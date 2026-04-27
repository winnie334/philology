'use client';

import React, {useState, useEffect, useRef, memo} from 'react';
import {useParams, useRouter} from 'next/navigation';
import {useLiveQuery} from 'dexie-react-hooks';
import {Document, Page, pdfjs} from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {db} from '@/lib/db';

if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const ArrowLeftIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
         strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"/>
        <polyline points="12 19 5 12 12 5"/>
    </svg>
);
const PencilIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
         strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
);
const TrashIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    </svg>
);
const CheckIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
         strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
    </svg>
);
const XIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
         strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
);

function SparklesIcon({className = ""}: { className?: string }) {
    return <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path
            d="m12 3-1.9 5.8a2 2 0 0 1-1.2 1.2L3 12l5.8 1.9a2 2 0 0 1 1.2 1.2L12 21l1.9-5.8a2 2 0 0 1 1.2-1.2L21 12l-5.8-1.9a2 2 0 0 1-1.2-1.2L12 3Z"/>
    </svg>;
}

function ChevronDownIcon({className = ""}: { className?: string }) {
    return <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 9 6 6 6-6"/>
    </svg>;
}

// ─── Sentence Row (Memoized to prevent flickering on DB Save) ─────────────────
const SentenceRow = memo(({
                              text, idx, isActive, onSave, onDelete, onHover, onZoomRequest
                          }: {
    text: string; idx: number; isActive: boolean; onSave: (val: string) => void; onDelete: () => void;
    onHover: (active: boolean) => void; onZoomRequest: () => void;
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(text);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) inputRef.current?.focus();
    }, [isEditing]);

    const handleCommit = (e?: React.MouseEvent | React.KeyboardEvent) => {
        e?.stopPropagation();
        onSave(draft);
        setIsEditing(false);
    };

    const handleCancel = (e: React.MouseEvent) => {
        e.stopPropagation();
        setDraft(text);
        setIsEditing(false);
    };

    const highlightAbbr = (val: string) => {
        const parts = val.split(/(<abbr>.*?<\/abbr>)/g);
        return parts.map((part, i) => {
            if (part.startsWith('<abbr>') && part.endsWith('</abbr>')) {
                const inner = part.replace(/<\/?abbr>/g, '');
                return <span key={i}
                             className="bg-accent/15 text-accent-dark px-1 rounded border-b border-accent/40 font-semibold">{inner}</span>;
            }
            return <span key={i}>{part}</span>;
        });
    };

    return (
        <div
            className={`group flex items-start gap-3 py-2.5 px-4 border-b border-border/20 transition-all cursor-pointer ${isActive ? 'bg-accent/10 border-l-4 border-accent' : 'border-l-4 border-transparent hover:bg-black/[0.02]'}`}
            onMouseEnter={() => onHover(true)}
            onMouseLeave={() => onHover(false)}
            onClick={() => !isEditing && onZoomRequest()}
        >
            <span className="w-5 text-[9px] text-muted/40 font-mono mt-1.5">{idx + 1}</span>
            {isEditing ? (
                <div className="flex-1 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <input
                        ref={inputRef}
                        className="flex-1 bg-white border border-accent/50 rounded px-2 py-1 text-sm font-lora outline-none shadow-sm"
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleCommit(e);
                            if (e.key === 'Escape') setIsEditing(false);
                        }}
                    />
                    <button onClick={handleCommit}
                            className="p-1.5 bg-accent text-white rounded hover:bg-accent-dark shadow-sm transition-colors">
                        <CheckIcon/></button>
                    <button onClick={handleCancel}
                            className="p-1.5 bg-white border border-border text-muted rounded hover:text-ink shadow-sm transition-colors">
                        <XIcon/></button>
                </div>
            ) : (
                <div className="flex-1 flex items-start justify-between gap-4">
                    <p className="text-[14px] font-lora text-ink leading-relaxed">{highlightAbbr(text)}</p>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={(e) => {
                            e.stopPropagation();
                            setIsEditing(true);
                        }} className="p-1 text-muted hover:text-accent">
                            <PencilIcon/></button>
                        <button onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this line?")) onDelete();
                        }} className="p-1 text-muted hover:text-red-500">
                            <TrashIcon/></button>
                    </div>
                </div>
            )}
        </div>
    );
});
SentenceRow.displayName = 'SentenceRow';

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DocumentViewer() {
    const params = useParams();
    const router = useRouter();
    const id = parseInt(params.id as string, 10);

    const doc = useLiveQuery(() => db.documents.get(id), [id]);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [pdfWidth, setPdfWidth] = useState(550);
    const [numPages, setNumPages] = useState(0);

    const [hoveredContext, setHoveredContext] = useState<{ pIdx: number, lIdx: number } | null>(null);
    const [zoomConfig, setZoomConfig] = useState<{
        pIdx: number,
        lIdx: number,
        x: number,
        y: number,
        scale: number
    } | null>(null);
    const [isTransforming, setIsTransforming] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const [pdfDocProxy, setPdfDocProxy] = useState<any>(null);

    useEffect(() => {
        if (doc?.data) {
            const url = URL.createObjectURL(doc.data);
            setPdfUrl(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [doc?.data]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => setPdfWidth(Math.floor(entry.contentRect.width * 0.48)));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const parseLines = (textData?: string) => {
        try {
            const parsed = JSON.parse(textData || '[]');
            return Array.isArray(parsed) ? (parsed as any[]) : [];
        } catch {
            return [];
        }
    };

    const handleSaveLine = async (pIdx: number, lIdx: number, newText: string) => {
        if (!doc) return;
        const trans = [...(doc.transcriptions ?? [])];
        const lines = parseLines(trans[pIdx]);
        if (lines[lIdx]) {
            lines[lIdx].text = newText;
            trans[pIdx] = JSON.stringify(lines);
            await db.documents.update(id, {transcriptions: trans});
        }
    };

    const handleDeleteLine = async (pIdx: number, lIdx: number) => {
        if (!doc) return;
        const trans = [...(doc.transcriptions ?? [])];
        const lines = parseLines(trans[pIdx]);
        lines.splice(lIdx, 1);
        trans[pIdx] = JSON.stringify(lines);
        await db.documents.update(id, {transcriptions: trans});
    };

    const handleDeleteAllOnPage = async (pIdx: number) => {
        if (!doc || !confirm("Clear entire transcription for this page?")) return;
        const trans = [...(doc.transcriptions ?? [])];
        trans[pIdx] = "[]";
        await db.documents.update(id, {transcriptions: trans});
    };

    const toggleZoom = (pIdx: number, lIdx: number, box: number[]) => {
        if (zoomConfig?.pIdx === pIdx && zoomConfig?.lIdx === lIdx) {
            setZoomConfig(null);
            return;
        }

        setIsTransforming(true);
        const boxH = (box[2] - box[0]) / 10;
        const boxW = (box[3] - box[1]) / 10;

        const isSuspicious = boxW > 85 || boxH > 20;
        let calculatedScale = Math.min(2.8, Math.max(1.6, 85 / boxW));
        if (isSuspicious) calculatedScale = 1.8;

        const centerX = (box[1] + box[3]) / 20;
        const centerY = (box[0] + box[2]) / 20;

        setZoomConfig({
            pIdx, lIdx,
            x: centerX - (50 / calculatedScale),
            y: centerY - (30 / calculatedScale),
            scale: calculatedScale
        });

        setTimeout(() => setIsTransforming(false), 500);
    };

    const processTranscriptionQueue = async () => {
        if (!pdfDocProxy || !doc?.id) return;
        if (startPage < 1 || endPage > numPages || startPage > endPage) {
            alert("Invalid page range.");
            return;
        }

        setIsPopoverOpen(false);

        for (let currentPage = startPage; currentPage <= endPage; currentPage++) {
            setTranscribingPageIndex(currentPage - 1);

            try {
                const page = await pdfDocProxy.getPage(currentPage);

                // --- THE CLEVER RESOLUTION MATH ---
                const baseViewport = page.getViewport({scale: 1.0});
                // AI vision models and LayoutParser perform best when the longest edge is ~2000-2500px.
                const targetWidth = 2200;
                // Dynamically calculate the scale, but cap it at 5.0 so Safari/Chrome don't crash from memory limits
                const dynamicScale = Math.min(targetWidth / baseViewport.width, 5.0);

                const viewport = page.getViewport({scale: dynamicScale});
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                // Pre-processing: Sharp contrast helps the AI see faded ink
                if (ctx) ctx.filter = 'grayscale(100%) contrast(150%)';

                await page.render({canvasContext: ctx, viewport}).promise;

                // --- THE CLEVER PAYLOAD MATH ---
                // Switch to JPEG with 95% quality.
                // This preserves text sharpness but reduces the payload size from ~15MB to ~2MB.
                const base64Data = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];

                const res = await fetch('/api/transcribe', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    // Make sure to tell your Python server this is a JPEG now
                    body: JSON.stringify({base64Image: base64Data, mimeType: 'image/jpeg'})
                });

                if (!res.ok) throw new Error("API Route Failed");
                const resultData = await res.json();

                const currentDoc = await db.documents.get(doc.id);
                const updated = [...(currentDoc?.transcriptions || [])];
                while (updated.length < currentPage) updated.push('');
                updated[currentPage - 1] = JSON.stringify(resultData.lines);
                await db.documents.update(doc.id, {transcriptions: updated});

            } catch (err) {
                console.error(`Failed on page ${currentPage}:`, err);
            }
        }
        setTranscribingPageIndex(null);
    };

    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [startPage, setStartPage] = useState(1);
    const [endPage, setEndPage] = useState(1);
    const [transcribingPageIndex, setTranscribingPageIndex] = useState<number | null>(null);

    if (!doc) return null;

    const isTranscribingAny = transcribingPageIndex !== null;
    const displayName = doc.name.replace(/\.pdf$/i, '');

    return (
        <div className="h-screen flex flex-col bg-[#F8F7F4] overflow-hidden font-lora">
            <header className="sticky top-0 z-20 border-b border-border/50 bg-parchment/90 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-8 py-4 flex items-center gap-5">
                    <button onClick={() => router.push('/')}
                            className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors font-lora shrink-0">
                        <ArrowLeftIcon/> Archive
                    </button>
                    <div className="w-px h-4 bg-border shrink-0"/>
                    <h1 className="font-playfair text-xl text-ink truncate leading-snug flex-1">{displayName}</h1>

                    <div className="relative">
                        <button
                            onClick={() => setIsPopoverOpen(!isPopoverOpen)}
                            disabled={isTranscribingAny || numPages === 0}
                            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${isTranscribingAny ? 'bg-amber-100 text-amber-700 cursor-not-allowed' : 'bg-accent/10 text-accent hover:bg-accent hover:text-white border border-accent/20'}`}
                        >
                            <SparklesIcon className={isTranscribingAny ? "animate-pulse" : ""}/>
                            {isTranscribingAny ? `Transcribing Page ${transcribingPageIndex + 1}...` : "AI Transcribe"}
                            {!isTranscribingAny && <ChevronDownIcon className="opacity-70"/>}
                        </button>

                        {isPopoverOpen && (
                            <div
                                className="absolute right-0 mt-2 w-64 bg-white border border-border shadow-lg rounded-lg p-4 z-50">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-playfair font-semibold text-ink text-sm">Select Range</h3>
                                    <button onClick={() => setIsPopoverOpen(false)}
                                            className="text-muted hover:text-ink"><XIcon/></button>
                                </div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="flex-1">
                                        <label
                                            className="block text-[10px] uppercase text-muted mb-1 font-semibold">From</label>
                                        <input type="number" min={1} max={numPages} value={startPage}
                                               onChange={(e) => setStartPage(Number(e.target.value))}
                                               className="w-full text-sm border rounded px-2 py-1"/>
                                    </div>
                                    <span className="text-muted mt-4">-</span>
                                    <div className="flex-1">
                                        <label
                                            className="block text-[10px] uppercase text-muted mb-1 font-semibold">To</label>
                                        <input type="number" min={1} max={numPages} value={endPage}
                                               onChange={(e) => setEndPage(Number(e.target.value))}
                                               className="w-full text-sm border rounded px-2 py-1"/>
                                    </div>
                                </div>
                                <button onClick={processTranscriptionQueue}
                                        className="w-full bg-accent text-white py-2 rounded-md text-sm hover:bg-accent/90 shadow-sm">Start
                                    Processing
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto custom-scrollbar" ref={containerRef}>
                <div className="max-w-[1700px] mx-auto p-10 space-y-24">
                    <Document file={pdfUrl} onLoadSuccess={(pdf) => {
                        setNumPages(pdf.numPages);
                        setPdfDocProxy(pdf);
                    }}>
                        {Array.from({length: numPages}).map((_, i) => {
                            const lines = parseLines(doc.transcriptions?.[i]);
                            const isPageZoomed = zoomConfig?.pIdx === i;

                            return (
                                <div key={i} className="flex gap-12 items-start h-[780px]">
                                    <div className="shrink-0 flex flex-col">
                                        <span className="text-[10px] font-bold text-muted/40 mb-2">FOLIO {i + 1}</span>
                                        <div
                                            className="relative bg-white rounded-xl shadow-2xl border border-border/20 overflow-hidden"
                                            style={{width: pdfWidth, height: '720px'}}>
                                            <div
                                                className={`transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)] origin-top-left ${isTransforming ? 'pointer-events-none' : ''}`}
                                                style={{transform: isPageZoomed ? `scale(${zoomConfig.scale}) translate(${-zoomConfig.x}%, ${-zoomConfig.y}%)` : 'scale(1) translate(0,0)'}}
                                            >
                                                <Page pageNumber={i + 1} width={pdfWidth} scale={isPageZoomed ? 2 : 1}
                                                      renderTextLayer={false} renderAnnotationLayer={false}/>
                                                {lines.map((line, idx) => line.box_2d && (
                                                    <div
                                                        key={idx}
                                                        onClick={() => toggleZoom(i, idx, line.box_2d)}
                                                        onMouseEnter={() => !isTransforming && setHoveredContext({
                                                            pIdx: i,
                                                            lIdx: idx
                                                        })}
                                                        onMouseLeave={() => setHoveredContext(null)}
                                                        className={`absolute cursor-pointer transition-all ${hoveredContext?.pIdx === i && hoveredContext?.lIdx === idx ? 'bg-accent/15 ring-2 ring-accent/60' : ''}`}
                                                        style={{
                                                            top: `${line.box_2d[0] / 10}%`,
                                                            left: `${line.box_2d[1] / 10}%`,
                                                            height: `${(line.box_2d[2] - line.box_2d[0]) / 10}%`,
                                                            width: `${(line.box_2d[3] - line.box_2d[1]) / 10}%`
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            {isPageZoomed && (
                                                <button onClick={() => setZoomConfig(null)}
                                                        className="absolute bottom-6 right-6 bg-black/70 text-white px-4 py-2 rounded-full text-[10px] font-bold backdrop-blur-md shadow-xl hover:bg-black transition-all">RESET
                                                    VIEW</button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 flex flex-col h-[720px] mt-6">
                                        <div className="flex items-center justify-between mb-2">
                                            <span
                                                className="text-[10px] font-bold text-muted/40 uppercase">Transcription</span>
                                            {lines.length > 0 && (
                                                <button onClick={() => handleDeleteAllOnPage(i)}
                                                        className="text-[10px] text-muted hover:text-red-500 font-bold flex items-center gap-1 transition-colors">
                                                    <TrashIcon/> CLEAR TRANSCRIPT
                                                </button>
                                            )}
                                        </div>
                                        <div
                                            className="bg-white rounded-xl border border-border/30 shadow-sm flex flex-col flex-1 overflow-hidden">
                                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                                {lines.map((line, idx) => (
                                                    <SentenceRow
                                                        key={line.id ?? `${i}-${idx}`}
                                                        text={line.text}
                                                        idx={idx}
                                                        isActive={hoveredContext?.pIdx === i && hoveredContext?.lIdx === idx}
                                                        onHover={active => !isTransforming && setHoveredContext(active ? {
                                                            pIdx: i,
                                                            lIdx: idx
                                                        } : null)}
                                                        onSave={val => handleSaveLine(i, idx, val)}
                                                        onDelete={() => handleDeleteLine(i, idx)}
                                                        onZoomRequest={() => line.box_2d && toggleZoom(i, idx, line.box_2d)}
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
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 5px;
                    height: 5px;
                }

                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #E5E5E1;
                    border-radius: 10px;
                }
            `}</style>
        </div>
    );
}