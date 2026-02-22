"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot, getDoc, collection, addDoc } from "firebase/firestore";
import { recalculatePortfolioFromTransactions, type Transaction } from "@/app/actions/portfolio";
import {
    getPortfolioPulse,
    getAccountInsights,
    getLookout,
    getInvestorHypeScore,
    type PortfolioPulseResult,
    type AccountInsightsResult,
    type LookoutResult,
} from "@/app/actions/gemini";
import { BentoGrid } from "@/components/ui/bento-grid";
import { TrendingUp } from "lucide-react";

type PortfolioPosition = { ticker: string; name: string; shares: number; avgCost: number; costBasis: number; priceAtPurchase?: number };

export default function PortfolioPage() {
    const router = useRouter();
    const [candleData, setCandleData] = useState<any[]>([]);
    const [transactionHistory, setTransactionHistory] = useState<Transaction[]>([]);
    const [portfolio, setPortfolio] = useState<PortfolioPosition[]>([]);
    const [cashBalance, setCashBalance] = useState<number>(10000);
    const [transactionsWithPrices, setTransactionsWithPrices] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [portfolioRecalculating, setPortfolioRecalculating] = useState(false);
    const portfolioRecalculatingRef = useRef(false);
    const [livePrices, setLivePrices] = useState<Record<string, number>>({});
    const [activeTab, setActiveTab] = useState<"assets" | "history">("assets");
    const [timeframe, setTimeframe] = useState("2 wks");
    const [portfolioPulse, setPortfolioPulse] = useState<PortfolioPulseResult | null>(null);
    const [accountInsights, setAccountInsights] = useState<AccountInsightsResult | null>(null);
    const [lookout, setLookout] = useState<LookoutResult | null>(null);
    const [lookoutHypeScores, setLookoutHypeScores] = useState<Record<string, { score: number | null; points: string[] }>>({});
    const [aiLoading, setAiLoading] = useState({ pulse: false, insights: false, lookout: false });
    const [txToShare, setTxToShare] = useState<Transaction | null>(null);
    const [shareAudience, setShareAudience] = useState<"public" | "friends">("public");
    const [isSharingTx, setIsSharingTx] = useState(false);
    const [shareSuccess, setShareSuccess] = useState(false);
    const [portfolio7DayPct, setPortfolio7DayPct] = useState<number | null>(null);
    const [spy7DayPct, setSpy7DayPct] = useState<number | null>(null);

    const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const [pillPos, setPillPos] = useState<{ left: number; width: number } | null>(null);
    const tabLabels = [
        { key: "assets" as const, label: "My Assets" },
        { key: "history" as const, label: "Transaction History" },
    ];
    const activeTabIdx = tabLabels.findIndex(t => t.key === activeTab);
    useEffect(() => {
        const el = tabRefs.current[activeTabIdx];
        if (el) setPillPos({ left: el.offsetLeft, width: el.offsetWidth });
    }, [activeTabIdx, loading]);

    // Merge duplicate tickers: sum shares, weighted avg cost. Remove positions with 0 shares.
    const mergedPositions = useMemo(() => {
        const byTicker = new Map<string, { name: string; shares: number; costBasis: number }>();
        for (const p of portfolio) {
            const shares = p.shares ?? 0;
            const costBasis = p.costBasis ?? (shares * (p.avgCost ?? p.priceAtPurchase ?? 0));
            const existing = byTicker.get(p.ticker);
            if (existing) {
                existing.shares += shares;
                existing.costBasis += costBasis;
            } else {
                byTicker.set(p.ticker, { name: p.name ?? p.ticker, shares, costBasis });
            }
        }
        return Array.from(byTicker.entries())
            .filter(([, v]) => v.shares > 0)
            .map(([ticker, v]) => ({
                ticker,
                name: v.name,
                shares: v.shares,
                costBasis: v.costBasis,
                avgCost: v.costBasis / v.shares,
            }));
    }, [portfolio]);

    // Calculate portfolio metrics
    const totalInvested = mergedPositions.reduce((sum, p) => sum + p.costBasis, 0);
    const totalMarketValue = mergedPositions.reduce((sum, p) => sum + (livePrices[p.ticker] ?? p.avgCost) * p.shares, 0);
    const totalValue = totalMarketValue + cashBalance;
    const totalPnL = totalMarketValue - totalInvested;
    const totalReturn = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    const isPortfolioUp = totalPnL >= 0;
    const investedPct = totalValue > 0 ? (totalMarketValue / totalValue) * 100 : 0;

    const fetchLivePrices = useCallback((forceRefresh = false) => {
        if (mergedPositions.length === 0) {
            setLivePrices({});
            return;
        }
        const symbols = mergedPositions.map(p => p.ticker);
        import("@/app/actions/market").then(({ getBatchQuotes }) => {
            getBatchQuotes(symbols, forceRefresh).then((data: any[]) => {
                const priceMap: Record<string, number> = {};
                data.forEach((q: any) => { priceMap[q.symbol] = q.price; });
                setLivePrices(priceMap);
            });
        });
    }, [mergedPositions]);

    useEffect(() => {
        fetchLivePrices(true);
        const interval = setInterval(() => fetchLivePrices(true), 10000);
        return () => clearInterval(interval);
    }, [fetchLivePrices]);

    useEffect(() => {
        if (activeTab === "assets" && mergedPositions.length > 0) {
            fetchLivePrices(true);
        }
    }, [activeTab, mergedPositions.length, fetchLivePrices]);

    useEffect(() => {
        let unsubscribeDoc: () => void;

        const attachSnapshot = (uid: string) => {
            const userRef = doc(db, "users", uid);
            unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setTransactionHistory(data.transactionHistory || []);
                } else {
                    setTransactionHistory([]);
                }
                setLoading(false);
            }, (error) => {
                console.error("Failed to listen to user data:", error);
                setLoading(false);
            });
        };

        // Use already-resolved currentUser first (layout guarantees auth is done)
        const currentUser = auth.currentUser;
        if (currentUser) {
            attachSnapshot(currentUser.uid);
        } else {
            // Fallback: wait for auth state (e.g. on hard refresh)
            const unsubscribeAuth = auth.onAuthStateChanged((user) => {
                if (user) {
                    attachSnapshot(user.uid);
                } else {
                    setTransactionHistory([]);
                    setPortfolio([]);
                    setCashBalance(10000);
                    setTransactionsWithPrices([]);
                    setLoading(false);
                }
                unsubscribeAuth(); // only need it once
            });
        }

        return () => {
            if (unsubscribeDoc) unsubscribeDoc();
        };
    }, []);


    // Derive portfolio and cash from transaction history (price based on timestamp)
    useEffect(() => {
        if (transactionHistory.length === 0) {
            portfolioRecalculatingRef.current = false;
            setPortfolioRecalculating(false);
            setPortfolio([]);
            setCashBalance(10000);
            setTransactionsWithPrices([]);
            return;
        }
        portfolioRecalculatingRef.current = true;
        setPortfolioRecalculating(true);
        recalculatePortfolioFromTransactions(transactionHistory).then(({ portfolio: p, cashBalance: c, transactionsWithPrices: twp }) => {
            setPortfolio(p);
            setCashBalance(c);
            setTransactionsWithPrices(twp);
            portfolioRecalculatingRef.current = false;
            setPortfolioRecalculating(false);
        });
    }, [transactionHistory]);

    const handleOpenShareModal = async (tx: Transaction) => {
        setTxToShare(tx);
        setShareSuccess(false);
        if (auth.currentUser) {
            const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
            if (snap.exists() && snap.data().defaultAudience) {
                setShareAudience(snap.data().defaultAudience);
            }
        }
    };

    const handleShareTransaction = async () => {
        if (!auth.currentUser || !txToShare) return;
        setIsSharingTx(true);
        try {
            const feedRef = collection(db, "global_feed");
            const tradeDate = new Date(txToShare.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

            let actionText = txToShare.type === "buy"
                ? `purchased ${txToShare.shares.toLocaleString(undefined, { maximumFractionDigits: 2 })} shares on ${tradeDate} of`
                : `sold ${txToShare.shares.toLocaleString(undefined, { maximumFractionDigits: 2 })} shares on ${tradeDate} of`;

            if (txToShare.type === "sell") {
                const profitAmount = txToShare.profitAmount ?? 0;
                const profitPercent = txToShare.profitPercent ?? 0;
                const profitStr = profitAmount >= 0 ? `making a $${profitAmount.toFixed(2)} profit (+${profitPercent.toFixed(2)}%) on` : `taking a $${Math.abs(profitAmount).toFixed(2)} loss (${profitPercent.toFixed(2)}%) on`;
                actionText = `sold ${txToShare.shares.toLocaleString(undefined, { maximumFractionDigits: 2 })} shares on ${tradeDate}, ${profitStr}`;
            }

            await addDoc(feedRef, {
                user: {
                    name: auth.currentUser.displayName || "Anonymous",
                    handle: `@${(auth.currentUser.displayName || "user").replace(/\s+/g, '').toLowerCase()}`,
                    avatar: (auth.currentUser.displayName || "A").substring(0, 2).toUpperCase(),
                    color: "bg-blue-500",
                    uid: auth.currentUser.uid
                },
                audience: shareAudience,
                action: actionText,
                ticker: txToShare.ticker,
                timestamp: new Date().toISOString(),
                likes: [],
                commentsList: [],
                isPositive: txToShare.type === "buy"
            });
            setShareSuccess(true);
            setTimeout(() => {
                setTxToShare(null);
                setShareSuccess(false);
            }, 2000);
        } catch (error) {
            console.error("Error sharing transaction:", error);
        }
        setIsSharingTx(false);
    };

    useEffect(() => {
        if (loading || portfolioRecalculating || portfolioRecalculatingRef.current) {
            setAiLoading({ pulse: false, insights: false, lookout: false });
            return;
        }
        const holdings = mergedPositions.map((p) => ({ ticker: p.ticker, name: p.name, shares: p.shares, costBasis: p.costBasis }));
        const holdingsKey = holdings.map((h) => `${h.ticker}:${h.shares}`).sort().join(",");
        const txCount = transactionHistory.length;
        const uid = auth.currentUser?.uid ?? "anon";
        const cacheKey = `portfolioPulse:${uid}:${timeframe}:${holdingsKey}`;
        const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

        const tryCache = () => {
            if (typeof window === "undefined") return null;
            try {
                const raw = localStorage.getItem(cacheKey);
                if (!raw) return null;
                const { data, timestamp, storedTxCount } = JSON.parse(raw);
                if (Date.now() - timestamp > CACHE_TTL_MS) return null;
                if (storedTxCount !== txCount) return null;
                return data as PortfolioPulseResult;
            } catch {
                return null;
            }
        };

        const cached = tryCache();
        setAiLoading({ pulse: !cached, insights: true, lookout: true });
        if (cached) {
            setPortfolioPulse(cached);
        } else {
            getPortfolioPulse(timeframe, holdings).then((r) => {
                if (r && typeof window !== "undefined") {
                    try {
                        localStorage.setItem(cacheKey, JSON.stringify({
                            data: r,
                            timestamp: Date.now(),
                            storedTxCount: txCount,
                        }));
                    } catch { /* ignore */ }
                }
                setPortfolioPulse(r ?? null);
                setAiLoading((prev) => ({ ...prev, pulse: false }));
            });
        }
        getAccountInsights(
            timeframe,
            mergedPositions.map((p) => ({ ticker: p.ticker, name: p.name, shares: p.shares })),
            transactionsWithPrices.map((t) => ({ ticker: t.ticker, type: t.type, shares: t.shares, timestamp: t.timestamp }))
        ).then((r) => {
            setAccountInsights(r ?? null);
            setAiLoading((prev) => ({ ...prev, insights: false }));
        });
        getLookout(timeframe, mergedPositions.map((p) => ({ ticker: p.ticker, name: p.name })), []).then((r) => {
            setLookout(r ?? null);
            setAiLoading((prev) => ({ ...prev, lookout: false }));
            if (r?.items) {
                const tickers = r.items.filter((i) => i.ticker).map((i) => i.ticker!);
                tickers.forEach((ticker) => {
                    const item = r.items.find((i) => i.ticker === ticker);
                    if (item) {
                        getInvestorHypeScore(ticker, item.name).then((hype) => {
                            setLookoutHypeScores((prev) => ({ ...prev, [ticker]: hype }));
                        });
                    }
                });
            }
        });
    }, [timeframe, mergedPositions, transactionsWithPrices, loading, portfolioRecalculating]);

    useEffect(() => {
        if (loading || mergedPositions.length === 0) {
            setPortfolio7DayPct(null);
            setSpy7DayPct(null);
            return;
        }
        import("@/app/actions/market").then(({ getPortfolio7DayPctChange, getSpy7DayPctChange }) => {
            const prices = { ...livePrices };
            mergedPositions.forEach((p) => {
                if (!(p.ticker in prices)) prices[p.ticker] = p.avgCost;
            });
            Promise.all([
                getPortfolio7DayPctChange(mergedPositions.map((p) => ({ ticker: p.ticker, shares: p.shares })), prices),
                getSpy7DayPctChange(),
            ]).then(([p7, s7]) => {
                setPortfolio7DayPct(p7 ?? null);
                setSpy7DayPct(s7 ?? null);
            });
        });
    }, [loading, mergedPositions, livePrices]);

    useEffect(() => {
        // Generate mock candlestick data for the mini chart
        setCandleData(
            Array.from({ length: 15 }, () => {
                const open = Math.random() * 40 + 40;
                const close = open + (Math.random() * 20 - 10);
                const high = Math.max(open, close) + Math.random() * 10;
                const low = Math.min(open, close) - Math.random() * 10;
                return { high, low, open, close };
            })
        );
    }, []);

    return (
        <div className="w-full flex flex-col gap-6 animate-in fade-in duration-500 font-sans text-[#f0ede8] px-4 sm:px-6 lg:px-8">
                    <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-[#2a3d30]/50 pb-6 mb-0">
                        <div>
                            <h1 className="font-page-title text-[#f0ede8]">
                                Portfolio
                            </h1>
                            <p className="text-[#a8a8a0] text-sm mt-2">Track your investments and performance</p>
                        </div>
                        <div className="relative">
                            <select
                                value={timeframe}
                                onChange={(e) => setTimeframe(e.target.value)}
                                className="appearance-none bg-[#1a2a22] border border-[#2a3d30] text-[#a8a8a0] text-sm py-2 pl-4 pr-10 rounded-xl focus:outline-none focus:border-[#4ade9a] transition cursor-pointer hover:bg-[#1f2f25]"
                            >
                                <option value="2 wks">2 weeks</option>
                                <option value="1 mo">1 month</option>
                                <option value="3 mo">3 months</option>
                                <option value="YTD">Year to date</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#a8a8a0]">
                                <svg className="fill-current w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                            </div>
                        </div>
                    </header>

                    {/* AI Account Summary Section */}
                    {!loading && (
                        <div className="w-full">
                            <div className="bg-gradient-to-br from-[#1a2a22] to-[#111c18] border border-[#2a3d30]/50 rounded-2xl p-6 lg:p-8 shadow-xl relative overflow-hidden group w-full">
                                {/* Decorative AI Sparkles */}
                                <div className="absolute top-4 right-4 opacity-20 group-hover:opacity-40 transition-opacity duration-1000">
                                    <svg className="w-8 h-8 text-[#4ade9a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>

                                <h2 className="text-xl lg:text-2xl font-serif font-bold text-[#f0ede8] mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
                                    Portfolio Pulse
                                </h2>

                                {aiLoading.pulse ? (
                                    <div className="py-8 flex items-center justify-center text-[#a8a8a0]">
                                        <div className="w-8 h-8 border-2 border-[#4ade9a]/30 border-t-[#4ade9a] rounded-full animate-spin" />
                                        <span className="ml-3">Analyzing portfolio...</span>
                                    </div>
                                ) : portfolioPulse ? (
                                    <p className="text-base md:text-lg text-[#a8a8a0] leading-relaxed max-w-3xl whitespace-pre-line">
                                        <span className="text-[#4ade9a] font-medium">AI Insights:</span> {portfolioPulse.insight}
                                    </p>
                                ) : (
                                    <p className="text-[#a8a8a0]">Add GEMINI_API_KEY to .env.local to enable AI analysis.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Overvaluation, Growth, Political Climate - full-width section */}
                    {!loading && portfolioPulse && (
                        <section className="w-full -mx-4 sm:-mx-6 lg:-mx-8 px-2 sm:px-4 lg:px-6 py-6 border-y border-[#2a3d30]/50">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 w-full">
                                <div className="group relative flex items-center justify-between gap-6 p-8 bg-[#111c18] border border-[#2a3d30]/50 rounded-2xl transition-all duration-300 hover:border-[#4ade9a]/30 hover:shadow-[0_0_24px_rgba(74,222,154,0.08)] hover:-translate-y-0.5 cursor-default">
                                    <span className="text-base font-medium text-[#a8a8a0]">Valuation Risk</span>
                                    <span className={`font-bold px-4 py-2 rounded-full text-sm border shrink-0 inline-flex items-center justify-center ${portfolioPulse.overvaluation >= 60 ? "bg-red-500/10 text-red-400 border-red-500/20" : portfolioPulse.overvaluation >= 40 ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : "bg-[#4ade9a]/10 text-[#4ade9a] border-[#4ade9a]/20"}`}>
                                        {portfolioPulse.overvaluation}/100
                                    </span>
                                    {(portfolioPulse.valuationRiskExplanation?.length ?? 0) > 0 && (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-72 p-4 bg-[#1a2a22] border border-[#2a3d30] rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                            <ul className="space-y-2 text-sm text-[#a8a8a0] list-disc list-inside">
                                                {portfolioPulse.valuationRiskExplanation!.map((b, i) => (
                                                    <li key={i}>{b}</li>
                                                ))}
                                            </ul>
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-8 border-transparent border-t-[#1a2a22]" />
                                        </div>
                                    )}
                                </div>
                                <div className="group relative flex items-center justify-between gap-6 p-8 bg-[#111c18] border border-[#2a3d30]/50 rounded-2xl transition-all duration-300 hover:border-[#4ade9a]/30 hover:shadow-[0_0_24px_rgba(74,222,154,0.08)] hover:-translate-y-0.5 cursor-default">
                                    <span className="text-base font-medium text-[#a8a8a0]">Growth Potential</span>
                                    <span className={`font-bold px-4 py-2 rounded-full text-sm border shrink-0 inline-flex items-center justify-center ${portfolioPulse.growthPotential >= 70 ? "bg-[#4ade9a]/10 text-[#4ade9a] border-[#4ade9a]/20" : portfolioPulse.growthPotential >= 40 ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"}`}>
                                        {portfolioPulse.growthPotential}/100
                                    </span>
                                    {(portfolioPulse.growthPotentialExplanation?.length ?? 0) > 0 && (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-72 p-4 bg-[#1a2a22] border border-[#2a3d30] rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                            <ul className="space-y-2 text-sm text-[#a8a8a0] list-disc list-inside">
                                                {portfolioPulse.growthPotentialExplanation!.map((b, i) => (
                                                    <li key={i}>{b}</li>
                                                ))}
                                            </ul>
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-8 border-transparent border-t-[#1a2a22]" />
                                        </div>
                                    )}
                                </div>
                                <div className="group relative flex items-center justify-between gap-6 p-8 bg-[#111c18] border border-[#2a3d30]/50 rounded-2xl transition-all duration-300 hover:border-[#4ade9a]/30 hover:shadow-[0_0_24px_rgba(74,222,154,0.08)] hover:-translate-y-0.5 cursor-default">
                                    <span className="text-base font-medium text-[#a8a8a0]">Political Climate</span>
                                    <span className={`font-bold px-4 py-2 rounded-full text-sm border shrink-0 inline-flex items-center justify-center ${portfolioPulse.politicalClimate >= 60 ? "bg-[#4ade9a]/10 text-[#4ade9a] border-[#4ade9a]/20" : portfolioPulse.politicalClimate >= 40 ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"}`}>
                                        {portfolioPulse.politicalClimate}/100
                                    </span>
                                    {(portfolioPulse.politicalClimateExplanation?.length ?? 0) > 0 && (
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-72 p-4 bg-[#1a2a22] border border-[#2a3d30] rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                            <ul className="space-y-2 text-sm text-[#a8a8a0] list-disc list-inside">
                                                {portfolioPulse.politicalClimateExplanation!.map((b, i) => (
                                                    <li key={i}>{b}</li>
                                                ))}
                                            </ul>
                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-8 border-transparent border-t-[#1a2a22]" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Portfolio Section */}
                    {!loading && (
                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl lg:text-3xl font-bold font-serif" style={{ fontFamily: 'Playfair Display, serif' }}>Holdings</h2>
                                    <p className="text-[#a8a8a0] text-sm mt-1">Your investment positions and performance</p>
                                </div>
                                {/* Tab switcher */}
                                <div className="relative flex rounded-xl bg-[#1a2a22] border border-[#2a3d30] p-1">
                                    {pillPos && (
                                        <span
                                            className="absolute inset-y-1 rounded-lg bg-[#4ade9a] pointer-events-none transition-all duration-300 ease-out"
                                            style={{
                                                left: pillPos.left,
                                                width: pillPos.width,
                                            }}
                                        />
                                    )}
                                    {tabLabels.map((tab, i) => (
                                        <button
                                            key={tab.key}
                                            ref={el => { tabRefs.current[i] = el; }}
                                            onClick={() => setActiveTab(tab.key)}
                                            className={activeTab === tab.key ? "relative z-10 px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 text-black" : "relative z-10 px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 text-[#a8a8a0] hover:text-white"}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-[#111c18] border border-[#2a3d30]/50 rounded-2xl shadow-xl overflow-hidden">
                                {/* Portfolio Summary */}
                                <div className="p-6 lg:p-8 border-b border-[#2a3d30]/50">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <div>
                                            <div className="space-y-3">
                                                <span className="text-[#a8a8a0] text-sm uppercase tracking-wider font-bold">Total Portfolio Value</span>
                                                <div className="text-3xl lg:text-4xl font-bold">
                                                    ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <span className={isPortfolioUp ? "inline-flex items-center gap-1 text-sm font-bold px-3 py-1.5 rounded-xl border bg-[#4ade9a]/15 text-[#4ade9a] border-[#4ade9a]/30" : "inline-flex items-center gap-1 text-sm font-bold px-3 py-1.5 rounded-xl border bg-red-400/15 text-red-400 border-red-400/30"}>
                                                        {isPortfolioUp ? "▲" : "▼"} {isPortfolioUp ? "+" : ""}${Math.abs(totalPnL).toFixed(2)} ({isPortfolioUp ? "+" : ""}{totalReturn.toFixed(2)}%)
                                                    </span>
                                                    <span className="text-[#a8a8a0] text-sm">vs $10,000 initial</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-[#1a2a22] rounded-xl p-4 border border-[#4ade9a]/20">
                                            <div className="text-[#a8a8a0] text-xs uppercase tracking-wider font-bold mb-2">Available Cash</div>
                                            <div className="text-2xl font-bold text-[#4ade9a] mb-1">
                                                ${cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                            <div className="text-xs text-[#a8a8a0]">{(100 - investedPct).toFixed(0)}% of portfolio</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Tab Content */}
                                <div className="p-6 lg:p-8">
                                    {activeTab === "assets" ? (
                                        mergedPositions.length === 0 ? (
                                            <div className="py-12 text-center text-[#a8a8a0] flex flex-col items-center">
                                                <div className="w-16 h-16 bg-[#1a2a22] rounded-full flex items-center justify-center mb-4 border border-[#2a3d30]">
                                                    <span className="text-2xl opacity-50">💸</span>
                                                </div>
                                                <p className="text-lg">You haven't made any investments yet.</p>
                                                <p className="text-sm mt-2 max-w-sm">Head over to the Markets tab to start trading and build your portfolio!</p>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left min-w-[700px]">
                                                    <thead>
                                                        <tr className="border-b border-[#2a3d30]/50 text-[#a8a8a0] text-sm uppercase tracking-wider">
                                                            <th className="pb-4 font-bold pr-8 min-w-[140px]">Ticker</th>
                                                            <th className="pb-4 font-bold text-right pr-8 min-w-[100px]">Shares</th>
                                                            <th className="pb-4 font-bold text-right pr-8 min-w-[100px]">Avg Cost</th>
                                                            <th className="pb-4 font-bold text-right pr-8 min-w-[110px]">Current Price</th>
                                                            <th className="pb-4 font-bold text-right pr-8 min-w-[120px]">Market Value</th>
                                                            <th className="pb-4 font-bold text-right min-w-[140px]">Unrealized P&L</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {mergedPositions.map((item, i) => {
                                                            const currentPrice = livePrices[item.ticker] ?? item.avgCost;
                                                            const marketValue = currentPrice * item.shares;
                                                            const unrealizedPnL = marketValue - item.costBasis;
                                                            const unrealizedPercent = item.costBasis > 0 ? (unrealizedPnL / item.costBasis) * 100 : 0;
                                                            const isPositive = unrealizedPnL >= 0;

                                                            return (
                                                                <tr
                                                                    key={i}
                                                                    onClick={() => router.push(`/markets/${item.ticker}`)}
                                                                    className="border-b border-[#2a3d30]/30 hover:bg-[#1a2a22]/50 cursor-pointer transition-colors"
                                                                >
                                                                    <td className="py-4 pr-8">
                                                                        <div className="font-bold">{item.ticker}</div>
                                                                        <div className="text-sm text-[#a8a8a0]">{item.name}</div>
                                                                    </td>
                                                                    <td className="py-4 text-right font-medium pr-8">{item.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                                                                    <td className="py-4 text-right font-medium pr-8">${item.avgCost.toFixed(2)}</td>
                                                                    <td className="py-4 text-right font-medium pr-8">${currentPrice.toFixed(2)}</td>
                                                                    <td className="py-4 text-right font-bold pr-8">${marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                    <td className={isPositive ? "py-4 text-right font-bold text-[#4ade9a]" : "py-4 text-right font-bold text-red-400"}>
                                                                        {isPositive ? "+" : ""}{unrealizedPnL.toFixed(2)} ({isPositive ? "+" : ""}{unrealizedPercent.toFixed(2)}%)
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )
                                    ) : (
                                        <div className="space-y-4">
                                            {transactionsWithPrices.length === 0 ? (
                                                <div className="py-12 text-center text-[#a8a8a0]">No transactions yet.</div>
                                            ) : (
                                                [...transactionsWithPrices].reverse().map((tx, i) => (
                                                    <div key={i} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-4 bg-[#1a2a22] rounded-2xl border border-[#2a3d30]/50">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-bold">{tx.ticker}</span>
                                                            <span className="text-sm text-[#a8a8a0]">{tx.name}</span>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                                                            <span className={tx.type === "buy" ? "text-sm font-bold px-2 py-0.5 rounded bg-[#4ade9a]/20 text-[#4ade9a]" : "text-sm font-bold px-2 py-0.5 rounded bg-red-500/20 text-red-400"}>
                                                                {tx.type.toUpperCase()}
                                                            </span>
                                                            <span className="text-sm text-[#a8a8a0]">{tx.shares} @ ${(tx.price ?? 0).toFixed(2)}</span>
                                                            <span className="font-bold">${(tx.total ?? 0).toFixed(2)}</span>
                                                            <span className="text-sm text-[#a8a8a0]">{new Date(tx.timestamp).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

            {/* Account Insights Section */}
            <div className="mt-8 border-t border-white/5 pt-12">
                <h2 className="text-2xl font-serif font-bold mb-8 text-[#f0ede8]" style={{ fontFamily: 'Playfair Display, serif' }}>Account Insights</h2>

                        <BentoGrid className="auto-rows-min lg:grid-rows-[auto_auto] grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Account Insights */}
                            <div className="lg:col-span-2 bg-[#111c18] border border-[#2a3d30]/50 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-[#4ade9a]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
                                <h3 className="text-lg text-[#a8a8a0] font-medium mb-4">Account Insights</h3>
                                {aiLoading.insights ? (
                                    <div className="py-4 flex items-center text-[#a8a8a0]">
                                        <div className="w-6 h-6 border-2 border-[#4ade9a]/30 border-t-[#4ade9a] rounded-full animate-spin" />
                                        <span className="ml-3 text-sm">Analyzing positions...</span>
                                    </div>
                                ) : accountInsights ? (
                                    <div className="space-y-4 text-base leading-relaxed relative z-10">
                                        {accountInsights.items.length > 0 ? (
                                            accountInsights.items.map((item, i) => (
                                                <div key={i} className="flex gap-3 items-start">
                                                    <span className="text-[#4ade9a] text-lg leading-none mt-0.5">&mdash;</span>
                                                    <div>
                                                        <p><span className="text-white font-bold">{item.ticker}</span> ({item.name}): {item.movement}</p>
                                                        <ul className="text-[#a8a8a0] text-sm mt-0.5 list-disc list-inside space-y-0.5">
                                                            {(Array.isArray(item.drivers) ? item.drivers : [item.drivers]).map((d, j) => (
                                                                <li key={j}>{d}</li>
                                                            ))}
                                                        </ul>
                                                        <p className="text-[#a8a8a0] text-sm mt-0.5">{item.interpretation}</p>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-[#a8a8a0] text-sm">No significant position movements in this timeframe.</p>
                                        )}
                                        <p className="text-white font-medium mt-3 text-sm">{accountInsights.portfolioObservation}</p>
                                    </div>
                                ) : (
                                    <p className="text-[#a8a8a0] text-sm">Enable AI to see account insights.</p>
                                )}
                            </div>

                            {/* Right column: Profitable Positions + Weekly Return stacked */}
                            <div className="lg:col-span-1 flex flex-col gap-6">
                                {/* Profitable Positions Gauge */}
                                {(() => {
                                    const profitableCount = mergedPositions.filter(p => (livePrices[p.ticker] ?? p.avgCost) > p.avgCost).length;
                                    const total = mergedPositions.length;
                                    const pct = total > 0 ? Math.round((profitableCount / total) * 100) : 0;
                                    const circumference = 263.89;
                                    const dashOffset = circumference - (pct / 100) * circumference;
                                    return (
                                        <div className="bg-[#111c18] border border-[#2a3d30]/50 rounded-3xl p-8 shadow-xl flex flex-col items-center justify-center">
                                            <h3 className="text-lg font-medium text-[#a8a8a0] mb-6 text-center font-serif" style={{ fontFamily: 'Playfair Display, serif' }}>Profitable Positions</h3>
                                            <div className="relative w-32 h-32 flex items-center justify-center">
                                                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                                                    <circle cx="50" cy="50" r="42" stroke="#1a2a22" strokeWidth="6" fill="none" />
                                                    <circle cx="50" cy="50" r="42" stroke={pct >= 50 ? "#4ade9a" : "#f87171"} strokeWidth="6" fill="none"
                                                        strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round"
                                                        style={{ transition: "stroke-dashoffset 1s ease-out" }} />
                                                </svg>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                    <span className="text-3xl font-bold text-white tracking-tighter" style={{ fontFamily: 'Playfair Display, serif' }}>
                                                        {total === 0 ? "—" : pct}<span className="text-lg" style={{ color: pct >= 50 ? "#4ade9a" : "#f87171" }}>{total > 0 ? "%" : ""}</span>
                                                    </span>
                                                    {total > 0 && <span className="text-xs text-[#a8a8a0] mt-1">{profitableCount} of {total}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Performance Card - Weekly Return vs Market */}
                                <div className="bg-gradient-to-br from-[#4ade9a]/20 to-[#4ade9a]/5 border border-[#4ade9a]/30 rounded-3xl p-6 flex flex-col gap-4">
                                    <div>
                                        <span className={`text-4xl font-bold tracking-tighter block mb-1 ${(portfolio7DayPct ?? totalReturn) >= 0 ? "text-[#4ade9a]" : "text-red-400"}`}>
                                            {portfolio7DayPct !== null
                                                ? `${portfolio7DayPct >= 0 ? "+" : ""}${portfolio7DayPct.toFixed(1)}%`
                                                : mergedPositions.length > 0
                                                    ? "—"
                                                    : `${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(1)}%`}
                                        </span>
                                        <span className="text-xs text-[#4ade9a] uppercase tracking-widest font-bold">Weekly Return</span>
                                        {spy7DayPct !== null && (
                                            <span className="block text-xs text-[#a8a8a0] mt-1">Market (SPY): {spy7DayPct >= 0 ? "+" : ""}{spy7DayPct.toFixed(1)}%</span>
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-serif font-bold leading-tight text-white" style={{ fontFamily: 'Playfair Display, serif' }}>
                                            {portfolio7DayPct !== null && spy7DayPct !== null
                                                ? portfolio7DayPct > spy7DayPct
                                                    ? "Beating the Market!"
                                                    : "Building Wealth"
                                                : isPortfolioUp ? "Beating the Market!" : "Building Wealth"}
                                        </h3>
                                        <div className="w-10 h-1 bg-[#4ade9a] rounded-full mt-3" />
                                    </div>
                                </div>
                            </div>

                            {/* Lookout Section - full width below */}
                            <div className="lg:col-span-3 bg-[#111c18] border border-[#2a3d30]/50 rounded-3xl p-8 shadow-xl">
                                <h3 className="text-xl font-serif font-bold mb-6 flex items-center gap-3 text-[#f0ede8]" style={{ fontFamily: 'Playfair Display, serif' }}>
                                    Lookout👀 ({timeframe})
                                </h3>
                                {aiLoading.lookout ? (
                                    <div className="py-6 flex items-center text-[#a8a8a0]">
                                        <div className="w-6 h-6 border-2 border-[#4ade9a]/30 border-t-[#4ade9a] rounded-full animate-spin" />
                                        <span className="ml-3 text-sm">Scanning for signals...</span>
                                    </div>
                                ) : lookout?.items && lookout.items.length > 0 ? (
                                    <ul className="space-y-5 text-base">
                                        {lookout.items.map((item, i) => (
                                            <li key={i} className="flex gap-4 items-start">
                                                <span className="text-[#a8a8a0] text-xl leading-none mt-1">&mdash;</span>
                                                <div className="flex-1">
                                                    <p className="leading-relaxed">
                                                        {item.ticker ? (
                                                            <Link href={`/markets/${item.ticker}`} className="text-white font-medium hover:text-[#4ade9a] transition underline">
                                                                {item.name} ({item.ticker})
                                                            </Link>
                                                        ) : (
                                                            <span className="text-white font-medium">{item.name}</span>
                                                        )}
                                                        {" "}{item.item}
                                                    </p>
                                                    <p className="text-[#a8a8a0] text-sm mt-1">{item.whyItMatters}</p>
                                                    {item.ticker && lookoutHypeScores[item.ticker] && (
                                                        <div className="mt-2 flex items-center gap-2">
                                                            <div className="flex flex-col items-center gap-0.5 bg-[#1a2a22] border border-[#2a3d30] px-3 py-2 rounded-xl">
                                                                <span className="text-xs font-bold text-white">
                                                                    {lookoutHypeScores[item.ticker].score ?? "—"}
                                                                </span>
                                                                <span className="text-[10px] text-[#a8a8a0] font-medium uppercase tracking-wider">Hype</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-[#a8a8a0] text-sm">No lookout signals in this timeframe. Enable AI for analysis.</p>
                                )}
                            </div>
                        </BentoGrid>
                    </div>
        </div>
    );
}
