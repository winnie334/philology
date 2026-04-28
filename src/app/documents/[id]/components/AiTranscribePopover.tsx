'use client';

import React from 'react';
import { XIcon } from './Icons';

interface AiTranscribePopoverProps {
    numPages: number;
    startPage: number;
    endPage: number;
    onStartChange: (v: number) => void;
    onEndChange: (v: number) => void;
    onSubmit: () => void;
    onClose: () => void;
}

export default function AiTranscribePopover({
                                                numPages,
                                                startPage,
                                                endPage,
                                                onStartChange,
                                                onEndChange,
                                                onSubmit,
                                                onClose,
                                            }: AiTranscribePopoverProps) {
    return (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-border shadow-lg rounded-lg p-4 z-50">
            <div className="flex justify-between items-center mb-3">
                <h3 className="font-playfair font-semibold text-ink text-sm">Select Range</h3>
                <button onClick={onClose} className="text-muted hover:text-ink transition-colors">
                    <XIcon />
                </button>
            </div>

            <div className="flex items-center gap-3 mb-4">
                <div className="flex-1">
                    <label className="block text-[10px] uppercase text-muted mb-1 font-semibold tracking-wider">
                        From
                    </label>
                    <input
                        type="number"
                        min={1}
                        max={numPages}
                        value={startPage}
                        onChange={(e) => onStartChange(Number(e.target.value))}
                        className="w-full text-sm border border-border rounded px-2 py-1 outline-none focus:border-accent/60"
                    />
                </div>
                <span className="text-muted mt-4">–</span>
                <div className="flex-1">
                    <label className="block text-[10px] uppercase text-muted mb-1 font-semibold tracking-wider">
                        To
                    </label>
                    <input
                        type="number"
                        min={1}
                        max={numPages}
                        value={endPage}
                        onChange={(e) => onEndChange(Number(e.target.value))}
                        className="w-full text-sm border border-border rounded px-2 py-1 outline-none focus:border-accent/60"
                    />
                </div>
            </div>

            <button
                onClick={onSubmit}
                className="w-full bg-accent text-white py-2 rounded-md text-sm font-medium hover:bg-accent/90 active:scale-[0.98] shadow-sm transition-all"
            >
                Start Processing
            </button>
        </div>
    );
}