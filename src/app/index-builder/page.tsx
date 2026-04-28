'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ─── Blacklist ────────────────────────────────────────────────────────────────

const BLACKLIST = new Set([
    'et', 'atque', 'ac', 'aut', 'vel', 'nec', 'neque', 'sed', 'at', 'nam',
    'enim', 'autem', 'vero', 'quidem', 'ergo', 'igitur', 'itaque', 'quia',
    'quod', 'quam', 'quasi', 'sicut', 'tamquam', 'tamen', 'dum', 'cum',
    'si', 'nisi', 'ne', 'ut', 'nunc', 'iam', 'tunc',
    'in', 'ad', 'de', 'ex', 'ab', 'a', 'e', 'per', 'pro', 'sub', 'super',
    'ante', 'post', 'inter', 'contra', 'sine', 'ob',
    'is', 'ea', 'id', 'hic', 'haec', 'hoc', 'ille', 'illa', 'illud',
    'ipse', 'ipsa', 'ipsum', 'qui', 'quae', 'que', 'se', 'sui', 'sibi',
    'eo', 'eius', 'ei', 'eos', 'eas', 'eam', 'eum',
    'est', 'sunt', 'esse', 'sit', 'sint', 'erat', 'erant', 'fuit',
    'habet', 'habent', 'fit', 'fiunt',
    'omnis', 'omne', 'omnes', 'omnia',
    'plus', 'minus', 'non', 'se',
]);

// ─── Types ────────────────────────────────────────────────────────────────────

interface IndexEntry {
    word: string;
    occurrences: string[];
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function stripPunctuation(s: string): string {
    // Remove leading/trailing non-letter characters
    return s.replace(/^[^a-zA-Z]+/, '').replace(/[^a-zA-Z]+$/, '');
}

function buildIndex(raw: string): IndexEntry[] {
    const wordMap: Map<string, Set<string>> = new Map();

    let topLevel = 0;
    let midLevel = 0;
    let sentenceLevel = 0;

    const tokens = raw.replace(/\r\n/g, '\n').replace(/[^\S\n]+/g, ' ').trim().split(/\s+/);

    function addWord(word: string) {
        if (!word || word.length < 2) return;
        if (BLACKLIST.has(word)) return;
        if (/^\d+$/.test(word)) return;
        if (topLevel === 0 && midLevel === 0 && sentenceLevel === 0) return;
        const ref = topLevel + '.' + midLevel + '.' + sentenceLevel;
        if (!wordMap.has(word)) wordMap.set(word, new Set());
        wordMap.get(word)!.add(ref);
    }

    function processToken(token: string) {
        if (!token) return;

        // N. standalone — mid level
        if (/^\d+\.$/.test(token)) {
            midLevel = parseInt(token, 10);
            sentenceLevel = 0;
            return;
        }

        // NWord — sentence number glued to word start e.g. "1Nunc"
        const gluedMatch = /^(\d+)([a-zA-Z].*)$/.exec(token);
        if (gluedMatch) {
            sentenceLevel = parseInt(gluedMatch[1], 10);
            const word = stripPunctuation(gluedMatch[2]).toLowerCase();
            addWord(word);
            return;
        }

        // Standalone number
        if (/^\d+$/.test(token)) {
            sentenceLevel = parseInt(token, 10);
            return;
        }

        // Plain word
        const word = stripPunctuation(token).toLowerCase();
        addWord(word);
    }

    for (const token of tokens) {
        const t = token.trim();
        if (!t) continue;

        // [N] — top level, possibly with remainder e.g. "[25]1."
        const topMatch = /^\[(\d+)\](.*)$/.exec(t);
        if (topMatch) {
            topLevel = parseInt(topMatch[1], 10);
            midLevel = 0;
            sentenceLevel = 0;
            if (topMatch[2]) processToken(topMatch[2]);
            continue;
        }

        processToken(t);
    }

    return Array.from(wordMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([word, refs]) => ({ word, occurrences: Array.from(refs) }));
}

function formatIndexText(entries: IndexEntry[]): string {
    return entries.map(e => e.word + '  ' + e.occurrences.join(', ')).join('\n');
}

// ─── Index rows renderer ─────────────────────────────────────────────────────

function renderIndexRows(entries: IndexEntry[]): React.ReactNode[] {
    const rows: React.ReactNode[] = [];
    let lastLetter = '';

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const letter = entry.word[0].toUpperCase();

        if (letter !== lastLetter) {
            lastLetter = letter;
            rows.push(
                <div
                    key={'divider-' + letter}
                    className="px-6 py-1.5 bg-parchment/70 border-b border-border/40"
                >
                    <span className="font-playfair text-xs font-bold text-accent/80 uppercase tracking-widest">
                        {letter}
                    </span>
                </div>
            );
        }

        rows.push(
            <div
                key={entry.word}
                className={
                    'grid grid-cols-[180px_1fr] px-6 py-2.5 border-b border-border/20 transition-colors hover:bg-accent/[0.035] ' +
                    (i % 2 === 0 ? 'bg-transparent' : 'bg-parchment/20')
                }
            >
                <span className="font-lora text-[14px] text-ink font-medium">
                    {entry.word}
                </span>
                <span className="font-lora text-[13px] text-ink-faint leading-relaxed">
                    {entry.occurrences.map((ref, ri) => (
                        <React.Fragment key={ref}>
                            <span className="font-mono text-[12px] text-muted hover:text-accent transition-colors">
                                {ref}
                            </span>
                            {ri < entry.occurrences.length - 1 && (
                                <span className="text-muted/40 mx-1">,</span>
                            )}
                        </React.Fragment>
                    ))}
                </span>
            </div>
        );
    }

    return rows;
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ArrowLeftIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
        </svg>
    );
}

function CopyIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IndexBuilderPage() {
    const router = useRouter();
    const [inputText, setInputText] = useState('');
    const [entries, setEntries] = useState<IndexEntry[]>([]);
    const [copied, setCopied] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleInputChange = useCallback((value: string) => {
        setInputText(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setEntries(value.trim() ? buildIndex(value) : []);
        }, 800);
    }, []);

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(formatIndexText(entries));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const indexRows = renderIndexRows(entries);

    return (
        <div className="min-h-screen bg-parchment font-lora flex flex-col">

            {/* Header */}
            <header className="sticky top-0 z-10 border-b border-border/50 bg-paper/70 backdrop-blur-md">
                <div className="max-w-5xl mx-auto px-8 py-5 flex items-center gap-5">
                    <button
                        onClick={() => router.push('/')}
                        className="inline-flex items-center gap-2 text-sm text-muted hover:text-accent transition-colors shrink-0"
                    >
                        <ArrowLeftIcon /> Archive
                    </button>
                    <div className="w-px h-4 bg-border shrink-0" />
                    <div>
                        <h1 className="font-playfair text-[22px] font-bold text-ink leading-none tracking-tight">
                            Index Builder
                        </h1>
                        <p className="text-[10px] text-muted mt-0.5 uppercase tracking-[0.18em]">
                            Automatic word index from numbered text
                        </p>
                    </div>
                </div>
            </header>

            {/* Body */}
            <div className="flex-1 max-w-5xl mx-auto w-full px-8 py-8 flex flex-col gap-6 min-h-0">

                {/* Input */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase tracking-[0.18em] text-muted font-lora">
                            Source text
                        </label>
                        {entries.length > 0 && (
                            <span className="text-[10px] text-muted/60 font-lora">
                                {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                            </span>
                        )}
                    </div>
                    <textarea
                        value={inputText}
                        onChange={e => handleInputChange(e.target.value)}
                        placeholder={'Paste your numbered text here\n\n[25] 1. 1Nunc autem volo dicere…'}
                        className="w-full h-52 resize-none rounded-2xl border border-border bg-paper px-5 py-4 font-lora text-[14px] text-ink leading-relaxed placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent/60 transition-all shadow-sm"
                    />
                    <p className="text-[11px] text-muted/60 font-lora">
                        Index refreshes automatically.
                        Format: <code className="font-mono text-[11px] bg-border/30 px-1 rounded">[X] Y. Ztext…</code>
                    </p>
                </div>

                {/* Output */}
                {entries.length > 0 && (
                    <div className="flex flex-col gap-2 animate-fade-in" style={{ minHeight: 0, flex: '1 1 0' }}>
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] uppercase tracking-[0.18em] text-muted font-lora">
                                Generated index &mdash; {entries.length} {entries.length === 1 ? 'word' : 'words'}
                            </label>
                            <button
                                onClick={handleCopy}
                                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg border border-border text-xs font-lora text-muted hover:border-accent/50 hover:text-accent hover:bg-accent/5 active:scale-[0.97] transition-all"
                            >
                                {copied ? <><CheckIcon /> Copied</> : <><CopyIcon /> Copy</>}
                            </button>
                        </div>

                        <div className="overflow-y-auto rounded-2xl border border-border bg-paper shadow-sm"
                             style={{ flex: '1 1 0', minHeight: 0 }}>
                            {/* Column headers */}
                            <div className="sticky top-0 bg-paper/95 backdrop-blur-sm border-b border-border/60 grid grid-cols-[180px_1fr] px-6 py-2.5 z-10">
                                <span className="text-[10px] uppercase tracking-[0.18em] text-muted font-lora">
                                    Word
                                </span>
                                <span className="text-[10px] uppercase tracking-[0.18em] text-muted font-lora">
                                    References
                                </span>
                            </div>
                            {indexRows}
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {!inputText && (
                    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                        <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-border/70 flex items-center justify-center">
                            <span className="font-playfair text-2xl text-border/80">I</span>
                        </div>
                        <div>
                            <p className="font-playfair text-lg text-ink/60">Paste your text to begin</p>
                            <p className="text-xs text-muted/50 font-lora mt-1">
                                Words are indexed as you type
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 5px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #D5C9B5; border-radius: 10px; }
            `}</style>
        </div>
    );
}