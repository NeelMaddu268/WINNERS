"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

const API_KEY = process.env.GEMINI_API_KEY;
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

const CACHE_TTL_MS = 10 * 60 * 1000;
const PULSE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // Portfolio Pulse scores: once per day or on trade
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

function setCache(key: string, data: string, ttlMs?: number): void {
    cache.set(key, { data, expires: Date.now() + (ttlMs ?? CACHE_TTL_MS) });
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

/** Fetch Finnhub news for most-talked-about stocks NOT in the user's portfolio (for Lookout). */
async function fetchLookoutNewsContext(portfolioTickers: string[]): Promise<string> {
    if (!FINNHUB_KEY) return "";
    const exclude = new Set(portfolioTickers.map((t) => t.toUpperCase()));
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 30);
    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];
    let candidateTickers: string[] = [];
    try {
        const { getTopGainersLosers, getVolumeLeaders } = await import("@/app/actions/market");
        const [gl, vol] = await Promise.all([getTopGainersLosers(), getVolumeLeaders()]);
        const all = [...gl.gainers, ...gl.losers, ...vol].map((m) => m.symbol);
        candidateTickers = [...new Set(all)].filter((s) => !exclude.has(s.toUpperCase())).slice(0, 6);
    } catch {
        candidateTickers = ["NVDA", "AAPL", "TSLA", "AMZN", "MSFT", "GOOGL", "META", "AMD", "COIN", "PLTR"]
            .filter((s) => !exclude.has(s));
    }
    if (candidateTickers.length === 0) return "";
    const results: string[] = [];
    for (const symbol of candidateTickers.slice(0, 5)) {
        try {
            const res = await fetch(
                `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromStr}&to=${toStr}&token=${FINNHUB_KEY}`,
                { next: { revalidate: 300 } }
            );
            const data = (await res.json()) as { headline?: string; summary?: string; source?: string; datetime?: number }[];
            if (Array.isArray(data) && data.length > 0) {
                const items = data.slice(0, 6).map((n) => `- ${n.headline || ""} (${n.source || "news"})`);
                results.push(`[${symbol} Finnhub news]\n${items.join("\n")}`);
            }
        } catch {
            /* ignore */
        }
    }
    return results.length > 0
        ? `\n\nFINNHUB NEWS (use this to find most talked-about stocks; EXCLUDE from output: ${portfolioTickers.join(", ") || "none"}):\n${results.join("\n\n")}`
        : "";
}

export type PortfolioPulseResult = {
    insight: string;
    overvaluation: number;
    growthPotential: number;
    politicalClimate: number;
    /** 2 short bullets explaining valuation risk relative to positions (P/E, market cap) */
    valuationRiskExplanation?: string[];
    /** 2 short bullets explaining growth potential (industry, product, earnings) */
    growthPotentialExplanation?: string[];
    /** 2 short bullets: low = restrictions; high = subsidies, incentives, industrial policy */
    politicalClimateExplanation?: string[];
};

export type AccountInsightItem = {
    ticker: string;
    name: string;
    movement: string;
    drivers: string[];
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
    recentNewsAndFundamentals: string;
    fundamentalContext: string;
    risks: string[];
    outlook: string;
};

export async function getPortfolioPulse(
    timeframe: string,
    holdings: { ticker: string; name: string; shares: number; costBasis: number }[]
): Promise<PortfolioPulseResult | null> {
    if (!genAI) return null;
    const cacheKey = `pulse:${timeframe}:${holdings.map((h) => `${h.ticker}:${h.shares}`).sort().join(",")}`;
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
  "insight": "<2-4 short bullet points: sector clustering, concentration risks, shared tailwinds, cross-holding themes. No long paragraphs.>",
  "overvaluation": <0-100 score>,
  "growthPotential": <0-100 score>,
  "politicalClimate": <0-100 score>,
  "valuationRiskExplanation": ["<bullet 1: P/E ratios, market cap relative to positions>", "<bullet 2>"],
  "growthPotentialExplanation": ["<bullet 1: industry growth, product, position earnings>", "<bullet 2>"],
  "politicalClimateExplanation": ["<bullet 1: low scores = government restrictions; high = subsidies/incentives/industrial policy>", "<bullet 2>"]
}
For valuationRiskExplanation: explain P/E ratios, market cap relative to the user's positions.
For growthPotentialExplanation: explain industry growth, product positioning, and the position's earning numbers.
For politicalClimateExplanation: for low scores show government restrictions; for high scores justify with relevant subsidies, incentives, and industrial policy.`;
        const text = await generateJson(GEMINIRULES, userPrompt);
        setCache(cacheKey, text, PULSE_CACHE_TTL_MS);
        return JSON.parse(text) as PortfolioPulseResult;
    } catch (e) {
        console.error("getPortfolioPulse error:", e);
        return null;
    }
}

export async function getAccountInsights(
    timeframe: string,
    holdings: { ticker: string; name: string; shares: number; unrealizedPercent?: number }[],
    transactions: { ticker: string; type: string; shares: number; timestamp: string }[]
): Promise<AccountInsightsResult | null> {
    if (!genAI) return null;
    const txSlice = transactions.slice(-20).map((t) => `${t.ticker}:${t.type}:${t.shares}:${t.timestamp}`);
    const cacheKey = `insights:${timeframe}:${holdings.map((h) => `${h.ticker}:${h.unrealizedPercent ? h.unrealizedPercent.toFixed(1) : ''}`).sort().join(",")}:${txSlice.join("|")}`;
    const cached = getCached(cacheKey);
    if (cached) return JSON.parse(cached) as AccountInsightsResult;
    try {
        await rateLimitAcquire();
        const tickers = [...new Set(holdings.map((h) => h.ticker))];
        const newsContext = await fetchStockNewsContext(tickers);
        const userPrompt = `You are operating in Account Insights mode. Follow the rules in GEMINIRULES.MD strictly.

Timeframe: ${timeframe}
Holdings (including real-time exact Profit/Loss %): ${JSON.stringify(holdings)}
Recent transactions: ${JSON.stringify(transactions.slice(-20))}
${newsContext}

Explain movements in the user's positions using the exact profit/loss % data and news context above. IMPORTANT: When citing if a stock is up or down, ONLY use the exact 'unrealizedPercent' provided in the Holdings data. Do not hallucinate price movements. Output JSON:
{
  "items": [{"ticker": "...", "name": "...", "movement": "<Describe the exact profit/loss using the provided metrics>", "drivers": ["<bullet 1>", "<bullet 2>", ...], "interpretation": "..."}],
  "portfolioObservation": "<summary of what positions collectively indicate>",
  "watchItems": ["<string>", ...]
}
Each driver must be a separate array element—one short sentence per bullet. Never combine multiple drivers into one string. Include encouragement, reassurance, or a tip in interpretation when natural.`;
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
    holdings: { ticker: string; name: string }[] = [],
    watchlist: string[] = []
): Promise<LookoutResult | null> {
    if (!genAI) return null;
    const portfolioTickers = [...new Set([...holdings.map((h) => h.ticker), ...watchlist])];
    const cacheKey = `lookout:${timeframe}:${portfolioTickers.sort().join(",")}`;
    const cached = getCached(cacheKey);
    if (cached) return JSON.parse(cached) as LookoutResult;
    try {
        await rateLimitAcquire();
        const newsContext = await fetchLookoutNewsContext(portfolioTickers);
        const userPrompt = `You are operating in Lookout mode. Follow the rules in GEMINIRULES.MD strictly.

Timeframe: ${timeframe}
User's portfolio tickers (EXCLUDE these from your output—do not surface any of these): ${portfolioTickers.length > 0 ? portfolioTickers.join(", ") : "none"}
${newsContext}

Use the Finnhub news above to identify the most talked-about stocks in this timeframe. Surface ONLY stocks that are NOT in the user's portfolio. For each item, include the stock ticker if it's a specific company. Output JSON:
{
  "items": [
    {"ticker": "AAPL" or null, "name": "Apple Inc", "item": "<brief description>", "whyItMatters": "<why it matters to investors generally>", "signalType": "risk"|"opportunity"|"watch"}
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
  "recentNewsAndFundamentals": "<2-4 bullets summarizing recent news: company fundamentals, products, earnings. Each bullet distills one news item or theme.>",
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
