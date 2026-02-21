"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { searchTickers } from "@/app/actions/fmp";

type TickerItem = { ticker: string; name: string; price: number; diff: string; isPositive: boolean };

export default function MarketsPage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<{ symbol: string; name: string }[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const [activeTimeframe, setActiveTimeframe] = useState("1M");
    const [indexData, setIndexData] = useState<{ price: number; diff: string; isPositive: boolean } | null>(null);
    const [topTickers, setTopTickers] = useState<TickerItem[]>([
        { ticker: "NVDA", name: "NVIDIA", price: 189.82, diff: "+1.91 (1.02%)", isPositive: true },
        { ticker: "AAPL", name: "Apple", price: 173.50, diff: "-0.45 (-0.26%)", isPositive: false },
        { ticker: "MSFT", name: "Microsoft", price: 410.22, diff: "+3.14 (0.77%)", isPositive: true },
        { ticker: "TSLA", name: "Tesla", price: 175.34, diff: "-4.20 (-2.34%)", isPositive: false },
        { ticker: "AMZN", name: "Amazon", price: 178.15, diff: "+1.05 (0.59%)", isPositive: true },
    ]);

    // Search tickers when query changes (debounced)
    useEffect(() => {
        if (searchQuery.trim().length < 2) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        const timer = setTimeout(() => {
            searchTickers(searchQuery).then((results) => {
                setSearchResults(results);
                setIsSearching(false);
            });
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Close search dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setIsSearchDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

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
                const ordered = ["NVDA", "AAPL", "MSFT", "TSLA", "AMZN"].map(t => formatted.find((f: TickerItem) => f.ticker === t)).filter(Boolean) as TickerItem[];
                if (ordered.length > 0) setTopTickers(ordered);
            });
        });
    }, []);

    const [spChartPath, setSpChartPath] = useState("M 0,40 L 5,38 L 10,42 L 15,35 L 20,38 L 25,25 L 30,28 L 35,45 L 40,35 L 45,48 L 50,15 L 55,30 L 60,10 L 65,25 L 70,15 L 75,25 L 80,18 L 85,22 L 90,18 L 95,20 L 100,16");

    useEffect(() => {
        const randomY = () => Math.floor(Math.random() * 40) + 10;
        const points: { x: number; y: number }[] = [];
        points.push({ x: 0, y: randomY() });
        for (let i = 1; i <= 20; i++) points.push({ x: i * 5, y: randomY() });
        const newPath = `M ${points[0].x},${points[0].y}` + points.slice(1).map((p) => ` L ${p.x},${p.y}`).join("");
        setSpChartPath(newPath);
    }, [activeTimeframe]);


    const handleSelectSearchResult = (symbol: string) => {
        setSearchQuery("");
        setIsSearchDropdownOpen(false);
        setSearchResults([]);
        router.push(`/markets/${symbol}`);
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
            <div className="w-full h-56 mt-8 relative">
                <svg className="w-full h-full relative z-10" viewBox="0 0 100 50" preserveAspectRatio="none">
                    {[10, 20, 30, 40].map((y) => (
                        <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                    ))}
                    <path
                        d={`${spChartPath} L 100,50 L 0,50 Z`}
                        fill="#00c805"
                        fillOpacity="0.15"
                        className="transition-all duration-300 ease-in-out"
                    />
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

            {/* Search Bar */}
            <div ref={searchRef} className="relative px-4 mt-8">
                <div className="relative flex items-center bg-[#1a1a1a] border border-zinc-600/60 rounded-xl py-2 pl-4 pr-3 gap-3 transition-all focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-500/30">
                    <span className="text-zinc-400 shrink-0">
                        {isSearching ? (
                            <span className="w-4 h-4 block border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        )}
                    </span>
                    <input
                        type="text"
                        placeholder="Symbol/Name"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsSearchDropdownOpen(true);
                        }}
                        onFocus={() => searchResults.length > 0 && setIsSearchDropdownOpen(true)}
                        className="flex-1 min-w-0 bg-transparent text-white placeholder-zinc-400 text-sm focus:outline-none"
                    />
                    {searchResults.length > 0 && (
                        <span className="shrink-0 text-zinc-400 text-sm font-medium bg-[#1f1f1f] border border-zinc-600/60 rounded-full px-3 py-1">
                            {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                        </span>
                    )}
                </div>
                {isSearchDropdownOpen && (searchResults.length > 0 || (searchQuery.length >= 2 && !isSearching)) && (
                    <div className="absolute top-full left-4 right-4 mt-1 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl z-50 max-h-64 overflow-y-auto">
                        {searchResults.length > 0 ? (
                            searchResults.map((r) => (
                                <button
                                    key={r.symbol}
                                    type="button"
                                    onClick={() => handleSelectSearchResult(r.symbol)}
                                    className="w-full flex justify-between items-center px-4 py-3 hover:bg-zinc-800 text-left transition"
                                >
                                    <div>
                                        <span className="font-bold">{r.symbol}</span>
                                        <span className="text-zinc-500 text-sm ml-2">{r.name}</span>
                                    </div>
                                    <span className="text-zinc-400 text-sm">View</span>
                                </button>
                            ))
                        ) : (
                            <div className="px-4 py-6 text-center text-zinc-500 text-sm">No results found</div>
                        )}
                    </div>
                )}
            </div>

            {/* Top Movers List */}
            <div className="px-4 mt-8">
                <h2 className="text-xl font-bold mb-4">Top Tickers</h2>
                <div className="flex flex-col gap-0 border border-zinc-800 rounded-2xl overflow-hidden bg-[#111111]">
                    {topTickers.map((ticker, idx) => (
                        <div
                            key={ticker.ticker}
                            onClick={() => router.push(`/markets/${ticker.ticker}`)}
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

        </div>
    );
}
