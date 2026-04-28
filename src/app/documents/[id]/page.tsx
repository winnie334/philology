'use client';

import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { db, AppDocument, AppMapping } from '@/lib/db';

if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function parseLines(textData?: string): { text: string; box_2d?: number[]; id?: string }[] {
    try {
        const parsed = JSON.parse(textData || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
}

/** Flatten all pages to a global line index */
function localToGlobal(transcriptions: string[], pageIdx: number, lineIdx: number): number {
    let count = 0;
    for (let p = 0; p < pageIdx; p++) {
        count += parseLines(transcriptions?.[p]).length;
    }
    return count + lineIdx;
}

/** Convert a global line index back to (pageIdx, lineIdx) */
function globalToLocal(transcriptions: string[], globalIdx: number): { pageIdx: number; lineIdx: number } {
    let count = 0;
    for (let p = 0; p < (transcriptions?.length ?? 0); p++) {
        const len = parseLines(transcriptions[p]).length;
        if (count + len > globalIdx) return { pageIdx: p, lineIdx: globalIdx - count };
        count += len;
    }
    return { pageIdx: 0, lineIdx: 0 };
}

/** Nearest-neighbour fallback if exact key is missing */
function findNearestMappedLine(map: Record<string, number>, globalLine: number): number {
    if (String(globalLine) in map) return map[String(globalLine)];
    const keys = Object.keys(map).map(Number).sort((a, b) => a - b);
    if (keys.length === 0) return 0;
    let nearest = keys[0];
    let minDist = Math.abs(globalLine - nearest);
    for (const k of keys) {
        const d = Math.abs(globalLine - k);
        if (d < minDist) { minDist = d; nearest = k; }
    }
    return map[String(nearest)];
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const ArrowLeftIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
         strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
    </svg>
);
const PencilIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
         strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
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
         strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);
const XIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
         strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
);
const LinkIcon = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
         strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
);
function SparklesIcon({ className = '' }: { className?: string }) {
    return (
        <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.2 1.2L3 12l5.8 1.9a2 2 0 0 1 1.2 1.2L12 21l1.9-5.8a2 2 0 0 1 1.2-1.2L21 12l-5.8-1.9a2 2 0 0 1-1.2-1.2L12 3Z"/>
        </svg>
    );
}
function ChevronDownIcon({ className = '' }: { className?: string }) {
    return (
        <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
    );
}

// ─── Sentence Row ─────────────────────────────────────────────────────────────

const SentenceRow = memo(
    React.forwardRef<
HTMLDivElement,
{
    text: string;
    idx: number;
    isActive: boolean;
    isSourceHighlight: boolean;
    onSave: (val: string) => void;
    onDelete: () => void;
    onHover: (active: boolean) => void;
    onZoomRequest: () => void;
    onMapRequest: () => void;
}
>(({ text, idx, isActive, isSourceHighlight, onSave, onDelete, onHover, onZoomRequest, onMapRequest }, ref) => {
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(text);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { if (isEditing) inputRef.current?.focus(); }, [isEditing]);

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
                return (
                    <span key={i} className="bg-accent/15 text-accent px-1 rounded border-b border-accent/40 font-semibold">
              {inner}
            </span>
                );
            }
            return <span key={i}>{part}</span>;
        });
    };

    const rowClass = isActive
        ? 'bg-accent/10 border-l-4 border-accent'
        : isSourceHighlight
            ? 'bg-amber-50 border-l-4 border-amber-400/70'
            : 'border-l-4 border-transparent hover:bg-black/[0.02]';

    return (
        <div
            ref={ref}
            className={`group flex items-start gap-3 py-2.5 px-4 border-b border-border/20 transition-all cursor-pointer ${rowClass}`}
            onMouseEnter={() => onHover(true)}
            onMouseLeave={() => onHover(false)}
            onClick={() => !isEditing && onZoomRequest()}
        >
            <span className="w-5 text-[9px] text-muted/40 font-mono mt-1.5 shrink-0">{idx + 1}</span>
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
                            className="p-1.5 bg-accent text-white rounded hover:bg-accent/80 shadow-sm transition-colors">
                        <CheckIcon/>
                    </button>
                    <button onClick={handleCancel}
                            className="p-1.5 bg-white border border-border text-muted rounded hover:text-ink shadow-sm transition-colors">
                        <XIcon/>
                    </button>
                </div>
            ) : (
                <div className="flex-1 flex items-start justify-between gap-4">
                    <p className="text-[14px] font-lora text-ink leading-relaxed">{highlightAbbr(text)}</p>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                        <button
                            title="Compare in another manuscript"
                            onClick={e => { e.stopPropagation(); onMapRequest(); }}
                            className="p-1 text-muted hover:text-accent transition-colors"
                        >
                            <LinkIcon/>
                        </button>
                        <button
                            onClick={e => { e.stopPropagation(); setIsEditing(true); }}
                            className="p-1 text-muted hover:text-accent transition-colors"
                        >
                            <PencilIcon/>
                        </button>
                        <button
                            onClick={e => { e.stopPropagation(); if (confirm('Delete this line?')) onDelete(); }}
                            className="p-1 text-muted hover:text-red-500 transition-colors"
                        >
                            <TrashIcon/>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
})
);
SentenceRow.displayName = 'SentenceRow';

// ─── Mapping Selector Modal ───────────────────────────────────────────────────

function MappingSelector({
                             currentDocId,
                             mappings,
                             allDocs,
                             onSelect,
                             onClose,
                         }: {
    currentDocId: number;
    mappings: AppMapping[];
    allDocs: AppDocument[];
    onSelect: (mapping: AppMapping) => void;
    onClose: () => void;
}) {
    const relevant = mappings.filter(m => m.docAId === currentDocId || m.docBId === currentDocId);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
        >
            <div
                className="bg-paper rounded-2xl shadow-2xl border border-border w-80 p-6 animate-slide-up"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h3 className="font-playfair text-lg font-semibold text-ink">Compare Manuscripts</h3>
                        <p className="text-[11px] text-muted font-lora mt-0.5">Select a mapped manuscript to view side by side</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-muted hover:text-ink transition-colors rounded-lg">
                        <XIcon/>
                    </button>
                </div>

                {relevant.length === 0 ? (
                    <div className="py-6 text-center">
                        <div className="w-10 h-10 rounded-full bg-border/60 flex items-center justify-center mx-auto mb-3">
                            <LinkIcon/>
                        </div>
                        <p className="text-sm text-muted font-lora leading-relaxed">
                            No mappings available for this document.
                        </p>
                        <p className="text-xs text-muted/60 font-lora mt-1.5">
                            Create one from the archive using Begin Mapping.
                        </p>
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {relevant.map(mapping => {
                            const otherDocId = mapping.docAId === currentDocId ? mapping.docBId : mapping.docAId;
                            const otherDoc = allDocs.find(d => d.id === otherDocId);
                            const lineCount = Object.keys(mapping.mapAtoB).length;
                            return (
                                <li key={mapping.id}>
                                    <button
                                        onClick={() => onSelect(mapping)}
                                        className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-accent/50 hover:bg-accent/5 transition-all group"
                                    >
                                        <p className="font-lora text-sm font-medium text-ink group-hover:text-ink transition-colors">
                                            {otherDoc?.name.replace(/\.pdf$/i, '') ?? 'Unknown manuscript'}
                                        </p>
                                        <p className="text-[10px] text-muted font-lora mt-0.5">
                                            {lineCount} aligned lines
                                        </p>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}

// ─── Side Doc Panel ───────────────────────────────────────────────────────────

function SideDocPanel({
                          doc,
                          highlightGlobalLine,
                          onClose,
                      }: {
    doc: AppDocument;
    highlightGlobalLine: number;
    onClose: () => void;
}) {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [numPages, setNumPages] = useState(0);
    const [pdfLoaded, setPdfLoaded] = useState(false);
    const [sidePdfWidth, setSidePdfWidth] = useState(280);
    const panelRef = useRef<HTMLDivElement>(null);
    const pageRefs = useRef<{ [k: number]: HTMLDivElement | null }>({});
    const highlightedRowRef = useRef<HTMLDivElement | null>(null);

    const { pageIdx: targetPageIdx, lineIdx: targetLineIdx } = useMemo(
        () => globalToLocal(doc.transcriptions ?? [], highlightGlobalLine),
        [doc.transcriptions, highlightGlobalLine]
    );

    // Create object URL
    useEffect(() => {
        const url = URL.createObjectURL(doc.data);
        setPdfUrl(url);
        setPdfLoaded(false);
        return () => URL.revokeObjectURL(url);
    }, [doc.data]);

    // Resize observer for PDF width
    useEffect(() => {
        const el = panelRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => {
            setSidePdfWidth(Math.floor(entry.contentRect.width * 0.44));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Scroll to target page + line when PDF loads or target changes
    const scrollToTarget = useCallback(() => {
        const pageEl = pageRefs.current[targetPageIdx];
        if (pageEl) {
            pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setTimeout(() => {
            highlightedRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    }, [targetPageIdx]);

    useEffect(() => {
        if (pdfLoaded) scrollToTarget();
    }, [pdfLoaded, scrollToTarget]);

    // Re-scroll when target changes while panel is open
    useEffect(() => {
        if (pdfLoaded) scrollToTarget();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [highlightGlobalLine]);

    const displayName = doc.name.replace(/\.pdf$/i, '');

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-[#F5F4F1] border-l border-border/40" ref={panelRef}>
            {/* Side panel header */}
            <div className="shrink-0 sticky top-0 z-10 bg-[#F5F4F1]/95 backdrop-blur-md border-b border-border/40 px-5 py-3 flex items-center justify-between">
                <div className="min-w-0">
                    <p className="font-playfair text-[15px] font-semibold text-ink truncate leading-tight">{displayName}</p>
                    <p className="text-[10px] text-muted font-lora uppercase tracking-widest mt-0.5">Parallel view</p>
                </div>
                <button
                    onClick={onClose}
                    className="shrink-0 ml-3 p-2 rounded-lg text-muted hover:text-ink hover:bg-border/60 transition-all"
                    title="Close parallel view"
                >
                    <XIcon/>
                </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-16">
                {pdfUrl && (
                    <Document
                        file={pdfUrl}
                        onLoadSuccess={({ numPages: n }) => { setNumPages(n); setPdfLoaded(true); }}
                        loading={
                            <div className="flex items-center justify-center py-20">
                                <div className="w-6 h-6 border-2 border-border border-t-accent rounded-full animate-spin"/>
                            </div>
                        }
                    >
                        {Array.from({ length: numPages }).map((_, i) => {
                            const lines = parseLines(doc.transcriptions?.[i]);
                            return (
                                <div
                                    key={i}
                                    ref={el => { pageRefs.current[i] = el; }}
                                    className="flex gap-6 items-start"
                                >
                                    {/* Transcription — LEFT side in mirrored layout */}
                                    <div className="flex-1 min-w-0 pt-8">
                                        <div className="bg-white rounded-xl border border-border/30 shadow-sm overflow-hidden">
                                            {lines.length === 0 ? (
                                                <div className="px-4 py-6 text-center text-xs text-muted/60 font-lora italic">
                                                    No transcription for this page.
                                                </div>
                                            ) : (
                                                lines.map((line, idx) => {
                                                    const isHighlighted = i === targetPageIdx && idx === targetLineIdx;
                                                    return (
                                                        <div
                                                            key={idx}
                                                            ref={isHighlighted ? highlightedRowRef : undefined}
                                                            className={`flex gap-3 py-2.5 px-4 border-b border-border/20 transition-all ${
                                                                isHighlighted
                                                                    ? 'bg-amber-100/80 border-l-4 border-l-amber-500 shadow-[inset_0_0_0_1px_rgba(181,115,42,0.15)]'
                                                                    : 'border-l-4 border-l-transparent'
                                                            }`}
                                                        >
                                                            <span className="w-5 text-[9px] text-muted/40 font-mono mt-1.5 shrink-0">{idx + 1}</span>
                                                            <p className="text-[13px] font-lora text-ink leading-relaxed">{line.text}</p>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* PDF — RIGHT side in mirrored layout */}
                                    <div className="shrink-0" style={{ width: sidePdfWidth }}>
                    <span className="text-[9px] font-bold text-muted/40 font-lora uppercase tracking-wider block mb-2">
                      Folio {i + 1}
                    </span>
                                        <div
                                            className={`bg-white rounded-xl border overflow-hidden shadow-lg transition-all duration-300 ${
                                                i === targetPageIdx ? 'border-accent/40 shadow-accent/10' : 'border-border/20'
                                            }`}
                                        >
                                            <Page
                                                pageNumber={i + 1}
                                                width={sidePdfWidth}
                                                renderTextLayer={false}
                                                renderAnnotationLayer={false}
                                                loading={
                                                    <div
                                                        className="bg-paper/80 animate-pulse"
                                                        style={{ width: sidePdfWidth, height: Math.floor(sidePdfWidth * 1.4) }}
                                                    />
                                                }
                                            />
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

// ─── Main DocumentViewer ──────────────────────────────────────────────────────

export default function DocumentViewer() {
    const params = useParams();
    const router = useRouter();
    const id = parseInt(params.id as string, 10);

    const doc = useLiveQuery(() => db.documents.get(id), [id]);
    const allMappings = useLiveQuery(() => db.mappings.toArray(), []);
    const allDocuments = useLiveQuery(() => db.documents.toArray(), []);

    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [pdfWidth, setPdfWidth] = useState(550);
    const [numPages, setNumPages] = useState(0);

    const [hoveredContext, setHoveredContext] = useState<{ pIdx: number; lIdx: number } | null>(null);
    const [zoomConfig, setZoomConfig] = useState<{ pIdx: number; lIdx: number; x: number; y: number; scale: number } | null>(null);
    const [isTransforming, setIsTransforming] = useState(false);

    // Mapping state
    const [mappingSelector, setMappingSelector] = useState<{ globalLineIdx: number } | null>(null);
    const [sidePanel, setSidePanel] = useState<{
        doc: AppDocument;
        highlightGlobalLine: number; // in the side doc
        sourceGlobalLine: number;    // in the current doc, where user clicked
    } | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const [pdfDocProxy, setPdfDocProxy] = useState<any>(null);
    const sentenceRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [startPage, setStartPage] = useState(1);
    const [endPage, setEndPage] = useState(1);
    const [transcribingPageIndex, setTranscribingPageIndex] = useState<number | null>(null);

    // Build PDF URL
    useEffect(() => {
        if (!doc?.data) return;
        const url = URL.createObjectURL(doc.data);
        setPdfUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [doc?.data]);

    // Resize observer — on the left panel container, so it recalculates when side panel opens/closes
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => {
            setPdfWidth(Math.floor(entry.contentRect.width * 0.48));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Scroll transcription row into view on hover
    useEffect(() => {
        if (!hoveredContext) return;
        const key = `${hoveredContext.pIdx}-${hoveredContext.lIdx}`;
        sentenceRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [hoveredContext]);

    // ── Transcription editing ────────────────────────────────────────────────────

    const handleSaveLine = async (pIdx: number, lIdx: number, newText: string) => {
        if (!doc) return;
        const trans = [...(doc.transcriptions ?? [])];
        const lines = parseLines(trans[pIdx]);
        if (lines[lIdx]) {
            lines[lIdx].text = newText;
            trans[pIdx] = JSON.stringify(lines);
            await db.documents.update(id, { transcriptions: trans });
        }
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

    // ── Zoom / PDF overlay ───────────────────────────────────────────────────────

    const toggleZoom = (pIdx: number, lIdx: number, box: number[]) => {
        if (zoomConfig?.pIdx === pIdx && zoomConfig?.lIdx === lIdx) {
            setZoomConfig(null);
            return;
        }
        setIsTransforming(true);
        const boxH = (box[2] - box[0]) / 10;
        const boxW = (box[3] - box[1]) / 10;
        const isSuspicious = boxW > 85 || boxH > 20;
        let scale = Math.min(2.8, Math.max(1.6, 85 / boxW));
        if (isSuspicious) scale = 1.8;
        const centerX = (box[1] + box[3]) / 20;
        const centerY = (box[0] + box[2]) / 20;
        setZoomConfig({ pIdx, lIdx, x: centerX - 50 / scale, y: centerY - 30 / scale, scale });
        setTimeout(() => setIsTransforming(false), 500);
    };

    // ── AI Transcription queue ───────────────────────────────────────────────────

    const processTranscriptionQueue = async () => {
        if (!pdfDocProxy || !doc?.id) return;
        if (startPage < 1 || endPage > numPages || startPage > endPage) {
            alert('Invalid page range.');
            return;
        }
        setIsPopoverOpen(false);
        for (let currentPage = startPage; currentPage <= endPage; currentPage++) {
            setTranscribingPageIndex(currentPage - 1);
            try {
                const page = await pdfDocProxy.getPage(currentPage);
                const baseViewport = page.getViewport({ scale: 1.0 });
                const targetWidth = 2200;
                const dynamicScale = Math.min(targetWidth / baseViewport.width, 5.0);
                const viewport = page.getViewport({ scale: dynamicScale });
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d')!;
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({ canvasContext: ctx, viewport }).promise;
                const filteredCanvas = document.createElement('canvas');
                const fctx = filteredCanvas.getContext('2d')!;
                filteredCanvas.width = canvas.width;
                filteredCanvas.height = canvas.height;
                fctx.filter = 'grayscale(100%) contrast(150%)';
                fctx.drawImage(canvas, 0, 0);
                const base64Data = filteredCanvas.toDataURL('image/jpeg', 0.95).split(',')[1];
                const res = await fetch('/api/transcribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base64Image: base64Data, mimeType: 'image/jpeg' }),
                });
                if (!res.ok) throw new Error('API Route Failed');
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

    // ── Mapping handlers ─────────────────────────────────────────────────────────

    const openMappingSelector = useCallback((pIdx: number, lIdx: number) => {
        const globalLineIdx = localToGlobal(doc?.transcriptions ?? [], pIdx, lIdx);
        setMappingSelector({ globalLineIdx });
    }, [doc?.transcriptions]);

    const selectMapping = useCallback(async (mapping: AppMapping) => {
        if (!mappingSelector || !doc?.id) return;
        const isDocA = mapping.docAId === doc.id;
        const otherDocId = isDocA ? mapping.docBId : mapping.docAId;
        const map = isDocA ? mapping.mapAtoB : mapping.mapBtoA;
        const mappedGlobalLine = findNearestMappedLine(map, mappingSelector.globalLineIdx);
        const otherDoc = await db.documents.get(otherDocId);
        if (!otherDoc) return;
        setSidePanel({
            doc: otherDoc,
            highlightGlobalLine: mappedGlobalLine,
            sourceGlobalLine: mappingSelector.globalLineIdx,
        });
        setMappingSelector(null);
    }, [mappingSelector, doc?.id]);

    // ── Render guards ─────────────────────────────────────────────────────────────

    if (!doc) return null;

    const isTranscribingAny = transcribingPageIndex !== null;
    const displayName = doc.name.replace(/\.pdf$/i, '');

    return (
        <div className="h-screen flex flex-col bg-[#F8F7F4] overflow-hidden font-lora">

            {/* ── Header ── */}
            <header className="sticky top-0 z-20 border-b border-border/50 bg-parchment/90 backdrop-blur-md shrink-0">
                <div className="max-w-none px-8 py-4 flex items-center gap-5">
                    <button
                        onClick={() => router.push('/')}
                        className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors font-lora shrink-0"
                    >
                        <ArrowLeftIcon/> Archive
                    </button>
                    <div className="w-px h-4 bg-border shrink-0"/>
                    <h1 className="font-playfair text-xl text-ink truncate leading-snug flex-1">{displayName}</h1>

                    {/* Side panel indicator */}
                    {sidePanel && (
                        <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-accent font-lora tracking-wide">
                ↔ {sidePanel.doc.name.replace(/\.pdf$/i, '')}
              </span>
                            <button
                                onClick={() => setSidePanel(null)}
                                className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-border/60 transition-all"
                                title="Close parallel view"
                            >
                                <XIcon/>
                            </button>
                        </div>
                    )}

                    {/* AI Transcribe button */}
                    <div className="relative shrink-0">
                        <button
                            onClick={() => setIsPopoverOpen(!isPopoverOpen)}
                            disabled={isTranscribingAny || numPages === 0}
                            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                                isTranscribingAny
                                    ? 'bg-amber-100 text-amber-700 cursor-not-allowed'
                                    : 'bg-accent/10 text-accent hover:bg-accent hover:text-white border border-accent/20'
                            }`}
                        >
                            <SparklesIcon className={isTranscribingAny ? 'animate-pulse' : ''}/>
                            {isTranscribingAny ? `Transcribing Page ${transcribingPageIndex! + 1}…` : 'AI Transcribe'}
                            {!isTranscribingAny && <ChevronDownIcon className="opacity-70"/>}
                        </button>

                        {isPopoverOpen && (
                            <div className="absolute right-0 mt-2 w-64 bg-white border border-border shadow-lg rounded-lg p-4 z-50">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-playfair font-semibold text-ink text-sm">Select Range</h3>
                                    <button onClick={() => setIsPopoverOpen(false)} className="text-muted hover:text-ink"><XIcon/></button>
                                </div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="flex-1">
                                        <label className="block text-[10px] uppercase text-muted mb-1 font-semibold">From</label>
                                        <input type="number" min={1} max={numPages} value={startPage}
                                               onChange={e => setStartPage(Number(e.target.value))}
                                               className="w-full text-sm border rounded px-2 py-1"/>
                                    </div>
                                    <span className="text-muted mt-4">–</span>
                                    <div className="flex-1">
                                        <label className="block text-[10px] uppercase text-muted mb-1 font-semibold">To</label>
                                        <input type="number" min={1} max={numPages} value={endPage}
                                               onChange={e => setEndPage(Number(e.target.value))}
                                               className="w-full text-sm border rounded px-2 py-1"/>
                                    </div>
                                </div>
                                <button onClick={processTranscriptionQueue}
                                        className="w-full bg-accent text-white py-2 rounded-md text-sm hover:bg-accent/90 shadow-sm">
                                    Start Processing
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ── Body: left panel + optional side panel ── */}
            <div className="flex-1 flex overflow-hidden">

                {/* Left panel — current document */}
                <main
                    className={`overflow-y-auto custom-scrollbar transition-all duration-300 ease-in-out ${sidePanel ? 'w-1/2' : 'w-full'}`}
                    ref={containerRef}
                >
                    <div className="max-w-[1700px] mx-auto p-10 space-y-24">
                        <Document
                            file={pdfUrl}
                            onLoadSuccess={pdf => { setNumPages(pdf.numPages); setPdfDocProxy(pdf); }}
                        >
                            {Array.from({ length: numPages }).map((_, i) => {
                                const lines = parseLines(doc.transcriptions?.[i]);
                                const isPageZoomed = zoomConfig?.pIdx === i;

                                return (
                                    <div key={i} className="flex gap-12 items-start h-[780px]">
                                        {/* PDF page with overlay */}
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
                                                    <Page pageNumber={i + 1} width={pdfWidth} renderTextLayer={false} renderAnnotationLayer={false}/>
                                                    {lines.map((line, idx) => line.box_2d && (
                                                        <div
                                                            key={idx}
                                                            onClick={() => toggleZoom(i, idx, line.box_2d!)}
                                                            onMouseEnter={() => !isTransforming && setHoveredContext({ pIdx: i, lIdx: idx })}
                                                            onMouseLeave={() => setHoveredContext(null)}
                                                            className={`absolute cursor-pointer transition-all ${
                                                                hoveredContext?.pIdx === i && hoveredContext?.lIdx === idx
                                                                    ? 'bg-accent/15 ring-2 ring-accent/60'
                                                                    : ''
                                                            }`}
                                                            style={{
                                                                top: `${line.box_2d[0] / 10}%`,
                                                                left: `${line.box_2d[1] / 10}%`,
                                                                height: `${(line.box_2d[2] - line.box_2d[0]) / 10}%`,
                                                                width: `${(line.box_2d[3] - line.box_2d[1]) / 10}%`,
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                                {isPageZoomed && (
                                                    <button
                                                        onClick={() => setZoomConfig(null)}
                                                        className="absolute bottom-6 right-6 bg-black/70 text-white px-4 py-2 rounded-full text-[10px] font-bold backdrop-blur-md shadow-xl hover:bg-black transition-all"
                                                    >
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
                                                    <button
                                                        onClick={() => handleDeleteAllOnPage(i)}
                                                        className="text-[10px] text-muted hover:text-red-500 font-bold flex items-center gap-1 transition-colors font-lora"
                                                    >
                                                        <TrashIcon/> CLEAR
                                                    </button>
                                                )}
                                            </div>
                                            <div className="bg-white rounded-xl border border-border/30 shadow-sm flex flex-col flex-1 overflow-hidden">
                                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                                    {lines.map((line, idx) => {
                                                        const globalLine = localToGlobal(doc.transcriptions ?? [], i, idx);
                                                        const isSourceLine = sidePanel?.sourceGlobalLine === globalLine;
                                                        return (
                                                            <SentenceRow
                                                                ref={el => { sentenceRefs.current[`${i}-${idx}`] = el; }}
                                                                key={line.id ?? `${i}-${idx}`}
                                                                text={line.text}
                                                                idx={idx}
                                                                isActive={hoveredContext?.pIdx === i && hoveredContext?.lIdx === idx}
                                                                isSourceHighlight={isSourceLine}
                                                                onHover={active => !isTransforming && setHoveredContext(active ? { pIdx: i, lIdx: idx } : null)}
                                                                onSave={val => handleSaveLine(i, idx, val)}
                                                                onDelete={() => handleDeleteLine(i, idx)}
                                                                onZoomRequest={() => line.box_2d && toggleZoom(i, idx, line.box_2d)}
                                                                onMapRequest={() => openMappingSelector(i, idx)}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </Document>
                    </div>
                </main>

                {/* Right side panel — parallel document */}
                {sidePanel && (
                    <SideDocPanel
                        doc={sidePanel.doc}
                        highlightGlobalLine={sidePanel.highlightGlobalLine}
                        onClose={() => setSidePanel(null)}
                    />
                )}
            </div>

            {/* Mapping selector modal */}
            {mappingSelector && (
                <MappingSelector
                    currentDocId={id}
                    mappings={allMappings ?? []}
                    allDocs={allDocuments ?? []}
                    onSelect={selectMapping}
                    onClose={() => setMappingSelector(null)}
                />
            )}

            <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E5E1; border-radius: 10px; }
      `}</style>
        </div>
    );
}