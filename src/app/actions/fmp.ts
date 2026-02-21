"use server";

// Fallback mock data in case API is completely unreachable
const MOCK_INDEX = {
    price: 5234.18,
    change: 42.11,
    changesPercentage: 0.81,
    name: "S&P 500",
    symbol: "^GSPC"
};

const MOCK_TICKERS: Record<string, any> = {
    "NVDA": { price: 189.82, change: 1.91, changesPercentage: 1.02 },
    "AAPL": { price: 173.50, change: -0.45, changesPercentage: -0.26 },
    "MSFT": { price: 410.22, change: 3.14, changesPercentage: 0.77 },
    "TSLA": { price: 175.34, change: -4.20, changesPercentage: -2.34 },
    "AMZN": { price: 178.15, change: 1.05, changesPercentage: 0.59 }
};

// In-memory cache to strictly enforce limits and improve load times
const cache: Record<string, { data: any, expires: number }> = {};
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes before hitting the API again

export async function getMarketIndex(symbol: string = "^GSPC") {
    try {
        const cacheKey = `index_${symbol}`;
        if (cache[cacheKey] && cache[cacheKey].expires > Date.now()) {
            return cache[cacheKey].data;
        }

        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            next: { revalidate: 900 }
        });

        if (!res.ok) throw new Error("Yahoo Finance API error");

        const json = await res.json();
        const result = json.chart.result?.[0]?.meta;

        if (result) {
            const price = result.regularMarketPrice;
            const prevClose = result.chartPreviousClose || result.previousClose;
            const change = price - prevClose;
            const changesPercentage = (change / prevClose) * 100;

            const data = {
                price: price,
                change: change,
                changesPercentage: changesPercentage,
                name: "S&P 500",
                symbol: symbol
            };

            cache[cacheKey] = { data: data, expires: Date.now() + CACHE_TTL_MS };
            return data;
        }
        return MOCK_INDEX;
    } catch (error) {
        console.error("Failed to fetch market index from Yahoo:", error);
        return MOCK_INDEX;
    }
}

export async function getBatchQuotes(symbols: string[]) {
    try {
        const symbolString = symbols.sort().join(",");
        const cacheKey = `batch_${symbolString}`;

        if (cache[cacheKey] && cache[cacheKey].expires > Date.now()) {
            return cache[cacheKey].data;
        }

        const fetchPromises = symbols.map(async (symbol) => {
            const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                next: { revalidate: 900 }
            });
            if (!res.ok) return null;

            const json = await res.json();
            const result = json.chart.result?.[0]?.meta;
            if (!result) return null;

            const price = result.regularMarketPrice;
            const prevClose = result.chartPreviousClose || result.previousClose;
            const change = price - prevClose;

            return {
                symbol: symbol,
                price: price,
                change: change,
                changesPercentage: (change / prevClose) * 100
            };
        });

        const rawData = await Promise.all(fetchPromises);
        const finalData = rawData.filter(Boolean);

        cache[cacheKey] = { data: finalData, expires: Date.now() + CACHE_TTL_MS };
        return finalData;
    } catch (error) {
        console.error("Failed to fetch batch quotes from Yahoo:", error);
        return symbols.map(sym => ({
            symbol: sym,
            ...(MOCK_TICKERS[sym] || { price: 100, change: 0, changesPercentage: 0 })
        }));
    }
}
