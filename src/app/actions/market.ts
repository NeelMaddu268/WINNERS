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

export async function searchTickers(query: string): Promise<{ symbol: string; name: string; exchange?: string; type?: string }[]> {
    if (!query || query.trim().length < 2) return [];
    try {
        const res = await fetch(
            `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query.trim())}&quotesCount=10`,
            { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 60 } }
        );
        if (!res.ok) return [];
        const json = await res.json();
        const quotes = json.quotes || [];
        return quotes
            .filter((q: { symbol?: string; shortname?: string }) => q.symbol && q.shortname)
            .map((q: { symbol: string; shortname: string; longname?: string; exchange?: string; quoteType?: string }) => ({
                symbol: q.symbol,
                name: q.shortname || q.longname || q.symbol,
                exchange: q.exchange,
                type: q.quoteType,
            }));
    } catch (error) {
        console.error("Failed to search tickers:", error);
        return [];
    }
}

export async function getQuote(symbol: string): Promise<{ symbol: string; price: number; change: number; changesPercentage: number; name?: string } | null> {
    try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
            headers: { "User-Agent": "Mozilla/5.0" },
            next: { revalidate: 60 },
        });
        if (!res.ok) return null;
        const json = await res.json();
        const result = json.chart?.result?.[0]?.meta;
        if (!result) return null;
        const price = result.regularMarketPrice;
        const prevClose = result.chartPreviousClose || result.previousClose;
        const change = price - prevClose;
        return {
            symbol,
            price,
            change,
            changesPercentage: (change / prevClose) * 100,
            name: result.shortName || result.longName || symbol,
        };
    } catch (error) {
        console.error("Failed to fetch quote:", error);
        return null;
    }
}

export async function getChartData(symbol: string): Promise<{ date: string; open: number; high: number; low: number; close: number; volume: number }[]> {
    try {
        const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=20y`,
            { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 900 } }
        );
        if (!res.ok) return [];
        const data = await res.json();
        const result = data.chart?.result?.[0];
        if (!result) return [];
        const timestamps = result.timestamp;
        const quotes = result.indicators?.quote?.[0];
        if (!timestamps || !quotes) return [];
        const chartData: { date: string; open: number; high: number; low: number; close: number; volume: number }[] = [];
        for (let j = 0; j < timestamps.length; j++) {
            if (quotes.close[j] !== null) {
                const dateObj = new Date(timestamps[j] * 1000);
                chartData.push({
                    date: dateObj.toISOString().split("T")[0],
                    open: quotes.open[j] ?? quotes.close[j],
                    high: quotes.high[j] ?? quotes.close[j],
                    low: quotes.low[j] ?? quotes.close[j],
                    close: quotes.close[j],
                    volume: quotes.volume[j] ?? 0,
                });
            }
        }
        return chartData.slice(-5000);
    } catch (error) {
        console.error("Failed to fetch chart data:", error);
        return [];
    }
}

export async function getPriceForDate(symbol: string, dateOrTimestamp: string): Promise<number | null> {
    const dateStr = dateOrTimestamp.includes("T") ? dateOrTimestamp.split("T")[0] : dateOrTimestamp;
    try {
        const chartData = await getChartData(symbol);
        const exact = chartData.find((d) => d.date === dateStr);
        if (exact) return exact.close;
        const before = chartData.filter((d) => d.date <= dateStr).sort((a, b) => b.date.localeCompare(a.date))[0];
        const after = chartData.filter((d) => d.date >= dateStr).sort((a, b) => a.date.localeCompare(b.date))[0];
        if (before) return before.close;
        if (after) return after.close;
        return chartData.length > 0 ? chartData[chartData.length - 1].close : null;
    } catch {
        return null;
    }
}

export async function getTopGainersLosers(): Promise<{
    gainers: { symbol: string; name: string; price: number; change: number; changesPercentage: number; volume: number }[];
    losers: { symbol: string; name: string; price: number; change: number; changesPercentage: number; volume: number }[];
}> {
    const MOCK = {
        gainers: [
            { symbol: "NVDA", name: "NVIDIA Corp", price: 189.82, change: 12.4, changesPercentage: 7.0, volume: 48200000 },
            { symbol: "SMCI", name: "Super Micro Computer", price: 78.14, change: 4.72, changesPercentage: 6.4, volume: 12400000 },
            { symbol: "PLTR", name: "Palantir Technologies", price: 21.33, change: 1.02, changesPercentage: 5.0, volume: 88100000 },
            { symbol: "MSTR", name: "MicroStrategy", price: 1420.0, change: 60.5, changesPercentage: 4.5, volume: 3200000 },
            { symbol: "COIN", name: "Coinbase Global", price: 184.0, change: 7.8, changesPercentage: 4.4, volume: 9800000 },
        ],
        losers: [
            { symbol: "INTC", name: "Intel Corp", price: 21.05, change: -2.45, changesPercentage: -10.4, volume: 62000000 },
            { symbol: "PFE", name: "Pfizer Inc", price: 26.80, change: -2.1, changesPercentage: -7.3, volume: 38000000 },
            { symbol: "CVS", name: "CVS Health", price: 53.10, change: -3.2, changesPercentage: -5.7, volume: 14000000 },
            { symbol: "WBA", name: "Walgreens Boots", price: 9.30, change: -0.48, changesPercentage: -4.9, volume: 22000000 },
            { symbol: "BABA", name: "Alibaba Group", price: 74.50, change: -3.2, changesPercentage: -4.1, volume: 30000000 },
        ],
    };
    try {
        const cacheKey = "gainers_losers";
        if (cache[cacheKey] && cache[cacheKey].expires > Date.now()) return cache[cacheKey].data;

        const [gainersRes, losersRes] = await Promise.all([
            fetch("https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_gainers&count=10", {
                headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 900 }
            }),
            fetch("https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_losers&count=10", {
                headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 900 }
            }),
        ]);

        if (!gainersRes.ok || !losersRes.ok) return MOCK;

        const parse = (json: any) => (json?.finance?.result?.[0]?.quotes || []).map((q: any) => ({
            symbol: q.symbol,
            name: q.shortName || q.longName || q.symbol,
            price: q.regularMarketPrice ?? 0,
            change: q.regularMarketChange ?? 0,
            changesPercentage: q.regularMarketChangePercent ?? 0,
            volume: q.regularMarketVolume ?? 0,
        }));

        const [gainersJson, losersJson] = await Promise.all([gainersRes.json(), losersRes.json()]);
        const data = { gainers: parse(gainersJson), losers: parse(losersJson) };
        if (data.gainers.length === 0 && data.losers.length === 0) return MOCK;

        cache[cacheKey] = { data, expires: Date.now() + CACHE_TTL_MS };
        return data;
    } catch {
        return MOCK;
    }
}

export async function getVolumeLeaders(): Promise<{ symbol: string; name: string; price: number; change: number; changesPercentage: number; volume: number }[]> {
    const MOCK = [
        { symbol: "TSLA", name: "Tesla Inc", price: 175.34, change: -4.2, changesPercentage: -2.34, volume: 130000000 },
        { symbol: "NVDA", name: "NVIDIA Corp", price: 189.82, change: 12.4, changesPercentage: 7.0, volume: 98000000 },
        { symbol: "AMD", name: "Advanced Micro Devices", price: 160.20, change: 2.4, changesPercentage: 1.52, volume: 75000000 },
        { symbol: "AAPL", name: "Apple Inc", price: 173.50, change: -0.45, changesPercentage: -0.26, volume: 68000000 },
        { symbol: "AMZN", name: "Amazon.com Inc", price: 178.15, change: 1.05, changesPercentage: 0.59, volume: 55000000 },
    ];
    try {
        const cacheKey = "volume_leaders";
        if (cache[cacheKey] && cache[cacheKey].expires > Date.now()) return cache[cacheKey].data;

        const res = await fetch("https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=most_actives&count=10", {
            headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 900 }
        });
        if (!res.ok) return MOCK;
        const json = await res.json();
        const data = (json?.finance?.result?.[0]?.quotes || []).map((q: any) => ({
            symbol: q.symbol,
            name: q.shortName || q.longName || q.symbol,
            price: q.regularMarketPrice ?? 0,
            change: q.regularMarketChange ?? 0,
            changesPercentage: q.regularMarketChangePercent ?? 0,
            volume: q.regularMarketVolume ?? 0,
        }));
        if (data.length === 0) return MOCK;
        cache[cacheKey] = { data, expires: Date.now() + CACHE_TTL_MS };
        return data;
    } catch {
        return MOCK;
    }
}

const SECTOR_ETFS: { symbol: string; name: string; shortName: string }[] = [
    { symbol: "XLK", name: "Technology", shortName: "Tech" },
    { symbol: "XLF", name: "Financials", shortName: "Finance" },
    { symbol: "XLV", name: "Healthcare", shortName: "Health" },
    { symbol: "XLE", name: "Energy", shortName: "Energy" },
    { symbol: "XLY", name: "Consumer Disc.", shortName: "Cons. D" },
    { symbol: "XLP", name: "Consumer Staples", shortName: "Cons. S" },
    { symbol: "XLI", name: "Industrials", shortName: "Indust." },
    { symbol: "XLB", name: "Materials", shortName: "Materials" },
    { symbol: "XLRE", name: "Real Estate", shortName: "RE" },
    { symbol: "XLU", name: "Utilities", shortName: "Utilities" },
    { symbol: "XLC", name: "Comm. Services", shortName: "Comm." },
];

export async function getSectorPerformance(): Promise<{ symbol: string; name: string; shortName: string; price: number; change: number; changesPercentage: number }[]> {
    try {
        const cacheKey = "sector_perf";
        if (cache[cacheKey] && cache[cacheKey].expires > Date.now()) return cache[cacheKey].data;

        const quotes = await getBatchQuotes(SECTOR_ETFS.map(s => s.symbol));
        const data = SECTOR_ETFS.map(sector => {
            const q = (quotes as any[]).find((x: any) => x.symbol === sector.symbol);
            return {
                ...sector,
                price: q?.price ?? 0,
                change: q?.change ?? 0,
                changesPercentage: q?.changesPercentage ?? (Math.random() * 6 - 3),
            };
        });
        cache[cacheKey] = { data, expires: Date.now() + CACHE_TTL_MS };
        return data;
    } catch {
        return SECTOR_ETFS.map(s => ({ ...s, price: 0, change: 0, changesPercentage: Math.random() * 6 - 3 }));
    }
}

export async function getEarningsCalendar(): Promise<{
    beforeOpen: { symbol: string; name: string; epsEstimate: string }[];
    afterClose: { symbol: string; name: string; epsEstimate: string }[];
}> {
    // Yahoo Finance calendar endpoint requires session cookies; use realistic static data
    return {
        beforeOpen: [
            { symbol: "WMT", name: "Walmart Inc", epsEstimate: "$0.52" },
            { symbol: "HD", name: "Home Depot", epsEstimate: "$3.04" },
            { symbol: "LOW", name: "Lowe's Companies", epsEstimate: "$1.67" },
            { symbol: "TGT", name: "Target Corp", epsEstimate: "$2.26" },
        ],
        afterClose: [
            { symbol: "NVDA", name: "NVIDIA Corp", epsEstimate: "$0.74" },
            { symbol: "CSCO", name: "Cisco Systems", epsEstimate: "$0.91" },
            { symbol: "AMAT", name: "Applied Materials", epsEstimate: "$2.09" },
        ],
    };
}

export async function getEconomicCalendar(): Promise<{ time: string; event: string; impact: "high" | "medium" | "low"; forecast: string }[]> {
    return [
        { time: "8:30 AM", event: "Initial Jobless Claims", impact: "high", forecast: "215K" },
        { time: "10:00 AM", event: "Existing Home Sales", impact: "medium", forecast: "3.95M" },
        { time: "2:00 PM", event: "FOMC Meeting Minutes", impact: "high", forecast: "—" },
        { time: "4:30 PM", event: "Fed Balance Sheet", impact: "low", forecast: "—" },
    ];
}

export async function getFearGreedIndex(): Promise<{ score: number; rating: string } | null> {
    try {
        const cacheKey = "fear_greed";
        if (cache[cacheKey] && cache[cacheKey].expires > Date.now()) {
            return cache[cacheKey].data;
        }
        const res = await fetch("https://production.dataviz.cnn.io/index/fearandgreed/graphdata", {
            headers: { "User-Agent": "Mozilla/5.0" },
            next: { revalidate: 3600 },
        });
        if (!res.ok) return null;
        const json = await res.json();
        const fg = json?.fear_and_greed;
        if (!fg?.score) return null;
        const data = { score: Math.round(fg.score), rating: fg.rating || "neutral" };
        cache[cacheKey] = { data, expires: Date.now() + CACHE_TTL_MS };
        return data;
    } catch {
        return null;
    }
}

export async function getBatchQuotes(symbols: string[], skipCache?: boolean) {
    try {
        const symbolString = symbols.sort().join(",");
        const cacheKey = `batch_${symbolString}`;

        if (!skipCache && cache[cacheKey] && cache[cacheKey].expires > Date.now()) {
            return cache[cacheKey].data;
        }

        const fetchPromises = symbols.map(async (symbol) => {
            const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                ...(skipCache ? { cache: 'no-store' as RequestCache } : { next: { revalidate: 900 } })
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
