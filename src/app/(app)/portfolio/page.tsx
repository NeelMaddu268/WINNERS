"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

export default function PortfolioPage() {
    const [candleData, setCandleData] = useState<any[]>([]);
    const [portfolio, setPortfolio] = useState<any[]>([]);
    const [cashBalance, setCashBalance] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [selectedAsset, setSelectedAsset] = useState<any | null>(null);

    useEffect(() => {
        let unsubscribeDoc: () => void;

        const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            if (user) {
                const userRef = doc(db, "users", user.uid);

                // Set up real-time listener
                unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setPortfolio(data.portfolio || []);
                        setCashBalance(data.cashBalance || 0);
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Failed to listen to user data:", error);
                    setLoading(false);
                });
            } else {
                setPortfolio([]);
                setCashBalance(0);
                setLoading(false);
                if (unsubscribeDoc) unsubscribeDoc();
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeDoc) unsubscribeDoc();
        };
    }, []);

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

            {/* My Portfolio Section */}
            {!loading && (
                <div className="flex flex-col gap-6">
                    <h2 className="text-2xl font-bold font-serif" style={{ fontFamily: 'Playfair Display, serif' }}>My Assets</h2>
                    <div className="bg-[#111c18] border border-[#2a3d30]/50 rounded-3xl p-6 md:p-10 shadow-xl overflow-hidden">
                        <section className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[#2a3d30]/50 pb-8 mb-8 gap-4">
                            <div>
                                <span className="text-[#a8a8a0] text-sm uppercase tracking-wider font-bold">Total Portfolio Value</span>
                                <div className="text-4xl md:text-5xl font-bold mt-2">
                                    ${(cashBalance + portfolio.reduce((acc, item) => acc + (item.shares * 189.82), 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>
                            <div className="text-left md:text-right bg-[#1a2a22] px-6 py-4 rounded-2xl border border-[#2a3d30]">
                                <span className="text-[#a8a8a0] text-xs uppercase tracking-wider font-bold">Cash Balance</span>
                                <div className="text-2xl font-bold mt-1 text-[#4ade9a]">
                                    ${cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>
                        </section>

                        {portfolio.length === 0 ? (
                            <div className="py-12 text-center text-[#a8a8a0] flex flex-col items-center">
                                <div className="w-16 h-16 bg-[#1a2a22] rounded-full flex items-center justify-center mb-4 border border-[#2a3d30]">
                                    <span className="text-2xl opacity-50">💸</span>
                                </div>
                                <p className="text-lg">You haven't made any investments yet.</p>
                                <p className="text-sm mt-2 max-w-sm">Head over to the Markets tab to start trading and build your portfolio!</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {portfolio.map((item, i) => {
                                    const currentPrice = 189.82; // Mock current price Since we only traded NVDA
                                    const currentValue = item.shares * currentPrice;
                                    const profit = currentValue - item.costBasis;
                                    const profitPercent = (profit / item.costBasis) * 100;
                                    const isPositive = profit >= 0;

                                    return (
                                        <div key={i} onClick={() => setSelectedAsset(item)} className="flex justify-between items-center p-5 md:p-6 bg-[#1a2a22] rounded-2xl border border-[#2a3d30]/50 hover:border-[#4ade9a]/50 transition-colors group cursor-pointer">
                                            <div className="flex flex-col gap-1">
                                                <div className="font-bold text-xl flex items-baseline gap-3">
                                                    {item.ticker}
                                                    <span className="text-sm font-medium text-[#a8a8a0] bg-black/20 px-2 py-0.5 rounded">{item.shares} Shares</span>
                                                </div>
                                                <div className="text-sm text-[#a8a8a0]">{item.name}</div>
                                            </div>
                                            <div className="text-right flex flex-col gap-1">
                                                <div className="font-bold text-xl">${currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                <div className={`text-sm font-bold flex items-center justify-end gap-1 ${isPositive ? 'text-[#4ade9a]' : 'text-red-400'}`}>
                                                    <span className="bg-current/10 px-1.5 py-0.5 rounded">
                                                        {isPositive ? '+' : ''}{profitPercent.toFixed(2)}%
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="mt-8 border-t border-white/5 pt-12">
                <h2 className="text-2xl font-serif font-bold mb-8 text-[#a8a8a0]" style={{ fontFamily: 'Playfair Display, serif' }}>Account Insights</h2>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

                    {/* Left Column: Narrative & Lookout */}
                    <div className="lg:col-span-7 flex flex-col gap-10">

                        {/* Narrative Report */}
                        <section className="bg-[#111c18] border border-[#2a3d30]/50 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                            {/* Subtle glow */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-[#4ade9a]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>

                            <h2 className="text-xl text-[#a8a8a0] font-medium mb-6">
                                Your bi-monthly report looks great, here's what happened:
                            </h2>

                            <ul className="space-y-6 text-lg leading-relaxed relative z-10">
                                <li className="flex gap-4 items-start">
                                    <span className="text-[#4ade9a] text-2xl leading-none mt-1">&mdash;</span>
                                    <p>Last week started out rough when <span className="text-white font-medium border-b border-white/20 pb-0.5">Apple earnings disappointed...</span></p>
                                </li>
                                <li className="flex gap-4 items-start">
                                    <span className="text-[#4ade9a] text-2xl leading-none mt-1">&mdash;</span>
                                    <div className="flex-1">
                                        <p>Your bet on <span className="text-white font-bold bg-[#4ade9a]/10 px-2 py-0.5 rounded text-[#4ade9a]">WDC</span> 6-months ago paid off this week!</p>
                                        <p className="text-[#a8a8a0] text-base mt-2">...unveiled new microchips</p>
                                    </div>
                                </li>
                            </ul>
                        </section>

                        {/* Lookout Section */}
                        <section className="bg-[#111c18] border border-[#2a3d30]/50 rounded-3xl p-8 shadow-xl">
                            <h2 className="text-2xl font-serif font-bold mb-6 flex items-center gap-3 text-[#f0ede8]" style={{ fontFamily: 'Playfair Display, serif' }}>
                                Lookout <span className="text-2xl">👀</span>
                            </h2>

                            <ul className="space-y-5 text-lg">
                                <li className="flex gap-4 items-start">
                                    <span className="text-[#a8a8a0] text-2xl leading-none mt-1">&mdash;</span>
                                    <p className="leading-relaxed">
                                        <span className="text-white font-medium">MRST</span> P/E ratio dropped, <span className="text-[#4ade9a]">look into buying in</span>
                                    </p>
                                </li>
                                <li className="flex gap-4 items-center">
                                    <span className="text-[#a8a8a0] text-2xl leading-none">&mdash;</span>
                                    <div className="flex-1 flex items-center justify-between">
                                        <p className="leading-relaxed text-[#a8a8a0]">
                                            <span className="text-white font-medium">Nvidia</span> teases sept 5. product reveal
                                        </p>
                                        <div className="flex flex-col items-center gap-1 ml-4 bg-[#1a2a22] border border-[#2a3d30] px-3 py-2 rounded-xl">
                                            <div className="relative w-10 h-10 flex items-center justify-center">
                                                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                                                    <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.05)" strokeWidth="12" fill="none" />
                                                    <circle cx="50" cy="50" r="40" stroke="#4ade9a" strokeWidth="12" fill="none" strokeDasharray="251.2" strokeDashoffset="35.1" strokeLinecap="round" />
                                                </svg>
                                                <span className="absolute text-xs font-bold text-white">86%</span>
                                            </div>
                                            <span className="text-[10px] text-[#a8a8a0] font-medium uppercase tracking-wider">AI Hype</span>
                                        </div>
                                    </div>
                                </li>
                            </ul>
                        </section>
                    </div>

                    {/* Right Column: Visualizations & Stats */}
                    <div className="lg:col-span-5 flex flex-col gap-6">

                        {/* Profitable Positions Gauge */}
                        <div className="bg-[#111c18] border border-[#2a3d30]/50 rounded-3xl p-10 flex flex-col items-center justify-center shadow-xl relative">
                            <h3 className="text-xl font-medium text-[#a8a8a0] mb-8 text-center font-serif" style={{ fontFamily: 'Playfair Display, serif' }}>
                                Profitable Positions
                            </h3>

                            <div className="relative w-48 h-48 flex items-center justify-center">
                                {/* SVG Gauge */}
                                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90 filter drop-shadow-[0_0_15px_rgba(74,222,154,0.3)]">
                                    {/* Background ring */}
                                    <circle cx="50" cy="50" r="42" stroke="#1a2a22" strokeWidth="6" fill="none" />
                                    {/* Value ring (83% of 263.89 circumference = 219.02 dasharray, offset 44.86) */}
                                    <circle cx="50" cy="50" r="42" stroke="#4ade9a" strokeWidth="6" fill="none" strokeDasharray="263.89" strokeDashoffset="44.86" strokeLinecap="round" className="animate-[spin_1.5s_ease-out_reverse]" />
                                </svg>

                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-6xl font-bold font-serif text-white tracking-tighter" style={{ fontFamily: 'Playfair Display, serif' }}>
                                        83<span className="text-3xl text-[#4ade9a]">%</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Grid for Chart and Beating Market Box */}
                        <div className="grid grid-cols-2 gap-6 h-full">

                            {/* Highlights / Stats */}
                            <div className="bg-gradient-to-br from-[#4ade9a]/20 to-[#4ade9a]/5 border border-[#4ade9a]/30 rounded-3xl p-6 flex flex-col justify-between shadow-[0_0_30px_rgba(74,222,154,0.1)] relative overflow-hidden group">
                                {/* Decorative background lines */}
                                <div className="absolute inset-0 opacity-20 pointer-events-none">
                                    <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] bg-[length:10px_10px]" />
                                </div>

                                <div className="relative z-10">
                                    <span className="text-5xl font-bold text-[#4ade9a] drop-shadow-[0_0_10px_rgba(74,222,154,0.5)] tracking-tighter block mb-2 group-hover:scale-105 transition-transform origin-left">
                                        +15%
                                    </span>
                                    <span className="text-sm text-[#4ade9a] uppercase tracking-widest font-bold">This Week</span>
                                </div>

                                <div className="relative z-10 mt-6">
                                    <h3 className="text-2xl font-serif font-bold leading-tight text-white mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
                                        Beating the<br />Market!
                                    </h3>
                                    <div className="w-12 h-1 bg-[#4ade9a] rounded-full mt-4"></div>
                                </div>
                            </div>

                            {/* Mini Chart */}
                            <div className="bg-[#111c18] border border-[#2a3d30]/50 rounded-3xl p-6 relative flex flex-col shadow-xl">
                                <div className="absolute inset-0 bg-gradient-to-t from-[#4ade9a]/5 to-transparent rounded-3xl pointer-events-none"></div>

                                {/* Horizontal axis line */}
                                <div className="absolute top-1/2 left-4 right-4 h-px bg-[#2a3d30] z-0"></div>
                                {/* Vertical axis line */}
                                <div className="absolute top-6 bottom-6 left-4 w-px bg-[#2a3d30] z-0"></div>

                                <div className="flex-1 flex items-center justify-between gap-1 relative z-10 pl-4 py-4">
                                    {candleData.map((candle, idx) => {
                                        const maxHeight = 100;
                                        const range = 80; // Scale factor
                                        const wickHeight = (candle.high - candle.low) / range * maxHeight;
                                        const bodyHeight = Math.max(Math.abs(candle.close - candle.open) / range * maxHeight, 2);
                                        const isUp = candle.close >= candle.open;

                                        return (
                                            <div key={idx} className="flex-1 flex flex-col items-center relative h-full">
                                                <div className="absolute top-1/2 -translate-y-1/2 h-full w-full flex flex-col justify-center items-center">
                                                    {/* Wick */}
                                                    <div
                                                        className={`w-0.5 ${isUp ? 'bg-[#4ade9a]/60' : 'bg-red-400/60'} absolute`}
                                                        style={{ height: `${wickHeight}px` }}
                                                    />
                                                    {/* Body */}
                                                    <div
                                                        className={`w-1.5 md:w-2 ${isUp ? 'bg-[#4ade9a]' : 'bg-red-400'} absolute rounded-sm`}
                                                        style={{
                                                            height: `${bodyHeight}px`,
                                                            transform: `translateY(${(candle.open - candle.close) > 0 ? bodyHeight / 2 : -bodyHeight / 2}px)`
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Floating Action Button (Post) overlaid on chart corner */}
                                <button className="absolute -bottom-4 -right-4 w-14 h-14 bg-blue-600 hover:bg-blue-500 rounded-full flex flex-col items-center justify-center shadow-[0_10px_25px_rgba(37,99,235,0.5)] transition-transform hover:scale-110 active:scale-95 group text-white border-2 border-[#111c18]">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mb-0.5 group-hover:-translate-y-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                    <span className="text-[9px] font-bold tracking-widest uppercase">Post</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Asset Details Modal */}
            {selectedAsset && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#111c18] border border-[#2a3d30] rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold font-serif" style={{ fontFamily: 'Playfair Display, serif' }}>{selectedAsset.ticker} Details</h3>
                            <button onClick={() => setSelectedAsset(null)} className="text-[#a8a8a0] hover:text-white bg-[#1a2a22] w-8 h-8 rounded-full flex items-center justify-center transition">✕</button>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="flex justify-between items-center bg-[#1a2a22] p-4 rounded-xl border border-[#2a3d30]">
                                <span className="text-[#a8a8a0] text-sm font-medium">Shares Owned</span>
                                <span className="font-bold text-lg text-white">{selectedAsset.shares}</span>
                            </div>
                            <div className="flex justify-between items-center bg-[#1a2a22] p-4 rounded-xl border border-[#2a3d30]">
                                <span className="text-[#a8a8a0] text-sm font-medium">Avg Cost</span>
                                <span className="font-bold text-lg text-white">${selectedAsset.priceAtPurchase.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center bg-[#1a2a22] p-4 rounded-xl border border-[#2a3d30]">
                                <span className="text-[#a8a8a0] text-sm font-medium">Total Cost</span>
                                <span className="font-bold text-lg text-white">${selectedAsset.costBasis.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center bg-[#1a2a22] p-4 rounded-xl border border-[#2a3d30]">
                                <span className="text-[#a8a8a0] text-sm font-medium">Purchased On</span>
                                <span className="font-bold text-md text-white">{new Date(selectedAsset.timestamp).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
