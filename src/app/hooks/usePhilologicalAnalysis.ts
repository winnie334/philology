// hooks/usePhilologicalAnalysis.ts
import {useState} from 'react';
import {PhilologicalAnalysisResult} from "@/types/philology";
import {db} from "@/lib/db";

export function usePhilologicalAnalysis() {
    const [data, setData] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const analyze = async () => {
        const allDocs = await db.documents.toArray();

        if (allDocs.length < 2) {
            alert("You need at least two manuscripts for a comparative analysis.");
            return;
        }

        const manuscriptsPayload = allDocs.map(doc => {
            const combinedText = doc.transcriptions.map(page => {
                try {
                    const parsed = JSON.parse(page || '[]');
                    return parsed.map((l: any) => l.text).join(' ');
                } catch {
                    return '';
                }
            }).join('\n\n');

            return {
                name: doc.name,
                fullText: combinedText
            };
        });


        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({manuscripts: manuscriptsPayload}),
            });

            if (!response.ok) {
                throw new Error('Analysis request failed');
            }

            const result: PhilologicalAnalysisResult = await response.json();
            setData(result);
        } catch (err: any) {
            setError(err.message || 'An unknown error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return {analyze, data, isLoading, error};
}