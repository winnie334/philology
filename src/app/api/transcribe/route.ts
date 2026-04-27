import {NextRequest, NextResponse} from 'next/server';
import {GoogleGenerativeAI, SchemaType, Schema} from '@google/generative-ai';

// Initialize the SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {base64Image, mimeType = "image/png"} = body;

        if (!base64Image) {
            return NextResponse.json({error: "No image provided"}, {status: 400});
        }

        // gemini-3.1-pro-preview
        // gemini-3.1-flash-lite-preview
        const model_name = "gemini-3.1-pro-preview"
        const model = genAI.getGenerativeModel({model: model_name});

        // 1. Explicitly type the object as `Schema` to cure the TS error
        const responseSchema: Schema = {
            type: SchemaType.OBJECT,
            properties: {
                lines: {
                    type: SchemaType.ARRAY,
                    description: "An array of transcribed lines from the manuscript.",
                    items: {
                        type: SchemaType.OBJECT,
                        properties: {
                            text: {
                                type: SchemaType.STRING,
                                description: "The transcribed text of the physical line, with abbreviations wrapped in <abbr> tags."
                            },
                            box_2d: {
                                type: SchemaType.ARRAY,
                                description: "The bounding box of the line on a 0-1000 scale: [ymin, xmin, ymax, xmax].",
                                items: {
                                    type: SchemaType.INTEGER,
                                },
                            },
                        },
                        required: ["text", "box_2d"],
                    },
                },
            },
            required: ["lines"],
        };

        // 2. The Updated Philologist Prompt
        const prompt = `
            You are an expert medieval philologist transcribing a medical manuscript.
            
            RULES:
            1. Line by Line: Transcribe the text exactly as it appears, physical line by physical line.
            2. Language Constraint: The text is Medieval Latin. Use ONLY valid Latin letters. ABSOLUTELY NO NUMBERS (like 3, 9) in the words.
            3. Abbreviation Handling: Scribes used symbols that look like numbers (e.g., a "3" shape). Do not transcribe these as numbers. If you cannot confidently resolve a shorthand symbol into Latin letters, replace it with an underscore "_".
            4. Tagging: Wrap ANY word containing a medieval abbreviation, shorthand, or placeholder underscore in <abbr> tags. Example: <abbr>quecumq_</abbr>.
            5. Spatial Mapping: Calculate the bounding box for each line on a 0-1000 scale [ymin, xmin, ymax, xmax].
        `;

        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType: mimeType,
            },
        };

        console.log("Feeding page to Gemini 3.1 Pro with Typed Schema...");

        const result = await model.generateContent({
            contents: [{role: "user", parts: [{text: prompt}, imagePart]}],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: responseSchema, // TypeScript is now happy
            },
        });

        const parsedData = JSON.parse(result.response.text());
        return NextResponse.json({lines: parsedData.lines});

    } catch (error) {
        console.error("Hackathon Hurdle (Next.js API):", error);
        return NextResponse.json({error: "Transcription failed"}, {status: 500});
    }
}