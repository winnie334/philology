'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page } from 'react-pdf';
import { useDocumentStore } from "@/app/store/useDocumentStore";
import { parseLines, localToGlobal, findNearestMappedLine, globalToLocal } from '../lib/lineUtils';
import SentenceRow from '../components/SentenceRow';
import {PencilIcon, TrashIcon} from "@/app/documents/[id]/components/Icons";

interface MainWorkspaceProps {
    numPages: number;
    pdfWidth: number;
    transcriptions: string[];
    onLoadSuccess: (pdf: any) => void;
    file: any;
    docId: number;
}

// ─── Modular Bulk Editor Component ───
const BulkEditor = ({
                        lines,
                        onSave,
                        onCancel
                    }: {
    lines: any[];
    onSave: (newLines: any[]) => void;
    onCancel: () => void;
}) => {
    // Join all texts with a newline for the textarea
    const [text, setText] = useState(() => lines.map(l => l.text).join('\n'));

    const handleSave = () => {
        const newTexts = text.split('\n');
        const newLines = [];

        // Merge the new text with the existing bounding boxes
        const maxLength = Math.max(lines.length, newTexts.length);
        for (let i = 0; i < maxLength; i++) {
            if (i < newTexts.length) {
                newLines.push({
                    ...(lines[i] || {}), // Keep existing box_2d if it exists
                    text: newTexts[i]
                });
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
                <button
                    onClick={onCancel}
                    className="px-4 py-2 text-xs font-semibold text-muted hover:text-ink transition-colors"
                >
                    CANCEL
                </button>
                <button
                    onClick={handleSave}
                    className="px-6 py-2 text-xs font-semibold bg-accent text-white rounded-md shadow hover:bg-accent/90 transition-colors"
                >
                    SAVE ALL
                </button>
            </div>
        </div>
    );
};


export default function MainWorkspace({
                                          numPages,
                                          pdfWidth,
                                          transcriptions,
                                          onLoadSuccess,
                                          file,
                                          docId
                                      }: MainWorkspaceProps) {
    const {
        zoomConfig,
        setZoom,
        mainHover,
        setMainHover,
        sideHover,
        sideDoc,
        mainDoc,
        activeMapping,
        updateTranscription,
        updatePageTranscriptions, // <-- Make sure to pull this from the store
        deleteAllOnPage,
        deleteTranscriptionLine,
        setMappingPopover,
        setSidePanelScrollTarget
    } = useDocumentStore();

    const [isTransforming, setIsTransforming] = useState(false);
    const [bulkEditingPage, setBulkEditingPage] = useState<number | null>(null);
    const sentenceRefs = useRef<Record<string, HTMLDivElement | null>>({});

    useEffect(() => {
        if (mainHover) {
            const target = sentenceRefs.current[`${mainHover.pIdx}-${mainHover.lIdx}`];
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
        else if (zoomConfig) {
            const target = sentenceRefs.current[`${zoomConfig.pIdx}-${zoomConfig.lIdx}`];
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [mainHover, zoomConfig]);

    const externalHighlight = useMemo(() => {
        if (!mainDoc || !sideHover || !activeMapping || !sideDoc) return null;

        const isDocA = activeMapping.docAId === mainDoc.id;
        const map = isDocA ? activeMapping.mapBtoA : activeMapping.mapAtoB;

        const globalLine = localToGlobal(sideDoc.transcriptions, sideHover.pIdx, sideHover.lIdx);
        const mappedGlobal = findNearestMappedLine(map, globalLine);
        return globalToLocal(mainDoc.transcriptions, mappedGlobal);
    }, [mainDoc, sideDoc, sideHover, activeMapping]);

    const handleMainLineClick = (pIdx: number, lIdx: number) => {
        if (!sideDoc || !activeMapping || !mainDoc) return;
        const isDocA = activeMapping.docAId === mainDoc.id;
        const map = isDocA ? activeMapping.mapAtoB : activeMapping.mapBtoA;
        const globalLine = localToGlobal(mainDoc.transcriptions, pIdx, lIdx);
        const mappedGlobal = findNearestMappedLine(map, globalLine);
        setSidePanelScrollTarget(mappedGlobal);
    };

    const handleToggleZoom = (pIdx: number, lIdx: number, box: number[]) => {
        if (zoomConfig?.pIdx === pIdx && zoomConfig?.lIdx === lIdx) {
            setZoom(null);
            return;
        }

        setIsTransforming(true);
        const boxH = (box[2] - box[0]) / 10;
        const boxW = (box[3] - box[1]) / 10;

        let scale = Math.min(2.8, Math.max(1.6, 85 / boxW));
        if (boxW > 85 || boxH > 20) scale = 1.8;

        const centerX = (box[1] + box[3]) / 20;
        const centerY = (box[0] + box[2]) / 20;

        setZoom({
            pIdx,
            lIdx,
            x: centerX - 50 / scale,
            y: centerY - 30 / scale,
            scale
        });

        setTimeout(() => setIsTransforming(false), 500);
    };

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#F8F7F4] border-r">
            <Document
                file={file}
                onLoadSuccess={onLoadSuccess}
                loading={
                    <div className="flex flex-col items-center justify-center h-full min-h-[50vh] animate-pulse">
                        <div className="h-4 w-32 bg-black/5 rounded mb-4" />
                        <span className="text-sm text-muted font-lora">Initializing Manuscript...</span>
                    </div>
                }
            >
                <div className="max-w-[1700px] mx-auto p-10 space-y-24">
                    {Array.from({ length: numPages }).map((_, i) => {
                        const lines = parseLines(transcriptions?.[i]);
                        const isPageZoomed = zoomConfig?.pIdx === i;
                        const isBulkEditing = bulkEditingPage === i;

                        return (
                            <div key={i} className="flex gap-12 items-start h-[780px]">

                                {/* ── LEFT COLUMN: PDF PAGE ── */}
                                <div className="shrink-0 flex flex-col">
                                    <span className="text-[10px] font-bold text-muted/40 mb-2 uppercase tracking-wider font-lora">
                                        Folio {i + 1}
                                    </span>
                                    <div
                                        className="relative bg-white rounded-xl shadow-2xl border border-border/20 overflow-hidden"
                                        style={{ width: pdfWidth, height: '720px' }}
                                    >
                                        <div
                                            className={`transition-transform duration-500 ease-[cubic-bezier(0.2,0,0,1)] origin-top-left ${isTransforming ? 'pointer-events-none' : ''}`}
                                            style={{
                                                transform: isPageZoomed
                                                    ? `scale(${zoomConfig.scale}) translate(${-zoomConfig.x}%, ${-zoomConfig.y}%)`
                                                    : 'scale(1) translate(0,0)'
                                            }}
                                        >
                                            <Page pageNumber={i + 1} width={pdfWidth} renderTextLayer={false} renderAnnotationLayer={false} />

                                            {!isBulkEditing && lines.map((line, idx) => {
                                                if (!line.box_2d) return null;

                                                const isLocalActive = (mainHover?.pIdx === i && mainHover?.lIdx === idx) ||
                                                    (zoomConfig?.pIdx === i && zoomConfig?.lIdx === idx);
                                                const isExtActive = externalHighlight?.pIdx === i && externalHighlight?.lIdx === idx;

                                                return (
                                                    <div
                                                        key={idx}
                                                        onMouseEnter={() => !isTransforming && setMainHover({ pIdx: i, lIdx: idx })}
                                                        onMouseLeave={() => setMainHover(null)}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleToggleZoom(i, idx, line.box_2d!);
                                                            handleMainLineClick(i, idx);
                                                        }}
                                                        className={`absolute cursor-pointer transition-all duration-150 ${
                                                            isLocalActive ? 'bg-accent/15 ring-2 ring-accent/60 z-10' :
                                                                isExtActive ? 'bg-amber-300/25 ring-2 ring-amber-500/70 z-10' : ''
                                                        }`}
                                                        style={{
                                                            top: `${line.box_2d[0] / 10}%`,
                                                            left: `${line.box_2d[1] / 10}%`,
                                                            height: `${(line.box_2d[2] - line.box_2d[0]) / 10}%`,
                                                            width: `${(line.box_2d[3] - line.box_2d[1]) / 10}%`,
                                                        }}
                                                    />
                                                );
                                            })}
                                        </div>

                                        {isPageZoomed && (
                                            <button
                                                onClick={() => setZoom(null)}
                                                className="absolute bottom-6 right-6 bg-black/70 text-white px-4 py-2 rounded-full text-[10px] font-bold backdrop-blur-md shadow-xl hover:bg-black transition-all z-20 pointer-events-auto"
                                            >
                                                RESET VIEW
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* ── RIGHT COLUMN: TRANSCRIPTION LIST ── */}
                                <div className="flex-1 flex flex-col h-[720px] mt-6">

                                    {/* Panel Header with Bulk Actions */}
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold text-muted/40 uppercase font-lora tracking-wider">Transcription</span>

                                        {!isBulkEditing && lines.length > 0 && (
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => setBulkEditingPage(i)}
                                                    className="text-[10px] text-muted hover:text-accent font-bold flex items-center gap-1 transition-colors font-lora"
                                                >
                                                    <PencilIcon /> EDIT ALL
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if(confirm("Are you sure you want to clear all transcriptions for this page?")) {
                                                            deleteAllOnPage(docId, i);
                                                        }
                                                    }}
                                                    className="text-[10px] text-muted hover:text-red-500 font-bold flex items-center gap-1 transition-colors font-lora"
                                                >
                                                    <TrashIcon /> CLEAR ALL
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Panel Content (List vs Bulk Editor) */}
                                    <div className="bg-white rounded-xl border border-border/30 shadow-sm flex flex-col flex-1 overflow-hidden">
                                        {isBulkEditing ? (
                                            <BulkEditor
                                                lines={lines}
                                                onCancel={() => setBulkEditingPage(null)}
                                                onSave={(newLines) => {
                                                    updatePageTranscriptions(docId, i, newLines);
                                                    setBulkEditingPage(null);
                                                }}
                                            />
                                        ) : (
                                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                                {lines.map((line, idx) => {
                                                    const isLocalActive = (mainHover?.pIdx === i && mainHover?.lIdx === idx) ||
                                                        (zoomConfig?.pIdx === i && zoomConfig?.lIdx === idx);
                                                    const isExtActive = externalHighlight?.pIdx === i && externalHighlight?.lIdx === idx;

                                                    return (
                                                        <SentenceRow
                                                            key={`${i}-${idx}`}
                                                            ref={el => {
                                                                sentenceRefs.current[`${i}-${idx}`] = el;
                                                            }}
                                                            text={line.text}
                                                            idx={idx}
                                                            isActive={isLocalActive}
                                                            isExternalHighlight={isExtActive}
                                                            onHover={(active) => !isTransforming && setMainHover(active ? {
                                                                pIdx: i,
                                                                lIdx: idx
                                                            } : null)}
                                                            onSave={(val) => updateTranscription(docId, i, idx, val)}
                                                            onDelete={() => deleteTranscriptionLine(docId, i, idx)}
                                                            onZoomRequest={() => {
                                                                if (line.box_2d) {
                                                                    handleToggleZoom(i, idx, line.box_2d);
                                                                }
                                                                handleMainLineClick(i, idx);
                                                            }}
                                                            onMapRequest={(rect) => {
                                                                const globalLineIdx = localToGlobal(transcriptions, i, idx);
                                                                setMappingPopover({ globalLineIdx, rect });
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
    );
}