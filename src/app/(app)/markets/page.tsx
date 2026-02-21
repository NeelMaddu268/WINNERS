"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { searchTickers, getMarketIndex, getTopGainersLosers, getVolumeLeaders, getSectorPerformance, getEarningsCalendar, getEconomicCalendar, getBatchQuotes, getMarketBreadth } from "@/app/actions/market";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

// ─── Types ────────────────────────────────────────────────────
type IndexCard = { label: string; symbol: string; price: number; change: number; pct: number; path: string };
type MoverItem = { symbol: string; name: string; price: number; change: number; changesPercentage: number; volume: number };
type SectorItem = { symbol: string; name: string; shortName: string; price: number; change: number; changesPercentage: number };
type EarningItem = { symbol: string; name: string; epsEstimate: string };
type EconomicEvent = { time: string; event: string; impact: "high" | "medium" | "low"; forecast: string };

// ─── Helpers ──────────────────────────────────────────────────
function generateSparklinePath(prices: number[]): string {
    if (!prices || prices.length === 0) return "";
    if (prices.length === 1) return `M 0,25 L 100,25`;

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    const padY = 5;
    const height = 50 - padY * 2;
    const scaleX = 100 / (prices.length - 1);

    const pts = prices.map((p, i) => {
        const x = i * scaleX;
        const normalized = (p - min) / range;
        const y = padY + height - (normalized * height);
        return { x, y };
    });

    return `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}` + pts.slice(1).map(p => ` L ${p.x.toFixed(2)},${p.y.toFixed(2)}`).join("");
}

function fmtVol(n: number): string {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
    return String(n);
}

function sectorColor(pct: number): { bg: string; text: string } {
    if (pct >= 2) return { bg: "bg-[#4ade9a]/20 border-[#4ade9a]/30", text: "text-[#4ade9a]" };
    if (pct > 0) return { bg: "bg-[#4ade9a]/10 border-[#4ade9a]/15", text: "text-[#4ade9a]/80" };
    if (pct > -2) return { bg: "bg-red-500/10 border-red-500/15", text: "text-red-400/80" };
    return { bg: "bg-red-500/20 border-red-500/30", text: "text-red-500" };
}

const WATCHLIST = ["NVDA", "AAPL", "TSLA", "AMZN", "MSFT", "GOOGL", "META"];

// ─── Sub-components ───────────────────────────────────────────
function IndexCardComponent({ card }: { card: IndexCard }) {
    const pos = card.pct >= 0;
    const stroke = pos ? "#4ade9a" : "#ef4444";
    const fillId = `grad-${card.symbol}`;
    return (
        <div className="flex-1 min-w-0 bg-gradient-to-br from-[#1a2a22] to-[#111c18] border border-[#2a3d30]/50 rounded-3xl p-3 flex flex-col gap-1 shadow-lg">
            <span className="text-[11px] font-bold text-[#a8a8a0] tracking-wider uppercase">{card.label}</span>
            <span className="text-lg font-bold leading-tight">
                {card.price > 0 ? card.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
            </span>
            <span className={`text-[11px] font-semibold ${pos ? "text-[#4ade9a]" : "text-red-500"}`}>
                {pos ? "▲" : "▼"} {Math.abs(card.pct).toFixed(2)}%
            </span>
            <svg viewBox="0 0 100 50" className="w-full h-8 mt-1" preserveAspectRatio="none">
                <defs>
                    <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={stroke} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path d={`${card.path} L 100,50 L 0,50 Z`} fill={`url(#${fillId})`} />
                <path d={card.path} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
        </div>
    );
}

function MoverRow({ item, router, showVol }: { item: MoverItem; router: ReturnType<typeof useRouter>; showVol?: boolean }) {
    const pos = item.changesPercentage >= 0;
    return (
        <div
            onClick={() => router.push(`/markets/${item.symbol}`)}
            className="flex items-center px-4 py-3 hover:bg-[#1a2a22] cursor-pointer transition-colors border-b border-[#2a3d30]/50 last:border-0 group"
        >
            <div className="flex flex-col flex-1 min-w-0">
                <span className="font-bold text-sm text-[#f0ede8]">{item.symbol}</span>
                <span className="text-xs text-[#a8a8a0] truncate">{item.name}</span>
                {showVol && <span className="text-[11px] text-[#a8a8a0] mt-0.5">Vol: {fmtVol(item.volume)}</span>}
            </div>
            <div className="flex flex-col items-end mr-3">
                <span className="font-semibold text-sm text-[#f0ede8]">${item.price.toFixed(2)}</span>
                <span className={`text-xs font-bold ${pos ? "text-[#4ade9a]" : "text-red-500"}`}>
                    {pos ? "+" : ""}{item.changesPercentage.toFixed(2)}%
                </span>
            </div>
            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                <button
                    onClick={() => router.push(`/markets/${item.symbol}`)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[#4ade9a]/15 text-[#4ade9a] border border-[#4ade9a]/30 hover:bg-[#4ade9a]/30 transition-colors"
                >
                    Buy
                </button>
                <button
                    onClick={() => router.push(`/markets/${item.symbol}`)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                >
                    Sell
                </button>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────
export default function MarketsPage() {
    const router = useRouter();

    // Search
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<{ symbol: string; name: string }[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Indices
    const [indices, setIndices] = useState<IndexCard[]>([
        { label: "S&P 500", symbol: "SPY", price: 0, change: 0, pct: 0, path: "" },
        { label: "Nasdaq", symbol: "QQQ", price: 0, change: 0, pct: 0, path: "" },
        { label: "Dow Jones", symbol: "DIA", price: 0, change: 0, pct: 0, path: "" },
    ]);

    // Breadth
    const [breadth, setBreadth] = useState({ up: 0, down: 0 });
    const breadthTotal = breadth.up + breadth.down || 1; // Prevent div by 0 on load

    // Discovery tab
    const [discoveryTab, setDiscoveryTab] = useState<"gainers" | "losers" | "volume" | "movers">("gainers");
    const [gainers, setGainers] = useState<MoverItem[]>([]);
    const [losers, setLosers] = useState<MoverItem[]>([]);
    const [volumeLeaders, setVolumeLeaders] = useState<MoverItem[]>([]);
    const [movers, setMovers] = useState<MoverItem[]>([]);
    const [moversLoading, setMoversLoading] = useState(true);

    // Sector
    const [sectors, setSectors] = useState<SectorItem[]>([]);

    // Calendar
    const [earningsBefore, setEarningsBefore] = useState<EarningItem[]>([]);
    const [earningsAfter, setEarningsAfter] = useState<EarningItem[]>([]);
    const [economicEvents, setEconomicEvents] = useState<EconomicEvent[]>([]);

    // Watchlist
    const [watchlistData, setWatchlistData] = useState<{ symbol: string; price: number; pct: number; pos: boolean }[]>([]);

    // Fear & Greed (heuristic)
    const fearGreed = Math.min(100, Math.max(0, Math.round(50 + (breadth.up - breadth.down) / breadthTotal * 80)));
    const fearGreedLabel = fearGreed >= 75 ? "Extreme Greed" : fearGreed >= 55 ? "Greed" : fearGreed >= 45 ? "Neutral" : fearGreed >= 25 ? "Fear" : "Extreme Fear";
    const fearGreedColor = fearGreed >= 55 ? "#4ade9a" : fearGreed >= 45 ? "#f59e0b" : "#ef4444";

    const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const discoveryItems = { gainers, losers, volume: volumeLeaders, movers } as Record<string, MoverItem[]>;
    const showVol = discoveryTab === "volume";

    // ── Data loading ──────────────────────────────────────────
    useEffect(() => {
        // Broad data load
        getMarketBreadth().then(setBreadth);

        // Big Three indices
        Promise.all([getMarketIndex("^GSPC"), getMarketIndex("^IXIC"), getMarketIndex("^DJI")]).then(([spy, qqq, dia]) => {
            setIndices([
                { label: "S&P 500", symbol: "^GSPC", price: spy.price, change: spy.change, pct: spy.changesPercentage, path: generateSparklinePath(spy.sparkline) },
                { label: "Nasdaq", symbol: "^IXIC", price: qqq.price, change: qqq.change, pct: qqq.changesPercentage, path: generateSparklinePath(qqq.sparkline) },
                { label: "Dow Jones", symbol: "^DJI", price: dia.price, change: dia.change, pct: dia.changesPercentage, path: generateSparklinePath(dia.sparkline) },
            ]);
        });

        // Movers
        Promise.all([getTopGainersLosers(), getVolumeLeaders()]).then(([gl, vol]) => {
            setGainers(gl.gainers);
            setLosers(gl.losers);
            setVolumeLeaders(vol);
            // Movers: stocks with |pct| > 0.5 to ensure large caps appear
            const allMovers = [...gl.gainers, ...gl.losers, ...vol];
            const seen = new Set<string>();
            const gapList = allMovers.filter(m => {
                if (Math.abs(m.changesPercentage) >= 0.5 && !seen.has(m.symbol)) { seen.add(m.symbol); return true; }
                return false;
            }).sort((a, b) => Math.abs(b.changesPercentage) - Math.abs(a.changesPercentage));
            setMovers(gapList);
            setMoversLoading(false);
        });

        // Sectors
        getSectorPerformance().then(setSectors);

        // Calendar
        Promise.all([getEarningsCalendar(), getEconomicCalendar()]).then(([earnings, economic]) => {
            setEarningsBefore(earnings.beforeOpen);
            setEarningsAfter(earnings.afterClose);
            setEconomicEvents(economic);
        });

        // Watchlist
        const loadWatchlist = async () => {
            let symbolsToLoad = WATCHLIST;
            if (auth.currentUser) {
                try {
                    const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
                    if (userDoc.exists() && userDoc.data().watchlist?.length > 0) {
                        symbolsToLoad = userDoc.data().watchlist.slice(0, 10);
                    }
                } catch (e) {
                    console.error("Failed to fetch custom watchlist", e);
                }
            }
            getBatchQuotes(symbolsToLoad).then((data: any[]) => {
                setWatchlistData(symbolsToLoad.map(sym => {
                    const q = data.find((x: any) => x.symbol === sym);
                    return { symbol: sym, price: q?.price ?? 0, pct: q?.changesPercentage ?? 0, pos: (q?.changesPercentage ?? 0) >= 0 };
                }));
            });
        };

        const unsubAuth = auth.onAuthStateChanged(() => {
            loadWatchlist();
        });

        // initial load if auth is already resolved, though onAuthStateChanged fires immediately anyway.
        if (auth.currentUser) {
            loadWatchlist();
        }

        return () => unsubAuth();
    }, []);

    // Search with debounce
    useEffect(() => {
        if (searchQuery.trim().length < 2) { setSearchResults([]); setIsSearching(false); return; }
        setIsSearching(true);
        const t = setTimeout(() => {
            searchTickers(searchQuery).then(r => { setSearchResults(r); setIsSearching(false); });
        }, 300);
        return () => clearTimeout(t);
    }, [searchQuery]);

    useEffect(() => {
        const h = (e: MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node)) setIsSearchDropdownOpen(false); };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const handleSelectSearchResult = (symbol: string) => {
        setSearchQuery("");
        setIsSearchDropdownOpen(false);
        setSearchResults([]);
        router.push(`/markets/${symbol}`);
    };

    return (
        <div className="flex flex-col w-full animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans text-[#f0ede8] pb-24 md:pb-8 max-w-2xl mx-auto gap-0">
            {/* ── Page Header ── */}
            <header className="px-4 mt-2 mb-4">
                <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
                    Markets
                </h1>
            </header>

            {/* ── Big Three Indices ── */}
            <div className="px-4 mt-2">
                <h2 className="text-xs font-bold tracking-widest text-[#a8a8a0] uppercase mb-3">Market Overview</h2>
                <div className="flex gap-2.5">
                    {indices.map(c => <IndexCardComponent key={c.symbol} card={c} />)}
                </div>
            </div>

            {/* ── Market Breadth ── */}
            <div className="px-4 mt-4">
                <div className="bg-[#111c18] border border-[#2a3d30]/50 rounded-3xl p-5 shadow-lg">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold tracking-widest text-[#a8a8a0] uppercase">Market Breadth</span>
                        <span className="text-xs text-[#a8a8a0]">Advance / Decline</span>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-[#4ade9a] text-sm">↑ {breadth.up.toLocaleString()}</span>
                        <span className="text-[#a8a8a0] text-xs">vs</span>
                        <span className="font-bold text-red-500 text-sm">↓ {breadth.down.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-red-500/20">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-[#4ade9a] to-[#22c55e] transition-all duration-700"
                            style={{ width: `${(breadth.up / breadthTotal) * 100}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-1.5">
                        <span className="text-[10px] text-[#a8a8a0]">{((breadth.up / breadthTotal) * 100).toFixed(0)}% advancing</span>
                        <span className="text-[10px] text-[#a8a8a0]">{((breadth.down / breadthTotal) * 100).toFixed(0)}% declining</span>
                    </div>
                </div>
            </div>

            {/* ── Fear & Greed ── */}
            <div className="px-4 mt-4">
                <div className="bg-[#111c18] border border-[#2a3d30]/50 rounded-3xl p-5 shadow-lg">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold tracking-widest text-[#a8a8a0] uppercase">Fear &amp; Greed Index</span>
                        <span className="text-xs font-bold" style={{ color: fearGreedColor }}>{fearGreedLabel}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full bg-gradient-to-r from-red-600 via-amber-400 to-[#4ade9a]">
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg shadow-black/50 transition-all duration-700"
                            style={{ left: `calc(${fearGreed}% - 8px)`, backgroundColor: fearGreedColor }}
                        />
                    </div>
                    <div className="flex justify-between mt-1.5">
                        <span className="text-[10px] text-red-500 font-semibold">Extreme Fear</span>
                        <span className="text-[10px] font-bold text-2xl" style={{ color: fearGreedColor }}>{fearGreed}</span>
                        <span className="text-[10px] text-[#4ade9a] font-semibold">Extreme Greed</span>
                    </div>
                </div>
            </div>

            {/* ── Search Bar ── */}
            <div ref={searchRef} className="relative px-4 mt-5">
                <div className="relative flex items-center bg-[#1a2a22] border border-[#2a3d30] rounded-xl py-2 pl-4 pr-3 gap-3 transition-all focus-within:border-[#4ade9a]/50 focus-within:ring-2 focus-within:ring-[#4ade9a]/20">
                    <span className="text-[#a8a8a0] shrink-0">
                        {isSearching ? (
                            <span className="w-4 h-4 block border-2 border-[#a8a8a0] border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        )}
                    </span>
                    <input
                        type="text"
                        placeholder="Search symbol / name..."
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setIsSearchDropdownOpen(true); }}
                        onFocus={() => searchResults.length > 0 && setIsSearchDropdownOpen(true)}
                        className="flex-1 min-w-0 bg-transparent text-[#f0ede8] placeholder-[#a8a8a0] text-sm focus:outline-none"
                    />
                    {searchResults.length > 0 && (
                        <span className="shrink-0 text-[#a8a8a0] text-sm font-medium bg-[#0a120f] border border-[#2a3d30]/50 rounded-full px-3 py-1">
                            {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
                        </span>
                    )}
                </div>
                {isSearchDropdownOpen && (searchResults.length > 0 || (searchQuery.length >= 2 && !isSearching)) && (
                    <div className="absolute top-full left-4 right-4 mt-1 bg-[#111c18] border border-[#2a3d30] rounded-xl overflow-hidden shadow-2xl z-50 max-h-64 overflow-y-auto">
                        {searchResults.length > 0 ? searchResults.map(r => (
                            <button key={r.symbol} type="button"
                                onClick={() => { setSearchQuery(""); setIsSearchDropdownOpen(false); setSearchResults([]); router.push(`/markets/${r.symbol}`); }}
                                className="w-full flex justify-between items-center px-4 py-3 hover:bg-[#1a2a22] text-left transition">
                                <div>
                                    <span className="font-bold text-[#f0ede8]">{r.symbol}</span>
                                    <span className="text-[#a8a8a0] text-sm ml-2">{r.name}</span>
                                </div>
                                <span className="text-[#a8a8a0] text-sm">View →</span>
                            </button>
                        )) : <div className="px-4 py-6 text-center text-[#a8a8a0] text-sm">No results found</div>}
                    </div>
                )}
            </div>

            {/* ── Quick Watchlist ── */}
            <div className="px-4 mt-5">
                <h2 className="text-xs font-bold tracking-widest text-[#a8a8a0] uppercase mb-3">Quick Watch</h2>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {watchlistData.length === 0
                        ? WATCHLIST.map(s => (
                            <div key={s} className="flex flex-col items-center bg-[#111c18] border border-[#2a3d30]/50 rounded-2xl px-4 py-2.5 min-w-[72px] shrink-0 animate-pulse">
                                <span className="font-bold text-sm text-[#f0ede8]">{s}</span>
                                <span className="text-xs text-[#a8a8a0] mt-1">—</span>
                            </div>
                        ))
                        : watchlistData.map(w => (
                            <button key={w.symbol} onClick={() => router.push(`/markets/${w.symbol}`)}
                                className="flex flex-col items-center bg-[#111c18] border border-[#2a3d30]/50 rounded-2xl px-4 py-2.5 min-w-[72px] shrink-0 hover:bg-[#1a2a22] transition-colors">
                                <span className="font-bold text-sm text-[#f0ede8]">{w.symbol}</span>
                                <span className={`text-[11px] font-semibold mt-0.5 ${w.pos ? "text-[#4ade9a]" : "text-red-500"}`}>
                                    {w.pos ? "+" : ""}{w.pct.toFixed(2)}%
                                </span>
                            </button>
                        ))}
                </div>
            </div>

            {/* ── Discovery Lists ── */}
            <div className="px-4 mt-5">
                <h2 className="text-xs font-bold tracking-widest text-[#a8a8a0] uppercase mb-3">High-Velocity Discovery</h2>
                {/* Tab bar */}
                <div className="relative flex rounded-full bg-[#1a2a22] border border-[#2a3d30] p-1 mb-3">
                    {(["gainers", "losers", "volume", "movers"] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setDiscoveryTab(tab)}
                            className={`flex-1 text-xs font-bold py-1.5 rounded-full capitalize transition-all duration-200 ${discoveryTab === tab
                                ? "bg-[#4ade9a] text-[#0a120f]"
                                : "text-[#a8a8a0] hover:text-[#f0ede8]"
                                }`}
                        >
                            {tab === "gainers" ? "↑ Gainers" : tab === "losers" ? "↓ Losers" : tab === "volume" ? "⚡ Volume" : "⬡ Movers"}
                        </button>
                    ))}
                </div>
                <div className="bg-[#111c18] border border-[#2a3d30]/50 rounded-3xl overflow-hidden shadow-lg">
                    {moversLoading ? (
                        [...Array(5)].map((_, i) => (
                            <div key={i} className="flex justify-between items-center px-4 py-3 border-b border-[#2a3d30]/50 last:border-0 animate-pulse">
                                <div className="flex flex-col gap-1.5"><div className="w-12 h-3 bg-[#1a2a22] rounded" /><div className="w-24 h-2.5 bg-[#1a2a22] rounded" /></div>
                                <div className="flex flex-col items-end gap-1.5"><div className="w-14 h-3 bg-[#1a2a22] rounded" /><div className="w-10 h-2.5 bg-[#1a2a22] rounded" /></div>
                            </div>
                        ))
                    ) : (discoveryItems[discoveryTab] || []).length === 0 ? (
                        <div className="px-4 py-8 text-center text-[#a8a8a0] text-sm">No data available</div>
                    ) : (
                        (discoveryItems[discoveryTab] || []).map(item => (
                            <MoverRow key={item.symbol} item={item} router={router} showVol={showVol} />
                        ))
                    )}
                </div>
            </div>

            {/* ── Sector Performance Heatmap ── */}
            <div className="px-4 mt-5">
                <h2 className="text-xs font-bold tracking-widest text-[#a8a8a0] uppercase mb-3">Sector Performance</h2>
                <div className="grid grid-cols-3 gap-2">
                    {(sectors.length === 0 ? Array(11).fill(null) : sectors).map((s, i) =>
                        s === null ? (
                            <div key={i} className="rounded-3xl border border-[#2a3d30]/50 h-16 animate-pulse bg-[#111c18]" />
                        ) : (() => {
                            const { bg, text } = sectorColor(s.changesPercentage);
                            return (
                                <button key={s.symbol} onClick={() => router.push(`/markets/${s.symbol}`)}
                                    className={`flex flex-col items-center justify-center rounded-2xl border p-2.5 h-16 transition-transform hover:scale-105 ${bg}`}>
                                    <span className="text-[11px] font-bold text-[#f0ede8] leading-tight text-center">{s.shortName}</span>
                                    <span className={`text-[13px] font-black mt-0.5 ${text}`}>
                                        {s.changesPercentage >= 0 ? "+" : ""}{s.changesPercentage.toFixed(2)}%
                                    </span>
                                </button>
                            );
                        })()
                    )}
                </div>
            </div>

            {/* ── Events Calendar ── */}
            <div className="px-4 mt-5">
                <h2 className="text-xs font-bold tracking-widest text-[#a8a8a0] uppercase mb-1">Live Events</h2>
                <p className="text-[11px] text-[#a8a8a0] mb-3">{today}</p>

                {/* Earnings */}
                <div className="bg-[#111c18] border border-[#2a3d30]/50 rounded-3xl overflow-hidden mb-3 shadow-lg">
                    <div className="flex border-b border-[#2a3d30]/50">
                        <div className="flex-1 border-r border-[#2a3d30]/50 px-3 py-2">
                            <span className="text-[10px] font-bold text-[#a8a8a0] uppercase tracking-wider">🌅 Before Open</span>
                        </div>
                        <div className="flex-1 px-3 py-2">
                            <span className="text-[10px] font-bold text-[#a8a8a0] uppercase tracking-wider">🌆 After Close</span>
                        </div>
                    </div>
                    <div className="flex">
                        <div className="flex-1 border-r border-[#2a3d30]/50 py-1">
                            {earningsBefore.map(e => (
                                <button key={e.symbol} onClick={() => router.push(`/markets/${e.symbol}`)}
                                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#1a2a22] transition-colors">
                                    <div className="flex flex-col items-start">
                                        <span className="font-bold text-sm text-[#f0ede8]">{e.symbol}</span>
                                        <span className="text-[10px] text-[#a8a8a0]">{e.epsEstimate}</span>
                                    </div>
                                    <span className="text-[10px] text-[#a8a8a0]">EPS est.</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 py-1">
                            {earningsAfter.map(e => (
                                <button key={e.symbol} onClick={() => router.push(`/markets/${e.symbol}`)}
                                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#1a2a22] transition-colors">
                                    <div className="flex flex-col items-start">
                                        <span className="font-bold text-sm text-[#f0ede8]">{e.symbol}</span>
                                        <span className="text-[10px] text-[#a8a8a0]">{e.epsEstimate}</span>
                                    </div>
                                    <span className="text-[10px] text-[#a8a8a0]">EPS est.</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Economic Releases */}
                <div className="bg-[#111c18] border border-[#2a3d30]/50 rounded-3xl overflow-hidden shadow-lg">
                    <div className="px-4 py-2.5 border-b border-[#2a3d30]/50">
                        <span className="text-[10px] font-bold text-[#a8a8a0] uppercase tracking-wider">📊 Economic Releases</span>
                    </div>
                    {economicEvents.map((ev, i) => (
                        <div key={i} className="flex items-center px-4 py-3 border-b border-[#2a3d30]/50 last:border-0 gap-3">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${ev.impact === "high" ? "bg-red-500" : ev.impact === "medium" ? "bg-amber-400" : "bg-[#2a3d30]"}`} />
                            <div className="flex flex-col flex-1 min-w-0">
                                <span className="text-sm font-semibold text-[#f0ede8]">{ev.event}</span>
                                <span className="text-[11px] text-[#a8a8a0]">{ev.time}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-xs text-[#a8a8a0] font-semibold">{ev.forecast}</span>
                                <span className={`text-[10px] capitalize ${ev.impact === "high" ? "text-red-400" : ev.impact === "medium" ? "text-amber-400" : "text-[#a8a8a0]"}`}>{ev.impact}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
}
