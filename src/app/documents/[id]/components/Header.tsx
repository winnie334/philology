'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDocumentStore } from '@/app/store/useDocumentStore';
import { ArrowLeftIcon, SparklesIcon, ChevronDownIcon, XIcon } from '../components/Icons';
import AiTranscribePopover from '../components/AiTranscribePopover';

interface HeaderProps {
    docName: string;
    numPages: number;
    pdfDocProxy: any; // The property required by the interface
    onRunTranscription: (start: number, end: number) => void;
    isTranscribing: boolean;
    transcribingIdx: number | null;
}

export default function Header({
                                   docName,
                                   numPages,
                                   pdfDocProxy,
                                   onRunTranscription,
                                   isTranscribing,
                                   transcribingIdx
                               }: HeaderProps) {
    const router = useRouter();
    const { sideDoc, closeSidePanel } = useDocumentStore();
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [range, setRange] = useState({ start: 1, end: 1 });

    return (
        <header className="sticky top-0 z-20 border-b border-border/50 bg-white/90 backdrop-blur-md shrink-0">
            <div className="px-8 py-4 flex items-center gap-5">
                <button
                    onClick={() => router.push('/')}
                    className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent font-lora transition-colors"
                >
                    <ArrowLeftIcon /> Archive
                </button>

                <div className="w-px h-4 bg-border" />

                <h1 className="font-playfair text-xl text-ink truncate flex-1">
                    {docName.replace(/\.pdf$/i, '')}
                </h1>

                {sideDoc && (
                    <div className="flex items-center gap-2 border-r border-border/50 pr-5 mr-5">
            <span className="text-[11px] text-accent font-lora tracking-wide">
              ↔ {sideDoc.name.replace(/\.pdf$/i, '')}
            </span>
                        <button
                            onClick={closeSidePanel}
                            className="p-1.5 rounded-lg hover:bg-border/60 text-muted hover:text-ink transition-colors"
                        >
                            <XIcon />
                        </button>
                    </div>
                )}

                <div className="relative">
                    <button
                        onClick={() => setIsPopoverOpen(!isPopoverOpen)}
                        // Ensure we have a proxy and pages before allowing transcription
                        disabled={isTranscribing || !pdfDocProxy || numPages === 0}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                            isTranscribing
                                ? 'bg-amber-100 text-amber-700 cursor-not-allowed'
                                : 'bg-accent/10 text-accent hover:bg-accent hover:text-white border border-accent/20'
                        }`}
                    >
                        <SparklesIcon className={isTranscribing ? 'animate-pulse' : ''} />
                        {isTranscribing ? `Transcribing Page ${transcribingIdx! + 1}…` : 'AI Transcribe'}
                        {!isTranscribing && <ChevronDownIcon className="opacity-70" />}
                    </button>

                    {isPopoverOpen && (
                        <AiTranscribePopover
                            numPages={numPages}
                            startPage={range.start}
                            endPage={range.end}
                            onStartChange={(v) => setRange(prev => ({ ...prev, start: v }))}
                            onEndChange={(v) => setRange(prev => ({ ...prev, end: v }))}
                            onSubmit={() => {
                                onRunTranscription(range.start, range.end);
                                setIsPopoverOpen(false);
                            }}
                            onClose={() => setIsPopoverOpen(false)}
                        />
                    )}
                </div>
            </div>
        </header>
    );
}