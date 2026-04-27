'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { db } from '@/lib/db';

// Configure pdf.js worker via CDN (matches installed version automatically)
if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ArrowLeftIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
        </svg>
    );
}

function PencilIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
    );
}

// ─── Transcription Panel ──────────────────────────────────────────────────────

function TranscriptionPanel({
                                pageIndex,
                                text,
                                isEditing,
                                onEdit,
                                onSave,
                                onCancel,
                            }: {
    pageIndex: number;
    text: string;
    isEditing: boolean;
    onEdit: () => void;
    onSave: (val: string) => void;
    onCancel: () => void;
}) {
    const [draft, setDraft] = useState(text);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Sync draft when entering edit mode
    useEffect(() => {
        if (isEditing) {
            setDraft(text);
            const t = setTimeout(() => textareaRef.current?.focus(), 30);
            return () => clearTimeout(t);
        }
    }, [isEditing, text]);

    return (
        <div className="flex flex-col gap-3">
            {/* Label row */}
            <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted font-lora">
          Page {pageIndex + 1}
        </span>
                {!isEditing && (
                    <button
                        onClick={onEdit}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-muted hover:text-accent hover:bg-accent/10 transition-colors font-lora"
                    >
                        <PencilIcon />
                        Edit
                    </button>
                )}
            </div>

            {/* Content */}
            {isEditing ? (
                <div className="flex flex-col gap-2.5 animate-fade-in">
          <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={10}
              className="w-full p-4 rounded-xl border border-accent/40 bg-paper text-ink font-lora text-[14px] leading-[1.8] resize-y focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent/70 transition-all placeholder:text-muted/40"
              placeholder="Enter transcription for this page…"
          />
                    <div className="flex gap-2">
                        <button
                            onClick={() => onSave(draft)}
                            className="px-4 py-2 rounded-lg bg-accent text-paper text-xs font-lora font-medium hover:bg-accent-warm active:scale-[0.97] transition-all"
                        >
                            Save
                        </button>
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 rounded-lg text-muted text-xs font-lora hover:text-ink hover:bg-border/60 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : text ? (
                <p className="font-lora text-[14px] text-ink-faint leading-[1.9] whitespace-pre-wrap">
                    {text}
                </p>
            ) : (
                <p className="font-lora text-[13px] text-muted/60 italic leading-relaxed">
                    No transcription for this page yet.
                </p>
            )}
        </div>
    );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ label }: { label?: string }) {
    return (
        <div className="flex flex-col items-center gap-3 text-muted">
            <div className="w-7 h-7 border-2 border-border border-t-accent rounded-full animate-spin" />
            {label && <p className="font-lora text-sm">{label}</p>}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocumentViewer() {
    const params = useParams();
    const router = useRouter();
    const id = parseInt(params.id as string, 10);

    // Track whether the DB query has settled (to distinguish "loading" from "not found")
    const [queryDone, setQueryDone] = useState(false);
    const doc = useLiveQuery(async () => {
        const result = await db.documents.get(id);
        setQueryDone(true);
        return result;
    }, [id]);

    const [numPages, setNumPages] = useState(0);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [editingPage, setEditingPage] = useState<number | null>(null);
    const [pdfWidth, setPdfWidth] = useState(520);
    const containerRef = useRef<HTMLDivElement>(null);

    // Build object URL from stored blob
    useEffect(() => {
        if (!doc?.data) return;
        const url = URL.createObjectURL(doc.data);
        setPdfUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [doc?.data]);

    // Measure container to size PDF pages responsively
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => {
            const total = entry.contentRect.width;
            // PDF column takes ~58% of content area, minus gap
            setPdfWidth(Math.max(280, Math.floor(total * 0.57 - 24)));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const handleSave = useCallback(
        async (pageIndex: number, newText: string) => {
            if (!doc?.id) return;
            const updated = [...(doc.transcriptions ?? [])];
            while (updated.length <= pageIndex) updated.push('');
            updated[pageIndex] = newText;
            await db.documents.update(doc.id, { transcriptions: updated });
            setEditingPage(null);
        },
        [doc]
    );

    // ─── States ─────────────────────────────────────────────────────────────────

    if (!queryDone) {
        return (
            <div className="min-h-screen bg-parchment flex items-center justify-center">
                <Spinner label="Loading document…" />
            </div>
        );
    }

    if (!doc) {
        return (
            <div className="min-h-screen bg-parchment flex items-center justify-center">
                <div className="text-center">
                    <p className="font-playfair text-2xl text-ink mb-3">Document not found</p>
                    <button
                        onClick={() => router.push('/')}
                        className="text-sm text-accent hover:underline font-lora"
                    >
                        Return to archive
                    </button>
                </div>
            </div>
        );
    }

    const displayName = doc.name.replace(/\.pdf$/i, '');

    // ─── Main render ─────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-parchment">

            {/* Sticky header */}
            <header className="sticky top-0 z-20 border-b border-border/50 bg-parchment/90 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-8 py-4 flex items-center gap-5">
                    <button
                        onClick={() => router.push('/')}
                        className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors font-lora shrink-0"
                    >
                        <ArrowLeftIcon />
                        Archive
                    </button>

                    {/* Divider */}
                    <div className="w-px h-4 bg-border shrink-0" />

                    <h1 className="font-playfair text-xl text-ink truncate leading-snug flex-1">
                        {displayName}
                    </h1>

                    {numPages > 0 && (
                        <span className="text-[11px] text-muted font-lora shrink-0 ml-auto tracking-wide">
              {numPages} {numPages === 1 ? 'page' : 'pages'}
            </span>
                    )}
                </div>
            </header>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-8 py-10" ref={containerRef}>
                {!pdfUrl ? (
                    <div className="flex items-center justify-center py-32">
                        <Spinner label="Preparing document…" />
                    </div>
                ) : (
                    <Document
                        file={pdfUrl}
                        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                        loading={
                            <div className="flex items-center justify-center py-32">
                                <Spinner label="Loading PDF…" />
                            </div>
                        }
                        error={
                            <div className="flex items-center justify-center py-32 text-danger">
                                <p className="font-lora text-sm">Could not load this PDF. The file may be corrupted.</p>
                            </div>
                        }
                    >
                        <div className="space-y-16">
                            {Array.from({ length: numPages }, (_, i) => (
                                <div
                                    key={i}
                                    className="flex gap-10 items-start animate-fade-in"
                                    style={{ animationDelay: `${Math.min(i * 0.06, 0.4)}s` }}
                                >
                                    {/* ── Left: PDF page ────────────────────────────────── */}
                                    <div className="shrink-0" style={{ width: pdfWidth }}>
                                        {/* Page counter */}
                                        <div className="text-[10px] uppercase tracking-[0.18em] text-muted/70 font-lora mb-2.5">
                                            {i + 1} / {numPages}
                                        </div>

                                        {/* Page card */}
                                        <div className="rounded-2xl overflow-hidden shadow-[0_4px_28px_rgba(26,22,18,0.11)] border border-border/30 bg-white">
                                            <Page
                                                pageNumber={i + 1}
                                                width={pdfWidth}
                                                renderTextLayer={false}
                                                renderAnnotationLayer={false}
                                                loading={
                                                    <div
                                                        className="bg-paper animate-pulse"
                                                        style={{ width: pdfWidth, height: Math.floor(pdfWidth * 1.414) }}
                                                    />
                                                }
                                            />
                                        </div>
                                    </div>

                                    {/* ── Right: Transcription ──────────────────────────── */}
                                    <div className="flex-1 min-w-0 pt-10">
                                        <div className="border-l-2 border-border/70 pl-8 hover:border-accent/40 transition-colors duration-300">
                                            <TranscriptionPanel
                                                pageIndex={i}
                                                text={doc.transcriptions?.[i] ?? ''}
                                                isEditing={editingPage === i}
                                                onEdit={() => setEditingPage(i)}
                                                onSave={(val) => handleSave(i, val)}
                                                onCancel={() => setEditingPage(null)}
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