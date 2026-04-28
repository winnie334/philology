'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppAbbreviation, AppDocument } from '@/lib/db';
import { useAbbreviations } from '../lib/AbbreviationContext';
import { parseLines } from '../lib/lineUtils';

// ─── Usage counter ────────────────────────────────────────────────────────────

function countUsages(abbr: string, doc: AppDocument | null): number {
    if (!abbr.trim() || !doc) return 0;
    let count = 0;
    const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'g');
    for (const pageJson of doc.transcriptions ?? []) {
        for (const line of parseLines(pageJson)) {
            const hits = line.text?.match(pattern);
            if (hits) count += hits.length;
        }
    }
    return count;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const PlusIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);
const TrashIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
);

// ─── Single editable row ──────────────────────────────────────────────────────

interface AbbrevRowProps {
    entry: AppAbbreviation;
    usageCount: number;
    onUpdate: (id: number, field: 'abbr' | 'meaning', value: string) => Promise<void>;
    onDelete: (id: number) => Promise<void>;
}

function AbbrevRow({ entry, usageCount, onUpdate, onDelete }: AbbrevRowProps) {
    const abbrRef = useRef<HTMLInputElement>(null);
    const meaningRef = useRef<HTMLInputElement>(null);

    // Auto-focus the abbreviation field for brand-new (empty) rows
    useEffect(() => {
        if (!entry.abbr && !entry.meaning) {
            abbrRef.current?.focus();
        }
    }, [entry.id]); // only fire when a new row mounts

    const handleBlur = useCallback(
        (field: 'abbr' | 'meaning', value: string) => {
            if (entry.id !== undefined) {
                onUpdate(entry.id, field, value);
            }
        },
        [entry.id, onUpdate]
    );

    return (
        <div className="group px-4 py-3 border-b border-[#c8dfd0]/60 hover:bg-[#e4f0e8]/50 transition-colors">
            <div className="flex items-center gap-2">
                {/* Abbreviation input */}
                <input
                    ref={abbrRef}
                    defaultValue={entry.abbr}
                    placeholder="abbr."
                    onBlur={e => handleBlur('abbr', e.target.value)}
                    className="w-20 shrink-0 bg-white border border-[#a8c9b4] rounded-md px-2 py-1.5
                               text-[13px] font-mono text-[#2d5a40] placeholder:text-[#a8c9b4]
                               focus:outline-none focus:ring-2 focus:ring-[#4a7c59]/30 focus:border-[#4a7c59]
                               transition-all"
                />
                <span className="text-[#a8c9b4] text-sm shrink-0">→</span>
                {/* Meaning input */}
                <input
                    ref={meaningRef}
                    defaultValue={entry.meaning}
                    placeholder="full meaning"
                    onBlur={e => handleBlur('meaning', e.target.value)}
                    className="flex-1 min-w-0 bg-white border border-[#a8c9b4] rounded-md px-2 py-1.5
                               text-[13px] font-lora text-[#2d5a40] placeholder:text-[#a8c9b4]
                               focus:outline-none focus:ring-2 focus:ring-[#4a7c59]/30 focus:border-[#4a7c59]
                               transition-all"
                />
                {/* Delete */}
                <button
                    onClick={() => entry.id !== undefined && onDelete(entry.id)}
                    className="shrink-0 p-1.5 rounded-md text-[#a8c9b4] opacity-0 group-hover:opacity-100
                               hover:text-[#9b2c2c] hover:bg-red-50 transition-all"
                    title="Remove abbreviation"
                >
                    <TrashIcon />
                </button>
            </div>
            {/* Usage count */}
            <div className="items-left">
            {entry.abbr.trim() && (
                <p className="mt-1.5 pl-1 text-[10px] text-[#7aab8a] font-lora">
                    {usageCount === 0
                        ? 'no usages in this manuscript'
                        : `${usageCount} usage${usageCount === 1 ? '' : 's'} in this manuscript`}
                </p>
            )}
            </div>
        </div>
    );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface AbbreviationPanelProps {
    /** The document currently being viewed — used for usage counts */
    currentDoc: AppDocument | null;
}

export default function AbbreviationPanel({ currentDoc }: AbbreviationPanelProps) {
    const {
        liveAbbreviations,
        isOpen,
        openPanel,
        closePanel,
        addAbbreviation,
        updateAbbreviation,
        deleteAbbreviation,
    } = useAbbreviations();

    // Pre-compute usage counts for all live abbreviations
    const usageCounts = useMemo(() => {
        const map: Record<number, number> = {};
        for (const entry of liveAbbreviations) {
            if (entry.id !== undefined) {
                map[entry.id] = countUsages(entry.abbr, currentDoc);
            }
        }
        return map;
    }, [liveAbbreviations, currentDoc]);

    return (
        <>
            {/* ── Backdrop ── */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-30 bg-[#1a1612]/30 backdrop-blur-[1px] transition-opacity"
                    onClick={closePanel}
                />
            )}

            {/*/!* ── Collapsed tab — always visible at the right edge ── *!/*/}
            {/*{!isOpen && (*/}
            {/*    <button*/}
            {/*        onClick={openPanel}*/}
            {/*        className="fixed right-0 top-1/2 -translate-y-1/2 z-40*/}
            {/*                   flex flex-col items-center justify-center gap-2*/}
            {/*                   bg-[#4a7c59] text-white*/}
            {/*                   w-7 py-5 rounded-l-xl*/}
            {/*                   shadow-lg hover:bg-[#3d6b4f] active:scale-95*/}
            {/*                   transition-all duration-200"*/}
            {/*        title="Open abbreviations panel"*/}
            {/*    >*/}
            {/*        /!* Rotated label *!/*/}
            {/*        <span*/}
            {/*            className="text-[9px] font-lora font-semibold uppercase tracking-[0.18em] whitespace-nowrap"*/}
            {/*            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}*/}
            {/*        >*/}
            {/*            Abbreviations*/}
            {/*        </span>*/}
            {/*        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"*/}
            {/*             stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">*/}
            {/*            <polyline points="15 18 9 12 15 6" />*/}
            {/*        </svg>*/}
            {/*    </button>*/}
            {/*)}*/}

            {/* ── Slide-in panel ── */}
            <div
                className={`fixed top-0 right-0 h-full z-40 w-[340px]
                            flex flex-col bg-[#eef5f0] border-l border-[#a8c9b4]
                            shadow-2xl shadow-[#1a1612]/20
                            transition-transform duration-300 ease-in-out
                            ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >

                {/* Tab — always hangs off the left edge */}
                <button
                    onClick={isOpen ? closePanel : openPanel}
                    className="absolute left-0 -translate-x-full top-1/2 -translate-y-1/2
               flex flex-col items-center justify-center gap-2
               bg-[#4a7c59] text-white w-7 py-5 rounded-l-xl
               shadow-lg hover:bg-[#3d6b4f] transition-colors"
                >
                <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                      className="text-[9px] font-lora font-semibold uppercase tracking-[0.18em] whitespace-nowrap">
                  Abbreviations
                </span>
                    {/* Flip arrow direction based on state */}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points={isOpen ? "9 18 15 12 9 6" : "15 18 9 12 15 6"} />
                    </svg>
            </button>

                {/* Header */}
                <div className="shrink-0 px-5 py-4 border-b border-[#a8c9b4]/70 bg-[#e4f0e8] flex items-center justify-between">
                    <div>
                        <h2 className="font-playfair text-[17px] font-bold text-[#2d5a40] leading-none">
                            Abbreviations
                        </h2>
                    </div>
                    <button
                        onClick={closePanel}
                        className="p-2 rounded-lg text-[#7aab8a] hover:text-[#2d5a40] hover:bg-[#c8dfd0]
                                   transition-colors"
                        title="Close panel"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                             stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                        </svg>
                    </button>
                </div>

                {/* Legend */}
                <div className="shrink-0 px-5 py-3 border-b border-[#c8dfd0]/60 bg-[#eef5f0]">
                    <p className="text-[11px] text-[#7aab8a] font-lora leading-relaxed">
                        Abbreviated forms are automatically expanded and highlighted in all transcriptions.
                    </p>
                    {/*<p className="text-[10px] text-[#7aab8a] font-lora mt-1 uppercase tracking-[0.18em] text-center mt-3">*/}
                    {/*    {liveAbbreviations.length} defined*/}
                    {/*</p>*/}
                </div>



                {/* Rows */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {liveAbbreviations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
                            <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-[#a8c9b4] flex items-center justify-center">
                                <span className="text-[#a8c9b4] text-xl font-playfair">æ</span>
                            </div>
                            <p className="text-sm text-[#7aab8a] font-lora leading-relaxed">
                                No abbreviations yet. Press the button below to add one.
                            </p>
                        </div>
                    ) : (
                        liveAbbreviations.map(entry => (
                            <AbbrevRow
                                key={entry.id}
                                entry={entry}
                                usageCount={entry.id !== undefined ? (usageCounts[entry.id] ?? 0) : 0}
                                onUpdate={updateAbbreviation}
                                onDelete={deleteAbbreviation}
                            />
                        ))
                    )}
                </div>

                {/* Add row button */}
                <div className="shrink-0 px-4 py-4 border-t border-[#a8c9b4]/70 bg-[#e4f0e8]">
                    <button
                        onClick={addAbbreviation}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl  cursor-pointer
                                   border-2 border-dashed border-[#a8c9b4] text-[#4a7c59]
                                   text-sm font-lora font-medium
                                   hover:bg-[#c8dfd0]/60 hover:border-[#4a7c59] active:scale-[0.98]
                                   transition-all"
                    >
                        <PlusIcon />
                        Add new
                    </button>
                </div>
            </div>
        </>
    );
}