'use client';

import { useRouter } from 'next/navigation';

const IndexIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
);

export default function IndexBuilderButton() {
    const router = useRouter();
    return (
        <div className="border-t border-border/50 pt-8">
            <div className="flex items-center justify-between mb-3">
                <div>
                    <p className="text-[10px] text-muted uppercase tracking-[0.18em] font-lora">Index Builder</p>
                    <p className="text-xs text-muted/70 font-lora mt-0.5 leading-relaxed max-w-[340px]">
                        Automatically generate a word index with references from any numbered Latin text.
                    </p>
                </div>
                <button
                    onClick={() => router.push('/index-builder')}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-lora font-medium
                               border border-border text-muted
                               hover:border-accent/50 hover:text-accent hover:bg-accent/5
                               active:scale-[0.97] transition-all cursor-pointer"
                >
                    <IndexIcon />
                    Open Index Builder
                </button>
            </div>
        </div>
    );
}