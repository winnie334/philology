'use client';

import React, {useEffect, useState} from 'react';
import {useDocumentStore} from '@/app/store/useDocumentStore';
import {db} from '@/lib/db';
import {useLiveQuery} from 'dexie-react-hooks';
import {ChevronDown, ChevronUp, Clock, Diff, Trash2} from 'lucide-react';
import {localToGlobal} from '../lib/lineUtils';

export default function ComparisonOverlay() {
    const [isExpanded, setIsExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<'editor' | 'history'>('editor');
    const [type, setType] = useState<'difference' | 'similarity'>('difference');
    const [note, setNote] = useState('');

    // Form inputs
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

    // 1. DYNAMIC FILTER: Only show history for the TWO documents currently open
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

    // 2. RESOLUTION LOGIC: Maps saved data to current Left/Right panel positions
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
        return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
    };

    // SAFETY: If panels aren't ready, don't render the tool
    if (!mainDoc || !sideDoc) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 pointer-events-none">
            <div className={`bg-white border border-border shadow-2xl rounded-xl transition-all duration-300 flex flex-col overflow-hidden pointer-events-auto ${isExpanded ? 'h-[500px]' : 'h-14'}`}>

                {/* Collapsed Header */}
                <div
                    className="h-14 px-6 flex items-center justify-between cursor-pointer hover:bg-slate-50 shrink-0"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-100 p-1.5 rounded-md text-amber-700"><Diff className="w-4 h-4" /></div>
                        <span className="font-semibold text-xs text-slate-700 uppercase tracking-widest">Collation Tracker</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full uppercase tracking-tighter">
                            {mainDoc.name.slice(0, 10)} ↔ {sideDoc.name.slice(0, 10)}
                        </span>
                        {isExpanded ? <ChevronDown /> : <ChevronUp />}
                    </div>
                </div>

                {isExpanded && (
                    <>
                        <div className="flex border-t border-slate-100 bg-slate-50/50 shrink-0">
                            <button onClick={() => setActiveTab('editor')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'editor' ? 'bg-white border-b-2 border-amber-500 text-amber-700 shadow-[inset_0_-2px_0_rgba(245,158,11,1)]' : 'text-slate-400'}`}>Editor</button>
                            <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-white border-b-2 border-amber-500 text-amber-700 shadow-[inset_0_-2px_0_rgba(245,158,11,1)]' : 'text-slate-400'}`}>History ({history?.length || 0})</button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-white p-6">
                            {activeTab === 'editor' ? (
                                <div className="space-y-5 animate-in fade-in duration-300">
                                    <div className="flex gap-2">
                                        <button onClick={() => setType('difference')} className={`flex-1 py-2 rounded text-[10px] font-bold uppercase border transition-all ${type === 'difference' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white text-slate-400 border-slate-100'}`}>Difference</button>
                                        <button onClick={() => setType('similarity')} className={`flex-1 py-2 rounded text-[10px] font-bold uppercase border transition-all ${type === 'similarity' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white text-slate-400 border-slate-100'}`}>Similar</button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        {[
                                            { lab: "Left Panel (Current)", p: pageA, sp: setPageA, l: lineA, sl: setLineA, t: textA, st: setTextA },
                                            { lab: "Right Panel (Current)", p: pageB, sp: setPageB, l: lineB, sl: setLineB, t: textB, st: setTextB }
                                        ].map((ms, i) => (
                                            <div key={i} className="space-y-2">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{ms.lab}</span>
                                                <div className="flex gap-1">
                                                    <input type="text" value={ms.p} onChange={e=>ms.sp(e.target.value)} className="w-full p-1.5 text-[10px] border rounded bg-slate-50 focus:ring-1 focus:ring-amber-500/20 outline-none" placeholder="Pg" />
                                                    <input type="text" value={ms.l} onChange={e=>ms.sl(e.target.value)} className="w-full p-1.5 text-[10px] border rounded bg-slate-50 focus:ring-1 focus:ring-amber-500/20 outline-none" placeholder="Ln" />
                                                </div>
                                                <textarea value={ms.t} onChange={e=>ms.st(e.target.value)} className="w-full p-2 text-xs border rounded h-16 resize-none leading-relaxed focus:ring-1 focus:ring-amber-200 outline-none" />
                                            </div>
                                        ))}
                                    </div>

                                    <textarea placeholder="Observation notes..." className="w-full p-3 text-xs border border-slate-100 rounded-lg bg-slate-50/30 outline-none" rows={2} value={note} onChange={e=>setNote(e.target.value)} />
                                    <button onClick={handleSave} className="w-full bg-slate-800 text-white py-3 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-black transition-colors shadow-lg">Save Variation</button>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 animate-in slide-in-from-bottom-2 duration-300">
                                    {history?.length === 0 && (
                                        <div className="p-12 text-center space-y-2">
                                            <Clock className="w-8 h-8 text-slate-200 mx-auto" />
                                            <p className="text-slate-400 text-xs uppercase tracking-widest font-medium">No shared variations yet</p>
                                        </div>
                                    )}
                                    {[...history || []].reverse().map((v) => {
                                        const { left, right } = resolvePositions(v);
                                        return (
                                            <div
                                                key={v.id}
                                                onClick={() => {
                                                    navigateToLines(v)
                                                }}
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
                                                className="group flex items-center gap-4 px-4 py-3 hover:bg-amber-50/40 cursor-pointer transition-colors relative"
                                            >
                                                <div className={`w-1 h-full absolute left-0 top-0 ${v.type === 'difference' ? 'bg-red-400' : 'bg-emerald-400'}`} />

                                                <div className="w-20 shrink-0">
                                                    <p className="text-[10px] font-bold text-slate-700">{left.pIdx+1}.{left.lIdx+1} ↔ {right.pIdx+1}.{right.lIdx+1}</p>
                                                    <p className="text-[8px] text-slate-400 font-mono mt-0.5">{formatDate(v.createdAt)}</p>
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex gap-2 items-center text-[10px]">
                                                        <span className="text-slate-500 italic truncate max-w-[100px] border-l border-slate-200 pl-2">"{left.text}"</span>
                                                        <span className="text-slate-300">/</span>
                                                        <span className="text-slate-500 italic truncate max-w-[100px] border-l border-slate-200 pl-2">"{right.text}"</span>
                                                    </div>
                                                    {v.note && <p className="text-[9px] text-amber-700 font-bold mt-1 uppercase tracking-tighter truncate">{v.note}</p>}
                                                </div>

                                                <button
                                                    onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) db.variations.delete(v.id!); }}
                                                    className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <Trash2 className="w-3 h-3" />
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