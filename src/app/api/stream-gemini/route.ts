import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

const API_KEY = process.env.GEMINI_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

function loadRules(filename: string): string {
    try {
        return fs.readFileSync(path.join(process.cwd(), filename), "utf-8");
    } catch {
        return "";
    }
}

const GEMINIRULES = loadRules("GEMINIRULES.MD");

export async function POST(req: NextRequest) {
    if (!genAI) {
        return new Response(JSON.stringify({ error: "GEMINI_API_KEY is not set" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }

    let body: { prompt: string; systemPrompt?: string };
    try {
        body = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const { prompt, systemPrompt } = body;
    if (!prompt || typeof prompt !== "string") {
        return new Response(JSON.stringify({ error: "prompt is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    const system = systemPrompt ?? GEMINIRULES;
    const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;

    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                const result = await model.generateContentStream({
                    contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
                });

                let lastText = "";
                for await (const chunk of result.stream) {
                    try {
                        const text = chunk.text?.() ?? "";
                        if (text) {
                            const delta = text.slice(lastText.length);
                            lastText = text;
                            if (delta) {
                                controller.enqueue(encoder.encode(delta));
                            }
                        }
                    } catch {
                        // Skip chunks that fail to parse
                    }
                }
            } catch (err) {
                controller.enqueue(
                    encoder.encode(
                        `\n\n[Error: ${err instanceof Error ? err.message : "Stream failed"}]`
                    )
                );
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Transfer-Encoding": "chunked",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}
