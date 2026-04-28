export type ErrorType = 'omission' | 'addition' | 'substitution' | 'transposition' | 'orthographic';

export interface TextualVariant {
    paragraphId: string;
    sentenceId: string;
    baseText: string; // The assumed correct text or majority reading
    witnesses: {
        manuscriptId: string;
        reading: string; // How this specific manuscript spells/writes it
    }[];
    errorType: ErrorType;
    philologicalNote: string; // AI's reasoning (e.g., "Classic homeoteleuton skip")
}

export interface StemmaHypothesis {
    hypothesisId: string;
    description: string; // e.g., "Manuscript B and C share 4 unique conjunctive errors, suggesting they derive from a common lost sub-archetype."
    probability: number; // 0.0 to 1.0
    supportingVariants: string[]; // Array of paragraphIds/sentenceIds supporting this
}

export interface PhilologicalAnalysisResult {
    variants: TextualVariant[];
    stemmaHypotheses: StemmaHypothesis[];
}