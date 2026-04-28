'use client';

import React from 'react';
import { AppMapping, AppDocument } from '@/lib/db';
import { XIcon } from './Icons';

interface MappingSelectorProps {
    /** Bounding rect of the link button that was clicked — popover anchors to this */
    anchorRect: DOMRect;
    currentDocId: number;
    mappings: AppMapping[];
    allDocs: AppDocument[];
    onSelect: (mapping: AppMapping) => void;
    onClose: () => void;
}

export default function MappingSelector({
                                            anchorRect,
                                            currentDocId,
                                            mappings,
                                            allDocs,
                                            onSelect,
                                            onClose,
                                        }: MappingSelectorProps) {
    const relevant = mappings.filter(
        (m) => m.docAId === currentDocId || m.docBId === currentDocId
    );

    const POPOVER_WIDTH = 256;
    // Estimate height to decide whether to open upward
    const estimatedHeight = relevant.length > 0 ? 100 + relevant.length * 68 : 150;
    const spaceBelow = window.innerHeight - anchorRect.bottom - 8;
    const openAbove = spaceBelow < estimatedHeight && anchorRect.top > estimatedHeight;

    const top = openAbove
        ? anchorRect.top - estimatedHeight - 6
        : anchorRect.bottom + 6;

    // Keep popover from overflowing the right edge
    const left = Math.min(
        Math.max(8, anchorRect.left),
        window.innerWidth - POPOVER_WIDTH - 8
    );

    return (
        <>
            {/* Transparent backdrop — click outside to close */}
            <div className="fixed inset-0 z-[99]" onClick={onClose} />

            {/* Popover card */}
            <div
                style={{
                    position: 'fixed',
                    top,
                    left,
                    width: POPOVER_WIDTH,
                    zIndex: 100,
                }}
                className="bg-paper rounded-xl border border-border shadow-2xl shadow-ink/10 p-4 animate-slide-up"
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="font-playfair text-sm font-semibold text-ink leading-none">
                            Compare in…
                        </h3>
                        <p className="text-[10px] text-muted font-lora mt-0.5">
                            Open a parallel view
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-border/60 transition-colors"
                    >
                        <XIcon />
                    </button>
                </div>

                {/* Options */}
                {relevant.length === 0 ? (
                    <div className="py-4 text-center space-y-1">
                        <p className="text-xs text-muted font-lora leading-relaxed">
                            No mappings found for this document.
                        </p>
                        <p className="text-[10px] text-muted/60 font-lora">
                            Use Begin Mapping from the archive first.
                        </p>
                    </div>
                ) : (
                    <ul className="space-y-1.5">
                        {relevant.map((mapping) => {
                            const otherDocId =
                                mapping.docAId === currentDocId ? mapping.docBId : mapping.docAId;
                            const otherDoc = allDocs.find((d) => d.id === otherDocId);
                            const lineCount = Object.keys(mapping.mapAtoB).length;

                            return (
                                <li key={mapping.id}>
                                    <button
                                        onClick={() => onSelect(mapping)}
                                        className="w-full text-left px-3 py-2.5 rounded-lg border border-border hover:border-accent/50 hover:bg-accent/5 active:scale-[0.98] transition-all group"
                                    >
                                        <p className="font-lora text-[13px] font-medium text-ink truncate group-hover:text-ink/80">
                                            {otherDoc?.name.replace(/\.pdf$/i, '') ?? 'Unknown manuscript'}
                                        </p>
                                        <p className="text-[10px] text-muted font-lora mt-0.5">
                                            {lineCount} aligned lines
                                        </p>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </>
    );
}