"use server";

import { getBatchQuotes } from "./fmp";

const TICKER_SYMBOLS = [
    { symbol: "BTC-USD", name: "Bitcoin" },
    { symbol: "ETH-USD", name: "Ethereum" },
    { symbol: "AAPL", name: "Apple" },
    { symbol: "TSLA", name: "Tesla" },
    { symbol: "NVDA", name: "Nvidia" },
    { symbol: "AMZN", name: "Amazon" },
    { symbol: "MSFT", name: "Microsoft" },
    { symbol: "GOOGL", name: "Google" },
    { symbol: "SOL-USD", name: "Solana" },
    { symbol: "META", name: "Meta" },
    { symbol: "^GSPC", name: "S&P 500" },
    { symbol: "ADA-USD", name: "Cardano" },
];

export async function getTickerData() {
    const symbols = TICKER_SYMBOLS.map((t) => t.symbol);
    const quotes = await getBatchQuotes(symbols);

    return TICKER_SYMBOLS.map((t) => {
        const q = quotes.find((quote: any) => quote?.symbol === t.symbol);
        const price = q?.price ?? 0;
        const pct = q?.changesPercentage ?? 0;
        const positive = pct >= 0;

        // Format price
        let priceStr: string;
        if (price >= 1000) priceStr = price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        else if (price >= 1) priceStr = price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        else priceStr = price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

        return {
            name: t.name,
            price: `${priceStr} USD`,
            change: `${positive ? "+" : ""}${pct.toFixed(2)}%`,
            positive,
        };
    });
}
