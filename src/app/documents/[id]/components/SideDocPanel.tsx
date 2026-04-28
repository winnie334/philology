'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { AppDocument } from '@/lib/db';
import { parseLines, globalToLocal, TranscriptionLine } from '../lib/lineUtils';
import SentenceRow from './SentenceRow';
import { XIcon } from './Icons';

if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

export interface HoverContext { pIdx: number; lIdx: number; }

interface SideDocPanelProps {
    doc: AppDocument;
    /** Global line index in the side doc — scroll target on open */
    initialScrollGlobal: number;
    /** External scroll command from a click in the main panel */
    scrollToGlobal: number | null;
    /** Dynamic amber highlight driven by the main panel's hover */
    externalHighlight: HoverContext | null;
    /** Reports internal hover so parent can sync to main panel */
    onHover: (ctx: HoverContext | null) => void;
    /** Fired when user clicks a row — parent scrolls main panel to mapped line */
    onLineClick: (pIdx: number, lIdx: number) => void;
    onClose: () => void;
}

export default function SideDocPanel({
                                         doc,
                                         initialScrollGlobal,
                                         scrollToGlobal,
                                         externalHighlight,
                                         onHover,
                                         onLineClick,
                                         onClose,
                                     }: SideDocPanelProps) {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [numPages, setNumPages] = useState(0);
    const [pdfLoaded, setPdfLoaded] = useState(false);
    const [sidePdfWidth, setSidePdfWidth] = useState(240);
    const [internalHover, setInternalHover] = useState<HoverContext | null>(null);

    const panelRef = useRef<HTMLDivElement>(null);
    const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

    // ── Object URL ──────────────────────────────────────────────────────────────
    useEffect(() => {
        const url = URL.createObjectURL(doc.data);
        setPdfUrl(url);
        setPdfLoaded(false);
        setNumPages(0);
        return () => URL.revokeObjectURL(url);
    }, [doc.data]);

    // ── Responsive PDF width ────────────────────────────────────────────────────
    useEffect(() => {
        const el = panelRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => {
            setSidePdfWidth(Math.max(160, Math.floor(entry.contentRect.width * 0.38)));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // ── Scroll helpers ──────────────────────────────────────────────────────────
    const scrollToGlobalLine = useCallback(
        (globalIdx: number) => {
            const target = globalToLocal(doc.transcriptions ?? [], globalIdx);
            // First snap the page container into view, then refine to the exact row.
            // Two-step with a gap lets the browser lay out the page heights first.
            pageRefs.current[target.pIdx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => {
                rowRefs.current[`${target.pIdx}-${target.lIdx}`]?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                });
            }, 350);
        },
        [doc.transcriptions]
    );

    // Scroll once when the PDF finishes loading
    useEffect(() => {
        if (!pdfLoaded || numPages === 0) return;
        // Slight delay so react-pdf finishes its canvas renders and all row DOM nodes settle
        const t = setTimeout(() => scrollToGlobalLine(initialScrollGlobal), 200);
        return () => clearTimeout(t);
        // intentionally only re-fires when the PDF itself reloads (pdfLoaded toggles)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pdfLoaded, numPages]);

    // External scroll command (main-panel click → scroll side panel)
    useEffect(() => {
        if (scrollToGlobal === null || scrollToGlobal === undefined || !pdfLoaded) return;
        scrollToGlobalLine(scrollToGlobal);
    }, [scrollToGlobal, pdfLoaded, scrollToGlobalLine]);

    // ── Hover ───────────────────────────────────────────────────────────────────
    const handleHover = useCallback(
        (ctx: HoverContext | null) => { setInternalHover(ctx); onHover(ctx); },
        [onHover]
    );

    const displayName = doc.name.replace(/\.pdf$/i, '');
    // Compute fixed row height from current PDF width (A4 aspect ratio)
    const pdfH = Math.floor(sidePdfWidth * 1.414);

    return (
        <div ref={panelRef} className="flex-1 flex flex-col overflow-hidden border-l border-border/50 bg-[#F3F1EC]">

            {/* ── Header ── */}
            <div className="shrink-0 sticky top-0 z-10 bg-[#F3F1EC]/95 backdrop-blur-md border-b border-border/40 px-5 py-3 flex items-center justify-between">
                <div className="min-w-0">
                    <p className="font-playfair text-[15px] font-semibold text-ink truncate leading-tight">{displayName}</p>
                    <p className="text-[10px] text-muted font-lora uppercase tracking-[0.16em] mt-0.5">Parallel view</p>
                </div>
                <button onClick={onClose} className="shrink-0 ml-3 p-2 rounded-lg text-muted hover:text-ink hover:bg-border/60 transition-all" title="Close parallel view">
                    <XIcon />
                </button>
            </div>

            {/* ── Scrollable content ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-8 space-y-20">
                {pdfUrl && (
                    <Document
                        file={pdfUrl}
                        onLoadSuccess={({ numPages: n }) => { setNumPages(n); setPdfLoaded(true); }}
                        loading={<div className="flex items-center justify-center py-24"><div className="w-6 h-6 border-2 border-border border-t-accent rounded-full animate-spin" /></div>}
                        error={<p className="text-center text-sm font-lora text-danger py-12">Could not load this PDF.</p>}
                    >
                        {Array.from({ length: numPages }).map((_, i) => {
                            const lines = parseLines(doc.transcriptions?.[i]);
                            const pageIsHighlighted = externalHighlight?.pIdx === i;

                            return (
                                <div
                                    key={i}
                                    ref={el => { pageRefs.current[i] = el; }}
                                    className="flex gap-5 items-start"
                                    style={{ height: pdfH + 36 }}  /* 36 = label height */
                                >
                                    {/* ── Transcription — LEFT (mirrored) ── */}
                                    <div className="flex-1 flex flex-col min-w-0" style={{ height: pdfH + 36 }}>
                    <span className="text-[9px] font-bold text-muted/40 uppercase font-lora tracking-widest mb-2 shrink-0">
                      Folio {i + 1}
                    </span>
                                        <div className={`flex-1 bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden transition-all duration-300 ${
                                            pageIsHighlighted ? 'border-amber-300/70 shadow-[0_2px_12px_rgba(251,191,36,0.10)]' : 'border-border/30'
                                        }`}>
                                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                                {lines.length === 0 ? (
                                                    <div className="px-4 py-6 text-center text-xs text-muted/50 font-lora italic">No transcription for this page.</div>
                                                ) : (
                                                    lines.map((line: TranscriptionLine, idx: number) => (
                                                        <SentenceRow
                                                            ref={el => { rowRefs.current[`${i}-${idx}`] = el; }}
                                                            key={idx}
                                                            text={line.text}
                                                            idx={idx}
                                                            readOnly
                                                            isActive={internalHover?.pIdx === i && internalHover?.lIdx === idx}
                                                            isExternalHighlight={!!(externalHighlight?.pIdx === i && externalHighlight?.lIdx === idx)}
                                                            onHover={active => handleHover(active ? { pIdx: i, lIdx: idx } : null)}
                                                            onZoomRequest={() => onLineClick(i, idx)}
                                                            onMapRequest={() => {}}
                                                            onSave={() => {}}
                                                            onDelete={() => {}}
                                                        />
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── PDF — RIGHT (mirrored) ── */}
                                    <div className="shrink-0 flex flex-col" style={{ width: sidePdfWidth }}>
                                        {/* Spacer to align with the transcription label */}
                                        <div className="mb-2" style={{ height: 20 }} />
                                        <div className={`relative bg-white rounded-xl overflow-hidden shadow-lg border transition-all duration-300 ${
                                            pageIsHighlighted
                                                ? 'border-amber-400/50 shadow-[0_4px_20px_rgba(251,191,36,0.14)]'
                                                : 'border-border/20'
                                        }`} style={{ height: pdfH }}>
                                            <Page
                                                pageNumber={i + 1}
                                                width={sidePdfWidth}
                                                renderTextLayer={false}
                                                renderAnnotationLayer={false}
                                                loading={<div className="bg-paper/80 animate-pulse" style={{ width: sidePdfWidth, height: pdfH }} />}
                                            />

                                            {/* Bounding-box overlays — interactive */}
                                            {lines.map((line: TranscriptionLine, idx: number) => {
                                                if (!line.box_2d) return null;
                                                const isLocalHov = internalHover?.pIdx === i && internalHover?.lIdx === idx;
                                                const isExtHov = externalHighlight?.pIdx === i && externalHighlight?.lIdx === idx;
                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`absolute cursor-pointer transition-all duration-150 ${
                                                            isLocalHov ? 'bg-accent/20 ring-2 ring-accent/70'
                                                                : isExtHov ? 'bg-amber-300/25 ring-2 ring-amber-500/70'
                                                                    : 'hover:bg-accent/10'
                                                        }`}
                                                        style={{
                                                            top: `${line.box_2d[0] / 10}%`,
                                                            left: `${line.box_2d[1] / 10}%`,
                                                            height: `${(line.box_2d[2] - line.box_2d[0]) / 10}%`,
                                                            width: `${(line.box_2d[3] - line.box_2d[1]) / 10}%`,
                                                        }}
                                                        onMouseEnter={() => handleHover({ pIdx: i, lIdx: idx })}
                                                        onMouseLeave={() => handleHover(null)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </Document>
                )}
            </div>
        </div>
    );
}