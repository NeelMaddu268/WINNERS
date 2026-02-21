"use server";

import { getChartData } from "./market";

const STARTING_CASH = 10000;

export type Transaction = { type: "buy" | "sell"; ticker: string; name: string; shares: number; timestamp: string; price?: number; total?: number };
export type Position = { ticker: string; name: string; shares: number; avgCost: number; costBasis: number };

export async function recalculatePortfolioFromTransactions(
    transactions: Transaction[]
): Promise<{ portfolio: Position[]; cashBalance: number; transactionsWithPrices: Transaction[] }> {
    const sorted = [...transactions].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const tickerDates = new Map<string, Set<string>>();
    for (const tx of sorted) {
        if (tx.price != null) continue; // Legacy: use stored price
        const dateStr = tx.timestamp.includes("T") ? tx.timestamp.split("T")[0] : tx.timestamp;
        if (!tickerDates.has(tx.ticker)) tickerDates.set(tx.ticker, new Set());
        tickerDates.get(tx.ticker)!.add(dateStr);
    }
    const priceCache = new Map<string, number>();
    for (const [ticker, dates] of tickerDates) {
        const chartData = await getChartData(ticker);
        for (const dateStr of dates) {
            const exact = chartData.find((d) => d.date === dateStr);
            if (exact) priceCache.set(`${ticker}:${dateStr}`, exact.close);
            else {
                const before = chartData.filter((d) => d.date <= dateStr).sort((a, b) => b.date.localeCompare(a.date))[0];
                const after = chartData.filter((d) => d.date >= dateStr).sort((a, b) => a.date.localeCompare(b.date))[0];
                const price = before?.close ?? after?.close ?? (chartData.length > 0 ? chartData[chartData.length - 1].close : 0);
                priceCache.set(`${ticker}:${dateStr}`, price);
            }
        }
    }

    let cash = STARTING_CASH;
    const positions = new Map<string, { name: string; shares: number; costBasis: number }>();
    const transactionsWithPrices: Transaction[] = [];

    for (const tx of sorted) {
        const dateStr = tx.timestamp.includes("T") ? tx.timestamp.split("T")[0] : tx.timestamp;
        // Legacy transactions may have stored price/total; otherwise derive from timestamp
        const price = tx.price != null ? tx.price : (priceCache.get(`${tx.ticker}:${dateStr}`) ?? 0);
        const total = tx.total != null ? tx.total : tx.shares * price;
        transactionsWithPrices.push({ ...tx, price, total });

        const existing = positions.get(tx.ticker);
        const existingShares = existing?.shares ?? 0;
        const existingCostBasis = existing?.costBasis ?? 0;

        if (tx.type === "buy") {
            cash -= total;
            const newShares = existingShares + tx.shares;
            const newCostBasis = existingCostBasis + total;
            positions.set(tx.ticker, { name: tx.name, shares: newShares, costBasis: newCostBasis });
        } else {
            cash += total;
            const newShares = existingShares - tx.shares;
            const newCostBasis = newShares > 0 ? (existingCostBasis / existingShares) * newShares : 0;
            if (newShares <= 0) positions.delete(tx.ticker);
            else positions.set(tx.ticker, { name: tx.name, shares: newShares, costBasis: newCostBasis });
        }
    }

    const portfolio: Position[] = Array.from(positions.entries())
        .filter(([, v]) => v.shares > 0)
        .map(([ticker, v]) => ({
            ticker,
            name: v.name,
            shares: v.shares,
            costBasis: v.costBasis,
            avgCost: v.costBasis / v.shares,
        }));

    return { portfolio, cashBalance: cash, transactionsWithPrices };
}
