'use client';

import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {Document, Page, pdfjs} from 'react-pdf';
import {parseLines, globalToLocal, localToGlobal, findNearestMappedLine, TranscriptionLine} from '../lib/lineUtils';
import SentenceRow from './SentenceRow';
import {XIcon} from './Icons';
import {useDocumentStore} from "@/app/store/useDocumentStore";

export default function SideDocPanel() {
    const {
        sideDoc,
        closeSidePanel,
        sidePanelScrollTarget,
        mainHover,
        mainDoc,
        activeMapping,
        setSideHover,
        sideHover,
        setSidePanelScrollTarget
    } = useDocumentStore();

    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [numPages, setNumPages] = useState(0);
    const [pdfLoaded, setPdfLoaded] = useState(false);
    const [sidePdfWidth, setSidePdfWidth] = useState(240);

    const panelRef = useRef<HTMLDivElement>(null);
    const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

    // 2. Calculate External Highlight (When main panel is hovered)
    const externalHighlight = useMemo(() => {
        if (!sideDoc || !mainHover || !activeMapping || !mainDoc) return null;
        const isDocA = activeMapping.docAId === mainDoc.id;
        const map = isDocA ? activeMapping.mapAtoB : activeMapping.mapBtoA;
        const globalLine = localToGlobal(mainDoc.transcriptions, mainHover.pIdx, mainHover.lIdx);
        const mappedGlobal = findNearestMappedLine(map, globalLine);
        return globalToLocal(sideDoc.transcriptions, mappedGlobal);
    }, [sideDoc, mainHover, activeMapping, mainDoc]);

    // ── Object URL ──
    useEffect(() => {
        if (!sideDoc) return;
        const url = URL.createObjectURL(sideDoc.data);
        setPdfUrl(url);
        setPdfLoaded(false);
        return () => URL.revokeObjectURL(url);
    }, [sideDoc]);

    // ── Scrolling Logic ──
    const scrollToGlobalLine = useCallback((globalIdx: number) => {
        if (!sideDoc) return;
        const target = globalToLocal(sideDoc.transcriptions ?? [], globalIdx);
        pageRefs.current[target.pIdx]?.scrollIntoView({behavior: 'smooth', block: 'start'});
        setTimeout(() => {
            rowRefs.current[`${target.pIdx}-${target.lIdx}`]?.scrollIntoView({
                behavior: 'smooth', block: 'center',
            });
        }, 350);
    }, [sideDoc]);

    useEffect(() => {
        if (sidePanelScrollTarget !== null && pdfLoaded) {
            scrollToGlobalLine(sidePanelScrollTarget);
            setSidePanelScrollTarget(null); // Reset after consumption
        }
    }, [sidePanelScrollTarget, pdfLoaded, scrollToGlobalLine, setSidePanelScrollTarget]);

    // ── Interaction Handlers ──
    const handleLineClick = (pIdx: number, lIdx: number) => {
        if (!sideDoc || !activeMapping || !mainDoc) return;
        const isDocA = activeMapping.docAId === mainDoc.id;
        const map = isDocA ? activeMapping.mapBtoA : activeMapping.mapAtoB;
        const globalLine = localToGlobal(sideDoc.transcriptions, pIdx, lIdx);
        const mappedGlobal = findNearestMappedLine(map, globalLine);

        // We could emit a "mainPanelScrollRequest" here if needed
        console.log("Requesting main panel scroll to global index:", mappedGlobal);
    };

    if (!sideDoc) return null;

    const pdfH = Math.floor(sidePdfWidth * 1.414);

    return (
        <div ref={panelRef} className="flex-1 flex flex-col overflow-hidden border-l border-border/50 bg-[#F3F1EC]">
            <div
                className="shrink-0 sticky top-0 z-10 bg-[#F3F1EC]/95 backdrop-blur-md border-b border-border/40 px-5 py-3 flex items-center justify-between">
                <p className="font-playfair text-[15px] font-semibold text-ink truncate">{sideDoc.name}</p>
                <button onClick={closeSidePanel} className="p-2 rounded-lg hover:bg-border/60"><XIcon/></button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-8 space-y-20">
                <Document
                    file={pdfUrl}
                    onLoadSuccess={({numPages: n}) => {
                        setNumPages(n);
                        setPdfLoaded(true);
                    }}
                >
                    {Array.from({length: numPages}).map((_, i) => {
                        const lines = parseLines(sideDoc.transcriptions?.[i]);
                        const pageIsHighlighted = externalHighlight?.pIdx === i;

                        return (
                            <div key={i} ref={el => {
                                pageRefs.current[i] = el;
                            }} className="flex gap-5 items-start" style={{height: pdfH + 36}}>
                                <div className="flex-1 flex flex-col min-w-0" style={{height: pdfH + 36}}>
                                    <span
                                        className="text-[9px] font-bold text-muted/40 uppercase mb-2">Folio {i + 1}</span>
                                    <div
                                        className={`flex-1 bg-white rounded-xl border flex flex-col overflow-hidden transition-all ${
                                            pageIsHighlighted ? 'border-amber-300 shadow-md' : 'border-border/30'
                                        }`}>
                                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                                            {lines.map((line: TranscriptionLine, idx: number) => (
                                                <SentenceRow
                                                    ref={el => {
                                                        rowRefs.current[`${i}-${idx}`] = el;
                                                    }}
                                                    key={idx}
                                                    text={line.text}
                                                    idx={idx}
                                                    readOnly
                                                    isActive={sideHover?.pIdx === i && sideHover?.lIdx === idx}
                                                    isExternalHighlight={externalHighlight?.pIdx === i && externalHighlight?.lIdx === idx}
                                                    onHover={active => setSideHover(active ? {
                                                        pIdx: i,
                                                        lIdx: idx
                                                    } : null)}
                                                    onZoomRequest={() => handleLineClick(i, idx)}
                                                    onMapRequest={() => {
                                                    }}
                                                    onSave={() => {
                                                    }}
                                                    onDelete={() => {
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="shrink-0 flex flex-col" style={{width: sidePdfWidth}}>
                                    <div className="mb-2" style={{height: 20}}/>
                                    <div className="relative bg-white rounded-xl overflow-hidden shadow-lg border"
                                         style={{height: pdfH}}>
                                        <Page pageNumber={i + 1} width={sidePdfWidth} renderTextLayer={false}
                                              renderAnnotationLayer={false}/>
                                        {lines.map((line: TranscriptionLine, idx: number) => (
                                            <div
                                                key={idx}
                                                className={`absolute cursor-pointer transition-all ${
                                                    (sideHover?.pIdx === i && sideHover?.lIdx === idx) ? 'bg-accent/20 ring-2 ring-accent/70' :
                                                        (externalHighlight?.pIdx === i && externalHighlight?.lIdx === idx) ? 'bg-amber-300/25 ring-2 ring-amber-500/70' : ''
                                                }`}
                                                style={{
                                                    top: `${line.box_2d![0] / 10}%`,
                                                    left: `${line.box_2d![1] / 10}%`,
                                                    height: `${(line.box_2d![2] - line.box_2d![0]) / 10}%`,
                                                    width: `${(line.box_2d![3] - line.box_2d![1]) / 10}%`,
                                                }}
                                                onMouseEnter={() => setSideHover({pIdx: i, lIdx: idx})}
                                                onMouseLeave={() => setSideHover(null)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </Document>
            </div>
        </div>
    );
}