import {NextRequest, NextResponse} from 'next/server';
import {GoogleGenerativeAI, SchemaType, Schema} from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {base64Image, mimeType = "image/png"} = body;

        if (!base64Image) {
            return NextResponse.json({error: "No image provided"}, {status: 400});
        }

        const model = genAI.getGenerativeModel({model: "gemini-3.1-pro-preview"});

        const responseSchema: Schema = {
            type: SchemaType.OBJECT,
            properties: {
                lines: {
                    type: SchemaType.ARRAY,
                    description: "An array of transcribed lines from the manuscript.",
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            text: {type: SchemaType.STRING},
                            box_2d: {
                                type: SchemaType.ARRAY,
                                items: {type: SchemaType.INTEGER},
                            },
                        },
                        required: ["text", "box_2d"],
                    },
                },
            },
            required: ["lines"],
        };

        // Removed marginalia rule, added strict focus on main text
        const prompt = `
ACT AS: An elite Medieval Philologist specializing in 12th–14th century Latin medical scripts (Hippocratic corpus).

STRICT TRANSCRIPTION PROTOCOL:

0. COLUMN DETECTION:
   - First, determine if the page contains one or multiple columns.
   - If TWO columns are present, you MUST process the LEFT column completely before moving to the RIGHT column.
   - NEVER read across columns line-by-line.

1. LINE-BY-LINE:
   - Within each column, process the text in strict top-to-bottom physical sequence.
   - Do not skip lines.

2. ZERO-DIGIT POLICY:
   - Numbers (0–9) NEVER appear in Medieval Latin words.
   - Any perceived '3', '9', '4', etc. are shorthand characters (e.g., 'con-' or '-us').
   - Interpret them as abbreviation marks, NOT digits.
   - Resolve them into Latin letters when reasonably clear.
   - If uncertain, choose the most plausible expansion based on context.
   - NEVER output digits.

3. ABBREVIATIONS (CRITICAL):
   - Medieval Latin texts make extensive use of abbreviations and ligatures.
   - ANY word containing an abbreviation mark MUST be wrapped in <abbr> tags.
   - This applies EVEN IF you expand the word confidently.
   - The <abbr> tag signals that the original manuscript used shorthand.
   - Examples: <abbr>quecumque</abbr>, <abbr>conclusio</abbr>.

4. PHILOLOGICAL CONFIDENCE:
   - Prefer grammatically and contextually correct Latin expansions over uncertainty.
   - Use knowledge of common medieval abbreviations and medical terminology.
   - Ensure the resulting text is linguistically coherent.

5. SPATIAL ACCURACY:
   - Provide bounding boxes as [ymin, xmin, ymax, xmax] on a 0–1000 scale.

6. BODY TEXT ONLY:
   - Ignore marginal notes, headers, page numbers, glosses, and decorations.

7. GRAMMAR CHECK:
   - Ensure Latin morphology is plausible (e.g., -em, -is, -ibus endings).

8. OUTPUT ORDER:
   - Output MUST follow physical reading order:
     (LEFT COLUMN top→bottom) → (RIGHT COLUMN top→bottom).
`;
        const imagePart = {inlineData: {data: base64Image, mimeType}};

        const result = await model.generateContent({
            contents: [{role: "user", parts: [{text: prompt}, imagePart]}],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        const parsedData = JSON.parse(result.response.text());
        return NextResponse.json({lines: parsedData.lines});

    } catch (error) {
        console.error("Hackathon Hurdle (Next.js API):", error);
        return NextResponse.json({error: "Transcription failed"}, {status: 500});
    }
}