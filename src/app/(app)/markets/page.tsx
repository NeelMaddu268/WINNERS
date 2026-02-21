"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { getInvestorHypeScore } from "@/app/actions/gemini";

export default function MarketsPage() {
    const router = useRouter();
    const [selectedTicker, setSelectedTicker] = useState<{ ticker: string, name: string, price: number, diff: string, isPositive: boolean } | null>(null);
    const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
    const [shares, setShares] = useState("1");
    const [isTrading, setIsTrading] = useState(false);
    const [tradeError, setTradeError] = useState("");
    const [tradeSuccess, setTradeSuccess] = useState(false);
    const [activeTimeframe, setActiveTimeframe] = useState("1M");
    const [fullChartData, setFullChartData] = useState<any[]>([]);
    const [hypeData, setHypeData] = useState<{ score: number | null, points: string[] } | null>(null);
    const [isHypeLoading, setIsHypeLoading] = useState(false);

    const [indexData, setIndexData] = useState<{ price: number, diff: string, isPositive: boolean } | null>(null);
    const [topTickers, setTopTickers] = useState<{ ticker: string, name: string, price: number, diff: string, isPositive: boolean }[]>([
        { ticker: "NVDA", name: "NVIDIA", price: 189.82, diff: "+1.91 (1.02%)", isPositive: true },
        { ticker: "AAPL", name: "Apple", price: 173.50, diff: "-0.45 (-0.26%)", isPositive: false },
        { ticker: "MSFT", name: "Microsoft", price: 410.22, diff: "+3.14 (0.77%)", isPositive: true },
        { ticker: "TSLA", name: "Tesla", price: 175.34, diff: "-4.20 (-2.34%)", isPositive: false },
        { ticker: "AMZN", name: "Amazon", price: 178.15, diff: "+1.05 (0.59%)", isPositive: true },
    ]);

    useEffect(() => {
        import("@/app/actions/fmp").then(({ getMarketIndex, getBatchQuotes }) => {
            getMarketIndex("^GSPC").then(data => {
                const diffStr = `${data.change >= 0 ? '+' : ''}${data.change?.toFixed(2)} (${data.changesPercentage?.toFixed(2)}%)`;
                setIndexData({ price: data.price, diff: diffStr, isPositive: data.change >= 0 });
            });

            getBatchQuotes(["NVDA", "AAPL", "MSFT", "TSLA", "AMZN"]).then(data => {
                const nameMap: Record<string, string> = { "NVDA": "NVIDIA", "AAPL": "Apple", "MSFT": "Microsoft", "TSLA": "Tesla", "AMZN": "Amazon" };
                const formatted = data.map((q: { symbol: string, price: number, change: number, changesPercentage: number }) => ({
                    ticker: q.symbol,
                    name: nameMap[q.symbol] || q.symbol,
                    price: q.price,
                    diff: `${q.change >= 0 ? '+' : ''}${q.change?.toFixed(2)} (${q.changesPercentage?.toFixed(2)}%)`,
                    isPositive: q.change >= 0
                }));
                const ordered = ["NVDA", "AAPL", "MSFT", "TSLA", "AMZN"].map(t => formatted.find((f: { ticker: string, name: string, price: number, diff: string, isPositive: boolean }) => f.ticker === t)).filter(Boolean) as { ticker: string, name: string, price: number, diff: string, isPositive: boolean }[];
                if (ordered.length > 0) setTopTickers(ordered);
            });
        });
    }, []);

    const [spChartPath, setSpChartPath] = useState("M 0,40 L 5,38 L 10,42 L 15,35 L 20,38 L 25,25 L 30,28 L 35,45 L 40,35 L 45,48 L 50,15 L 55,30 L 60,10 L 65,25 L 70,15 L 75,25 L 80,18 L 85,22 L 90,18 L 95,20 L 100,16");
    const [historicalChartPath, setHistoricalChartPath] = useState(spChartPath);
    const [chartStats, setChartStats] = useState({ open: "-", high: "-", vol: "-", range: "-" });

    useEffect(() => {
        // Randomize the S&P chart path softly when timeframe changes (mock)
        const randomY = () => Math.floor(Math.random() * 40) + 10;
        const newPath = `M 0,${randomY()} ` + Array.from({ length: 20 }).map((_, i) => `L ${(i + 1) * 5},${randomY()}`).join(" ");
        setSpChartPath(newPath);
    }, [activeTimeframe]);

    // Redraw Ticker Chart when Timeframe or Data Changes
    useEffect(() => {
        if (!fullChartData || fullChartData.length === 0) return;

        let daysToShow;
        switch (activeTimeframe) {
            case '1W': daysToShow = 5; break; // 5 trading days
            case '1M': daysToShow = 21; break; // ~21 trading days month
            case '3M': daysToShow = 63; break; // ~63 trading days quarter
            case 'YTD':
                // Calculate days since Jan 1st of current year roughly
                daysToShow = fullChartData.filter(d => new Date(d.date).getFullYear() === new Date().getFullYear()).length;
                if (daysToShow === 0) daysToShow = 21; // fallback if Jan 1
                break;
            case '1Y': daysToShow = 252; break; // 252 trading days year
            case 'ALL': daysToShow = fullChartData.length; break;
            default: daysToShow = 21;
        }

        // Slice from the end (since array is oldest -> newest)
        const slicedData = fullChartData.slice(Math.max(fullChartData.length - daysToShow, 0));

        if (slicedData.length > 0) {
            const closes = slicedData.map((d: any) => d.close);
            let min = Math.min(...closes);
            let max = Math.max(...closes);

            if (min === max) { max += 1; min -= 1; }

            let path = `M 0,${50 - ((closes[0] - min) / (max - min)) * 50}`;
            closes.forEach((val: number, idx: number) => {
                const x = (idx / (closes.length - 1)) * 100;
                const y = 50 - ((val - min) / (max - min)) * 50;
                path += ` L ${x},${y}`;
            });

            setHistoricalChartPath(path);

            const latest = slicedData[slicedData.length - 1]; // today's data
            setChartStats({
                open: latest.open.toFixed(2),
                high: latest.high.toFixed(2),
                vol: (latest.volume / 1000000).toFixed(2) + "M",
                range: `${min.toFixed(2)} - ${max.toFixed(2)}`
            });
        }

    }, [activeTimeframe, fullChartData]);

    useEffect(() => {
        if (selectedTicker) {
            setIsHypeLoading(true);
            setHypeData(null);
            setHistoricalChartPath(spChartPath); // Reset back to mock line briefly
            setChartStats({ open: "-", high: "-", vol: "-", range: "-" });
            setFullChartData([]); // Clear previous ticker data

            getInvestorHypeScore(selectedTicker.ticker, selectedTicker.name).then(data => {
                setHypeData(data);
                setIsHypeLoading(false);
            });

            // Fetch Real 20-Year Historical Data from Firestore Cache
            const cacheRef = doc(db, "market_cache", `${selectedTicker.ticker}_daily`);
            getDoc(cacheRef).then(snap => {
                if (snap.exists() && snap.data().chartData) {
                    const data = snap.data().chartData;
                    // Trigger the plotting useEffect by setting state
                    setFullChartData(data);
                }
            }).catch(e => console.error("Error fetching historical chart data:", e));
        }
    }, [selectedTicker, spChartPath]);

    const handleTrade = async () => {
        if (!auth.currentUser || !selectedTicker) return;
        setIsTrading(true);
        setTradeError("");

        const cost = parseFloat(shares || "0") * selectedTicker.price;

        try {
            const userRef = doc(db, "users", auth.currentUser.uid);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                const currentBalance = userData.cashBalance || 0;

                if (currentBalance < cost) {
                    setTradeError("Insufficient funds.");
                    setIsTrading(false);
                    return;
                }

                // Update balance and add to portfolio
                await updateDoc(userRef, {
                    cashBalance: currentBalance - cost,
                    portfolio: arrayUnion({
                        ticker: selectedTicker.ticker,
                        name: selectedTicker.name,
                        shares: parseFloat(shares),
                        priceAtPurchase: selectedTicker.price,
                        costBasis: cost,
                        timestamp: new Date().toISOString(),
                    })
                });

                setTradeSuccess(true);
                setTimeout(() => {
                    setIsTradeModalOpen(false);
                    setTradeSuccess(false);
                    setSelectedTicker(null);
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

            {/* Main Market Overview (S&P 500) */}
            <div className="flex flex-col gap-1 px-4 mt-2">
                <span className="text-sm font-bold tracking-wider text-zinc-400">INDEX</span>
                <h1 className="text-3xl font-bold tracking-tight">S&P 500</h1>
                <div className="text-4xl font-bold mt-2">
                    {indexData ? indexData.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "..."}
                    <span className={`text-xl ${indexData?.isPositive !== false ? 'text-[#00c805] bg-[#00c805]/10 border-[#00c805]/20' : 'text-red-500 bg-red-500/10 border-red-500/20'} w-fit px-2 py-1 rounded-full inline-block ml-2 mb-1 border`}>
                        {indexData?.isPositive !== false ? '↑' : '↓'}
                    </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <span className={`${indexData?.isPositive !== false ? 'text-[#00c805]' : 'text-red-500'} font-semibold text-sm`}>
                        {indexData?.isPositive !== false ? '▲' : '▼'} {indexData ? indexData.diff : "..."}
                    </span>
                    <span className="text-zinc-400 text-sm">Today</span>
                </div>
            </div>

            {/* S&P SVG Chart */}
            <div className="w-full h-64 mt-8 relative">
                <div className="absolute top-1/2 left-0 right-0 border-t border-dotted border-zinc-600 z-0"></div>
                <svg className="w-full h-full relative z-10" viewBox="0 0 100 50" preserveAspectRatio="none">
                    <path
                        d={spChartPath}
                        fill="none"
                        stroke="#00c805"
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                        className="transition-all duration-300 ease-in-out"
                    />
                </svg>
            </div>

            <div className="flex items-center justify-between px-6 mt-4 border-b border-white/10 pb-6">
                {['1W', '1M', '3M', 'YTD', '1Y', 'ALL'].map((tf) => (
                    <button
                        key={tf}
                        onClick={() => setActiveTimeframe(tf)}
                        className={`text-xs font-bold transition-all duration-200 ${activeTimeframe === tf
                            ? 'bg-zinc-800 text-white px-3 py-1.5 rounded-full'
                            : 'text-zinc-400 hover:text-white px-3 py-1.5'
                            }`}
                    >
                        {tf}
                    </button>
                ))}
            </div>

            {/* Top Movers List */}
            <div className="px-4 mt-8">
                <h2 className="text-xl font-bold mb-4">Top Tickers</h2>
                <div className="flex flex-col gap-0 border border-zinc-800 rounded-2xl overflow-hidden bg-[#111111]">
                    {topTickers.map((ticker, idx) => (
                        <div
                            key={ticker.ticker}
                            onClick={() => setSelectedTicker(ticker)}
                            className={`flex justify-between items-center p-4 hover:bg-zinc-800/50 cursor-pointer transition-colors ${idx !== topTickers.length - 1 ? 'border-b border-zinc-800' : ''}`}
                        >
                            <div className="flex flex-col">
                                <span className="font-bold text-lg">{ticker.ticker}</span>
                                <span className="text-sm text-zinc-500">{ticker.name}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="font-bold">${ticker.price.toFixed(2)}</span>
                                <span className={`text-sm font-semibold ${ticker.isPositive ? 'text-[#00c805]' : 'text-red-500'}`}>
                                    {ticker.isPositive ? '▲' : '▼'} {ticker.diff}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Full Screen Ticker Drill-down Modal */}
            {selectedTicker && !isTradeModalOpen && (
                <div className="fixed inset-0 z-40 bg-black overflow-y-auto animate-in slide-in-from-bottom-full duration-300 pb-24">
                    {/* Modal Nav */}
                    <div className="sticky top-0 bg-black/80 backdrop-blur-xl z-50 px-4 py-4 flex justify-between items-center border-b border-zinc-800">
                        <button onClick={() => setSelectedTicker(null)} className="text-zinc-400 hover:text-white w-10 h-10 flex items-center justify-center rounded-full bg-zinc-900">
                            ✕
                        </button>
                        <span className="font-bold">{selectedTicker.ticker}</span>
                        <div className="w-10"></div> {/* spacer */}
                    </div>

                    <div className="max-w-2xl mx-auto">
                        {/* Ticker Header */}
                        <div className="flex flex-col gap-1 px-4 mt-6">
                            <h1 className="text-3xl font-bold tracking-tight">{selectedTicker.name}</h1>
                            <div className="text-4xl font-bold mt-2">${selectedTicker.price.toFixed(2)}</div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`font-semibold text-sm ${selectedTicker.isPositive ? 'text-[#00c805]' : 'text-red-500'}`}>
                                    {selectedTicker.isPositive ? '▲' : '▼'} {selectedTicker.diff}
                                </span>
                                <span className="text-zinc-400 text-sm">Today</span>
                            </div>
                        </div>

                        {/* Chart */}
                        <div className="w-full h-64 mt-8 relative">
                            <svg className="w-full h-full relative z-10" viewBox="0 0 100 50" preserveAspectRatio="none">
                                <path
                                    d={historicalChartPath}
                                    fill="none"
                                    stroke={selectedTicker.isPositive ? "#00c805" : "#ff5000"}
                                    strokeWidth="1.5"
                                    vectorEffect="non-scaling-stroke"
                                    className="transition-all duration-700 ease-in-out"
                                />
                            </svg>
                        </div>

                        {/* Modal Timeframe Selector */}
                        <div className="flex items-center justify-between px-6 mt-6 mb-2">
                            {['1W', '1M', '3M', 'YTD', '1Y', 'ALL'].map((tf) => (
                                <button
                                    key={tf}
                                    onClick={() => setActiveTimeframe(tf)}
                                    className={`text-xs font-bold transition-all duration-200 ${activeTimeframe === tf
                                        ? 'bg-zinc-800 text-white px-3 py-1.5 rounded-full'
                                        : 'text-zinc-400 hover:text-white px-3 py-1.5'
                                        }`}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>

                        {/* Trade Button */}
                        <div className="px-4 mt-8">
                            <button
                                onClick={() => setIsTradeModalOpen(true)}
                                className={`w-full py-4 rounded-full font-bold text-lg transition shadow-lg ${selectedTicker.isPositive ? 'bg-[#00c805] hover:bg-[#00e306] text-black shadow-[#00c805]/20' : 'bg-[#ff5000] hover:bg-[#ff6a26] text-white shadow-[#ff5000]/20'}`}
                            >
                                Trade {selectedTicker.ticker}
                            </button>
                        </div>

                        {/* AI Simplified Rundown Section */}
                        <div className="px-4 mt-12 mb-8">
                            <div className="bg-gradient-to-br from-[#1a1025] to-[#110c18] border border-purple-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden min-h-[250px]">
                                <h2 className="text-2xl font-serif font-bold text-purple-100 mb-6 flex items-center gap-2">
                                    <span className="text-purple-400">✨</span> AI Rundown
                                </h2>

                                {isHypeLoading ? (
                                    <div className="flex flex-col items-center justify-center py-8 opacity-70">
                                        <div className="w-8 h-8 rounded-full border-t-2 border-r-2 border-purple-500 animate-spin mb-4"></div>
                                        <p className="text-purple-300 text-sm animate-pulse">Analyzing web signals & sentiment...</p>
                                    </div>
                                ) : hypeData ? (
                                    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
                                        <div className="flex flex-col md:flex-row gap-6 items-center">
                                            {/* Score Display */}
                                            <div className="flex flex-col items-center p-6 bg-black/40 border border-purple-500/20 rounded-2xl w-full md:w-1/3 shadow-inner">
                                                <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2 text-center">Investor Hype Score</span>
                                                <div className="relative flex items-center justify-center w-24 h-24">
                                                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                                        <path className="text-white/5" strokeDasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" stroke="currentColor" strokeWidth="3" fill="none" />
                                                        <path className={`transition-all duration-1000 ease-out ${hypeData.score && hypeData.score > 60 ? 'text-red-500' : hypeData.score && hypeData.score > 40 ? 'text-yellow-500' : 'text-blue-500'}`} strokeDasharray={`${hypeData.score || 0}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" stroke="currentColor" strokeWidth="3" fill="none" />
                                                    </svg>
                                                    <div className="absolute flex items-center justify-center flex-col">
                                                        <span className="text-3xl font-bold text-white leading-none">{hypeData.score || "?"}</span>
                                                    </div>
                                                </div>
                                                <span className={`text-sm font-bold mt-4 ${hypeData.score && hypeData.score > 80 ? 'text-red-400' : hypeData.score && hypeData.score > 60 ? 'text-yellow-400' : 'text-blue-400'}`}>
                                                    {hypeData.score && hypeData.score > 80 ? 'Extreme / Meme' : hypeData.score && hypeData.score > 60 ? 'High Hype' : hypeData.score && hypeData.score > 40 ? 'Moderate Hype' : 'Low Hype'}
                                                </span>
                                            </div>

                                            {/* AI Context Paragraphs */}
                                            <div className="flex flex-col gap-4 w-full md:w-2/3">
                                                {hypeData.points.map((point, idx) => (
                                                    <div key={idx} className="bg-black/40 border border-white/5 p-4 rounded-2xl flex items-start gap-3">
                                                        <span className="text-purple-400 mt-0.5">•</span>
                                                        <p className="text-sm text-zinc-200 leading-relaxed font-medium">
                                                            {point}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-zinc-500 text-sm">No analysis available.</div>
                                )}
                            </div>
                        </div>

                        {/* Traditional Stats Section (Condensed) */}
                        <div className="px-4 mt-8 pb-32">
                            <h2 className="text-xl font-bold mb-4 text-zinc-400">Key Statistics</h2>
                            <div className="grid grid-cols-2 gap-y-4 text-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
                                <div>
                                    <span className="text-zinc-500 block mb-0.5">Open</span>
                                    <span className="font-medium">{chartStats.open}</span>
                                </div>
                                <div>
                                    <span className="text-zinc-500 block mb-0.5">High</span>
                                    <span className="font-medium">{chartStats.high}</span>
                                </div>
                                <div>
                                    <span className="text-zinc-500 block mb-0.5">Vol (Daily)</span>
                                    <span className="font-medium">{chartStats.vol}</span>
                                </div>
                                <div>
                                    <span className="text-zinc-500 block mb-0.5">{activeTimeframe} Range</span>
                                    <span className="font-medium">{chartStats.range}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Trade Confirmation Modal */}
            {isTradeModalOpen && selectedTicker && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">

                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Buy {selectedTicker.ticker}</h3>
                            <button onClick={() => setIsTradeModalOpen(false)} className="text-zinc-400 hover:text-white bg-zinc-800 w-8 h-8 rounded-full flex items-center justify-center">✕</button>
                        </div>

                        {tradeSuccess ? (
                            <div className="py-12 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-[#00c805]/20 text-[#00c805] rounded-full flex items-center justify-center mb-4 border-2 border-[#00c805]">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"></path></svg>
                                </div>
                                <h4 className="text-2xl font-bold mb-2">Order Complete</h4>
                                <p className="text-zinc-400 text-sm">Your {selectedTicker.ticker} shares have been added to your portfolio.</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-center bg-black/50 p-4 rounded-xl mb-6 border border-zinc-800">
                                    <span className="text-zinc-400">Current Price</span>
                                    <span className="font-bold text-lg">${selectedTicker.price.toFixed(2)}</span>
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
                                    <span className="font-bold text-xl">${(parseFloat(shares || "0") * selectedTicker.price).toFixed(2)}</span>
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
