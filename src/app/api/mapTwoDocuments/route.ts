import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType, Schema } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/** Flatten all pages of transcription JSON strings into a numbered line list */
function getAllLines(transcriptions: string[]): { text: string; globalIdx: number }[] {
    const result: { text: string; globalIdx: number }[] = [];
    let globalIdx = 0;
    for (const pageJson of (transcriptions ?? [])) {
        try {
            const lines = JSON.parse(pageJson || '[]');
            if (!Array.isArray(lines)) continue;
            for (const line of lines) {
                if (line?.text) {
                    result.push({ text: line.text, globalIdx });
                    globalIdx++;
                }
            }
        } catch { /* empty page */ }
    }
    return result;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { docAId, docBId, transcriptionsA, transcriptionsB } = body as {
            docAId: number;
            docBId: number;
            transcriptionsA: string[];
            transcriptionsB: string[];
        };

        const linesA = getAllLines(transcriptionsA);
        const linesB = getAllLines(transcriptionsB);

        if (linesA.length === 0 || linesB.length === 0) {
            return NextResponse.json(
                { error: 'One or both documents have no transcriptions.' },
                { status: 400 }
            );
        }

        const textA = linesA.map(l => `${l.globalIdx}: ${l.text}`).join('\n');
        const textB = linesB.map(l => `${l.globalIdx}: ${l.text}`).join('\n');

        const responseSchema: Schema = {
            type: SchemaType.OBJECT,
            properties: {
                mapping: {
                    type: SchemaType.ARRAY,
                    description: 'Alignment pairs between the two manuscripts.',
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            lineA: { type: SchemaType.INTEGER, description: 'Global line index in Manuscript A' },
                            lineB: { type: SchemaType.INTEGER, description: 'Best corresponding global line index in Manuscript B' },
                        },
                        required: ['lineA', 'lineB'],
                    },
                },
            },
            required: ['mapping'],
        };

        const prompt = `You are a Medieval Latin manuscript scholar performing a scholarly collation.

You are given two transcriptions of manuscripts that contain the same text tradition (e.g., the same treatise copied at different times or places). Your job is to create a line-level alignment between them.

RULES:
1. Every line in Manuscript A must appear exactly once as "lineA" in the output.
2. "lineB" is the global index of the FIRST line in B that corresponds to that line in A.
3. The mapping must be monotonically non-decreasing in both lineA and lineB (i.e., the order of text is preserved).
4. Multiple consecutive lines of A may map to the same lineB (if B condenses text).
5. Some lines in B may be skipped (if B expands text relative to A).
6. If uncertain, use the nearest reasonable match.

MANUSCRIPT A (${linesA.length} lines):
${textA}

MANUSCRIPT B (${linesB.length} lines):
${textB}

Return ONLY the JSON mapping array.`;

        const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' });

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema,
            },
        });

        const parsed = JSON.parse(result.response.text()) as {
            mapping: { lineA: number; lineB: number }[];
        };

        // Build forward map A→B
        const mapAtoB: Record<string, number> = {};
        for (const { lineA, lineB } of parsed.mapping) {
            mapAtoB[String(lineA)] = lineB;
        }

        // Build inverse map B→A (first A line that maps to each B line)
        const mapBtoA: Record<string, number> = {};
        for (const { lineA, lineB } of parsed.mapping) {
            if (!(String(lineB) in mapBtoA)) {
                mapBtoA[String(lineB)] = lineA;
            }
        }

        return NextResponse.json({ mapAtoB, mapBtoA });
    } catch (error) {
        console.error('Mapping error:', error);
        return NextResponse.json({ error: 'Mapping failed' }, { status: 500 });
    }
}