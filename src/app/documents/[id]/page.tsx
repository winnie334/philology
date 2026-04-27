'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { db } from '@/lib/db';

if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function ArrowLeftIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>; }
function PencilIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>; }
function SparklesIcon({ className = "" }: { className?: string }) { return <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.2 1.2L3 12l5.8 1.9a2 2 0 0 1 1.2 1.2L12 21l1.9-5.8a2 2 0 0 1 1.2-1.2L21 12l-5.8-1.9a2 2 0 0 1-1.2-1.2L12 3Z"/></svg>; }
function ChevronDownIcon({ className = "" }: { className?: string }) { return <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>; }
function XIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>; }

// ─── Transcription Panel ──────────────────────────────────────────────────────
function TranscriptionPanel({
                                pageIndex, textData, isEditing, isTranscribing, onEdit, onSave, onCancel, onHoverLine
                            }: {
    pageIndex: number; textData: string; isEditing: boolean; isTranscribing: boolean;
    onEdit: () => void; onSave: (val: string) => void; onCancel: () => void;
    onHoverLine: (box: number[] | null) => void;
}) {
    // Attempt to parse the DB string as our JSON schema
    let lines: {text: string, box_2d: number[] | null}[] = [];
    try {
        lines = JSON.parse(textData);
        if (!Array.isArray(lines)) throw new Error();
    } catch {
        lines = textData ? textData.split('\n').map(l => ({ text: l, box_2d: null })) : [];
    }

    const rawTextString = lines.map(l => l.text).join('\n');
    const [draft, setDraft] = useState(rawTextString);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isEditing) {
            setDraft(rawTextString);
            const t = setTimeout(() => textareaRef.current?.focus(), 30);
            return () => clearTimeout(t);
        }
    }, [isEditing, rawTextString]);

    const renderInteractiveText = (rawText: string) => {
        if (!rawText) return null;
        const parts = rawText.split(/(<abbr>.*?<\/abbr>)/g);
        return parts.map((part, i) => {
            if (part.startsWith('<abbr>') && part.endsWith('</abbr>')) {
                const innerText = part.replace(/<\/?abbr>/g, '');
                return <span key={i} className="bg-accent/20 text-accent-dark px-1 mx-0.5 rounded border-b border-accent/40 cursor-help hover:bg-accent hover:text-white transition-colors" title="AI Identified Abbreviation">{innerText}</span>;
            }
            return <span key={i}>{part}</span>;
        });
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted font-lora flex items-center gap-2">
                    Page {pageIndex + 1}
                    {isTranscribing && <span className="text-accent animate-pulse normal-case tracking-normal"> (AI is reading...)</span>}
                </span>
                {!isEditing && !isTranscribing && lines.length > 0 && (
                    <button onClick={onEdit} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-muted hover:text-accent hover:bg-accent/10 transition-colors font-lora">
                        <PencilIcon /> Edit
                    </button>
                )}
            </div>

            {isEditing ? (
                <div className="flex flex-col gap-2.5 animate-fade-in">
                    <textarea ref={textareaRef} value={draft} onChange={(e) => setDraft(e.target.value)} rows={10} className="w-full p-4 rounded-xl border border-accent/40 bg-paper text-ink font-lora text-[14px] leading-[1.8] resize-y focus:outline-none focus:ring-2 focus:ring-accent/25 transition-all" />
                    <div className="flex gap-2">
                        {/* We save manual edits by dropping the bounding box data to avoid spatial corruption */}
                        <button onClick={() => onSave(JSON.stringify([{ text: draft, box_2d: null }]))} className="px-4 py-2 rounded-lg bg-accent text-paper text-xs font-lora font-medium hover:bg-accent-warm">Save</button>
                        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-muted text-xs font-lora hover:bg-border/60">Cancel</button>
                    </div>
                </div>
            ) : lines.length > 0 ? (
                <div className="font-lora text-[14px] text-ink-faint leading-[1.9] whitespace-pre-wrap space-y-1" onMouseLeave={() => onHoverLine(null)}>
                    {lines.map((line, idx) => (
                        <div
                            key={idx}
                            className="hover:bg-accent/5 p-1 rounded transition-colors cursor-default"
                            onMouseEnter={() => onHoverLine(line.box_2d)}
                        >
                            {renderInteractiveText(line.text)}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="font-lora text-[13px] text-muted/60 italic leading-relaxed">
                    {isTranscribing ? "Transcribing in progress..." : "No transcription for this page yet."}
                </p>
            )}
        </div>
    );
}

function Spinner({ label }: { label?: string }) {
    return (
        <div className="flex flex-col items-center gap-3 text-muted">
            <div className="w-7 h-7 border-2 border-border border-t-accent rounded-full animate-spin" />
            {label && <p className="font-lora text-sm">{label}</p>}
        </div>
    );
}

// ─── Main Page Component ─────────────────────────────────────────────────────
export default function DocumentViewer() {
    const params = useParams();
    const router = useRouter();
    const id = parseInt(params.id as string, 10);

    const [queryDone, setQueryDone] = useState(false);
    const doc = useLiveQuery(async () => {
        const result = await db.documents.get(id);
        setQueryDone(true);
        return result;
    }, [id]);

    const [numPages, setNumPages] = useState(0);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [pdfDocProxy, setPdfDocProxy] = useState<any>(null);
    const [editingPage, setEditingPage] = useState<number | null>(null);
    const [pdfWidth, setPdfWidth] = useState(520);
    const containerRef = useRef<HTMLDivElement>(null);

    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [startPage, setStartPage] = useState(1);
    const [endPage, setEndPage] = useState(1);
    const [transcribingPageIndex, setTranscribingPageIndex] = useState<number | null>(null);

    // Tracks which box is currently hovered in the active panel
    const [hoveredBox, setHoveredBox] = useState<number[] | null>(null);

    useEffect(() => {
        if (!doc?.data) return;
        const url = URL.createObjectURL(doc.data);
        setPdfUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [doc?.data]);

    useEffect(() => {
        if (numPages > 0 && endPage === 1) setEndPage(numPages);
    }, [numPages]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => {
            setPdfWidth(Math.max(280, Math.floor(entry.contentRect.width * 0.57 - 24)));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const handleSave = useCallback(async (pageIndex: number, newTextString: string) => {
        if (!doc?.id) return;
        const updated = [...(doc.transcriptions ?? [])];
        while (updated.length <= pageIndex) updated.push('');
        updated[pageIndex] = newTextString;
        await db.documents.update(doc.id, { transcriptions: updated });
        setEditingPage(null);
    }, [doc]);

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
                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                await page.render({ canvasContext: ctx, viewport }).promise;
                const base64Data = canvas.toDataURL('image/png').split(',')[1];

                const res = await fetch('/api/transcribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base64Image: base64Data, mimeType: 'image/png' })
                });

                if (!res.ok) throw new Error("API Route Failed");
                const resultData = await res.json();

                const currentDoc = await db.documents.get(doc.id);
                const updated = [...(currentDoc?.transcriptions || [])];
                while (updated.length < currentPage) updated.push('');

                // Store the stringified structured JSON directly in dexie
                updated[currentPage - 1] = JSON.stringify(resultData.lines);
                await db.documents.update(doc.id, { transcriptions: updated });

            } catch (err) {
                console.error(`Failed on page ${currentPage}:`, err);
            }
        }
        setTranscribingPageIndex(null);
    };

    if (!queryDone) return <div className="min-h-screen bg-parchment flex items-center justify-center"><Spinner label="Loading document…" /></div>;
    if (!doc) return <div className="min-h-screen bg-parchment flex items-center justify-center"><div className="text-center"><p className="font-playfair text-2xl text-ink mb-3">Document not found</p><button onClick={() => router.push('/')} className="text-sm text-accent hover:underline font-lora">Return to archive</button></div></div>;

    const displayName = doc.name.replace(/\.pdf$/i, '');
    const isTranscribingAny = transcribingPageIndex !== null;

    return (
        <div className="min-h-screen bg-parchment">
            <header className="sticky top-0 z-20 border-b border-border/50 bg-parchment/90 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-8 py-4 flex items-center gap-5">
                    <button onClick={() => router.push('/')} className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors font-lora shrink-0"><ArrowLeftIcon /> Archive</button>
                    <div className="w-px h-4 bg-border shrink-0" />
                    <h1 className="font-playfair text-xl text-ink truncate leading-snug flex-1">{displayName}</h1>

                    <div className="relative">
                        <button
                            onClick={() => setIsPopoverOpen(!isPopoverOpen)}
                            disabled={isTranscribingAny || numPages === 0}
                            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${isTranscribingAny ? 'bg-amber-100 text-amber-700 cursor-not-allowed' : 'bg-accent/10 text-accent hover:bg-accent hover:text-white border border-accent/20'}`}
                        >
                            <SparklesIcon className={isTranscribingAny ? "animate-pulse" : ""} />
                            {isTranscribingAny ? `Transcribing Page ${transcribingPageIndex + 1}...` : "AI Transcribe"}
                            {!isTranscribingAny && <ChevronDownIcon className="opacity-70" />}
                        </button>

                        {isPopoverOpen && (
                            <div className="absolute right-0 mt-2 w-64 bg-white border border-border shadow-lg rounded-lg p-4 z-50">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-playfair font-semibold text-ink text-sm">Select Range</h3>
                                    <button onClick={() => setIsPopoverOpen(false)} className="text-muted hover:text-ink"><XIcon /></button>
                                </div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="flex-1"><label className="block text-[10px] uppercase text-muted mb-1 font-semibold">From</label><input type="number" min={1} max={numPages} value={startPage} onChange={(e) => setStartPage(Number(e.target.value))} className="w-full text-sm border rounded px-2 py-1" /></div>
                                    <span className="text-muted mt-4">-</span>
                                    <div className="flex-1"><label className="block text-[10px] uppercase text-muted mb-1 font-semibold">To</label><input type="number" min={1} max={numPages} value={endPage} onChange={(e) => setEndPage(Number(e.target.value))} className="w-full text-sm border rounded px-2 py-1" /></div>
                                </div>
                                <button onClick={processTranscriptionQueue} className="w-full bg-accent text-white py-2 rounded-md text-sm hover:bg-accent/90 shadow-sm">Start Processing</button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-8 py-10" ref={containerRef}>
                {!pdfUrl ? (
                    <div className="flex items-center justify-center py-32"><Spinner label="Preparing document…" /></div>
                ) : (
                    <Document file={pdfUrl} onLoadSuccess={(pdf) => { setNumPages(pdf.numPages); setPdfDocProxy(pdf); }} loading={<div className="flex items-center justify-center py-32"><Spinner label="Loading PDF…" /></div>}>
                        <div className="space-y-16">
                            {Array.from({ length: numPages }, (_, i) => (
                                <div key={i} className="flex gap-10 items-start">
                                    <div className="shrink-0" style={{ width: pdfWidth }}>
                                        <div className="text-[10px] uppercase tracking-[0.18em] text-muted/70 font-lora mb-2.5">
                                            {i + 1} / {numPages}
                                        </div>
                                        <div className="relative rounded-2xl overflow-hidden shadow-[0_4px_28px_rgba(26,22,18,0.11)] border border-border/30 bg-white">
                                            <Page pageNumber={i + 1} width={pdfWidth} renderTextLayer={false} renderAnnotationLayer={false} />

                                            {/* Bounding Box Overlay Magic */}
                                            {hoveredBox && (
                                                <div
                                                    className="absolute border-2 border-accent/80 bg-accent/20 rounded shadow-sm transition-all duration-200 pointer-events-none"
                                                    style={{
                                                        top: `${hoveredBox[0] / 10}%`,
                                                        left: `${hoveredBox[1] / 10}%`,
                                                        height: `${(hoveredBox[2] - hoveredBox[0]) / 10}%`,
                                                        width: `${(hoveredBox[3] - hoveredBox[1]) / 10}%`
                                                    }}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0 pt-10">
                                        <div className="border-l-2 border-border/70 pl-8">
                                            <TranscriptionPanel
                                                pageIndex={i}
                                                textData={doc.transcriptions?.[i] ?? ''}
                                                isEditing={editingPage === i}
                                                isTranscribing={transcribingPageIndex === i}
                                                onEdit={() => setEditingPage(i)}
                                                onSave={(val) => handleSave(i, val)}
                                                onCancel={() => setEditingPage(null)}
                                                onHoverLine={setHoveredBox} // Hook up the hover state
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Document>
                )}
            </div>
        </div>
    );
}