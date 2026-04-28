import React from 'react';

export interface TranscriptionLine {
    text: string;
    box_2d?: number[];
    id?: string;
}

export function parseLines(textData?: string): TranscriptionLine[] {
    try {
        const parsed = JSON.parse(textData || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/** Local (pageIdx, lineIdx) → flat global index across all pages */
export function localToGlobal(
    transcriptions: string[],
    pageIdx: number,
    lineIdx: number
): number {
    let count = 0;
    for (let p = 0; p < pageIdx; p++) {
        count += parseLines(transcriptions?.[p]).length;
    }
    return count + lineIdx;
}

/** Flat global index → (pageIdx, lineIdx) */
export function globalToLocal(
    transcriptions: string[],
    globalIdx: number
): { pIdx: number; lIdx: number } {
    let count = 0;
    for (let p = 0; p < (transcriptions?.length ?? 0); p++) {
        const len = parseLines(transcriptions[p]).length;
        if (count + len > globalIdx) return { pIdx: p, lIdx: globalIdx - count };
        count += len;
    }
    return { pIdx: 0, lIdx: 0 };
}

/** Find the mapped global line, falling back to nearest key if exact key is absent */
export function findNearestMappedLine(
    map: Record<string, number>,
    globalLine: number
): number {
    if (String(globalLine) in map) return map[String(globalLine)];
    const keys = Object.keys(map).map(Number).sort((a, b) => a - b);
    if (keys.length === 0) return 0;
    let nearest = keys[0];
    let minDist = Math.abs(globalLine - nearest);
    for (const k of keys) {
        const d = Math.abs(globalLine - k);
        if (d < minDist) {
            minDist = d;
            nearest = k;
        }
    }
    return map[String(nearest)];
}

/**
 * Render a transcription string, turning <abbr>…</abbr> spans into styled
 * highlighted nodes — identical rendering in both the main panel and side panel.
 */
export function renderAbbrText(val: string): React.ReactNode {
    const parts = val.split(/(<abbr>.*?<\/abbr>)/g);
    return (
        <>
            {parts.map((part, i) => {
                if (part.startsWith('<abbr>') && part.endsWith('</abbr>')) {
                    const inner = part.replace(/<\/?abbr>/g, '');
                    return (
                        <span
                            key={i}
                            className="bg-accent/15 text-accent px-1 rounded border-b border-accent/40 font-semibold"
                        >
              {inner}
            </span>
                    );
                }
                return <span key={i}>{part}</span>;
            })}
        </>
    );
}