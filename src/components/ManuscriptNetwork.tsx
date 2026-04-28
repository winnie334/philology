'use client';

import React, { useState } from 'react';
import { useCollationData } from "@/app/hooks/useCollationData";
import { Diff, Equal, Hash, TableProperties, X } from 'lucide-react';
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
        <div className="bg-paper border border-border rounded-2xl overflow-hidden shadow-sm animate-fade-in mb-10 font-lora">
            {/* Header */}
            <div className="px-8 py-6 border-b border-border/50 bg-paper/50 flex justify-between items-end">
                <div>
                    <h3 className="font-playfair text-2xl font-bold text-ink leading-none">Comparison Table</h3>
                    <p className="text-sm text-muted mt-2 font-medium">Overview of similarities and differences between manuscripts</p>
                </div>
                <div className="flex gap-6 text-[11px] font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-2 text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full"><Equal className="w-3.5 h-3.5"/> Similarities</span>
                    <span className="flex items-center gap-2 text-amber-700 bg-amber-50 px-3 py-1 rounded-full"><Diff className="w-3.5 h-3.5"/> Differences</span>
                </div>
            </div>

            <div className="p-8">
                <div className="overflow-x-auto pb-4">
                    <table className="border-separate border-spacing-2 mx-auto">
                        <thead>
                        <tr>
                            <th className="w-24"></th>
                            {docs.slice(1).map((doc) => (
                                <th key={doc.id} className="p-2 text-xs font-bold text-muted uppercase tracking-widest text-center">
                                    {doc.name.slice(0, 12)}
                                </th>
                            ))}
                        </tr>
                        </thead>
                        <tbody>
                        {docs.slice(0, -1).map((docA, rowIndex) => (
                            <tr key={docA.id}>
                                <td className="p-2 text-xs font-bold text-muted uppercase tracking-widest text-right align-middle">
                                    {docA.name.slice(0, 12)}
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
                                                isSelected ? 'border-accent ring-4 ring-accent/10 z-10' : 'border-border/40 hover:border-accent/40'
                                            } ${!hasData ? 'bg-slate-50/20' : 'bg-white shadow-sm'}`}
                                        >
                                            <div className="flex flex-col h-full text-center">
                                                <div className={`flex-1 flex flex-col items-center justify-center border-b border-border/5 ${hasData ? 'bg-emerald-50/30' : ''}`}>
                                                    <span className={`text-base font-bold ${hasData ? 'text-emerald-800' : 'text-slate-200'}`}>{stat.sim}</span>
                                                </div>
                                                <div className={`flex-1 flex flex-col items-center justify-center ${hasData ? 'bg-amber-50/30' : ''}`}>
                                                    <span className={`text-base font-bold ${hasData ? 'text-amber-800' : 'text-slate-200'}`}>{stat.diff}</span>
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

                {/* Details Section */}
                {selectedPair && (
                    <div className="mt-12 animate-slide-up border-t border-border/50 pt-8">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">

                                <h4 className="text-xl font-playfair font-bold text-ink">Comparison Details</h4>
                            </div>
                            <button
                                onClick={() => setSelectedPair(null)}
                                className="group flex items-center gap-2 text-xs font-bold text-muted hover:text-ink transition-colors"
                            >
                                CLOSE <X className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-4">
                            {variations?.length === 0 && (
                                <div className="py-20 text-center border-2 border-dashed border-border/40 rounded-2xl">
                                    <p className="text-sm text-muted italic">No specific notes recorded for this pair yet.</p>
                                </div>
                            )}
                            {variations?.map((v, i) => (
                                <div key={i} className="bg-white border border-border/60 rounded-xl overflow-hidden shadow-sm hover:border-accent/30 transition-colors">
                                    <div className="px-5 py-3 border-b border-border/40 bg-slate-50/50 flex justify-between items-center">
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                                            v.type === 'similarity' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                        }`}>
                                            {v.type === 'similarity' ? 'Similarity' : 'Difference'}
                                        </span>
                                        <div className="flex gap-6 text-[10px] font-bold text-slate-400">
                                            <span className="flex items-center gap-1.5"><Hash className="w-3 h-3"/> MS A: P.{v.locA.pIdx + 1}, L.{v.locA.lIdx + 1}</span>
                                            <span className="flex items-center gap-1.5"><Hash className="w-3 h-3"/> MS B: P.{v.locB.pIdx + 1}, L.{v.locB.lIdx + 1}</span>
                                        </div>
                                    </div>
                                    <div className="p-5 grid grid-cols-2 gap-10">
                                        <div className="relative">
                                            <div className="absolute -left-5 top-0 bottom-0 w-1 bg-emerald-100 rounded-full" />
                                            <p className="text-sm leading-relaxed text-ink italic italic">"{v.locA.text}"</p>
                                        </div>
                                        <div className="relative">
                                            <div className="absolute -left-5 top-0 bottom-0 w-1 bg-amber-100 rounded-full" />
                                            <p className="text-sm leading-relaxed text-ink italic">"{v.locB.text}"</p>
                                        </div>
                                    </div>
                                    {v.note && (
                                        <div className="px-5 py-3 bg-accent/5 border-t border-accent/10">
                                            <p className="text-xs font-bold text-accent uppercase tracking-tighter italic">Note: {v.note}</p>
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