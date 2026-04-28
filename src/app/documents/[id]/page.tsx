'use client';

import React, {useEffect, useState, useMemo} from 'react';
import {useParams} from 'next/navigation';
import {useLiveQuery} from 'dexie-react-hooks';
import {pdfjs} from 'react-pdf';

import {AppDocument, AppMapping, db} from '@/lib/db';
import {useDocumentStore} from '@/app/store/useDocumentStore';
import {useTranscription} from '@/app/hooks/useTranscription';
import {findNearestMappedLine, localToGlobal, globalToLocal} from './lib/lineUtils';

import MappingSelector from './components/MappingSelector';
import Header from "@/app/documents/[id]/components/Header";
import DocumentPanel from "@/app/documents/[id]/components/DocumentPanel"; // The new unified component

if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

export default function DocumentViewer() {
    const {id} = useParams();
    const docId = parseInt(id as string, 10);

    const {
        mainDoc, setMainDoc,
        sideDoc, openSidePanel, closeSidePanel,

        mainHover, setMainHover,
        sideHover, setSideHover,

        mappingPopover, setMappingPopover,
        sidePanelScrollTarget, setSidePanelScrollTarget,
        activeMapping
    } = useDocumentStore();

    const [pdfDocProxy, setPdfDocProxy] = useState<any>(null);
    const [pdfWidth, setPdfWidth] = useState(550);
    const [mainPdfUrl, setMainPdfUrl] = useState<string | null>(null);
    const [sidePdfUrl, setSidePdfUrl] = useState<string | null>(null);

    // We add a scroll target for the main panel specifically
    const [mainPanelScrollTarget, setMainPanelScrollTarget] = useState<number | null>(null);

    const allMappings = useLiveQuery(() => db.mappings.toArray(), []);
    const allDocuments = useLiveQuery(() => db.documents.toArray(), []);

    // ── Initial Document Loads ──
    useEffect(() => {
        let isMounted = true;
        const loadInitialDoc = async () => {
            const data = await db.documents.get(docId);
            if (isMounted && data) setMainDoc(data as AppDocument);
        };
        loadInitialDoc();
        return () => {
            isMounted = false;
        };
    }, [docId, setMainDoc]);

    useEffect(() => {
        if (!mainDoc?.data) return;
        const url = URL.createObjectURL(mainDoc.data);
        setMainPdfUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [mainDoc?.data]);

    useEffect(() => {
        if (!sideDoc?.data) return;
        const url = URL.createObjectURL(sideDoc.data);
        setSidePdfUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [sideDoc?.data]);

    // ── Hooks ──
    const {runTranscription, isProcessing, transcribingPageIndex} = useTranscription(
        pdfDocProxy,
        docId,
        (newTranscriptions) => {
            if (mainDoc) setMainDoc({...mainDoc, transcriptions: newTranscriptions});
        }
    );

    // ── Computed Highlights ──
    const sideExternalHighlight = useMemo(() => {
        if (!mainDoc || !mainHover || !activeMapping || !sideDoc) return null;
        const map = (activeMapping.docAId === mainDoc.id) ? activeMapping.mapAtoB : activeMapping.mapBtoA;
        const globalLine = localToGlobal(mainDoc.transcriptions, mainHover.pIdx, mainHover.lIdx);
        return globalToLocal(sideDoc.transcriptions, findNearestMappedLine(map, globalLine));
    }, [mainDoc, mainHover, activeMapping, sideDoc]);

    const mainExternalHighlight = useMemo(() => {
        if (!mainDoc || !sideHover || !activeMapping || !sideDoc) return null;
        const map = (activeMapping.docAId === mainDoc.id) ? activeMapping.mapBtoA : activeMapping.mapAtoB;
        const globalLine = localToGlobal(sideDoc.transcriptions, sideHover.pIdx, sideHover.lIdx);
        return globalToLocal(mainDoc.transcriptions, findNearestMappedLine(map, globalLine));
    }, [mainDoc, sideHover, activeMapping, sideDoc]);

    // ── Click Handlers ──
    const handleMainLineClick = (pIdx: number, lIdx: number) => {
        if (!sideDoc || !activeMapping || !mainDoc) return;
        const map = (activeMapping.docAId === mainDoc.id) ? activeMapping.mapAtoB : activeMapping.mapBtoA;
        const globalLine = localToGlobal(mainDoc.transcriptions, pIdx, lIdx);
        setSidePanelScrollTarget(findNearestMappedLine(map, globalLine));
    };

    const handleSideLineClick = (pIdx: number, lIdx: number) => {
        if (!sideDoc || !activeMapping || !mainDoc) return;
        const map = (activeMapping.docAId === mainDoc.id) ? activeMapping.mapBtoA : activeMapping.mapAtoB;
        const globalLine = localToGlobal(sideDoc.transcriptions, pIdx, lIdx);
        setMainPanelScrollTarget(findNearestMappedLine(map, globalLine));
    };

    const handleSelectMapping = async (mapping: AppMapping) => {
        if (!mappingPopover || !mainDoc) return;
        const isDocA = mapping.docAId === mainDoc.id;
        const otherDocId = isDocA ? mapping.docBId : mapping.docAId;
        const map = isDocA ? mapping.mapAtoB : mapping.mapBtoA;

        const mappedGlobal = findNearestMappedLine(map, mappingPopover.globalLineIdx);
        const otherDoc = await db.documents.get(otherDocId);

        if (otherDoc) {
            openSidePanel(otherDoc as AppDocument, mapping);
            setSidePanelScrollTarget(mappedGlobal);
        }
        setMappingPopover(null);
    };

    if (!mainDoc) {
        return (
            <div className="h-screen flex items-center justify-center bg-[#F8F7F4]">
                <div className="animate-pulse font-lora text-muted">Loading Manuscript...</div>
            </div>
        );
    }

    // Shrink the PDFs down slightly when both panels are open so they comfortably fit the 50/50 split
    const currentPdfWidth = sideDoc ? pdfWidth * 0.8 : pdfWidth;

    return (
        <div className="h-screen flex flex-col bg-[#F8F7F4] overflow-hidden font-lora">
            <Header
                docName={mainDoc.name}
                numPages={pdfDocProxy?.numPages || 0}
                pdfDocProxy={pdfDocProxy}
                onRunTranscription={runTranscription}
                isTranscribing={isProcessing}
                transcribingIdx={transcribingPageIndex}
            />

            <div className="flex-1 flex overflow-hidden">
                <main className={`flex flex-1 transition-all duration-300 ease-in-out ${sideDoc ? 'w-1/2' : 'w-full'}`}>
                    <DocumentPanel
                        doc={mainDoc}
                        pdfUrl={mainPdfUrl}
                        pdfWidth={currentPdfWidth}
                        localHover={mainHover}
                        setLocalHover={setMainHover}
                        externalHighlight={mainExternalHighlight}
                        onLineClick={handleMainLineClick}
                        onLoadSuccess={setPdfDocProxy}
                        scrollTargetGlobal={mainPanelScrollTarget}
                        onScrollTargetConsumed={() => setMainPanelScrollTarget(null)}
                        onMapRequest={(pIdx, lIdx, rect) => {
                            const globalLineIdx = localToGlobal(mainDoc.transcriptions, pIdx, lIdx);
                            setMappingPopover({globalLineIdx, rect});
                        }}
                    />
                </main>

                {sideDoc && (
                    <aside className="w-1/2 flex transition-all duration-300 ease-in-out">
                        <DocumentPanel
                            isSidePanel
                            doc={sideDoc}
                            pdfUrl={sidePdfUrl}
                            pdfWidth={currentPdfWidth}
                            localHover={sideHover}
                            setLocalHover={setSideHover}
                            externalHighlight={sideExternalHighlight}
                            onLineClick={handleSideLineClick}
                            onClose={closeSidePanel}
                            scrollTargetGlobal={sidePanelScrollTarget}
                            onScrollTargetConsumed={() => setSidePanelScrollTarget(null)}
                        />
                    </aside>
                )}
            </div>

            {mappingPopover && (
                <MappingSelector
                    anchorRect={mappingPopover.rect}
                    currentDocId={docId}
                    mappings={allMappings ?? []}
                    allDocs={allDocuments ?? []}
                    onSelect={handleSelectMapping}
                    onClose={() => setMappingPopover(null)}
                />
            )}

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 5px;
                    height: 5px;
                }

                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e5e5e1;
                    border-radius: 10px;
                }
            `}</style>
        </div>
    );
}