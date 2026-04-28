'use client';

import React from 'react';
import { usePhilologicalAnalysis } from "@/app/hooks/usePhilologicalAnalysis";

// --- Icons ---
function LinkIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
             strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
    );
}

export const PhilologyAnalyzer: React.FC = () => {
    const { analyze, data, isLoading, error } = usePhilologicalAnalysis();

    return (
        <div className="max-w-7xl mx-auto animate-fade-in px-4">
            {/* Header / Trigger Section */}
            <div className="border-t border-border/50 pt-10 mt-10">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <p className="text-[12px] text-muted uppercase tracking-[0.2em] font-lora font-semibold">
                            Manuscript Collation & Systematic Analysis
                        </p>
                    </div>
                    <button
                        onClick={() => analyze()}
                        disabled={isLoading}
                        className="inline-flex items-center gap-3 px-6 py-3 rounded-xl text-md font-lora font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] border-accent/40 text-accent hover:bg-accent hover:text-paper hover:border-accent cursor-pointer shadow-md"
                    >
                        {isLoading ? (
                            <>
                                <span className="inline-block w-4 h-4 border-[2px] border-accent/30 border-t-accent rounded-full animate-spin"/>
                                Performing Collation...
                            </>
                        ) : (
                            <><LinkIcon/> Begin Deep Analysis</>
                        )}
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-danger/5 border-l-4 border-danger text-danger p-5 mb-8 font-lora text-sm rounded-r-lg shadow-sm">
                    <p className="font-bold">Collation Error: {error}</p>
                </div>
            )}

            {data && (
                <div className="space-y-12 mt-8 pb-16">
                    {/* Stemma Hypotheses */}
                    <section>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {data.stemmaHypotheses.map((hypo, idx) => (
                                <div key={idx} className="bg-paper border border-accent/20 p-7 rounded-2xl shadow-sm relative">
                                    <div className="absolute top-4 right-5 text-[11px] font-bold uppercase tracking-widest text-accent opacity-70">
                                        {Math.round(hypo.probability * 100)}% Match
                                    </div>
                                    <h3 className="font-playfair text-xl font-bold text-ink mb-3">Hypothesis {idx + 1}</h3>
                                    <p className="font-lora text-ink-faint text-md leading-relaxed mb-4">{hypo.description}</p>
                                    <div className="bg-accent/[0.04] p-4 rounded-xl border border-accent/15">
                                        <p className="font-lora text-sm text-muted leading-relaxed italic">
                                            <span className="font-bold not-italic text-accent mr-2">Rationale:</span>
                                            {hypo.rationale}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Master Table */}
                    <section>
                        <div className="bg-paper border border-border rounded-2xl shadow-md overflow-hidden">
                            <table className="w-full text-left border-collapse table-fixed">
                                <thead>
                                <tr className="bg-paper-dark/60 border-b border-border">
                                    <th className="p-5 font-lora text-[12px] uppercase tracking-wider text-muted font-bold w-[25%]">Context</th>
                                    <th className="p-5 font-lora text-[12px] uppercase tracking-wider text-muted font-bold w-[20%]">Constitutio Textus</th>
                                    <th className="p-5 font-lora text-[12px] uppercase tracking-wider text-muted font-bold w-[35%]">Witness Readings</th>
                                    <th className="p-5 font-lora text-[12px] uppercase tracking-wider text-muted font-bold w-[20%]">Critical Note</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                {data.variants.map((variant, idx) => (
                                    <tr key={idx} className="hover:bg-accent/[0.015] transition-colors group">
                                        {/* Excerpt context */}
                                        <td className="p-6 align-top">
                                            <p className="font-lora text-[15px] text-muted/80 leading-relaxed italic border-l-2 border-accent/20 pl-4">
                                                "...{variant.excerpt}..."
                                            </p>
                                        </td>

                                        {/* Proposed Reconstruction */}
                                        <td className="p-6 align-top">
                                            <p className="font-playfair font-bold text-ink text-lg leading-tight tracking-tight">
                                                {variant.baseText}
                                            </p>
                                        </td>

                                        {/* Witness Comparison */}
                                        <td className="p-6 align-top">
                                            <div className="space-y-2.5">
                                                {variant.witnesses.map((w, wIdx) => {
                                                    const isDifferent = w.reading.trim().toLowerCase() !== variant.baseText.trim().toLowerCase();
                                                    return (
                                                        <div key={wIdx} className="flex gap-3 items-start text-[16px] font-lora">
                                                                <span className="shrink-0 font-bold text-accent/80 min-w-[100px] text-[12px] pt-1 uppercase tracking-wide">
                                                                    {w.manuscriptName}:
                                                                </span>
                                                            <span className={`${isDifferent ? 'text-danger font-semibold' : 'text-ink-faint'}`}>
                                                                    {w.reading}
                                                                </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </td>

                                        {/* Philological Meta */}
                                        <td className="p-6 align-top">
                                            <div className="flex flex-col gap-3">
                                                    <span className="inline-block px-2.5 py-1 bg-ink text-paper text-[10px] font-bold uppercase tracking-widest rounded shadow-sm w-fit">
                                                        {variant.errorType}
                                                    </span>
                                                <p className="text-[13px] text-muted/90 leading-relaxed font-lora">
                                                    {variant.philologicalNote}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};