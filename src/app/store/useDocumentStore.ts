import {create} from 'zustand';
import {AppDocument, AppMapping, db} from '@/lib/db';

interface DocumentState {
    mainDoc: AppDocument | null;
    sideDoc: AppDocument | null;
    activeMapping: AppMapping | null;
    mainHover: { pIdx: number; lIdx: number } | null;
    sideHover: { pIdx: number; lIdx: number } | null;
    zoomConfig: { pIdx: number; lIdx: number; x: number; y: number; scale: number } | null;

    setMainDoc: (doc: AppDocument) => void;
    setMainHover: (hover: { pIdx: number; lIdx: number } | null) => void;
    setZoom: (config: any) => void;
    openSidePanel: (doc: AppDocument, mapping: AppMapping) => void;
    closeSidePanel: () => void;

    // Data Actions
    updateTranscription: (id: number, pIdx: number, lIdx: number, text: string) => Promise<void>;
    deleteTranscriptionLine: (id: number, pIdx: number, lIdx: number) => Promise<void>;
    deleteAllOnPage: (id: number, pIdx: number) => Promise<void>;

    sidePanelScrollTarget: number | null;
    setSidePanelScrollTarget: (target: number | null) => void;
    setSideHover: (hover: { pIdx: number; lIdx: number } | null) => void;

    mappingPopover: { globalLineIdx: number; rect: DOMRect } | null;
    setMappingPopover: (popover: { globalLineIdx: number; rect: DOMRect } | null) => void;
    updatePageTranscriptions: (id: number, pIdx: number, newLines: any[]) => Promise<void>;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
    mainDoc: null,
    sideDoc: null,
    activeMapping: null,
    mainHover: null,
    sideHover: null,
    zoomConfig: null,

    setMainDoc: (doc) => set({mainDoc: doc}),
    setMainHover: (mainHover) => set({mainHover}),
    setZoom: (zoomConfig) => set({zoomConfig}),

    openSidePanel: (doc, mapping) => set({sideDoc: doc, activeMapping: mapping}),
    closeSidePanel: () => set({sideDoc: null, activeMapping: null, sideHover: null}),

    updateTranscription: async (id, pIdx, lIdx, text) => {
        const doc = await db.documents.get(id);
        if (!doc) return;
        const trans = [...(doc.transcriptions ?? [])];
        const lines = JSON.parse(trans[pIdx] || '[]');
        if (lines[lIdx]) {
            lines[lIdx].text = text;
            trans[pIdx] = JSON.stringify(lines);

            // 1. Optimistic UI Update (Instant, no refresh)
            const currentDoc = get().mainDoc;
            if (currentDoc && currentDoc.id === id) {
                set({mainDoc: {...currentDoc, transcriptions: trans}});
            }

            // 2. Background DB Sync
            await db.documents.update(id, {transcriptions: trans});
        }
    },

    deleteTranscriptionLine: async (id, pIdx, lIdx) => {
        const doc = await db.documents.get(id);
        if (!doc) return;
        const trans = [...(doc.transcriptions ?? [])];
        const lines = JSON.parse(trans[pIdx] || '[]');
        lines.splice(lIdx, 1);
        trans[pIdx] = JSON.stringify(lines);

        // 1. Optimistic UI Update
        const currentDoc = get().mainDoc;
        if (currentDoc && currentDoc.id === id) {
            set({mainDoc: {...currentDoc, transcriptions: trans}});
        }

        // 2. Background DB Sync
        await db.documents.update(id, {transcriptions: trans});
    },

    deleteAllOnPage: async (id, pIdx) => {
        const doc = await db.documents.get(id);
        if (!doc) return;
        const trans = [...(doc.transcriptions ?? [])];
        trans[pIdx] = '[]';

        const currentDoc = get().mainDoc;
        if (currentDoc && currentDoc.id === id) {
            set({mainDoc: {...currentDoc, transcriptions: trans}});
        }

        await db.documents.update(id, {transcriptions: trans});
    },

    sidePanelScrollTarget: null,
    setSidePanelScrollTarget: (sidePanelScrollTarget) => set({sidePanelScrollTarget}),
    setSideHover: (sideHover) => set({sideHover}),
    mappingPopover: null,
    setMappingPopover: (mappingPopover) => set({mappingPopover}),
    updatePageTranscriptions: async (id, pIdx, newLines) => {
        const doc = await db.documents.get(id);
        if (!doc) return;

        const trans = [...(doc.transcriptions ?? [])];
        trans[pIdx] = JSON.stringify(newLines);

        const currentDoc = get().mainDoc;
        if (currentDoc && currentDoc.id === id) {
            set({mainDoc: {...currentDoc, transcriptions: trans}});
        }

        await db.documents.update(id, {transcriptions: trans});
    },
}));