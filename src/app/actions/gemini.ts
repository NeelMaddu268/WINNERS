"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

const API_KEY = process.env.GEMINI_API_KEY;
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_MINUTE = 150; // Paid Tier 1
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const cache = new Map<string, { data: string; expires: number }>();
const requestTimestamps: number[] = [];

function loadRules(filename: string): string {
    try {
        return fs.readFileSync(path.join(process.cwd(), filename), "utf-8");
    } catch {
        return "";
    }
}
const GEMINIRULES = loadRules("GEMINIRULES.MD");
const HYPESCORE_RULES = loadRules("HYPESCORE.MD");

function getCached(key: string): string | null {
    const entry = cache.get(key);
    if (!entry || entry.expires < Date.now()) return null;
    return entry.data;
}

function setCache(key: string, data: string): void {
    cache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
}

async function rateLimitAcquire(): Promise<void> {
    const now = Date.now();
    const cutoff = now - RATE_LIMIT_WINDOW_MS;
    while (requestTimestamps.length > 0 && requestTimestamps[0] < cutoff) {
        requestTimestamps.shift();
    }
    if (requestTimestamps.length >= MAX_REQUESTS_PER_MINUTE) {
        const waitMs = requestTimestamps[0] + RATE_LIMIT_WINDOW_MS - now + 100;
        await new Promise((r) => setTimeout(r, Math.max(waitMs, 0)));
        return rateLimitAcquire();
    }
    requestTimestamps.push(Date.now());
}

async function generateJson(systemPrompt: string, userPrompt: string): Promise<string> {
    if (!genAI) throw new Error("GEMINI_API_KEY is not set");
    const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash-lite",
        generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] }],
    });
    return result.response.text();
}

/** Fetch recent news for tickers from Finnhub (free tier, no billing). */
async function fetchStockNewsContext(tickers: string[]): Promise<string> {
    if (!FINNHUB_KEY || tickers.length === 0) return "";
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];
    const results: string[] = [];
    for (const symbol of tickers.slice(0, 5)) {
        try {
            const res = await fetch(
                `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromStr}&to=${toStr}&token=${FINNHUB_KEY}`,
                { next: { revalidate: 300 } }
            );
            const data = (await res.json()) as { headline?: string; summary?: string; source?: string; datetime?: number }[];
            if (Array.isArray(data) && data.length > 0) {
                const items = data.slice(0, 8).map((n) => `- ${n.headline || ""} (${n.source || "news"})`);
                results.push(`[${symbol} recent news]\n${items.join("\n")}`);
            }
        } catch {
            /* ignore */
        }
    }
    return results.length > 0 ? `\n\nRECENT NEWS CONTEXT (use this for time-relevant analysis):\n${results.join("\n\n")}` : "";
}

export type PortfolioPulseResult = {
    insight: string;
    overvaluation: number;
    growthPotential: number;
    politicalClimate: number;
};

export type AccountInsightItem = {
    ticker: string;
    name: string;
    movement: string;
    drivers: string;
    interpretation: string;
};

export type AccountInsightsResult = {
    items: AccountInsightItem[];
    portfolioObservation: string;
    watchItems: string[];
};

export type LookoutItem = {
    ticker: string | null;
    name: string;
    item: string;
    whyItMatters: string;
    signalType: "risk" | "opportunity" | "watch";
};

export type LookoutResult = {
    items: LookoutItem[];
};

export type TickerOverviewResult = {
    priceBehavior: string;
    sentiment: string;
    hypeScore: number;
    fundamentalContext: string;
    risks: string[];
    outlook: string;
};

export async function getPortfolioPulse(
    timeframe: string,
    holdings: { ticker: string; name: string; shares: number; costBasis: number }[]
): Promise<PortfolioPulseResult | null> {
    if (!genAI) return null;
    const cacheKey = `pulse:${timeframe}:${holdings.map((h) => h.ticker).sort().join(",")}`;
    const cached = getCached(cacheKey);
    if (cached) return JSON.parse(cached) as PortfolioPulseResult;
    try {
        await rateLimitAcquire();
        const newsContext = await fetchStockNewsContext(holdings.map((h) => h.ticker));
        const userPrompt = `You are operating in Portfolio Pulse mode. Follow the rules in GEMINIRULES.MD strictly.

Timeframe: ${timeframe}
User holdings: ${JSON.stringify(holdings)}
${newsContext}

Generate a portfolio-level analysis based on the news context above and your knowledge. Output JSON:
{
  "insight": "<2-4 paragraph analysis of sector clustering, concentration risks, shared tailwinds, cross-holding themes>",
  "overvaluation": <0-100 score>,
  "growthPotential": <0-100 score>,
  "politicalClimate": <0-100 score>
}`;
        const text = await generateJson(GEMINIRULES, userPrompt);
        setCache(cacheKey, text);
        return JSON.parse(text) as PortfolioPulseResult;
    } catch (e) {
        console.error("getPortfolioPulse error:", e);
        return null;
    }
}

export async function getAccountInsights(
    timeframe: string,
    holdings: { ticker: string; name: string; shares: number }[],
    transactions: { ticker: string; type: string; shares: number; timestamp: string }[]
): Promise<AccountInsightsResult | null> {
    if (!genAI) return null;
    const txSlice = transactions.slice(-20).map((t) => `${t.ticker}:${t.type}:${t.shares}:${t.timestamp}`);
    const cacheKey = `insights:${timeframe}:${holdings.map((h) => h.ticker).sort().join(",")}:${txSlice.join("|")}`;
    const cached = getCached(cacheKey);
    if (cached) return JSON.parse(cached) as AccountInsightsResult;
    try {
        await rateLimitAcquire();
        const tickers = [...new Set(holdings.map((h) => h.ticker))];
        const newsContext = await fetchStockNewsContext(tickers);
        const userPrompt = `You are operating in Account Insights mode. Follow the rules in GEMINIRULES.MD strictly.

Timeframe: ${timeframe}
Holdings: ${JSON.stringify(holdings)}
Recent transactions: ${JSON.stringify(transactions.slice(-20))}
${newsContext}

Explain movements in the user's positions using the news context above. Output JSON:
{
  "items": [{"ticker": "...", "name": "...", "movement": "...", "drivers": "...", "interpretation": "..."}],
  "portfolioObservation": "<summary of what positions collectively indicate>",
  "watchItems": ["<string>", ...]
}`;
        const text = await generateJson(GEMINIRULES, userPrompt);
        setCache(cacheKey, text);
        return JSON.parse(text) as AccountInsightsResult;
    } catch (e) {
        console.error("getAccountInsights error:", e);
        return null;
    }
}

export async function getLookout(
    timeframe: string,
    holdings: { ticker: string; name: string }[],
    watchlist: string[] = []
): Promise<LookoutResult | null> {
    if (!genAI) return null;
    const cacheKey = `lookout:${timeframe}:${holdings.map((h) => h.ticker).sort().join(",")}:${watchlist.sort().join(",")}`;
    const cached = getCached(cacheKey);
    if (cached) return JSON.parse(cached) as LookoutResult;
    try {
        await rateLimitAcquire();
        const tickers = [...new Set([...holdings.map((h) => h.ticker), ...watchlist])];
        const newsContext = await fetchStockNewsContext(tickers);
        const userPrompt = `You are operating in Lookout mode. Follow the rules in GEMINIRULES.MD strictly.

Timeframe: ${timeframe}
User holdings: ${JSON.stringify(holdings)}
Watchlist: ${JSON.stringify(watchlist)}
${newsContext}

Surface early signals within the timeframe using the news context above. For each item, include the stock ticker if it's a specific company. Output JSON:
{
  "items": [
    {"ticker": "AAPL" or null, "name": "Apple Inc", "item": "<brief description>", "whyItMatters": "<why for user>", "signalType": "risk"|"opportunity"|"watch"}
  ]
}`;
        const text = await generateJson(GEMINIRULES, userPrompt);
        setCache(cacheKey, text);
        return JSON.parse(text) as LookoutResult;
    } catch (e) {
        console.error("getLookout error:", e);
        return null;
    }
}

export async function getTickerOverview(
    ticker: string,
    companyName: string,
    timeframe: string = "1M"
): Promise<TickerOverviewResult | null> {
    if (!genAI) return null;
    const cacheKey = `overview:${ticker}:${timeframe}`;
    const cached = getCached(cacheKey);
    if (cached) return JSON.parse(cached) as TickerOverviewResult;
    try {
        await rateLimitAcquire();
        const newsContext = await fetchStockNewsContext([ticker]);
        const userPrompt = `You are generating a single-ticker overview. Follow the SINGLE TICKER OVERVIEWS section in GEMINIRULES.MD strictly.

Ticker: ${ticker}
Company: ${companyName}
Timeframe: ${timeframe}
${newsContext}

Analyze using the news context above and your knowledge. Output JSON:
{
  "priceBehavior": "<recent trend, volatility, momentum shifts>",
  "sentiment": "<investor sentiment evaluation>",
  "hypeScore": <0-100>,
  "fundamentalContext": "<growth profile, perceived positioning>",
  "risks": ["<risk1>", "<risk2>", ...],
  "outlook": "<bullish|neutral|bearish, short|medium|long term, reasoning>"
}`;
        const text = await generateJson(GEMINIRULES, userPrompt);
        setCache(cacheKey, text);
        return JSON.parse(text) as TickerOverviewResult;
    } catch (e) {
        console.error("getTickerOverview error:", e);
        return null;
    }
}

export async function getInvestorHypeScore(
    ticker: string,
    companyName: string
): Promise<{ score: number | null; points: string[] }> {
    if (!genAI) {
        return {
            score: null,
            points: ["Add GEMINI_API_KEY to .env.local to enable AI analysis."],
        };
    }
    try {
        const cacheKey = `hype:${ticker}`;
        const cached = getCached(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            return { score: parsed.score ?? null, points: parsed.points ?? [] };
        }
        await rateLimitAcquire();
        const newsContext = await fetchStockNewsContext([ticker]);
        const userPrompt = `Analyze the current investor hype for ${companyName} (${ticker}). Use the HYPESCORE.MD rubric. Follow the 30-day observation window and five-dimension scoring. Use the news context below and your knowledge of retail attention, narrative strength, and price behavior.
${newsContext}

Output strictly as JSON:
{
  "score": <number 0-100>,
  "points": ["<short bullet 1>", "<short bullet 2>"]
}`;
        const text = await generateJson(HYPESCORE_RULES, userPrompt);
        const parsed = JSON.parse(text);
        setCache(cacheKey, text);
        return { score: parsed.score ?? null, points: parsed.points ?? [] };
    } catch (error) {
        console.error("Failed to generate hype score:", error);
        return {
            score: null,
            points: ["Failed to generate analysis.", "Please try again later."],
        };
    }
}
