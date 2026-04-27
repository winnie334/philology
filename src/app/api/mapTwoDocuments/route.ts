// Map two given documents with each other. This means every block of both files has at least one corresponding block in the other

import {NextRequest, NextResponse} from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

    } catch (error) {
        console.error("Error during mapping:", error);
        return NextResponse.json({error: "Mapping failed"}, {status: 500});
    }
}