"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function MarketsPage() {
    const router = useRouter();
    const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
    const [shares, setShares] = useState("1");
    const [isTrading, setIsTrading] = useState(false);
    const [tradeError, setTradeError] = useState("");
    const [tradeSuccess, setTradeSuccess] = useState(false);
    const [activeTimeframe, setActiveTimeframe] = useState("1D");
    const [chartPath, setChartPath] = useState("M 0,40 L 5,38 L 10,42 L 15,35 L 20,38 L 25,25 L 30,28 L 35,45 L 40,35 L 45,48 L 50,15 L 55,30 L 60,10 L 65,25 L 70,15 L 75,25 L 80,18 L 85,22 L 90,18 L 95,20 L 100,16");

    useEffect(() => {
        // Randomize the chart path softly when timeframe changes
        const randomY = () => Math.floor(Math.random() * 40) + 10;
        const newPath = `M 0,${randomY()} ` + Array.from({ length: 20 }).map((_, i) => `L ${(i + 1) * 5},${randomY()}`).join(" ");
        setChartPath(newPath);
    }, [activeTimeframe]);

    const price = 189.82;
    const totalCost = (parseFloat(shares || "0") * price).toFixed(2);

    const handleTrade = async () => {
        if (!auth.currentUser) return;
        setIsTrading(true);
        setTradeError("");

        try {
            const userRef = doc(db, "users", auth.currentUser.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                const currentBalance = userData.cashBalance || 0;
                const cost = parseFloat(totalCost);

                if (currentBalance < cost) {
                    setTradeError("Insufficient funds.");
                    setIsTrading(false);
                    return;
                }

                // Update balance and add to portfolio
                await updateDoc(userRef, {
                    cashBalance: currentBalance - cost,
                    portfolio: arrayUnion({
                        ticker: "NVDA",
                        name: "NVIDIA",
                        shares: parseFloat(shares),
                        priceAtPurchase: price,
                        costBasis: cost,
                        timestamp: new Date().toISOString(),
                    })
                });

                setTradeSuccess(true);
                setTimeout(() => {
                    setIsTradeModalOpen(false);
                    setTradeSuccess(false);
                    router.push("/portfolio");
                }, 1500);
            }
        } catch (error) {
            console.error(error);
            setTradeError("Failed to execute trade.");
        }
        setIsTrading(false);
    };

    return (
        <div className="flex flex-col w-full animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans text-white pb-24 md:pb-8 max-w-2xl mx-auto">

            {/* Asset Header */}
            <div className="flex flex-col gap-1 px-4 mt-2">
                <span className="text-sm font-bold tracking-wider text-zinc-400">NVDA</span>
                <h1 className="text-3xl font-bold tracking-tight">NVIDIA</h1>
                <div className="text-4xl font-bold mt-2">$189.82 <span className="text-xl text-[#00c805] bg-[#00c805]/10 w-fit px-2 py-1 rounded-full inline-block ml-2 mb-1 border border-[#00c805]/20">↑</span></div>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[#00c805] font-semibold text-sm">▲ $1.91 (1.02%)</span>
                    <span className="text-zinc-400 text-sm">Today</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[#00c805] font-semibold text-sm">▲ $0.19 (0.10%)</span>
                    <span className="text-zinc-400 text-sm">After-hours</span>
                </div>
            </div>

            {/* Robinhood-style SVG Line Chart */}
            <div className="w-full h-64 mt-8 relative">
                {/* Dotted horizontal zero line */}
                <div className="absolute top-1/2 left-0 right-0 border-t border-dotted border-zinc-600 z-0"></div>
                <svg className="w-full h-full relative z-10" viewBox="0 0 100 50" preserveAspectRatio="none">
                    <path
                        d={chartPath}
                        fill="none"
                        stroke="#00c805"
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                        className="transition-all duration-300 ease-in-out"
                    />
                </svg>
            </div>

            {/* Timeframes */}
            <div className="flex items-center justify-between px-6 mt-4 border-b border-white/10 pb-6">
                {['1D', '1W', '1M', '3M', 'YTD', '1Y'].map((tf) => (
                    <button
                        key={tf}
                        onClick={() => setActiveTimeframe(tf)}
                        className={`text-xs font-bold transition-all duration-200 ${activeTimeframe === tf
                            ? 'bg-[#00c805] text-black px-3 py-1.5 rounded-md'
                            : 'text-[#00c805] hover:text-[#00c805]/80 px-3 py-1.5'
                            }`}
                    >
                        {tf}
                    </button>
                ))}
            </div>

            {/* Trade Button (Moved Top) */}
            <div className="px-4 mt-6">
                <button
                    onClick={() => setIsTradeModalOpen(true)}
                    className="w-full py-3.5 bg-[#00c805] hover:bg-[#00e306] text-black rounded-full font-bold text-lg transition shadow-lg shadow-[#00c805]/20"
                >
                    Trade
                </button>
            </div>

            {/* About Section */}
            <div className="px-4 mt-8">
                <h2 className="text-2xl font-bold mb-4">About NVIDIA</h2>
                <p className="text-sm text-zinc-300 leading-relaxed mb-6">
                    NVIDIA Corp. engages in the design and manufacture of computer graphics processors, chipsets, and related multimedia software. It operates through the following segments: Graphics Processing Unit (GPU), Tegra Processor, and All Other.
                    <span className="text-[#00c805] font-bold ml-2 cursor-pointer">Show more</span>
                </p>

                <div className="grid grid-cols-2 gap-y-6 text-sm">
                    <div>
                        <span className="text-zinc-500 block mb-1">CEO</span>
                        <span className="font-medium">Jen-Hsun Huang</span>
                    </div>
                    <div>
                        <span className="text-zinc-500 block mb-1">Founded</span>
                        <span className="font-medium">1993</span>
                    </div>
                    <div>
                        <span className="text-zinc-500 block mb-1">Employees</span>
                        <span className="font-medium">36,000</span>
                    </div>
                    <div>
                        <span className="text-zinc-500 block mb-1">Headquarters</span>
                        <span className="font-medium">Santa Clara, California</span>
                    </div>
                </div>
            </div>

            {/* Stats Section */}
            <div className="px-4 mt-12">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">Stats <span className="text-zinc-500 text-lg">›</span></h2>

                <div className="grid grid-cols-2 gap-x-4 gap-y-8 text-sm pb-8 border-b border-white/10">
                    <div className="flex justify-between items-end border-b border-white/10 pb-2">
                        <div>
                            <span className="text-zinc-500 block mb-1 text-xs">Bid</span>
                            <span className="font-bold text-lg">$189.95</span>
                            <span className="block text-xs text-zinc-500 mt-0.5">x 50</span>
                        </div>
                        {/* Mock depth bar */}
                        <div className="w-8 h-8 rounded-sm shrink-0 flex items-end">
                            <div className="w-full bg-[#00c805]/20 border border-[#00c805] h-full"></div>
                        </div>
                    </div>
                    <div className="flex justify-between items-end border-b border-white/10 pb-2">
                        {/* Mock depth bar */}
                        <div className="w-8 h-8 rounded-sm shrink-0 flex items-end">
                            <div className="w-full bg-red-500/20 border border-red-500 h-1/4"></div>
                        </div>
                        <div className="text-right">
                            <span className="text-zinc-500 block mb-1 text-xs">Ask</span>
                            <span className="font-bold text-lg">$189.82</span>
                            <span className="block text-xs text-zinc-500 mt-0.5">x 13</span>
                        </div>
                    </div>

                    <div>
                        <span className="text-zinc-500 block mb-1 text-xs">Volume</span>
                        <span className="font-medium">178.42M</span>
                    </div>
                    <div>
                        <span className="text-zinc-500 block mb-1 text-xs">Average vol</span>
                        <span className="font-medium">169.33M</span>
                    </div>
                    <div>
                        <span className="text-zinc-500 block mb-1 text-xs">Open</span>
                        <span className="font-medium">186.52</span>
                    </div>
                    <div>
                        <span className="text-zinc-500 block mb-1 text-xs">Today's high</span>
                        <span className="font-medium">190.33</span>
                    </div>
                </div>
            </div>

            {/* News Section */}
            <div className="px-4 mt-8 pb-24">
                <h2 className="text-2xl font-bold mb-6">News</h2>

                <div className="flex flex-col gap-6">
                    <div className="flex gap-4 items-start border-b border-white/10 pb-6">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="font-bold text-sm">Nasdaq</span>
                                <span className="text-zinc-500 text-xs">2h</span>
                            </div>
                            <h3 className="font-medium text-white mb-3">Should You Buy Nvidia Stock Before Earnings?</h3>
                            <span className="text-[#00c805] text-xs font-bold bg-[#00c805]/10 px-2 py-1 rounded">NVDA +1.12%</span>
                        </div>
                        <div className="w-20 h-20 bg-zinc-800 rounded-lg shrink-0 shrink-0 bg-gradient-to-tr from-purple-900 to-blue-500 opacity-80"></div>
                    </div>

                    <div className="flex gap-4 items-start border-b border-white/10 pb-6">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="font-bold text-sm">The Motley Fool</span>
                                <span className="text-zinc-500 text-xs">6h</span>
                            </div>
                            <h3 className="font-medium text-white mb-3">Top Stocks to Double Up on Right Now</h3>
                            <div className="flex gap-2">
                                <span className="text-[#00c805] text-xs font-bold bg-[#00c805]/10 px-2 py-1 rounded">NVDA +1.12%</span>
                                <span className="text-[#00c805] text-xs font-bold bg-[#00c805]/10 px-2 py-1 rounded">MU +2.24%</span>
                            </div>
                        </div>
                        <div className="w-20 h-20 bg-zinc-800 rounded-lg shrink-0 bg-zinc-700"></div>
                    </div>
                </div>
            </div>

            {/* Trade Modal */}
            {isTradeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">

                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Buy NVDA</h3>
                            <button onClick={() => setIsTradeModalOpen(false)} className="text-zinc-400 hover:text-white bg-zinc-800 w-8 h-8 rounded-full flex items-center justify-center">✕</button>
                        </div>

                        {tradeSuccess ? (
                            <div className="py-12 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-[#00c805]/20 text-[#00c805] rounded-full flex items-center justify-center mb-4 border-2 border-[#00c805]">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"></path></svg>
                                </div>
                                <h4 className="text-2xl font-bold mb-2">Order Complete</h4>
                                <p className="text-zinc-400 text-sm">Your NVDA shares have been added to your portfolio.</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center bg-black/50 p-4 rounded-xl mb-6 border border-zinc-800">
                                    <span className="text-zinc-400">Current Price</span>
                                    <span className="font-bold text-lg">${price.toFixed(2)}</span>
                                </div>

                                <div className="mb-6">
                                    <label className="block text-sm text-zinc-400 mb-2">Number of Shares</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={shares}
                                            onChange={(e) => setShares(e.target.value)}
                                            min="0"
                                            step="1"
                                            className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-2xl font-bold focus:outline-none focus:border-[#00c805] transition"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-between items-center mb-8 px-2">
                                    <span className="text-zinc-400 font-medium">Estimated Cost</span>
                                    <span className="font-bold text-xl">${totalCost}</span>
                                </div>

                                {tradeError && (
                                    <div className="text-red-500 text-sm mb-4 px-2 font-medium">{tradeError}</div>
                                )}

                                <button
                                    onClick={handleTrade}
                                    disabled={isTrading || !shares || parseFloat(shares) <= 0}
                                    className="w-full py-4 bg-[#00c805] hover:bg-[#00e306] disabled:opacity-50 disabled:hover:bg-[#00c805] text-black rounded-2xl font-bold text-lg transition"
                                >
                                    {isTrading ? "Processing..." : "Confirm Review"}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

        </div>
    );
}
