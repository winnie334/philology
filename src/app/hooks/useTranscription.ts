'use client';

import {useState} from 'react';
import {db} from '@/lib/db';

export function useTranscription(
    pdfDocProxy: any,
    docId: number,
    onPageTranscribed?: (updatedTranscriptions: string[]) => void
) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [transcribingPageIndex, setTranscribingPageIndex] = useState<number | null>(null);

    const runTranscription = async (startPage: number, endPage: number) => {
        if (!pdfDocProxy || !docId) return;

        setIsProcessing(true);

        for (let currentPage = startPage; currentPage <= endPage; currentPage++) {
            setTranscribingPageIndex(currentPage - 1);
            try {
                const page = await pdfDocProxy.getPage(currentPage);
                const baseViewport = page.getViewport({scale: 1.0});
                const dynamicScale = Math.min(2200 / baseViewport.width, 5.0);
                const viewport = page.getViewport({scale: dynamicScale});

                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d')!;
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                await page.render({canvasContext: ctx, viewport}).promise;

                // Apply filters for better OCR
                const filtered = document.createElement('canvas');
                const fctx = filtered.getContext('2d')!;
                filtered.width = canvas.width;
                filtered.height = canvas.height;
                fctx.filter = 'grayscale(100%) contrast(150%)';
                fctx.drawImage(canvas, 0, 0);

                const base64Data = filtered.toDataURL('image/jpeg', 0.95).split(',')[1];

                const res = await fetch('/api/transcribe', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({base64Image: base64Data, mimeType: 'image/jpeg'}),
                });

                if (!res.ok) throw new Error('API route failed');
                const resultData = await res.json();

                // Update Dexie
                const currentDoc = await db.documents.get(docId);
                const updated = [...(currentDoc?.transcriptions || [])];
                while (updated.length < currentPage) updated.push('');
                updated[currentPage - 1] = JSON.stringify(resultData.lines);

                await db.documents.update(docId, {transcriptions: updated});

                // Instantly update the Zustand store so the UI reacts
                if (onPageTranscribed) {
                    onPageTranscribed(updated);
                }

            } catch (err) {
                console.error(`Transcription error on page ${currentPage}:`, err);
            }
        }

        setIsProcessing(false);
        setTranscribingPageIndex(null);
    };

    return {runTranscription, isProcessing, transcribingPageIndex};
}