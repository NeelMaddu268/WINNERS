"use client";

import { useState, useEffect, useMemo, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, addDoc, onSnapshot, updateDoc, arrayRemove } from "firebase/firestore";
import { recalculatePortfolioFromTransactions, type Transaction } from "@/app/actions/portfolio";

export default function ProfilePage({ params }: { params: Promise<{ uid: string }> }) {
    const router = useRouter();
    const resolvedParams = use(params);
    const targetUid = resolvedParams.uid;

    const [loading, setLoading] = useState(true);
    const [targetUser, setTargetUser] = useState<any>(null);
    const [currentUserData, setCurrentUserData] = useState<any>(null);
    const [hasPendingRequest, setHasPendingRequest] = useState(false);
    const [isUnfriendModalOpen, setIsUnfriendModalOpen] = useState(false);

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
    const totalCostBasis = cashBalance + mergedPositions.reduce((acc, p) => acc + p.costBasis, 0);

    const totalReturnVar = totalPortfolioValue - totalCostBasis;
    const totalReturnPct = totalCostBasis > 0 ? (totalReturnVar / totalCostBasis) * 100 : 0;

    const removeFriend = async () => {
        if (!auth.currentUser || !targetUid) return;

        try {
            // Optimistic update
            setCurrentUserData((prev: any) => prev ? ({ ...prev, friends: prev.friends?.filter((id: string) => id !== targetUid) || [] }) : prev);

            // Remove from my friends
            await updateDoc(doc(db, "users", auth.currentUser.uid), {
                friends: arrayRemove(targetUid)
            });

            // Remove me from their friends
            await updateDoc(doc(db, "users", targetUid), {
                friends: arrayRemove(auth.currentUser.uid)
            });
        } catch (e) {
            console.error("Failed to remove friend", e);
            // We're not reverting optimistic state here for simplicity, but in prod we should
        } finally {
            setIsUnfriendModalOpen(false);
        }
    };

    return (
        <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans text-white pb-24 md:pb-8">
            {/* Header / Profile Info */}
            <div className="bg-[#111] border border-zinc-800 rounded-3xl p-8 flex flex-col md:flex-row items-center md:items-start gap-6 relative overflow-hidden">
                <div className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center font-bold text-4xl shrink-0">
                    {(targetUser.displayName || targetUser.username || "A").substring(0, 1).toUpperCase()}
                </div>
                <div className="flex flex-col items-center md:items-start flex-1 text-center md:text-left">
                    <h1 className="text-3xl font-bold">{targetUser.displayName || targetUser.username || "Anonymous"}</h1>
                    <span className="text-zinc-500 mt-1">{targetUser.handle || (targetUser.username ? `@${targetUser.username}` : `@user_${targetUid.substring(0, 6)}`)}</span>

                    <div className="flex items-center gap-3 mt-4">
                        {isSelf ? (
                            <span className="bg-zinc-800 text-zinc-400 px-3 py-1 text-sm font-bold rounded-full">This is you</span>
                        ) : isFriend ? (
                            <div className="flex gap-2">
                                <span className="bg-[#00c805]/20 text-[#00c805] border border-[#00c805]/30 px-3 py-1 text-sm font-bold rounded-full">✓ Friends</span>
                                <button onClick={() => setIsUnfriendModalOpen(true)} className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 px-3 py-1 text-sm font-bold rounded-full transition-colors flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    Unfriend
                                </button>
                            </div>
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
                        <div className="flex flex-wrap gap-8 mb-8 pb-8 border-b border-zinc-800">
                            <div>
                                <span className="text-zinc-500 text-sm uppercase font-bold tracking-wider">Total Est. Value</span>
                                <div className="text-3xl font-bold mt-1">${totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            </div>
                            <div>
                                <span className="text-zinc-500 text-sm uppercase font-bold tracking-wider">Total Return</span>
                                <div className={`text-3xl font-bold mt-1 flex items-baseline gap-2 ${totalReturnVar >= 0 ? 'text-[#00c805]' : 'text-red-500'}`}>
                                    <span>{totalReturnVar >= 0 ? "+" : "-"}${Math.abs(totalReturnVar).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    <span className="text-lg opacity-80 bg-zinc-900/50 px-2 py-0.5 rounded-md border border-zinc-800/50">
                                        {totalReturnPct >= 0 ? "+" : ""}{totalReturnPct.toFixed(2)}%
                                    </span>
                                </div>
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
                                            <th className="pb-3 font-bold text-right pr-4">Value</th>
                                            <th className="pb-3 font-bold text-right">Total Return</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mergedPositions.map((item, i) => {
                                            const currentPrice = livePrices[item.ticker] ?? item.avgCost;
                                            const marketValue = currentPrice * item.shares;
                                            const totalCost = item.avgCost * item.shares;
                                            const returnVar = marketValue - totalCost;
                                            const returnPct = totalCost > 0 ? (returnVar / totalCost) * 100 : 0;
                                            const isPositive = currentPrice >= item.avgCost;

                                            return (
                                                <tr key={i} className="border-b border-zinc-800/50 last:border-0">
                                                    <td className="py-4 pr-4">
                                                        <div className="font-bold text-sm">{item.ticker}</div>
                                                        <div className="text-xs text-zinc-500">{item.name}</div>
                                                    </td>
                                                    <td className="py-4 text-right text-sm pr-4">{item.shares.toLocaleString(undefined, { maximumFractionDigits: 5 })}</td>
                                                    <td className="py-4 text-right text-sm pr-4">${item.avgCost.toFixed(2)}</td>
                                                    <td className="py-4 text-right text-sm pr-4">${currentPrice.toFixed(2)}</td>
                                                    <td className={`py-4 text-right text-sm font-bold pr-4 ${isPositive ? "text-[#00c805]" : "text-red-500"}`}>
                                                        ${marketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                    <td className={`py-4 text-right text-sm font-bold ${returnVar >= 0 ? "text-[#00c805]" : "text-red-500"}`}>
                                                        <div className="flex flex-col items-end">
                                                            <span>{returnVar >= 0 ? "+" : "-"}${Math.abs(returnVar).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                            <span className="text-xs opacity-80">{returnPct >= 0 ? "+" : ""}{returnPct.toFixed(2)}%</span>
                                                        </div>
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

            {/* Unfriend Confirmation Modal */}
            {isUnfriendModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#111] border border-zinc-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-500 mx-auto flex items-center justify-center mb-4 border border-red-500/30">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Remove Friend?</h3>
                            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                                Are you sure you want to unfriend <strong className="text-white">{targetUser.displayName || targetUser.username}</strong>? You will no longer be able to see each other's private portfolios or friends-only posts.
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsUnfriendModalOpen(false)}
                                    className="flex-1 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={removeFriend}
                                    className="flex-1 py-3 px-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                                >
                                    Unfriend
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
