'use client';

import React, { useEffect, useState } from 'react';
import { useDocumentStore } from '@/app/store/useDocumentStore';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import {
    ChevronDown,
    ChevronUp,
    Clock,
    Diff,
    Trash2,
    Equal,
    Save,
    Hash,
    MessageSquare,
    BookOpen
} from 'lucide-react';
import { localToGlobal } from '../lib/lineUtils';

export default function ComparisonOverlay() {
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<'editor' | 'history'>('editor');
    const [type, setType] = useState<'difference' | 'similarity'>('difference');
    const [note, setNote] = useState('');

    const [pageA, setPageA] = useState('');
    const [lineA, setLineA] = useState('');
    const [textA, setTextA] = useState('');
    const [pageB, setPageB] = useState('');
    const [lineB, setLineB] = useState('');
    const [textB, setTextB] = useState('');

    const {
        mainDoc, sideDoc,
        lastSelection,
        setMainPanelScrollTarget,
        setSidePanelScrollTarget,
        setMainHover,
        setSideHover,
        setIsHistoryHovering
    } = useDocumentStore();

    const history = useLiveQuery(
        () => {
            if (!mainDoc?.id || !sideDoc?.id) return [];
            return db.variations
                .where('docAId').anyOf([mainDoc.id, sideDoc.id])
                .filter(v =>
                    (v.docAId === mainDoc.id && v.docBId === sideDoc.id) ||
                    (v.docAId === sideDoc.id && v.docBId === mainDoc.id)
                )
                .toArray();
        },
        [mainDoc?.id, sideDoc?.id]
    );

    const resolvePositions = (v: any) => {
        const isAInMain = v.docAId === mainDoc?.id;
        return {
            left: isAInMain ? v.locA : v.locB,
            right: isAInMain ? v.locB : v.locA
        };
    };

    useEffect(() => {
        if (!lastSelection) return;
        if (lastSelection.target === 'A') {
            setPageA((lastSelection.pIdx + 1).toString());
            setLineA((lastSelection.lIdx + 1).toString());
            setTextA(lastSelection.text);
        } else {
            setPageB((lastSelection.pIdx + 1).toString());
            setLineB((lastSelection.lIdx + 1).toString());
            setTextB(lastSelection.text);
        }
        setIsExpanded(true);
        setActiveTab('editor');
    }, [lastSelection]);

    const handleSave = async () => {
        if (!mainDoc || !sideDoc) return;
        await db.variations.add({
            type,
            docAId: mainDoc.id!,
            docBId: sideDoc.id!,
            locA: { pIdx: parseInt(pageA) - 1, lIdx: parseInt(lineA) - 1, text: textA },
            locB: { pIdx: parseInt(pageB) - 1, lIdx: parseInt(lineB) - 1, text: textB },
            note,
            createdAt: Date.now()
        });
        setNote('');
        setActiveTab('history');
    };

    const navigateToLines = (v: any) => {
        if (!mainDoc || !sideDoc) return;
        const { left, right } = resolvePositions(v);
        setMainPanelScrollTarget(localToGlobal(mainDoc.transcriptions, left.pIdx, left.lIdx));
        setSidePanelScrollTarget(localToGlobal(sideDoc.transcriptions, right.pIdx, right.lIdx));
    };

    const formatDate = (ts: number) => {
        const d = new Date(ts);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' ' +
            d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    if (!sideDoc) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 pointer-events-none font-lora">
            <div className={`bg-paper border border-border shadow-[0_15px_50px_rgba(30,20,10,0.25)] rounded-2xl transition-all duration-500 flex flex-col overflow-hidden pointer-events-auto ${isExpanded ? 'h-[460px]' : 'h-14'}`}>

                {/* Header */}
                <div
                    className="h-14 px-6 flex items-center justify-between cursor-pointer hover:bg-black/[0.02] shrink-0 transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-accent/10 p-1.5 rounded-lg text-accent">
                            <BookOpen className="w-4 h-4" />
                        </div>
                        <span className="font-playfair font-bold text-base text-ink">Collation Tool</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:flex items-center gap-2 px-3 py-0.5 bg-parchment/60 rounded-full border border-border/50">
                            <span className="text-[9px] font-bold text-ink/60 uppercase truncate max-w-[80px] font-lora">{mainDoc.name}</span>
                            <span className="text-muted/30 text-[9px]">↔</span>
                            <span className="text-[9px] font-bold text-ink/60 uppercase truncate max-w-[80px] font-lora">{sideDoc.name}</span>
                        </div>
                        {isExpanded ? <ChevronDown className="text-ink/40 w-4 h-4" /> : <ChevronUp className="text-ink/40 w-4 h-4" />}
                    </div>
                </div>

                {isExpanded && (
                    <>
                        {/* Tabs */}
                        <div className="flex border-y border-border/40 bg-parchment/40 shrink-0">
                            <button
                                onClick={() => setActiveTab('editor')}
                                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${activeTab === 'editor' ? 'bg-paper text-accent shadow-[inset_0_-2px_0_rgba(181,115,42,1)]' : 'text-ink/40 hover:text-ink'}`}
                            >
                                <Save className="w-3 h-3" /> Entry
                            </button>
                            <button
                                onClick={() => setActiveTab('history')}
                                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${activeTab === 'history' ? 'bg-paper text-accent shadow-[inset_0_-2px_0_rgba(181,115,42,1)]' : 'text-ink/40 hover:text-ink'}`}
                            >
                                <Clock className="w-3 h-3" /> Archive ({history?.length || 0})
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-paper p-5">
                            {activeTab === 'editor' ? (
                                <div className="space-y-4 animate-in fade-in duration-300">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setType('difference')}
                                            className={`flex-1 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${type === 'difference' ? 'bg-danger/10 border-danger/20 text-danger' : 'bg-paper border-border/60 text-ink/40 hover:border-border'}`}
                                        >
                                            <Diff className="w-3.5 h-3.5" /> Difference
                                        </button>
                                        <button
                                            onClick={() => setType('similarity')}
                                            className={`flex-1 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${type === 'similarity' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-paper border-border/60 text-ink/40 hover:border-border'}`}
                                        >
                                            <Equal className="w-3.5 h-3.5" /> Similarity
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        {[
                                            { lab: "Main", p: pageA, sp: setPageA, l: lineA, sl: setLineA, t: textA, st: setTextA },
                                            { lab: "Side", p: pageB, sp: setPageB, l: lineB, sl: setLineB, t: textB, st: setTextB }
                                        ].map((ms, i) => (
                                            <div key={i} className="space-y-2">
                                                <div className="flex gap-2">
                                                    <div className="relative flex-[0.8]">
                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-accent/50 uppercase tracking-tighter">Pg</span>
                                                        <input type="text" value={ms.p} onChange={e=>ms.sp(e.target.value)} className="w-full pl-7 pr-1 py-1.5 text-sm border border-border/60 rounded bg-white/50 focus:ring-1 focus:ring-accent/40 focus:border-accent/60 outline-none text-ink font-bold" />
                                                    </div>
                                                    <div className="relative flex-[0.8]">
                                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-accent/50 uppercase tracking-tighter">Ln</span>
                                                        <input type="text" value={ms.l} onChange={e=>ms.sl(e.target.value)} className="w-full pl-7 pr-1 py-1.5 text-sm border border-border/60 rounded bg-white/50 focus:ring-1 focus:ring-accent/40 focus:border-accent/60 outline-none text-ink font-bold" />
                                                    </div>
                                                    <div className="flex-1 flex items-center"><span className="text-[10px] font-bold text-ink/30 uppercase tracking-widest leading-none">{ms.lab}</span></div>
                                                </div>
                                                <textarea
                                                    value={ms.t}
                                                    onChange={e=>ms.st(e.target.value)}
                                                    className="w-full p-2.5 text-sm border border-border/60 rounded-lg h-16 resize-none leading-relaxed bg-white focus:ring-1 focus:ring-accent/30 focus:border-accent/40 outline-none transition-all italic text-ink font-lora"
                                                    placeholder="Transcribed text..."
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-1.5 px-1 opacity-60">
                                            <MessageSquare className="w-3.5 h-3.5" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest font-lora">Commentary</span>
                                        </div>
                                        <textarea
                                            placeholder="Notes on variants..."
                                            className="w-full p-3 text-sm border border-border/60 rounded-lg bg-parchment/20 focus:ring-1 focus:ring-accent/30 focus:border-accent/40 outline-none transition-all font-lora text-ink"
                                            rows={1}
                                            value={note}
                                            onChange={(e) => {
                                                setNote(e.target.value);
                                                e.target.style.height = 'auto';
                                                e.target.style.height = e.target.scrollHeight + 'px';
                                            }}
                                        />
                                    </div>

                                    <button
                                        onClick={handleSave}
                                        className="w-full bg-ink text-paper py-3 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-ink-faint transition-all shadow-lg flex items-center justify-center gap-2 font-lora"
                                    >
                                        <Save className="w-3.5 h-3.5" /> Commit Collation
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4 animate-in fade-in duration-300 pb-2">
                                    {history?.length === 0 && (
                                        <div className="py-20 text-center text-ink/30 text-sm italic">Archive is empty.</div>
                                    )}
                                    {[...history || []].reverse().map((v) => {
                                        const { left, right } = resolvePositions(v);
                                        return (
                                            <div
                                                key={v.id}
                                                onClick={() => navigateToLines(v)}
                                                onMouseEnter={() => {
                                                    setIsHistoryHovering(true)
                                                    setMainHover({ pIdx: left.pIdx, lIdx: left.lIdx });
                                                    setSideHover({ pIdx: right.pIdx, lIdx: right.lIdx });
                                                }}
                                                onMouseLeave={() => {
                                                    setIsHistoryHovering(false)
                                                    setMainHover(null);
                                                    setSideHover(null);
                                                }}
                                                className="group p-4 bg-white border border-border/40 rounded-xl hover:bg-parchment/30 cursor-pointer transition-all relative shadow-sm hover:shadow-md"
                                            >
                                                <div className={`absolute left-0 top-4 bottom-4 w-1 rounded-r-full ${v.type === 'difference' ? 'bg-danger/40' : 'bg-emerald-500/40'}`} />

                                                <div className="flex flex-col gap-3">
                                                    <div className="flex items-center justify-between pr-8">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="px-2 py-1 bg-parchment rounded border border-border/40 flex items-center gap-1.5">
                                                                <Hash className="w-3 h-3 text-accent/50" />
                                                                <span className="text-[11px] font-bold text-ink font-mono">{left.pIdx+1}.{left.lIdx+1} <span className="opacity-20 mx-1">↔</span> {right.pIdx+1}.{right.lIdx+1}</span>
                                                            </div>
                                                            <span className={`text-[9px] font-bold uppercase tracking-widest ${v.type === 'difference' ? 'text-danger/80' : 'text-emerald-700/80'}`}>
                                                                {v.type}
                                                            </span>
                                                        </div>
                                                        <span className="text-[9px] text-ink/40 font-lora tracking-tight">{formatDate(v.createdAt)}</span>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-6">
                                                        <p className="text-[14px] text-ink leading-relaxed italic border-l-2 border-border/20 pl-3 line-clamp-2">"{left.text}"</p>
                                                        <p className="text-[14px] text-ink leading-relaxed italic border-l-2 border-border/20 pl-3 line-clamp-2">"{right.text}"</p>
                                                    </div>

                                                    {v.note && (
                                                        <div className="bg-accent/5 p-3 rounded-lg border border-accent/10 flex items-start gap-2.5">
                                                            <MessageSquare className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
                                                            <p className="text-[13px] text-ink/80 font-medium leading-snug">{v.note}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                <button
                                                    onClick={(e) => { e.stopPropagation(); if (confirm('Remove entry?')) db.variations.delete(v.id!); }}
                                                    className="absolute top-4 right-4 p-2 text-ink/10 hover:text-danger hover:bg-danger/5 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}