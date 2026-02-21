"use client";

import { useState, useEffect, useMemo, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, addDoc, onSnapshot } from "firebase/firestore";
import { recalculatePortfolioFromTransactions, type Transaction } from "@/app/actions/portfolio";

export default function ProfilePage({ params }: { params: Promise<{ uid: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);
    const targetUid = resolvedParams.uid;

    const [loading, setLoading] = useState(true);
    const [targetUser, setTargetUser] = useState<any>(null);
    const [currentUserData, setCurrentUserData] = useState<any>(null);
    const [hasPendingRequest, setHasPendingRequest] = useState(false);

    // Portfolio state if allowed to view
    const [portfolio, setPortfolio] = useState<any[]>([]);
    const [cashBalance, setCashBalance] = useState<number>(0);
    const [livePrices, setLivePrices] = useState<Record<string, number>>({});

    const isSelf = auth.currentUser?.uid === targetUid;
    const isFriend = currentUserData?.friends?.includes(targetUid);
    const isPublic = targetUser?.isPublic === true;
    const canViewPortfolio = isSelf || isFriend || isPublic;

    // Load data
    useEffect(() => {
        if (!auth.currentUser) return;

        const loadProfile = async () => {
            setLoading(true);
            try {
                // Get current user doc
                const meDoc = await getDoc(doc(db, "users", auth.currentUser!.uid));
                if (meDoc.exists()) setCurrentUserData(meDoc.data());

                // Get target user doc
                const tDoc = await getDoc(doc(db, "users", targetUid));
                if (tDoc.exists()) {
                    setTargetUser(tDoc.data());

                    // Check if pending request exists
                    const qReq = query(collection(db, "friend_requests"),
                        where("fromUid", "==", auth.currentUser!.uid),
                        where("toUid", "==", targetUid),
                        where("status", "==", "pending")
                    );
                    const reqSnap = await getDocs(qReq);
                    setHasPendingRequest(!reqSnap.empty);

                    // If we can view portfolio, calculate it
                    const canView = isSelf || (meDoc.data()?.friends?.includes(targetUid)) || (tDoc.data().isPublic === true);
                    if (canView && tDoc.data().transactionHistory) {
                        const { portfolio: p, cashBalance: c } = await recalculatePortfolioFromTransactions(tDoc.data().transactionHistory);
                        setPortfolio(p);
                        setCashBalance(c);
                    }
                }
            } catch (e) {
                console.error("Error loading profile", e);
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [targetUid, isSelf]);

    // Live Prices
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
        if (mergedPositions.length === 0) return;
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
        if (canViewPortfolio) {
            fetchLivePrices(true);
            const interval = setInterval(() => fetchLivePrices(true), 10000);
            return () => clearInterval(interval);
        }
    }, [fetchLivePrices, canViewPortfolio]);

    const sendRequest = async () => {
        if (!auth.currentUser) return;
        setHasPendingRequest(true); // Optimistic
        try {
            await addDoc(collection(db, "friend_requests"), {
                fromUid: auth.currentUser.uid,
                toUid: targetUid,
                status: "pending",
                timestamp: new Date().toISOString()
            });
        } catch (e) {
            console.error("Failed to send request", e);
            setHasPendingRequest(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-zinc-500 animate-pulse">Loading Profile...</div>;
    }

    if (!targetUser) {
        return <div className="p-8 text-center text-zinc-500">User not found.</div>;
    }

    const totalPortfolioValue = cashBalance + mergedPositions.reduce((acc, p) => acc + (p.shares * (livePrices[p.ticker] ?? p.avgCost)), 0);

    return (
        <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans text-white pb-24 md:pb-8">
            {/* Header / Profile Info */}
            <div className="bg-[#111] border border-zinc-800 rounded-3xl p-8 flex flex-col md:flex-row items-center md:items-start gap-6 relative overflow-hidden">
                <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center font-bold text-4xl shrink-0">
                    {(targetUser.displayName || "A").substring(0, 1).toUpperCase()}
                </div>
                <div className="flex flex-col items-center md:items-start flex-1 text-center md:text-left">
                    <h1 className="text-3xl font-bold">{targetUser.displayName || "Anonymous"}</h1>
                    <span className="text-zinc-500 mt-1">{targetUser.handle || `@user_${targetUid.substring(0, 6)}`}</span>

                    <div className="flex items-center gap-3 mt-4">
                        {isSelf ? (
                            <span className="bg-zinc-800 text-zinc-400 px-3 py-1 text-sm font-bold rounded-full">This is you</span>
                        ) : isFriend ? (
                            <span className="bg-[#00c805]/20 text-[#00c805] border border-[#00c805]/30 px-3 py-1 text-sm font-bold rounded-full">✓ Friends</span>
                        ) : hasPendingRequest ? (
                            <span className="bg-zinc-800 text-zinc-400 border border-zinc-700 px-3 py-1 text-sm font-bold rounded-full">Request Pending</span>
                        ) : (
                            <button onClick={sendRequest} className="bg-white text-black hover:bg-zinc-200 transition px-4 py-1.5 text-sm font-bold rounded-full">
                                Add Friend
                            </button>
                        )}

                        <span className={`px-3 py-1 text-sm font-bold rounded-full border ${isPublic ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                            {isPublic ? 'Unlock Portfolio (Public)' : 'Locked Portfolio (Private)'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Portfolio View */}
            <div className="bg-[#111] border border-zinc-800 rounded-3xl p-6 md:p-8">
                <h2 className="text-xl font-bold mb-6">Portfolio Holdings</h2>

                {!canViewPortfolio ? (
                    <div className="text-center py-12 flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center border border-zinc-800">
                            <span className="text-2xl">🔒</span>
                        </div>
                        <div>
                            <p className="font-bold text-lg text-white">This Account is Private</p>
                            <p className="text-zinc-500 text-sm mt-1">Add them as a friend to view their portfolio.</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-wrap gap-4 mb-8 pb-8 border-b border-zinc-800">
                            <div>
                                <span className="text-zinc-500 text-sm uppercase font-bold tracking-wider">Total Est. Value</span>
                                <div className="text-3xl font-bold mt-1">${totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            </div>
                        </div>

                        {mergedPositions.length === 0 ? (
                            <div className="text-center py-8 text-zinc-500">This user currently holds no assets.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left min-w-[600px]">
                                    <thead>
                                        <tr className="border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider">
                                            <th className="pb-3 font-bold pr-4">Asset</th>
                                            <th className="pb-3 font-bold text-right pr-4">Shares</th>
                                            <th className="pb-3 font-bold text-right pr-4">Avg Cost</th>
                                            <th className="pb-3 font-bold text-right pr-4">Current Price</th>
                                            <th className="pb-3 font-bold text-right">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mergedPositions.map((item, i) => {
                                            const currentPrice = livePrices[item.ticker] ?? item.avgCost;
                                            const marketValue = currentPrice * item.shares;
                                            const isPositive = currentPrice >= item.avgCost;

                                            return (
                                                <tr key={i} className="border-b border-zinc-800/50 last:border-0">
                                                    <td className="py-4 pr-4">
                                                        <div className="font-bold text-sm">{item.ticker}</div>
                                                        <div className="text-xs text-zinc-500">{item.name}</div>
                                                    </td>
                                                    <td className="py-4 text-right text-sm pr-4">{item.shares.toLocaleString()}</td>
                                                    <td className="py-4 text-right text-sm pr-4">${item.avgCost.toFixed(2)}</td>
                                                    <td className="py-4 text-right text-sm pr-4">${currentPrice.toFixed(2)}</td>
                                                    <td className={`py-4 text-right text-sm font-bold ${isPositive ? "text-[#00c805]" : "text-red-500"}`}>
                                                        ${marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
