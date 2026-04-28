'use client';

import React, {useState, useRef, useCallback} from 'react';
import {useLiveQuery} from 'dexie-react-hooks';
import {useRouter} from 'next/navigation';
import {db, AppDocument, AppMapping} from '@/lib/db';
import {PhilologicalAnalysisResult} from "@/types/philology";
import {PhilologyAnalyzer} from "@/components/PhilologyAnalyzer";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
    });
}

function docHasTranscriptions(doc: AppDocument): boolean {
    return (doc.transcriptions ?? []).some(t => {
        try {
            return JSON.parse(t || '[]').length > 0;
        } catch {
            return false;
        }
    });
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function UploadIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
             strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
    );
}

function LinkIcon() {
    return (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
    );
}

function PdfFileIcon() {
    return (
        <svg width="22" height="26" viewBox="0 0 22 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 1H3C1.9 1 1 1.9 1 3v22c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9l-7-8z"
                  fill="#FDFAF5" stroke="#D5C9B5" strokeWidth="1.2"/>
            <path d="M14 1v8h7" stroke="#D5C9B5" strokeWidth="1.2" fill="none"/>
            <text x="3.5" y="22" fontFamily="Georgia, serif" fontSize="6.5" fontWeight="700" fill="#B5732A"
                  letterSpacing="0.3">PDF
            </text>
        </svg>
    );
}

// ─── Document Row ─────────────────────────────────────────────────────────────

function DocumentRow({
                         doc,
                         isMapped,
                         onClick,
                         onDelete,
                     }: {
    doc: AppDocument;
    isMapped: boolean;
    onClick: () => void;
    onDelete: (e: React.MouseEvent) => void;
}) {
    const displayName = doc.name.replace(/\.pdf$/i, '');
    const pages = doc.transcriptions?.length;

    return (
        <li
            onClick={onClick}
            className="group relative flex items-center gap-5 px-6 py-5 rounded-2xl border border-border bg-paper cursor-pointer transition-all duration-200 hover:border-accent/60 hover:shadow-[0_2px_20px_rgba(181,115,42,0.10)] hover:-translate-y-px"
        >
            <div
                className="absolute left-0 top-5 bottom-5 w-[3px] rounded-r-full bg-transparent group-hover:bg-accent transition-all duration-300"/>
            <div className="shrink-0 transition-transform duration-200 group-hover:scale-105">
                <PdfFileIcon/>
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-playfair font-semibold text-ink text-[17px] leading-tight truncate">
                    {displayName}
                </p>
                <p className="text-xs text-muted mt-1.5 font-lora tracking-wide">
                    {formatDate(doc.createdAt)}
                    <span className="mx-2 opacity-40">·</span>
                    {formatSize(doc.size)}
                    {pages !== undefined && pages > 0 && (
                        <>
                            <span className="mx-2 opacity-40">·</span>
                            {pages} {pages === 1 ? 'page' : 'pages'}
                        </>
                    )}
                    {isMapped && (
                        <>
                            <span className="mx-2 opacity-40">·</span>
                            <span className="text-accent/80 inline-flex items-center gap-1">
                <LinkIcon/> mapped
              </span>
                        </>
                    )}
                </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
        <span
            className="text-[11px] text-accent font-medium tracking-wider uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-lora">
          Open →
        </span>
                <button
                    onClick={onDelete}
                    className="opacity-0 group-hover:opacity-70 hover:!opacity-100 transition-all duration-200 p-2 rounded-lg text-muted hover:text-danger hover:bg-danger/10"
                    title="Delete document"
                >
                    <TrashIcon/>
                </button>
            </div>
        </li>
    );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({onUpload}: { onUpload: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-28 text-center animate-fade-in">
            <div
                className="w-24 h-24 rounded-3xl border-2 border-dashed border-border/80 flex items-center justify-center mb-8">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#C8BAA8" strokeWidth="1.3"
                     strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="11" x2="12" y2="17"/>
                    <line x1="9" y1="14" x2="15" y2="14"/>
                </svg>
            </div>
            <h2 className="font-playfair text-2xl font-semibold text-ink mb-2">Your archive is empty</h2>
            <p className="text-muted font-lora text-sm mb-8 max-w-[280px] leading-relaxed">
                Upload PDF manuscripts to begin building your philological archive.
            </p>
            <button
                onClick={onUpload}
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-ink text-paper font-lora text-sm font-medium hover:bg-ink-faint active:scale-[0.98] transition-all cursor-pointer"
            >
                <UploadIcon/>
                Upload a document
            </button>
            <p className="text-xs text-muted/60 mt-4 font-lora">or drag & drop a PDF anywhere on this page</p>
        </div>
    );
}

// ─── Mapping Status Banner ─────────────────────────────────────────────────────

function MappingBanner({
                           mapping,
                           docs,
                       }: {
    mapping: AppMapping;
    docs: AppDocument[];
}) {
    const docA = docs.find(d => d.id === mapping.docAId);
    const docB = docs.find(d => d.id === mapping.docBId);
    if (!docA || !docB) return null;

    const nameA = docA.name.replace(/\.pdf$/i, '');
    const nameB = docB.name.replace(/\.pdf$/i, '');
    const lineCount = Object.keys(mapping.mapAtoB).length;

    return (
        <div
            className="flex items-center gap-4 px-5 py-3.5 rounded-xl border border-accent/30 bg-accent/5 animate-fade-in">
            <div className="shrink-0 w-7 h-7 rounded-full bg-accent/15 flex items-center justify-center">
                <LinkIcon/>
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-lora text-ink-faint leading-snug truncate">
                    <span className="font-semibold text-ink">{nameA}</span>
                    <span className="mx-2 text-muted">↔</span>
                    <span className="font-semibold text-ink">{nameB}</span>
                </p>
                <p className="text-[10px] text-muted mt-0.5 font-lora">
                    {lineCount} line alignments · Created {formatDate(mapping.createdAt)}
                </p>
            </div>
        </div>
    );
}


// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
    const documents = useLiveQuery(() => db.documents.orderBy('createdAt').reverse().toArray());
    const mappings = useLiveQuery(() => db.mappings.orderBy('createdAt').reverse().toArray());
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [isMappingInProgress, setIsMappingInProgress] = useState(false);

    // Which doc IDs have any mapping
    const mappedDocIds = new Set<number>(
        (mappings ?? []).flatMap(m => [m.docAId, m.docBId])
    );

    const handleFiles = useCallback(async (files: FileList | File[]) => {
        const pdfs = Array.from(files).filter(
            f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
        );
        if (!pdfs.length) return;
        setUploading(true);
        try {
            for (const file of pdfs) {
                await db.documents.add({
                    name: file.name,
                    data: file,
                    type: 'pdf',
                    size: file.size,
                    createdAt: Date.now(),
                    transcriptions: [],
                });
            }
        } catch (err) {
            console.error('Upload failed:', err);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, []);

    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (window.confirm('Remove this document from your archive?')) {
            await db.documents.delete(id);
            // Also remove any mappings involving this doc
            const toDelete = await db.mappings
                .filter(m => m.docAId === id || m.docBId === id)
                .primaryKeys();
            await db.mappings.bulkDelete(toDelete as number[]);
        }
    };

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
        },
        [handleFiles]
    );

    const onStartMapping = async () => {
        const allDocs = await db.documents.orderBy('createdAt').toArray();
        if (allDocs.length < 2) {
            alert('Upload at least two documents before creating a mapping.');
            return;
        }

        const docA = allDocs[allDocs.length - 2];
        const docB = allDocs[allDocs.length - 1];

        if (!docHasTranscriptions(docA) || !docHasTranscriptions(docB)) {
            alert(
                'Both documents must be transcribed before mapping.\n\n' +
                'Open each document and use the AI Transcribe button first.'
            );
            return;
        }

        setIsMappingInProgress(true);
        try {
            const res = await fetch('/api/mapTwoDocuments', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    docAId: docA.id,
                    docBId: docB.id,
                    transcriptionsA: docA.transcriptions,
                    transcriptionsB: docB.transcriptions,
                }),
            });

            if (!res.ok) throw new Error(await res.text());
            const {mapAtoB, mapBtoA} = await res.json();

            await db.mappings.add({
                docAId: docA.id!,
                docBId: docB.id!,
                createdAt: Date.now(),
                mapAtoB,
                mapBtoA,
            });
        } catch (err) {
            console.error('Mapping failed:', err);
            alert('Mapping failed. Check the console for details.');
        } finally {
            setIsMappingInProgress(false);
        }
    };

    // Determine which two docs would be mapped next
    const lastTwo = (documents ?? []).slice(0, 2);
    const canMap =
        !isMappingInProgress &&
        lastTwo.length === 2 &&
        docHasTranscriptions(lastTwo[0]) &&
        docHasTranscriptions(lastTwo[1]);


    return (
        <div
            className="min-h-screen bg-parchment"
            onDragOver={e => {
                e.preventDefault();
                setDragOver(true);
            }}
            onDragLeave={e => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
            }}
            onDrop={handleDrop}
        >
            {/* Drag overlay */}
            {dragOver && (
                <div
                    className="fixed inset-0 z-50 bg-parchment/92 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none">
                    <div
                        className="border-2 border-dashed border-accent/60 rounded-3xl px-20 py-16 flex flex-col items-center gap-4">
                        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#B5732A" strokeWidth="1.5">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        <p className="font-playfair text-2xl text-accent">Drop to add to archive</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <header className="sticky top-0 z-10 border-b border-border/50 bg-paper/60 backdrop-blur-md">
                <div className="max-w-3xl mx-auto px-8 py-5 flex items-center justify-between">
                    <div>
                        <h1 className="font-playfair text-[28px] font-bold text-ink leading-none tracking-tight">Scriptoria</h1>
                        <p className="text-[10px] text-muted mt-1 uppercase tracking-[0.18em] font-lora">Philological
                            Archive</p>
                    </div>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-accent text-paper font-lora text-sm font-medium hover:bg-accent-warm disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all shadow-sm cursor-pointer"
                    >
                        {uploading ? (
                            <>
                                <span
                                    className="inline-block w-3.5 h-3.5 border-[2px] border-paper/30 border-t-paper rounded-full animate-spin"/>
                                Uploading…
                            </>
                        ) : (
                            <><UploadIcon/> Add Document</>
                        )}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,application/pdf"
                        multiple
                        className="hidden"
                        onChange={e => e.target.files && handleFiles(e.target.files)}
                    />
                </div>
            </header>

            {/* Main */}
            <main className="max-w-4xl mx-auto px-8 py-10">
                {!documents ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-[78px] rounded-2xl bg-paper border border-border animate-pulse"
                                 style={{animationDelay: `${i * 0.08}s`}}/>
                        ))}
                    </div>
                ) : documents.length === 0 ? (
                    <EmptyState onUpload={() => fileInputRef.current?.click()}/>
                ) : (
                    <div className="animate-fade-in space-y-8">
                        {/* Document list */}
                        <div>
                            <p className="text-[10px] text-muted uppercase tracking-[0.18em] mb-5 font-lora">
                                {documents.length} {documents.length === 1 ? 'document' : 'documents'} in archive
                            </p>
                            <ul className="space-y-2.5">
                                {documents.map((doc, i) => (
                                    <div key={doc.id} className="animate-slide-up"
                                         style={{animationDelay: `${i * 0.04}s`}}>
                                        <DocumentRow
                                            doc={doc}
                                            isMapped={mappedDocIds.has(doc.id!)}
                                            onClick={() => router.push(`/documents/${doc.id}`)}
                                            onDelete={e => handleDelete(e, doc.id!)}
                                        />
                                    </div>
                                ))}
                            </ul>
                        </div>

                        {/* Mapping section */}
                        <div className="border-t border-border/50 pt-8">
                            <div className="flex items-center justify-between mb-5">
                                <p className="text-[10px] text-muted uppercase tracking-[0.18em] font-lora">Manuscript
                                    Collation</p>
                                <button
                                    onClick={onStartMapping}
                                    disabled={!canMap || isMappingInProgress}
                                    title={
                                        documents.length < 2
                                            ? 'Need at least 2 documents'
                                            : !canMap
                                                ? 'Both documents must be transcribed first'
                                                : 'Create alignment between the two most recent documents'
                                    }
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-lora font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] border-accent/40 text-accent hover:bg-accent hover:text-paper hover:border-accent cursor-pointer"
                                >
                                    {isMappingInProgress ? (
                                        <>
                                            <span
                                                className="inline-block w-3.5 h-3.5 border-[2px] border-accent/30 border-t-accent rounded-full animate-spin"/>
                                            Mapping…
                                        </>
                                    ) : (
                                        <><LinkIcon/> Begin Mapping</>
                                    )}
                                </button>
                            </div>

                            {/* Existing mappings */}
                            {mappings && mappings.length > 0 ? (
                                <div className="space-y-2.5">
                                    {mappings.map(m => (
                                        <MappingBanner key={m.id} mapping={m} docs={documents}/>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-muted/60 font-lora italic">
                                    No mappings yet. Transcribe two documents and press Begin Mapping to align them.
                                </p>
                            )}
                        </div>

                        <PhilologyAnalyzer/>
                    </div>
                )}
            </main>
        </div>
    );
}