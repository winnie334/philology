'use client';

import React, { useState } from 'react';
import { useCollationData } from "@/app/hooks/useCollationData";
import { Diff, Equal, Info, ChevronRight, Hash } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

export default function ManuscriptAnalytics() {
    const data = useCollationData();
    const [selectedPair, setSelectedPair] = useState<string | null>(null);

    const variations = useLiveQuery(async () => {
        if (!selectedPair) return [];
        const [id1, id2] = selectedPair.split('-').map(Number);
        return await db.variations
            .where('docAId').anyOf([id1, id2])
            .filter(v => (v.docAId === id1 && v.docBId === id2) || (v.docAId === id2 && v.docBId === id1))
            .toArray();
    }, [selectedPair]);

    if (!data || data.docs.length < 2) return null;
    const { docs, stats } = data;

    return (
        <div className="bg-paper border border-border rounded-2xl overflow-hidden shadow-sm animate-fade-in mb-10">
            <div className="px-8 py-5 border-b border-border/50 bg-paper/50 flex justify-between items-center">
                <div>
                    <h3 className="font-playfair text-xl font-bold text-ink leading-tight">Tradition Matrix</h3>
                    <p className="text-xs text-muted uppercase tracking-widest font-lora mt-1">Textual Concordance & Variance</p>
                </div>
                <div className="flex gap-4 text-[10px] font-bold uppercase tracking-tighter">
                    <span className="flex items-center gap-1.5 text-emerald-700"><Equal className="w-3 h-3"/> Concordance</span>
                    <span className="flex items-center gap-1.5 text-amber-700"><Diff className="w-3 h-3"/> Variance</span>
                </div>
            </div>

            <div className="p-6">
                <div className="overflow-x-auto pb-4">
                    <table className="border-separate border-spacing-2 mx-auto">
                        <thead>
                        <tr>
                            <th className="w-20"></th>
                            {docs.slice(1).map((doc) => (
                                <th key={doc.id} className="p-2 text-[11px] font-bold text-muted uppercase tracking-wider text-center">
                                    {doc.name.slice(0, 10)}
                                </th>
                            ))}
                        </tr>
                        </thead>
                        <tbody>
                        {docs.slice(0, -1).map((docA, rowIndex) => (
                            <tr key={docA.id}>
                                <td className="p-2 text-[11px] font-bold text-muted uppercase tracking-wider text-right align-middle">
                                    {docA.name.slice(0, 10)}
                                </td>
                                {docs.slice(1).map((docB, colIndex) => {
                                    if (colIndex < rowIndex) return <td key={`e-${colIndex}`} className="w-20 h-20" />;

                                    const pairKey = [docA.id, docB.id!].sort().join('-');
                                    const stat = stats[pairKey] || { sim: 0, diff: 0 };
                                    const isSelected = selectedPair === pairKey;
                                    const hasData = stat.sim + stat.diff > 0;

                                    return (
                                        <td
                                            key={docB.id}
                                            onClick={() => setSelectedPair(pairKey)}
                                            className={`w-20 h-20 rounded-xl border transition-all cursor-pointer group relative overflow-hidden ${
                                                isSelected ? 'border-accent ring-4 ring-accent/10' : 'border-border/40 hover:border-accent/40'
                                            } ${!hasData ? 'bg-slate-50/30' : 'bg-white shadow-sm'}`}
                                        >
                                            <div className="flex flex-col h-full">
                                                <div className={`flex-1 flex flex-col items-center justify-center border-b border-border/10 ${hasData ? 'bg-emerald-50/40' : ''}`}>
                                                    <span className={`text-sm font-bold ${hasData ? 'text-emerald-700' : 'text-slate-200'}`}>{stat.sim}</span>
                                                </div>
                                                <div className={`flex-1 flex flex-col items-center justify-center ${hasData ? 'bg-amber-50/40' : ''}`}>
                                                    <span className={`text-sm font-bold ${hasData ? 'text-amber-700' : 'text-slate-200'}`}>{stat.diff}</span>
                                                </div>
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                {selectedPair && (
                    <div className="mt-8 p-6 rounded-2xl bg-parchment/30 border border-accent/20 animate-slide-up shadow-inner">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="bg-accent/10 p-2 rounded-lg">
                                    <Info className="w-5 h-5 text-accent" />
                                </div>
                                <h4 className="text-sm font-playfair font-bold text-ink uppercase tracking-widest">Variation Log</h4>
                            </div>
                            <button onClick={() => setSelectedPair(null)} className="text-xs font-bold text-muted hover:text-ink uppercase border-b border-transparent hover:border-ink transition-all">Close Analysis</button>
                        </div>

                        <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-3">
                            {variations?.length === 0 && <p className="text-sm text-center text-muted italic py-8">No specific data points recorded for this pairing.</p>}
                            {variations?.map((v, i) => (
                                <div key={i} className="bg-white border border-border/60 p-4 rounded-xl shadow-sm">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className={`text-[10px] font-black uppercase tracking-[0.15em] px-2 py-1 rounded ${
                                            v.type === 'similarity' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                            {v.type}
                                        </span>
                                        <div className="flex gap-4 text-[10px] font-mono font-bold text-slate-400">
                                            <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100">MS A: P.{v.locA.pIdx + 1} L.{v.locA.lIdx + 1}</span>
                                            <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-100">MS B: P.{v.locB.pIdx + 1} L.{v.locB.lIdx + 1}</span>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-6 items-start italic text-[13px] font-lora leading-relaxed text-ink-faint">
                                        <p className="border-l-4 border-emerald-200/50 pl-3">"{v.locA.text}"</p>
                                        <p className="border-l-4 border-amber-200/50 pl-3">"{v.locB.text}"</p>
                                    </div>
                                    {v.note && (
                                        <div className="mt-3 pt-3 border-t border-slate-50 flex gap-2 items-center">
                                            <Hash className="w-3 h-3 text-accent" />
                                            <p className="text-[11px] font-bold text-accent uppercase tracking-tighter">{v.note}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}