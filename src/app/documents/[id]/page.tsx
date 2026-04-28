'use client';

import React, {useEffect, useState} from 'react';
import {useParams} from 'next/navigation';
import {useLiveQuery} from 'dexie-react-hooks';
import {pdfjs} from 'react-pdf';

// Database & Store
import {AppDocument, AppMapping, db} from '@/lib/db';
import {useDocumentStore} from '@/app/store/useDocumentStore';
import {useTranscription} from '@/app/hooks/useTranscription';
import {findNearestMappedLine} from './lib/lineUtils';

// Sub-components
import SideDocPanel from './components/SideDocPanel';
import MappingSelector from './components/MappingSelector';
import Header from "@/app/documents/[id]/components/Header";
import MainWorkspace from "@/app/documents/[id]/components/MainWorkspace";

// Configure PDF Worker
if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

export default function DocumentViewer() {
    const {id} = useParams();
    const docId = parseInt(id as string, 10);

    // ── Store State & Actions ──
    const {
        mainDoc,
        setMainDoc,
        sideDoc,
        openSidePanel,
        mappingPopover,
        setMappingPopover,
        setSidePanelScrollTarget,
    } = useDocumentStore();

    // ── Local UI State ──
    const [pdfDocProxy, setPdfDocProxy] = useState<any>(null);
    const [pdfWidth, setPdfWidth] = useState(550);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    // ── Dexie Queries (Only for secondary data now) ──
    const allMappings = useLiveQuery(() => db.mappings.toArray(), []);
    const allDocuments = useLiveQuery(() => db.documents.toArray(), []);

    // ── Manual Initial Load (Replaces useLiveQuery for main doc) ──
    useEffect(() => {
        let isMounted = true;
        const loadInitialDoc = async () => {
            const data = await db.documents.get(docId);
            if (isMounted && data) {
                setMainDoc(data as AppDocument);
            }
        };
        loadInitialDoc();
        return () => {
            isMounted = false;
        };
    }, [docId, setMainDoc]);

    // ── Blob URL Generation ──
    useEffect(() => {
        if (mainDoc?.data) {
            const url = URL.createObjectURL(mainDoc.data);
            setPdfUrl(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [mainDoc?.data]);

    // ── Hooks ──
    const {runTranscription, isProcessing, transcribingPageIndex} = useTranscription(
        pdfDocProxy,
        docId,
        (newTranscriptions) => {
            if (mainDoc) {
                setMainDoc({...mainDoc, transcriptions: newTranscriptions});
            }
        }
    );

    // Handle selection from the MappingSelector popover
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
                {/* ── Main Viewport ── */}
                <main
                    className={`flex flex-1 transition-all duration-300 ease-in-out ${
                        sideDoc ? 'w-1/2' : 'w-full'
                    }`}
                >
                    <MainWorkspace
                        docId={docId}
                        file={pdfUrl}
                        numPages={pdfDocProxy?.numPages || 0}
                        pdfWidth={pdfWidth}
                        transcriptions={mainDoc.transcriptions || []}
                        onLoadSuccess={setPdfDocProxy}
                    />
                </main>

                {/* ── Side Panel: Parallel View (Self-Sustaining) ── */}
                {sideDoc && <SideDocPanel/>}
            </div>

            {/* ── Modals & Popovers ── */}
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

            {/* Global Custom Scrollbars */}
            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 5px;
                    height: 5px;
                }

                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e5e5e1;
                    border-radius: 10px;
                }

                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
            `}</style>
        </div>
    );
}