'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { db, AppDocument, AppMapping } from '@/lib/db';
import {
    parseLines,
    localToGlobal,
    globalToLocal,
    findNearestMappedLine,
} from './lib/lineUtils';
import SentenceRow from './components/SentenceRow';
import MappingSelector from './components/MappingSelector';
import SideDocPanel, { HoverContext } from './components/SideDocPanel';
import AiTranscribePopover from './components/AiTranscribePopover';
import {
    ArrowLeftIcon, SparklesIcon, ChevronDownIcon, TrashIcon, XIcon,
} from './components/Icons';

if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc =
        `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SidePanelState {
    doc: AppDocument;
    mapping: AppMapping;
    initialScrollGlobal: number;
}

interface MappingPopoverState {
    globalLineIdx: number;
    rect: DOMRect;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DocumentViewer() {
    const params = useParams();
    const router = useRouter();
    const id = parseInt(params.id as string, 10);

    const doc = useLiveQuery(() => db.documents.get(id), [id]);
    const allMappings = useLiveQuery(() => db.mappings.toArray(), []);
    const allDocuments = useLiveQuery(() => db.documents.toArray(), []);

    // ── PDF state ──────────────────────────────────────────────────────────────
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [pdfWidth, setPdfWidth] = useState(550);
    const [numPages, setNumPages] = useState(0);
    const [pdfDocProxy, setPdfDocProxy] = useState<any>(null);

    // ── Hover state — separate for main and side panels ────────────────────────
    const [mainHover, setMainHover] = useState<HoverContext | null>(null);
    const [sideHover, setSideHover] = useState<HoverContext | null>(null);

    // ── Zoom ───────────────────────────────────────────────────────────────────
    const [zoomConfig, setZoomConfig] = useState<{
        pIdx: number; lIdx: number; x: number; y: number; scale: number;
    } | null>(null);
    const [isTransforming, setIsTransforming] = useState(false);

    // ── Mapping / side-panel state ─────────────────────────────────────────────
    const [mappingPopover, setMappingPopover] = useState<MappingPopoverState | null>(null);
    const [sidePanel, setSidePanel] = useState<SidePanelState | null>(null);
    /** A number set here tells SideDocPanel to scroll to that global line */
    const [sidePanelScrollTarget, setSidePanelScrollTarget] = useState<number | null>(null);

    // ── AI Transcribe ──────────────────────────────────────────────────────────
    const [isTranscribePopoverOpen, setIsTranscribePopoverOpen] = useState(false);
    const [startPage, setStartPage] = useState(1);
    const [endPage, setEndPage] = useState(1);
    const [transcribingPageIndex, setTranscribingPageIndex] = useState<number | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const sentenceRefs = useRef<Record<string, HTMLDivElement | null>>({});

    // ── Effects ────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!doc?.data) return;
        const url = URL.createObjectURL(doc.data);
        setPdfUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [doc?.data]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => {
            setPdfWidth(Math.floor(entry.contentRect.width * 0.48));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // When a PDF box is hovered, scroll the matching transcription row into view
    useEffect(() => {
        if (!mainHover) return;
        sentenceRefs.current[`${mainHover.pIdx}-${mainHover.lIdx}`]
            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [mainHover]);

    // ── Cross-panel computed highlights ────────────────────────────────────────

    /** Hovering a main-panel line → which line in the side doc corresponds? */
    const sideExternalHighlight = useMemo<HoverContext | null>(() => {
        if (!sidePanel || !mainHover || !doc?.transcriptions) return null;
        const isDocA = sidePanel.mapping.docAId === id;
        const map = isDocA ? sidePanel.mapping.mapAtoB : sidePanel.mapping.mapBtoA;
        const globalLine = localToGlobal(doc.transcriptions, mainHover.pIdx, mainHover.lIdx);
        const mappedGlobal = findNearestMappedLine(map, globalLine);
        return globalToLocal(sidePanel.doc.transcriptions, mappedGlobal);
    }, [sidePanel, mainHover, doc?.transcriptions, id]);

    /** Hovering a side-panel line → which line in the main doc corresponds? */
    const mainExternalHighlight = useMemo<HoverContext | null>(() => {
        if (!sidePanel || !sideHover || !sidePanel.doc.transcriptions) return null;
        const isDocA = sidePanel.mapping.docAId === id;
        const map = isDocA ? sidePanel.mapping.mapBtoA : sidePanel.mapping.mapAtoB;
        const globalLine = localToGlobal(sidePanel.doc.transcriptions, sideHover.pIdx, sideHover.lIdx);
        const mappedGlobal = findNearestMappedLine(map, globalLine);
        return globalToLocal(doc!.transcriptions, mappedGlobal);
    }, [sidePanel, sideHover, doc?.transcriptions, id]);

    // ── Zoom ───────────────────────────────────────────────────────────────────

    const toggleZoom = useCallback((pIdx: number, lIdx: number, box: number[]) => {
        if (zoomConfig?.pIdx === pIdx && zoomConfig?.lIdx === lIdx) { setZoomConfig(null); return; }
        setIsTransforming(true);
        const boxH = (box[2] - box[0]) / 10;
        const boxW = (box[3] - box[1]) / 10;
        let scale = Math.min(2.8, Math.max(1.6, 85 / boxW));
        if (boxW > 85 || boxH > 20) scale = 1.8;
        const centerX = (box[1] + box[3]) / 20;
        const centerY = (box[0] + box[2]) / 20;
        setZoomConfig({ pIdx, lIdx, x: centerX - 50 / scale, y: centerY - 30 / scale, scale });
        setTimeout(() => setIsTransforming(false), 500);
    }, [zoomConfig]);

    // ── Transcription edits ────────────────────────────────────────────────────

    const handleSaveLine = async (pIdx: number, lIdx: number, newText: string) => {
        if (!doc) return;
        const trans = [...(doc.transcriptions ?? [])];
        const lines = parseLines(trans[pIdx]);
        if (lines[lIdx]) { lines[lIdx].text = newText; trans[pIdx] = JSON.stringify(lines); }
        await db.documents.update(id, { transcriptions: trans });
    };

    const handleDeleteLine = async (pIdx: number, lIdx: number) => {
        if (!doc) return;
        const trans = [...(doc.transcriptions ?? [])];
        const lines = parseLines(trans[pIdx]);
        lines.splice(lIdx, 1);
        trans[pIdx] = JSON.stringify(lines);
        await db.documents.update(id, { transcriptions: trans });
    };

    const handleDeleteAllOnPage = async (pIdx: number) => {
        if (!doc || !confirm('Clear entire transcription for this page?')) return;
        const trans = [...(doc.transcriptions ?? [])];
        trans[pIdx] = '[]';
        await db.documents.update(id, { transcriptions: trans });
    };

    // ── AI Transcription ───────────────────────────────────────────────────────

    const processTranscriptionQueue = async () => {
        if (!pdfDocProxy || !doc?.id) return;
        if (startPage < 1 || endPage > numPages || startPage > endPage) { alert('Invalid page range.'); return; }
        setIsTranscribePopoverOpen(false);
        for (let currentPage = startPage; currentPage <= endPage; currentPage++) {
            setTranscribingPageIndex(currentPage - 1);
            try {
                const page = await pdfDocProxy.getPage(currentPage);
                const baseViewport = page.getViewport({ scale: 1.0 });
                const dynamicScale = Math.min(2200 / baseViewport.width, 5.0);
                const viewport = page.getViewport({ scale: dynamicScale });
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d')!;
                canvas.width = viewport.width; canvas.height = viewport.height;
                await page.render({ canvasContext: ctx, viewport }).promise;
                const filtered = document.createElement('canvas');
                const fctx = filtered.getContext('2d')!;
                filtered.width = canvas.width; filtered.height = canvas.height;
                fctx.filter = 'grayscale(100%) contrast(150%)';
                fctx.drawImage(canvas, 0, 0);
                const base64Data = filtered.toDataURL('image/jpeg', 0.95).split(',')[1];
                const res = await fetch('/api/transcribe', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base64Image: base64Data, mimeType: 'image/jpeg' }),
                });
                if (!res.ok) throw new Error('API route failed');
                const resultData = await res.json();
                const currentDoc = await db.documents.get(doc.id);
                const updated = [...(currentDoc?.transcriptions || [])];
                while (updated.length < currentPage) updated.push('');
                updated[currentPage - 1] = JSON.stringify(resultData.lines);
                await db.documents.update(doc.id, { transcriptions: updated });
            } catch (err) {
                console.error(`Failed on page ${currentPage}:`, err);
            }
        }
        setTranscribingPageIndex(null);
    };

    // ── Click-to-scroll-other-panel handlers ──────────────────────────────────

    /**
     * User clicks a line in the MAIN panel while the side panel is open
     * → tell the side panel to scroll to the mapped line.
     */
    const handleMainLineClick = useCallback((pIdx: number, lIdx: number) => {
        if (!sidePanel || !doc?.transcriptions) return;
        const isDocA = sidePanel.mapping.docAId === id;
        const map = isDocA ? sidePanel.mapping.mapAtoB : sidePanel.mapping.mapBtoA;
        const globalLine = localToGlobal(doc.transcriptions, pIdx, lIdx);
        const mappedGlobal = findNearestMappedLine(map, globalLine);
        setSidePanelScrollTarget(mappedGlobal);
    }, [sidePanel, doc?.transcriptions, id]);

    /**
     * User clicks a line in the SIDE panel
     * → scroll the main panel's transcription to the mapped line.
     */
    const handleSideLineClick = useCallback((pIdx: number, lIdx: number) => {
        if (!sidePanel || !doc?.transcriptions) return;
        const isDocA = sidePanel.mapping.docAId === id;
        const map = isDocA ? sidePanel.mapping.mapBtoA : sidePanel.mapping.mapAtoB;
        const globalLine = localToGlobal(sidePanel.doc.transcriptions, pIdx, lIdx);
        const mappedGlobal = findNearestMappedLine(map, globalLine);
        const target = globalToLocal(doc.transcriptions, mappedGlobal);
        sentenceRefs.current[`${target.pIdx}-${target.lIdx}`]
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [sidePanel, doc?.transcriptions, id]);

    // ── Mapping ────────────────────────────────────────────────────────────────

    const openMappingSelector = useCallback((pIdx: number, lIdx: number, rect: DOMRect) => {
        setMappingPopover({ globalLineIdx: localToGlobal(doc?.transcriptions ?? [], pIdx, lIdx), rect });
    }, [doc?.transcriptions]);

    const selectMapping = useCallback(async (mapping: AppMapping) => {
        if (!mappingPopover || !doc?.id) return;
        const isDocA = mapping.docAId === doc.id;
        const otherDocId = isDocA ? mapping.docBId : mapping.docAId;
        const map = isDocA ? mapping.mapAtoB : mapping.mapBtoA;
        const mappedGlobal = findNearestMappedLine(map, mappingPopover.globalLineIdx);
        const otherDoc = await db.documents.get(otherDocId);
        if (!otherDoc) return;
        setSidePanelScrollTarget(null);            // reset any previous scroll command
        setSidePanel({ doc: otherDoc as AppDocument, mapping, initialScrollGlobal: mappedGlobal });
        setMappingPopover(null);
    }, [mappingPopover, doc?.id]);

    const closeSidePanel = useCallback(() => {
        setSidePanel(null); setSideHover(null); setSidePanelScrollTarget(null);
    }, []);

    // ── Render guard ───────────────────────────────────────────────────────────

    if (!doc) return null;

    const isTranscribingAny = transcribingPageIndex !== null;
    const displayName = doc.name.replace(/\.pdf$/i, '');

    return (
        <div className="h-screen flex flex-col bg-[#F8F7F4] overflow-hidden font-lora">

            {/* ── Header ── */}
            <header className="sticky top-0 z-20 border-b border-border/50 bg-parchment/90 backdrop-blur-md shrink-0">
                <div className="px-8 py-4 flex items-center gap-5">
                    <button onClick={() => router.push('/')}
                            className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors font-lora shrink-0">
                        <ArrowLeftIcon /> Archive
                    </button>
                    <div className="w-px h-4 bg-border shrink-0" />
                    <h1 className="font-playfair text-xl text-ink truncate leading-snug flex-1">{displayName}</h1>

                    {sidePanel && (
                        <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-accent font-lora tracking-wide">
                ↔ {sidePanel.doc.name.replace(/\.pdf$/i, '')}
              </span>
                            <button onClick={closeSidePanel}
                                    className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-border/60 transition-all">
                                <XIcon />
                            </button>
                        </div>
                    )}

                    <div className="relative shrink-0">
                        <button
                            onClick={() => setIsTranscribePopoverOpen(!isTranscribePopoverOpen)}
                            disabled={isTranscribingAny || numPages === 0}
                            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                                isTranscribingAny
                                    ? 'bg-amber-100 text-amber-700 cursor-not-allowed'
                                    : 'bg-accent/10 text-accent hover:bg-accent hover:text-white border border-accent/20'
                            }`}
                        >
                            <SparklesIcon className={isTranscribingAny ? 'animate-pulse' : ''} />
                            {isTranscribingAny ? `Transcribing Page ${transcribingPageIndex! + 1}…` : 'AI Transcribe'}
                            {!isTranscribingAny && <ChevronDownIcon className="opacity-70" />}
                        </button>

                        {isTranscribePopoverOpen && (
                            <AiTranscribePopover
                                numPages={numPages} startPage={startPage} endPage={endPage}
                                onStartChange={setStartPage} onEndChange={setEndPage}
                                onSubmit={processTranscriptionQueue}
                                onClose={() => setIsTranscribePopoverOpen(false)}
                            />
                        )}
                    </div>
                </div>
            </header>

            {/* ── Body ── */}
            <div className="flex-1 flex overflow-hidden">

                {/* ── Main panel ── */}
                <main
                    ref={containerRef}
                    className={`overflow-y-auto custom-scrollbar transition-[width] duration-300 ease-in-out ${sidePanel ? 'w-1/2' : 'w-full'}`}
                >
                    <div className="max-w-[1700px] mx-auto p-10 space-y-24">
                        <Document file={pdfUrl} onLoadSuccess={pdf => { setNumPages(pdf.numPages); setPdfDocProxy(pdf); }}>
                            {Array.from({ length: numPages }).map((_, i) => {
                                const lines = parseLines(doc.transcriptions?.[i]);
                                const isPageZoomed = zoomConfig?.pIdx === i;

                                return (
                                    <div key={i} className="flex gap-12 items-start h-[780px]">

                                        {/* PDF page */}
                                        <div className="shrink-0 flex flex-col">
                                            <span className="text-[10px] font-bold text-muted/40 mb-2 font-lora uppercase tracking-wider">Folio {i + 1}</span>
                                            <div
                                                className="relative bg-white rounded-xl shadow-2xl border border-border/20 overflow-hidden"
                                                style={{ width: pdfWidth, height: '720px' }}
                                            >
                                                <div
                                                    className={`transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)] origin-top-left ${isTransforming ? 'pointer-events-none' : ''}`}
                                                    style={{ transform: isPageZoomed ? `scale(${zoomConfig!.scale}) translate(${-zoomConfig!.x}%, ${-zoomConfig!.y}%)` : 'scale(1) translate(0,0)' }}
                                                >
                                                    <Page pageNumber={i + 1} width={pdfWidth} renderTextLayer={false} renderAnnotationLayer={false} />

                                                    {lines.map((line, idx) => {
                                                        if (!line.box_2d) return null;
                                                        const isLocalActive = mainHover?.pIdx === i && mainHover?.lIdx === idx;
                                                        const isExtActive = mainExternalHighlight?.pIdx === i && mainExternalHighlight?.lIdx === idx;
                                                        return (
                                                            <div
                                                                key={idx}
                                                                onClick={() => toggleZoom(i, idx, line.box_2d!)}
                                                                onMouseEnter={() => !isTransforming && setMainHover({ pIdx: i, lIdx: idx })}
                                                                onMouseLeave={() => setMainHover(null)}
                                                                className={`absolute cursor-pointer transition-all duration-150 ${
                                                                    isLocalActive ? 'bg-accent/15 ring-2 ring-accent/60'
                                                                        : isExtActive ? 'bg-amber-300/25 ring-2 ring-amber-500/70'
                                                                            : ''
                                                                }`}
                                                                style={{
                                                                    top: `${line.box_2d[0] / 10}%`, left: `${line.box_2d[1] / 10}%`,
                                                                    height: `${(line.box_2d[2] - line.box_2d[0]) / 10}%`,
                                                                    width: `${(line.box_2d[3] - line.box_2d[1]) / 10}%`,
                                                                }}
                                                            />
                                                        );
                                                    })}
                                                </div>

                                                {isPageZoomed && (
                                                    <button onClick={() => setZoomConfig(null)}
                                                            className="absolute bottom-6 right-6 bg-black/70 text-white px-4 py-2 rounded-full text-[10px] font-bold backdrop-blur-md shadow-xl hover:bg-black transition-all">
                                                        RESET VIEW
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Transcription panel */}
                                        <div className="flex-1 flex flex-col h-[720px] mt-6">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-bold text-muted/40 uppercase font-lora tracking-wider">Transcription</span>
                                                {lines.length > 0 && (
                                                    <button onClick={() => handleDeleteAllOnPage(i)}
                                                            className="text-[10px] text-muted hover:text-red-500 font-bold flex items-center gap-1 transition-colors font-lora">
                                                        <TrashIcon /> CLEAR
                                                    </button>
                                                )}
                                            </div>
                                            <div className="bg-white rounded-xl border border-border/30 shadow-sm flex flex-col flex-1 overflow-hidden">
                                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                                    {lines.map((line, idx) => (
                                                        <SentenceRow
                                                            ref={el => { sentenceRefs.current[`${i}-${idx}`] = el; }}
                                                            key={line.id ?? `${i}-${idx}`}
                                                            text={line.text}
                                                            idx={idx}
                                                            isActive={mainHover?.pIdx === i && mainHover?.lIdx === idx}
                                                            isExternalHighlight={!!(
                                                                mainExternalHighlight?.pIdx === i &&
                                                                mainExternalHighlight?.lIdx === idx
                                                            )}
                                                            onHover={active =>
                                                                !isTransforming && setMainHover(active ? { pIdx: i, lIdx: idx } : null)
                                                            }
                                                            onSave={val => handleSaveLine(i, idx, val)}
                                                            onDelete={() => handleDeleteLine(i, idx)}
                                                            onZoomRequest={() => {
                                                                if (line.box_2d) toggleZoom(i, idx, line.box_2d);
                                                                handleMainLineClick(i, idx);
                                                            }}
                                                            onMapRequest={rect => openMappingSelector(i, idx, rect)}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </Document>
                    </div>
                </main>

                {/* ── Side panel ── */}
                {sidePanel && (
                    <SideDocPanel
                        doc={sidePanel.doc}
                        initialScrollGlobal={sidePanel.initialScrollGlobal}
                        scrollToGlobal={sidePanelScrollTarget}
                        externalHighlight={sideExternalHighlight}
                        onHover={setSideHover}
                        onLineClick={handleSideLineClick}
                        onClose={closeSidePanel}
                    />
                )}
            </div>

            {/* ── Mapping popover ── */}
            {mappingPopover && (
                <MappingSelector
                    anchorRect={mappingPopover.rect}
                    currentDocId={id}
                    mappings={allMappings ?? []}
                    allDocs={allDocuments ?? []}
                    onSelect={selectMapping}
                    onClose={() => setMappingPopover(null)}
                />
            )}

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e5e1; border-radius: 10px; }
            `}</style>
        </div>
    );
}