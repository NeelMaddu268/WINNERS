"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCuJTahFfn623GzFp6912viKOZwOf_JTbc";
const genAI = new GoogleGenerativeAI(API_KEY);

const HYPE_SCORE_RUBRIC = `
Here is a rigorous scoring framework you can use to rate the investor hype level of any stock (ticker) on a 1–100 scale. It focuses on observable signals that typically correlate with retail enthusiasm, narrative intensity, and speculative attention rather than fundamentals.

Investor Hype Score (IHS) — 0 to 100

Definition:
A quantitative estimate of how strongly a stock is driven by narrative, attention, and speculative excitement rather than valuation or earnings.

Score = weighted sum of 5 dimensions
Each dimension scored 0–20 → total 0–100

1. Retail Attention Intensity (0–20)
Measures how much non-institutional investor discussion exists.
Metrics: Reddit mentions, X/Twitter freq, Google Trends, YouTube coverage.
Scoring: 0–4 rarely discussed, 5–9 moderate, 10–14 frequently, 15–17 dominant, 18–20 meme-level

2. Narrative Strength & Virality (0–20)
How compelling and shareable the story is. (AI revolution, Next Tesla, Disrupting X)
Scoring: 0–4 no strong story, 5–9 niche thesis, 10–14 clear theme, 15–17 viral narrative, 18–20 cultural phenomenon

3. Price Behavior Consistent with Hype (0–20)
Market behavior typical of speculative excitement.
Scoring: 0–4 stable, 5–9 moderate momentum, 10–14 hype-like runs, 15–17 repeated speculative spikes, 18–20 meme-stock dynamics

4. Valuation vs Fundamentals Gap (0–20)
Degree to which expectations exceed financial reality.
Scoring: 0–4 fundamentals aligned, 5–9 mild premium, 10–14 optimism priced in, 15–17 extreme expectations, 18–20 story > business

5. Retail-Speculation Structure (0–20)
Mechanical features that amplify hype.
Scoring: 0–4 institution-driven, 5–9 balanced, 10–14 retail-heavy, 15–17 speculation-prone, 18–20 squeeze-capable

Final Score Interpretation
0–20 → No hype
21–40 → Low hype
41–60 → Moderate hype
61–80 → High hype
81–100 → Extreme hype / meme

Example Calibration Anchors:
Low (10–30): JPM, PG, KO
Moderate (40–60): AMD, SHOP, DIS
High (60–80): NVDA (AI era), TSLA, PLTR
Extreme (80–100): GME 2021, AMC 2021, DWAC 2022

Strict Scoring Procedure: Look up current web signals around the requested ticker and respond with ONLY a JSON object containing the exact following structure:
{
  "score": <number 1-100>,
  "points": ["<very short bullet point 1>", "<very short bullet point 2>"]
}
`;

export async function getInvestorHypeScore(ticker: string, companyName: string) {
    // API Key is temporarily rate-limited, returning placeholder data for now.
    return {
        score: null,
        points: [
            "AI generated hype analysis is temporarily paused.",
            "Please check back later or update the Gemini API Key in the environment variables."
        ]
    };

    /* Original Gemini Implementation (Disabled for Rate Limits):
    try {
        // Using gemini-2.5-flash as it's the latest available model for this key
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `Analyze the current investor hype for ${companyName} (${ticker}). Use the provided rubbing to generate a score and two bullet points explaining why. Output strictly as JSON.`;

        const result = await model.generateContent({
            contents: [
                { role: "user", parts: [{ text: prompt }] }
            ],
            systemInstruction: HYPE_SCORE_RUBRIC,
            tools: [{ googleSearchRetrieval: { dynamicRetrievalConfig: { mode: "MODE_DYNAMIC", dynamicThreshold: 0.3 } } } as any],
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        const responseText = result.response.text();
        return JSON.parse(responseText);
    } catch (error) {
        console.error("Failed to generate hype score:", error);
        return {
            score: null,
            points: ["Failed to generate analysis.", "Please try again later."]
        };
    }
    */
}
