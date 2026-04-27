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

0. COLUMN DETECTION & READING PATH:
   - Identify if the page is single or multi-column.
   - You MUST follow a strict linear horizontal-then-vertical path within the logical text block.
   - If TWO columns are present: Transcribe the entirety of the LEFT column line-by-line (top to bottom), then the entirety of the RIGHT column line-by-line (top to bottom).
   - NEVER bridge the gap between columns in a single line entry.

1. LINE-BY-LINE INTEGRITY:
   - Process the text in strict line-by-line sequence. 
   - A "line" is defined by its horizontal baseline.
   - Capture every word on a single line from left-to-right before proceeding to the line immediately below it.

2. ZERO-DIGIT POLICY:
   - Numbers (0–9) NEVER appear in Medieval Latin words.
   - Any perceived '3', '9', '4', etc. are shorthand characters (e.g., 'con-', '-us', or '-rum').
   - Interpret them as abbreviation marks, NOT digits. Resolve them into Latin letters.
   - NEVER output digits in the transcription.

3. ABBREVIATIONS (CRITICAL):
   - ANY word that was shortened or used a ligature in the manuscript MUST be wrapped in <abbr> tags.
   - The tag signals that the original scribe used shorthand, even if your expansion is 100% certain.
   - Examples: <abbr>quecumque</abbr>, <abbr>conclusio</abbr>, <abbr>dominus</abbr>.

4. PHILOLOGICAL CONFIDENCE:
   - Prioritize grammatically and contextually correct Latin (proper case endings: -em, -is, -ibus) over literal "character-by-character" guessing.
   - Use your expertise in medieval medical terminology to ensure the text is linguistically coherent.

5. SPATIAL ACCURACY:
   - Provide bounding boxes for each line as [ymin, xmin, ymax, xmax] on a 0–1000 scale.
   - Ensure the box encompasses the entire line of text within that column.

6. NOISE FILTERING:
   - Ignore marginalia, headers, folio numbers, and decorative illuminations. 
   - Focus exclusively on the main body of the medical treatise.

7. OUTPUT FORMAT:
   - Provide a JSON list of lines where each object contains: {"text": "...", "box_2d": [ymin, xmin, ymax, xmax]}.
   - The order of the list must reflect the physical reading order (Column 1: Line 1, 2, 3... then Column 2: Line 1, 2, 3...).
`
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