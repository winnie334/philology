'use client';

import React, { useState, useEffect, useRef, memo } from 'react';
import { PencilIcon, TrashIcon, CheckIcon, XIcon, LinkIcon } from './Icons';

interface SentenceRowProps {
    text: string;
    idx: number;
    isActive: boolean;
    isExternalHighlight: boolean;
    /** Hides edit / delete / map buttons — used by the side panel */
    readOnly?: boolean;
    onSave: (val: string) => void;
    onDelete: () => void;
    onHover: (active: boolean) => void;
    /** Fired on row click — used for zoom in main panel, scroll-other-panel in side panel */
    onZoomRequest: () => void;
    onMapRequest: (rect: DOMRect) => void;
}

const SentenceRow = memo(
    React.forwardRef<HTMLDivElement, SentenceRowProps>(
        (
            { text, idx, isActive, isExternalHighlight, readOnly = false,
                onSave, onDelete, onHover, onZoomRequest, onMapRequest },
            ref
        ) => {
            const [isEditing, setIsEditing] = useState(false);
            const [draft, setDraft] = useState(text);
            const inputRef = useRef<HTMLInputElement>(null);

            useEffect(() => { if (isEditing) inputRef.current?.focus(); }, [isEditing]);

            const handleCommit = (e?: React.MouseEvent | React.KeyboardEvent) => {
                e?.stopPropagation(); onSave(draft); setIsEditing(false);
            };
            const handleCancel = (e: React.MouseEvent) => {
                e.stopPropagation(); setDraft(text); setIsEditing(false);
            };

            let rowCls = 'border-l-4 border-transparent hover:bg-black/[0.02]';
            if (isActive) rowCls = 'bg-accent/10 border-l-4 border-accent';
            else if (isExternalHighlight) rowCls = 'bg-amber-50 border-l-4 border-amber-400/70';

            return (
                <div
                    ref={ref}
                    className={`group flex items-start gap-3 py-2.5 px-4 border-b border-border/20 transition-all cursor-pointer ${rowCls}`}
                    onMouseEnter={() => onHover(true)}
                    onMouseLeave={() => onHover(false)}
                    onClick={() => !isEditing && onZoomRequest()}
                >
                    <span className="w-5 text-[9px] text-muted/40 font-mono mt-1.5 shrink-0">{idx + 1}</span>

                    {isEditing && !readOnly ? (
                        <div className="flex-1 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <input
                                ref={inputRef}
                                className="flex-1 bg-white border border-accent/50 rounded px-2 py-1 text-sm font-lora outline-none shadow-sm"
                                value={draft}
                                onChange={e => setDraft(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleCommit(e); if (e.key === 'Escape') setIsEditing(false); }}
                            />
                            <button onClick={handleCommit} className="p-1.5 bg-accent text-white rounded hover:bg-accent/80 shadow-sm transition-colors"><CheckIcon /></button>
                            <button onClick={handleCancel} className="p-1.5 bg-white border border-border text-muted rounded hover:text-ink shadow-sm transition-colors"><XIcon /></button>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-start justify-between gap-4">
                            <p className="text-[14px] font-lora text-ink leading-relaxed"><span>{text}</span>;</p>
                            {!readOnly && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                    <button
                                        title="Compare in another manuscript"
                                        onClick={e => { e.stopPropagation(); onMapRequest((e.currentTarget as HTMLElement).getBoundingClientRect()); }}
                                        className="p-1 text-muted hover:text-accent transition-colors"
                                    ><LinkIcon /></button>
                                    <button onClick={e => { e.stopPropagation(); setIsEditing(true); }} className="p-1 text-muted hover:text-accent transition-colors"><PencilIcon /></button>
                                    <button onClick={e => { e.stopPropagation(); if (confirm('Delete this line?')) onDelete(); }} className="p-1 text-muted hover:text-red-500 transition-colors"><TrashIcon /></button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
        }
    )
);

SentenceRow.displayName = 'SentenceRow';
export default SentenceRow;