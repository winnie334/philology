// app/api/analyze-variants/route.ts
import {NextRequest, NextResponse} from 'next/server';
import {GoogleGenerativeAI, SchemaType, Schema} from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
    try {
        const {manuscripts} = await req.json(); // Array of { name, fullText }

        const model = genAI.getGenerativeModel({model: "gemini-3.1-pro-preview"})

        const responseSchema: Schema = {
            type: SchemaType.OBJECT,
            properties: {
                variants: {
                    type: SchemaType.ARRAY,
                    description: "A formal apparatus criticus of significant textual variations.",
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            excerpt: {
                                type: SchemaType.STRING,
                                description: "The specific context or sentence fragment where the variation occurs."
                            },
                            baseText: {
                                type: SchemaType.STRING,
                                description: "The proposed 'constitutio textus' (the most likely original reading)."
                            },
                            errorType: {
                                type: SchemaType.STRING,
                                description: "Technical classification (e.g., homoeoteleuton, haplography, dittography, interpolation)."
                            },
                            philologicalNote: {
                                type: SchemaType.STRING,
                                description: "Expert commentary on why this variation is significant for the stemma."
                            },
                            witnesses: {
                                type: SchemaType.ARRAY,
                                items: {
                                    type: SchemaType.OBJECT,
                                    properties: {
                                        manuscriptName: {type: SchemaType.STRING},
                                        reading: {type: SchemaType.STRING}
                                    },
                                    required: ["manuscriptName", "reading"]
                                }
                            }
                        },
                        required: ["excerpt", "baseText", "errorType", "philologicalNote", "witnesses"]
                    }
                },
                stemmaHypotheses: {
                    type: SchemaType.ARRAY,
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            description: {type: SchemaType.STRING},
                            probability: {type: SchemaType.NUMBER},
                            rationale: {
                                type: SchemaType.STRING,
                                description: "Detailed reasoning for this genetic relationship."
                            }
                        },
                        required: ["description", "probability", "rationale"]
                    }
                }
            },
            required: ["variants", "stemmaHypotheses"]
        };

        const prompt = `
            ACT AS: An elite Digital Philologist and Textual Critic.
            
            OBJECTIVE: Perform a deep collation and stemmatic analysis on ${manuscripts.length} manuscript witnesses.
            
            MANUSCRIPT DATA:
            ${manuscripts.map((m: any) => `[[MANUSCRIPT: ${m.name}]]\n${m.fullText}`).join('\n\n')}

            INSTRUCTIONS:
            1. SYNOPTIC COLLATION: Compare the transcriptions. Identify variations in word order, omissions, and substitutions.
            2. LEITFEHLER (GUIDE ERRORS): Identify "conjunctive errors" (shared mistakes that prove a common ancestor) and "separative errors" (mistakes that prove one is not copied from the other).
            3. CATEGORIZATION: Use standard philological terms (e.g., 'itacism', 'saut du même au même', 'marginal gloss interpolation').
            4. STEMMA CODICUM: Propose a genealogical relationship. Does MS A serve as the exemplar for MS B? Are they both copies of a lost hyparchetype (α)?
            5. EXCERPTS: For each variant, provide the exact text fragment so the user can locate it in the source.

            Respond strictly in the provided JSON schema.
        `;

        const result = await model.generateContent({
            contents: [{role: "user", parts: [{text: prompt}]}],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        return NextResponse.json(JSON.parse(result.response.text()));

    } catch (error) {
        console.error("Philological Analysis Error:", error);
        return NextResponse.json({error: "Analysis failed"}, {status: 500});
    }
}