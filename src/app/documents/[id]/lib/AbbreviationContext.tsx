'use client';

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AppAbbreviation, db } from '@/lib/db';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AbbreviationContextValue {
    /**
     * Snapshot that SentenceRows use for rendering.
     * Only refreshes when the panel is closed, so edits don't cause a live
     * re-render of every transcription line while the user is typing.
     */
    displayedAbbreviations: AppAbbreviation[];
    /** Always-fresh list used by the panel's editing UI */
    liveAbbreviations: AppAbbreviation[];
    isOpen: boolean;
    openPanel: () => void;
    closePanel: () => void;
    addAbbreviation: () => Promise<void>;
    updateAbbreviation: (id: number, field: 'abbr' | 'meaning', value: string) => Promise<void>;
    deleteAbbreviation: (id: number) => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AbbreviationContext = createContext<AbbreviationContextValue>({
    displayedAbbreviations: [],
    liveAbbreviations: [],
    isOpen: false,
    openPanel: () => {},
    closePanel: () => {},
    addAbbreviation: async () => {},
    updateAbbreviation: async () => {},
    deleteAbbreviation: async () => {},
});

export function AbbreviationProvider({ children }: { children: React.ReactNode }) {
    const liveAbbreviations = useLiveQuery(
        () => db.abbreviations.orderBy('createdAt').toArray(),
        [],
        []
    ) as AppAbbreviation[];

    const [displayedAbbreviations, setDisplayedAbbreviations] = useState<AppAbbreviation[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!isOpen && liveAbbreviations.length > 0 && displayedAbbreviations.length === 0) {
            setDisplayedAbbreviations(liveAbbreviations);
        }
    }, [liveAbbreviations]);

    const openPanel = useCallback(() => setIsOpen(true), []);

    const closePanel = useCallback(() => {
        setIsOpen(false);
        setDisplayedAbbreviations(liveAbbreviations);
    }, [liveAbbreviations]);

    const addAbbreviation = useCallback(async () => {
        await db.abbreviations.add({ abbr: '', meaning: '', createdAt: Date.now() });
    }, []);

    const updateAbbreviation = useCallback(
        async (id: number, field: 'abbr' | 'meaning', value: string) => {
            await db.abbreviations.update(id, { [field]: value });
        },
        []
    );

    const deleteAbbreviation = useCallback(async (id: number) => {
        await db.abbreviations.delete(id);
    }, []);

    return (
        <AbbreviationContext.Provider
            value={{
                displayedAbbreviations,
                liveAbbreviations,
                isOpen,
                openPanel,
                closePanel,
                addAbbreviation,
                updateAbbreviation,
                deleteAbbreviation,
            }}
        >
            {children}
        </AbbreviationContext.Provider>
    );
}

export function useAbbreviations() {
    return useContext(AbbreviationContext);
}

export function renderWithAbbreviations(
    text: string,
    abbreviations: AppAbbreviation[]
): React.ReactNode {
    const abbrTagParts = text.split(/(<abbr>.*?<\/abbr>)/g);

    return (
        <>
            {abbrTagParts.map((segment, segIdx) => {
                // ── Plain segment — apply user abbreviations → green ─────────
                if (abbreviations.length === 0) {
                    return <span key={segIdx}>{segment}</span>;
                }

                // Build a single regex from all non-empty abbreviations,
                // longest first to avoid shorter patterns stealing a match.
                const active = abbreviations
                    .filter(a => a.abbr.trim().length > 0)
                    .sort((a, b) => b.abbr.length - a.abbr.length);

                if (active.length === 0) return <span key={segIdx}>{segment}</span>;

                const escaped = active.map(a =>
                    a.abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                );
                // \b boundaries work for ASCII; for unicode Latin we also
                // check that the match isn't surrounded by other word chars.
                const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'g');

                const nodes: React.ReactNode[] = [];
                let last = 0;
                let m: RegExpExecArray | null;

                while ((m = pattern.exec(segment)) !== null) {
                    if (m.index > last) {
                        nodes.push(
                            <span key={`${segIdx}-t${last}`}>
                                {segment.slice(last, m.index)}
                            </span>
                        );
                    }
                    const entry = active.find(a => a.abbr === m![0]);
                    nodes.push(
                        <span
                            key={`${segIdx}-a${m.index}`}
                            title={`"${m[0]}" → ${entry?.meaning}`}
                            className="abbr-user"
                        >
                            {entry?.meaning ?? m[0]}
                        </span>
                    );
                    last = m.index + m[0].length;
                }

                if (last < segment.length) {
                    nodes.push(
                        <span key={`${segIdx}-t-end`}>{segment.slice(last)}</span>
                    );
                }

                return nodes.length > 0 ? (
                    <React.Fragment key={segIdx}>{nodes}</React.Fragment>
                ) : (
                    <span key={segIdx}>{segment}</span>
                );
            })}
        </>
    );
}