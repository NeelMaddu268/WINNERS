"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot, getDoc, collection, addDoc } from "firebase/firestore";
import { recalculatePortfolioFromTransactions, type Transaction } from "@/app/actions/portfolio";
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
    const [livePrices, setLivePrices] = useState<Record<string, number>>({});
    const [activeTab, setActiveTab] = useState<"assets" | "history">("assets");
    const [txToShare, setTxToShare] = useState<Transaction | null>(null);
    const [shareAudience, setShareAudience] = useState<"public" | "friends">("public");
    const [isSharingTx, setIsSharingTx] = useState(false);
    const [shareSuccess, setShareSuccess] = useState(false);

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
            setPortfolio([]);
            setCashBalance(10000);
            setTransactionsWithPrices([]);
            return;
        }
        recalculatePortfolioFromTransactions(transactionHistory).then(({ portfolio: p, cashBalance: c, transactionsWithPrices: twp }) => {
            setPortfolio(p);
            setCashBalance(c);
            setTransactionsWithPrices(twp);
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
        <>
            <div className="flex flex-col gap-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-700 font-sans text-[#f0ede8]">
                {/* Header */}
                <header className="flex items-end gap-4 border-b border-[#2a3d30]/50 pb-6">
                    <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
                        Account
                    </h1>
                    <div className="relative mb-2">
                        <select className="appearance-none bg-[#1a2a22] border border-[#2a3d30] text-[#a8a8a0] text-sm py-1.5 pl-4 pr-10 rounded-full focus:outline-none focus:border-[#4ade9a] transition cursor-pointer">
                            <option>2 wks</option>
                            <option>1 mo</option>
                            <option>3 mo</option>
                            <option>YTD</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#a8a8a0]">
                            <svg className="fill-current w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                        </div>
                    </div>
                </header>

                {/* AI Account Summary Section */}
                {!loading && (
                    <div className="flex flex-col gap-6">
                        <div className="bg-gradient-to-br from-[#1a2a22] to-[#111c18] border border-[#2a3d30]/50 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden group">
                            {/* Decorative AI Sparkles */}
                            <div className="absolute top-6 right-6 opacity-30 group-hover:opacity-100 transition-opacity duration-1000">
                                <svg className="w-12 h-12 text-[#4ade9a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>

                            <h2 className="text-3xl font-serif font-bold text-[#f0ede8] mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
                                Your Portfolio Pulse
                            </h2>

                            <p className="text-lg md:text-xl text-[#a8a8a0] leading-relaxed max-w-3xl mb-8">
                                <span className="text-[#4ade9a] font-medium">AI Insights:</span> Your portfolio is currently heavily consolidated in the tech sector, showing strong momentum from recent AI-driven rallies. While your growth metrics are exceptional, your diversification score is low. Consider exploring index funds to hedge against sector-specific volatility.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* AI Score Badge: Overvaluation */}
                                <div className="flex items-center justify-between p-4 bg-[#0a120f] border border-[#2a3d30]/40 rounded-2xl">
                                    <span className="text-sm font-medium text-[#a8a8a0]">Overvaluation Risk</span>
                                    <span className="bg-red-500/10 text-red-400 font-bold px-3 py-1 rounded-full text-sm border border-red-500/20">High (82/100)</span>
                                </div>

                                {/* AI Score Badge: Growth */}
                                <div className="flex items-center justify-between p-4 bg-[#0a120f] border border-[#2a3d30]/40 rounded-2xl">
                                    <span className="text-sm font-medium text-[#a8a8a0]">Growth Potential</span>
                                    <span className="bg-[#4ade9a]/10 text-[#4ade9a] font-bold px-3 py-1 rounded-full text-sm border border-[#4ade9a]/20">Exceptional (95/100)</span>
                                </div>

                                {/* AI Score Badge: Political Climate */}
                                <div className="flex items-center justify-between p-4 bg-[#0a120f] border border-[#2a3d30]/40 rounded-2xl">
                                    <span className="text-sm font-medium text-[#a8a8a0]">Political Climate</span>
                                    <span className="bg-yellow-500/10 text-yellow-400 font-bold px-3 py-1 rounded-full text-sm border border-yellow-500/20">Neutral (50/100)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* My Portfolio Section */}
                {!loading && (
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <h2 className="text-2xl font-bold font-serif" style={{ fontFamily: 'Playfair Display, serif' }}>Portfolio</h2>
                            {/* Sliding pill tab switcher */}
                            <div className="relative flex rounded-full bg-[#1a2a22] border border-[#2a3d30] p-1">
                                {pillPos && (
                                    <span
                                        className="absolute inset-y-1 rounded-full bg-[#4ade9a] pointer-events-none"
                                        style={{
                                            left: pillPos.left,
                                            width: pillPos.width,
                                            transition: "left 300ms cubic-bezier(0.4,0,0.2,1), width 300ms cubic-bezier(0.4,0,0.2,1)",
                                        }}
                                    />
                                )}
                                {tabLabels.map((tab, i) => (
                                    <button
                                        key={tab.key}
                                        ref={el => { tabRefs.current[i] = el; }}
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`relative z-10 px-6 py-2 rounded-full text-sm font-bold transition-colors duration-200 ${activeTab === tab.key ? "text-black" : "text-[#a8a8a0] hover:text-white"
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="bg-[#111c18] border border-[#2a3d30]/50 rounded-3xl p-6 md:p-10 shadow-xl overflow-hidden">
                            <section className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[#2a3d30]/50 pb-8 mb-8 gap-4">
                                <div>
                                    <span className="text-[#a8a8a0] text-sm uppercase tracking-wider font-bold">Total Portfolio Value</span>
                                    <div className="text-4xl md:text-5xl font-bold mt-2">
                                        ${(cashBalance + mergedPositions.reduce((acc, p) => acc + (p.shares * (livePrices[p.ticker] ?? p.avgCost)), 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div className="text-left md:text-right bg-[#1a2a22] px-6 py-4 rounded-2xl border border-[#2a3d30]">
                                    <span className="text-[#a8a8a0] text-xs uppercase tracking-wider font-bold">Available Cash</span>
                                    <div className="text-2xl font-bold mt-1 text-[#4ade9a]">
                                        ${cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </section>

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
                                                            <td className={`py-4 text-right font-bold ${isPositive ? "text-[#4ade9a]" : "text-red-400"}`}>
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
                                <div className="flex flex-col gap-3">
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
                                                    <span className={`text-sm font-bold px-2 py-0.5 rounded ${tx.type === "buy" ? "bg-[#4ade9a]/20 text-[#4ade9a]" : "bg-red-500/20 text-red-400"}`}>
                                                        {tx.type.toUpperCase()}
                                                    </span>
                                                    <span className="text-sm text-[#a8a8a0]">{tx.shares} @ ${(tx.price ?? 0).toFixed(2)}</span>
                                                    <span className="font-bold">${(tx.total ?? 0).toFixed(2)}</span>
                                                    <span className="text-sm text-[#a8a8a0] hidden sm:block">{new Date(tx.timestamp).toLocaleDateString()}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handleOpenShareModal(tx);
                                                        }}
                                                        className="w-8 h-8 rounded-full bg-[#2a3d30]/30 hover:bg-[#4ade9a]/20 text-[#a8a8a0] hover:text-[#4ade9a] transition flex items-center justify-center border border-[#2a3d30]/50 ml-2"
                                                        title="Share to Feed"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="mt-8 border-t border-white/5 pt-12">
                    <h2 className="text-2xl font-serif font-bold mb-8 text-[#a8a8a0]" style={{ fontFamily: 'Playfair Display, serif' }}>Account Insights</h2>

                    <BentoGrid className="lg:grid-rows-2 grid-cols-3 gap-4">

                        {/* ── Card 1: Bi-monthly Report  (col 1–2, row 1) ── */}
                        <div className="group relative overflow-hidden rounded-2xl bg-[#111c18] border border-[#2a3d30]/50 shadow-2xl p-8 flex flex-col justify-between transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(74,222,154,0.08)] lg:col-start-1 lg:col-end-3 lg:row-start-1 lg:row-end-2">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-[#4ade9a]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                            <p className="text-xl text-[#a8a8a0] font-medium mb-6 relative z-10">
                                Your bi-monthly report looks great, here&apos;s what happened:
                            </p>
                            <ul className="space-y-5 text-base leading-relaxed relative z-10 flex-1">
                                <li className="flex gap-4 items-start">
                                    <span className="text-[#4ade9a] text-xl leading-none mt-0.5 shrink-0">—</span>
                                    <p>Last week started out rough when <span className="text-white font-medium border-b border-white/20 pb-0.5">Apple earnings disappointed...</span></p>
                                </li>
                                <li className="flex gap-4 items-start">
                                    <span className="text-[#4ade9a] text-xl leading-none mt-0.5 shrink-0">—</span>
                                    <div>
                                        <p>Your bet on <span className="text-white font-bold bg-[#4ade9a]/10 px-2 py-0.5 rounded text-[#4ade9a]">WDC</span> 6-months ago paid off this week!</p>
                                        <p className="text-[#a8a8a0] text-sm mt-1.5">...unveiled new microchips</p>
                                    </div>
                                </li>
                            </ul>
                            {/* Hover CTA */}
                            <div className="mt-6 relative z-10 flex items-center gap-2 text-[#4ade9a] text-sm font-semibold opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                                <TrendingUp className="w-4 h-4" />
                                View full report
                            </div>
                        </div>

                        {/* ── Card 2: Profitable Positions gauge  (col 3, row 1) ── */}
                        {(() => {
                            const profitableCount = mergedPositions.filter(p => (livePrices[p.ticker] ?? p.avgCost) > p.avgCost).length;
                            const total = mergedPositions.length;
                            const pct = total > 0 ? Math.round((profitableCount / total) * 100) : 0;
                            const circumference = 263.89;
                            const dashOffset = circumference - (pct / 100) * circumference;
                            return (
                                <div className="group relative overflow-hidden rounded-2xl bg-[#111c18] border border-[#2a3d30]/50 shadow-xl p-8 flex flex-col items-center justify-center transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(74,222,154,0.08)] lg:col-start-3 lg:col-end-4 lg:row-start-1 lg:row-end-2">
                                    <h3 className="text-lg font-medium text-[#a8a8a0] mb-6 text-center font-serif" style={{ fontFamily: 'Playfair Display, serif' }}>Profitable Positions</h3>
                                    <div className="relative w-40 h-40 flex items-center justify-center">
                                        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90 filter drop-shadow-[0_0_15px_rgba(74,222,154,0.3)]">
                                            <circle cx="50" cy="50" r="42" stroke="#1a2a22" strokeWidth="6" fill="none" />
                                            <circle cx="50" cy="50" r="42" stroke={pct >= 50 ? "#4ade9a" : "#f87171"} strokeWidth="6" fill="none"
                                                strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round"
                                                style={{ transition: "stroke-dashoffset 1s ease-out" }} />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-5xl font-bold text-white tracking-tighter" style={{ fontFamily: 'Playfair Display, serif' }}>
                                                {total === 0 ? "—" : pct}<span className="text-2xl" style={{ color: pct >= 50 ? "#4ade9a" : "#f87171" }}>{total > 0 ? "%" : ""}</span>
                                            </span>
                                            {total > 0 && <span className="text-xs text-[#a8a8a0] mt-1">{profitableCount} of {total} positions</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ── Card 3: Lookout  (col 1, row 2) ── */}
                        <div className="group relative overflow-hidden rounded-2xl bg-[#111c18] border border-[#2a3d30]/50 shadow-xl p-8 flex flex-col justify-between transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(74,222,154,0.08)] lg:col-start-1 lg:col-end-2 lg:row-start-2 lg:row-end-3">
                            <h2 className="text-2xl font-serif font-bold mb-5 flex items-center gap-2 text-[#f0ede8]" style={{ fontFamily: 'Playfair Display, serif' }}>
                                Lookout <span>👀</span>
                            </h2>
                            <ul className="space-y-5 text-base flex-1">
                                <li className="flex gap-3 items-start">
                                    <span className="text-[#a8a8a0] text-xl leading-none mt-0.5 shrink-0">—</span>
                                    <p className="leading-relaxed"><span className="text-white font-medium">MRST</span> P/E ratio dropped, <span className="text-[#4ade9a]">look into buying in</span></p>
                                </li>
                                <li className="flex gap-3 items-center">
                                    <span className="text-[#a8a8a0] text-xl leading-none shrink-0">—</span>
                                    <div className="flex-1 flex items-center justify-between gap-3">
                                        <p className="leading-relaxed text-[#a8a8a0] text-sm"><span className="text-white font-medium">Nvidia</span> teases sept 5. product reveal</p>
                                        <div className="flex flex-col items-center gap-1 shrink-0 bg-[#1a2a22] border border-[#2a3d30] px-2 py-1.5 rounded-xl">
                                            <div className="relative w-9 h-9 flex items-center justify-center">
                                                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                                                    <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.05)" strokeWidth="12" fill="none" />
                                                    <circle cx="50" cy="50" r="40" stroke="#4ade9a" strokeWidth="12" fill="none" strokeDasharray="251.2" strokeDashoffset="35.1" strokeLinecap="round" />
                                                </svg>
                                                <span className="absolute text-[10px] font-bold text-white">86%</span>
                                            </div>
                                            <span className="text-[9px] text-[#a8a8a0] font-medium uppercase tracking-wider">AI Hype</span>
                                        </div>
                                    </div>
                                </li>
                            </ul>
                        </div>

                        {/* ── Card 4: Beating the Market  (col 2, row 2) ── */}
                        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4ade9a]/20 to-[#4ade9a]/5 border border-[#4ade9a]/30 shadow-[0_0_30px_rgba(74,222,154,0.1)] p-6 flex flex-col justify-between transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_0_50px_rgba(74,222,154,0.18)] lg:col-start-2 lg:col-end-3 lg:row-start-2 lg:row-end-3">
                            <div>
                                <span className="text-5xl font-bold text-[#4ade9a] drop-shadow-[0_0_10px_rgba(74,222,154,0.5)] tracking-tighter block mb-1 group-hover:scale-105 transition-transform origin-left">+15%</span>
                                <span className="text-xs text-[#4ade9a] uppercase tracking-widest font-bold">This Week</span>
                            </div>
                            <div>
                                <h3 className="text-2xl font-serif font-bold leading-tight text-white" style={{ fontFamily: 'Playfair Display, serif' }}>Beating the<br />Market!</h3>
                                <div className="w-10 h-1 bg-[#4ade9a] rounded-full mt-3" />
                            </div>
                        </div>

                        {/* ── Card 5: Mini Candlestick Chart  (col 3, row 2) ── */}
                        <div className="group relative overflow-hidden rounded-2xl bg-[#111c18] border border-[#2a3d30]/50 shadow-xl p-5 flex flex-col transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_0_40px_rgba(74,222,154,0.08)] lg:col-start-3 lg:col-end-4 lg:row-start-2 lg:row-end-3">
                            <div className="absolute top-1/2 left-4 right-4 h-px bg-[#2a3d30] z-0" />
                            <div className="absolute top-6 bottom-6 left-4 w-px bg-[#2a3d30] z-0" />
                            <div className="flex-1 flex items-center justify-between gap-1 relative z-10 pl-4 py-2">
                                {candleData.map((candle, idx) => {
                                    const maxHeight = 100, range = 80;
                                    const wickHeight = (candle.high - candle.low) / range * maxHeight;
                                    const bodyHeight = Math.max(Math.abs(candle.close - candle.open) / range * maxHeight, 2);
                                    const isUp = candle.close >= candle.open;
                                    return (
                                        <div key={idx} className="flex-1 flex flex-col items-center relative h-full">
                                            <div className="absolute top-1/2 -translate-y-1/2 h-full w-full flex flex-col justify-center items-center">
                                                <div className={`w-0.5 ${isUp ? 'bg-[#4ade9a]/60' : 'bg-red-400/60'} absolute`} style={{ height: `${wickHeight}px` }} />
                                                <div className={`w-1.5 md:w-2 ${isUp ? 'bg-[#4ade9a]' : 'bg-red-400'} absolute rounded-sm`} style={{ height: `${bodyHeight}px`, transform: `translateY(${(candle.open - candle.close) > 0 ? bodyHeight / 2 : -bodyHeight / 2}px)` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    </BentoGrid>
                </div>

            </div>

            {/* Share Transaction Modal */}
            {txToShare && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#111] border border-zinc-800 rounded-3xl w-full max-w-sm flex flex-col pt-6 pb-6 px-6 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Share Transaction</h3>
                            <button onClick={() => setTxToShare(null)} className="text-zinc-500 hover:text-white transition">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {shareSuccess ? (
                            <div className="py-8 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-[#4ade9a]/20 text-[#4ade9a] rounded-full flex items-center justify-center mb-4 border-2 border-[#4ade9a]">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <h4 className="text-2xl font-bold mb-2">Shared to Feed!</h4>
                            </div>
                        ) : (
                            <>
                                <div className="bg-[#1a2a22] border border-[#2a3d30]/50 rounded-2xl p-4 mb-6">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-white">{txToShare?.ticker}</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${txToShare?.type === "buy" ? "bg-[#4ade9a]/20 text-[#4ade9a]" : "bg-red-500/20 text-red-400"}`}>
                                            {txToShare?.type?.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-zinc-400 text-sm">Amount</span>
                                        <span className="font-bold text-white">{txToShare?.shares?.toLocaleString()} shares</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-1">
                                        <span className="text-zinc-400 text-sm">Value</span>
                                        <span className="font-bold text-white">${(txToShare?.total ?? 0).toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between px-2 text-sm text-zinc-400">
                                        <span>Share with:</span>
                                        <select
                                            value={shareAudience}
                                            onChange={(e) => setShareAudience(e.target.value as "public" | "friends")}
                                            className="bg-zinc-800 text-white border-none rounded-lg px-2 py-1 outline-none cursor-pointer"
                                        >
                                            <option value="public">Public</option>
                                            <option value="friends">Friends Only</option>
                                        </select>
                                    </div>

                                    <button
                                        onClick={handleShareTransaction}
                                        disabled={isSharingTx}
                                        className="w-full py-3 bg-[#4ade9a] hover:bg-[#22c55e] border border-[#4ade9a]/50 text-black font-bold rounded-xl transition shadow-[0_0_15px_rgba(74,222,154,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isSharingTx ? "Sharing..." : "Share to Feed"}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
