'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Document, Page } from 'react-pdf';
import { useDocumentStore } from "@/app/store/useDocumentStore";
import { parseLines, localToGlobal, globalToLocal } from '../lib/lineUtils';
import SentenceRow from '../components/SentenceRow';
import { PencilIcon, TrashIcon, XIcon } from '@/app/documents/[id]/components/Icons';
import { AppDocument } from '@/lib/db';

interface DocumentPanelProps {
    doc: AppDocument;
    pdfUrl: string | null;
    pdfWidth: number;
    localHover: { pIdx: number; lIdx: number } | null;
    setLocalHover: (hover: { pIdx: number; lIdx: number } | null) => void;
    externalHighlight: { pIdx: number; lIdx: number } | null;
    onLineClick: (pIdx: number, lIdx: number) => void;
    onMapRequest?: (pIdx: number, lIdx: number, rect: DOMRect) => void;
    onLoadSuccess?: (pdf: any) => void;
    scrollTargetGlobal?: number | null;
    onScrollTargetConsumed?: () => void;
    isSidePanel?: boolean;
    onClose?: () => void;
}

const BulkEditor = ({ lines, onSave, onCancel }: any) => {
    const [text, setText] = useState(() => lines.map((l: any) => l.text).join('\n'));

    const handleSave = () => {
        const newTexts = text.split('\n');
        const newLines = [];
        const maxLength = Math.max(lines.length, newTexts.length);
        for (let i = 0; i < maxLength; i++) {
            if (i < newTexts.length) {
                newLines.push({ ...(lines[i] || {}), text: newTexts[i] });
            }
        }
        onSave(newLines);
    };

    return (
        <div className="flex flex-col h-full bg-white p-4">
            <textarea
                autoFocus
                className="flex-1 w-full p-4 border border-accent/30 rounded-lg shadow-inner resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 font-lora text-sm leading-relaxed"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type or paste transcription here..."
            />
            <div className="flex justify-end gap-3 mt-4">
                <button onClick={onCancel} className="px-4 py-2 text-xs font-semibold text-muted hover:text-ink transition-colors">CANCEL</button>
                <button onClick={handleSave} className="px-6 py-2 text-xs font-semibold bg-accent text-white rounded-md shadow hover:bg-accent/90 transition-colors">SAVE ALL</button>
            </div>
        </div>
    );
};

export default function DocumentPanel({
                                          doc,
                                          pdfUrl,
                                          pdfWidth,
                                          localHover,
                                          setLocalHover,
                                          externalHighlight,
                                          onLineClick,
                                          onMapRequest,
                                          onLoadSuccess,
                                          scrollTargetGlobal,
                                          onScrollTargetConsumed,
                                          isSidePanel = false,
                                          onClose
                                      }: DocumentPanelProps) {
    const {
        updateTranscription,
        updatePageTranscriptions,
        deleteAllOnPage,
        deleteTranscriptionLine,
    } = useDocumentStore();

    const [numPages, setNumPages] = useState(0);
    const [zoomConfig, setZoomConfig] = useState<{ pIdx: number, lIdx: number, x: number, y: number, scale: number } | null>(null);
    const [isTransforming, setIsTransforming] = useState(false);
    const [bulkEditingPage, setBulkEditingPage] = useState<number | null>(null);
    const [flashTarget, setFlashTarget] = useState<{ pIdx: number; lIdx: number } | null>(null);

    const sentenceRefs = useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        if (localHover) {
            const target = sentenceRefs.current[`${localHover.pIdx}-${localHover.lIdx}`];
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else if (zoomConfig) {
            const target = sentenceRefs.current[`${zoomConfig.pIdx}-${zoomConfig.lIdx}`];
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [localHover, zoomConfig]);

    useEffect(() => {
        if (scrollTargetGlobal !== null && scrollTargetGlobal !== undefined && numPages > 0) {
            const target = globalToLocal(doc.transcriptions ?? [], scrollTargetGlobal);
            const el = sentenceRefs.current[`${target.pIdx}-${target.lIdx}`];
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setFlashTarget(target);
                setTimeout(() => setFlashTarget(null), 1500);
            }
            if (onScrollTargetConsumed) onScrollTargetConsumed();
        }
    }, [scrollTargetGlobal, numPages, doc.transcriptions, onScrollTargetConsumed]);

    const handleToggleZoom = (pIdx: number, lIdx: number, box: number[]) => {
        if (zoomConfig?.pIdx === pIdx && zoomConfig?.lIdx === lIdx) {
            setZoomConfig(null);
            return;
        }
        setIsTransforming(true);
        const boxW = (box[3] - box[1]) / 10;
        const boxH = (box[2] - box[0]) / 10;
        let scale = Math.min(2.8, Math.max(1.6, 85 / boxW));
        if (boxW > 85 || boxH > 20) scale = 1.8;

        setZoomConfig({
            pIdx, lIdx,
            x: ((box[1] + box[3]) / 20) - 50 / scale,
            y: ((box[0] + box[2]) / 20) - 30 / scale,
            scale
        });
        setTimeout(() => setIsTransforming(false), 500);
    };

    return (
        <div className={`flex-1 flex flex-col overflow-hidden ${isSidePanel ? 'bg-[#F3F1EC] border-l shadow-2xl z-10' : 'bg-[#F8F7F4] border-r'}`}>
            {isSidePanel && (
                <div className="shrink-0 sticky top-0 z-20 bg-[#F3F1EC]/95 backdrop-blur-md border-b border-border/40 px-5 py-3 flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-accent font-bold tracking-widest uppercase mb-1">Reference Document</span>
                        <h2 className="font-playfair text-[15px] font-semibold text-ink truncate">{doc.name.replace(/\.pdf$/i, '')}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-muted hover:text-ink rounded-lg hover:bg-black/5 transition-colors">
                        <XIcon />
                    </button>
                </div>
            )}

            <div className={`flex-1 overflow-y-auto custom-scrollbar ${isSidePanel ? 'p-6' : 'p-8'} space-y-12`}>
                <Document
                    file={pdfUrl || undefined}
                    onLoadSuccess={(pdf) => {
                        setNumPages(pdf.numPages);
                        if (onLoadSuccess) onLoadSuccess(pdf);
                    }}
                    loading={
                        <div className="flex flex-col items-center justify-center h-full min-h-[50vh] animate-pulse">
                            <div className="h-4 w-32 bg-black/5 rounded mb-4" />
                            <span className="text-sm text-muted font-lora">Initializing...</span>
                        </div>
                    }
                >
                    <div className="max-w-[1700px] mx-auto">
                        {Array.from({ length: numPages }).map((_, i) => {
                            const lines = parseLines(doc.transcriptions?.[i]);
                            const isPageZoomed = zoomConfig?.pIdx === i;
                            const isBulkEditing = bulkEditingPage === i;

                            return (
                                <div
                                    key={i}
                                    className={`flex ${isSidePanel ? 'flex-row-reverse' : 'flex-row'} gap-8 items-center mb-12 max-h-[780px]`}
                                >
                                    {/* ── PDF PAGE ── */}
                                    <div className="shrink-0 flex flex-col min-w-0">
                                        <span className="text-[10px] font-bold text-muted/40 mb-2 uppercase tracking-wider font-lora">Folio {i + 1}</span>
                                        <div
                                            className="relative bg-transparent overflow-hidden rounded-md shadow-sm"
                                            style={{ width: pdfWidth }}
                                        >
                                            <div
                                                className={`transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)] origin-top-left ${isTransforming ? 'pointer-events-none' : ''}`}
                                                style={{ transform: isPageZoomed ? `scale(${zoomConfig.scale}) translate(${-zoomConfig.x}%, ${-zoomConfig.y}%)` : 'scale(1) translate(0,0)' }}
                                            >
                                                <Page
                                                    pageNumber={i + 1}
                                                    width={pdfWidth}
                                                    devicePixelRatio={typeof window !== 'undefined' ? Math.max(window.devicePixelRatio || 1, 5) : 5}
                                                    renderTextLayer={false}
                                                    renderAnnotationLayer={false}
                                                />

                                                {!isBulkEditing && lines.map((line, idx) => {
                                                    if (!line.box_2d) return null;
                                                    const isActive = (localHover?.pIdx === i && localHover?.lIdx === idx) || (zoomConfig?.pIdx === i && zoomConfig?.lIdx === idx) || (flashTarget?.pIdx === i && flashTarget?.lIdx === idx);
                                                    const isExt = externalHighlight?.pIdx === i && externalHighlight?.lIdx === idx;

                                                    return (
                                                        <div
                                                            key={idx}
                                                            onMouseEnter={() => !isTransforming && setLocalHover({ pIdx: i, lIdx: idx })}
                                                            onMouseLeave={() => setLocalHover(null)}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const isZoomingOut = zoomConfig?.pIdx === i && zoomConfig?.lIdx === idx;
                                                                handleToggleZoom(i, idx, line.box_2d!);

                                                                // Prevent phantom highlight logic if we are just closing the zoom
                                                                if (!isZoomingOut) {
                                                                    onLineClick(i, idx);
                                                                }
                                                            }}
                                                            className={`absolute cursor-pointer transition-all duration-150 ${isActive ? 'bg-accent/15 ring-2 ring-accent/60 z-10' : isExt ? 'bg-amber-300/25 ring-2 ring-amber-500/70 z-10' : ''}`}
                                                            style={{ top: `${line.box_2d[0] / 10}%`, left: `${line.box_2d[1] / 10}%`, height: `${(line.box_2d[2] - line.box_2d[0]) / 10}%`, width: `${(line.box_2d[3] - line.box_2d[1]) / 10}%` }}
                                                        />
                                                    );
                                                })}
                                            </div>
                                            {isPageZoomed && (
                                                <button onClick={() => setZoomConfig(null)} className="absolute bottom-6 right-6 bg-black/70 text-white px-4 py-2 rounded-full text-[10px] font-bold backdrop-blur-md shadow-xl hover:bg-black transition-all z-20">
                                                    RESET VIEW
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── TRANSCRIPTION LIST ── */}
                                    <div className="flex-1 flex flex-col h-[720px] min-w-0">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-bold text-muted/40 uppercase font-lora tracking-wider mt-5">Transcription</span>
                                            {!isBulkEditing && lines.length > 0 && (
                                                <div className="flex items-center gap-4 mt-5">
                                                    <button onClick={() => setBulkEditingPage(i)} className="text-[10px] text-muted hover:text-accent font-bold flex items-center gap-1 transition-colors font-lora">
                                                        <PencilIcon /> EDIT
                                                    </button>
                                                    <button onClick={() => { if (doc.id !== undefined && confirm("Clear all transcriptions?")) deleteAllOnPage(doc.id, i); }} className="text-[10px] text-muted hover:text-red-500 font-bold flex items-center gap-1 transition-colors font-lora">
                                                        <TrashIcon /> CLEAR
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="bg-white rounded-xl border border-border/30 shadow-sm flex flex-col flex-1 overflow-hidden">
                                            {isBulkEditing ? (
                                                <BulkEditor
                                                    lines={lines}
                                                    onCancel={() => setBulkEditingPage(null)}
                                                    onSave={(newLines: any[]) => {
                                                        if (doc.id !== undefined) updatePageTranscriptions(doc.id, i, newLines);
                                                        setBulkEditingPage(null);
                                                    }}
                                                />
                                            ) : (
                                                <div className="flex-1 overflow-y-auto custom-scrollbar">
                                                    {lines.map((line, idx) => {
                                                        const isActive = (localHover?.pIdx === i && localHover?.lIdx === idx) || (zoomConfig?.pIdx === i && zoomConfig?.lIdx === idx) || (flashTarget?.pIdx === i && flashTarget?.lIdx === idx);
                                                        const isExt = externalHighlight?.pIdx === i && externalHighlight?.lIdx === idx;

                                                        return (
                                                            <SentenceRow
                                                                key={`${i}-${idx}`}
                                                                ref={el => { sentenceRefs.current[`${i}-${idx}`] = el; }}
                                                                text={line.text}
                                                                idx={idx}
                                                                isActive={isActive}
                                                                isExternalHighlight={isExt}
                                                                onHover={(active) => !isTransforming && setLocalHover(active ? { pIdx: i, lIdx: idx } : null)}
                                                                onSave={(val) => doc.id !== undefined && updateTranscription(doc.id, i, idx, val)}
                                                                onDelete={() => doc.id !== undefined && deleteTranscriptionLine(doc.id, i, idx)}
                                                                onZoomRequest={() => {
                                                                    const isZoomingOut = zoomConfig?.pIdx === i && zoomConfig?.lIdx === idx;
                                                                    if (line.box_2d) handleToggleZoom(i, idx, line.box_2d);

                                                                    if (!isZoomingOut) {
                                                                        onLineClick(i, idx);
                                                                    }
                                                                }}
                                                                onMapRequest={(rect) => {
                                                                    if (onMapRequest) onMapRequest(i, idx, rect);
                                                                }}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Document>
            </div>
        </div>
    );
}