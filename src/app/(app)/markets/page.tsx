"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { searchTickers, getMarketIndex, getTopGainersLosers, getVolumeLeaders, getSectorPerformance, getEarningsCalendar, getEconomicCalendar, getBatchQuotes } from "@/app/actions/market";

// ─── Types ────────────────────────────────────────────────────
type IndexCard = { label: string; symbol: string; price: number; change: number; pct: number; path: string };
type MoverItem = { symbol: string; name: string; price: number; change: number; changesPercentage: number; volume: number };
type SectorItem = { symbol: string; name: string; shortName: string; price: number; change: number; changesPercentage: number };
type EarningItem = { symbol: string; name: string; epsEstimate: string };
type EconomicEvent = { time: string; event: string; impact: "high" | "medium" | "low"; forecast: string };

// ─── Helpers ──────────────────────────────────────────────────
function randomSparkPath(): string {
    const pts: { x: number; y: number }[] = [{ x: 0, y: 25 + Math.random() * 20 }];
    for (let i = 1; i <= 16; i++) {
        const prev = pts[i - 1].y;
        pts.push({ x: i * 6.25, y: Math.max(5, Math.min(45, prev + (Math.random() - 0.48) * 12)) });
    }
    return `M ${pts[0].x},${pts[0].y}` + pts.slice(1).map(p => ` L ${p.x},${p.y}`).join("");
}

function fmtVol(n: number): string {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
    return String(n);
}

function sectorColor(pct: number): { bg: string; text: string } {
    if (pct >= 2) return { bg: "bg-[#00c805]/20 border-[#00c805]/30", text: "text-[#00c805]" };
    if (pct > 0) return { bg: "bg-[#00c805]/10 border-[#00c805]/15", text: "text-[#00c805]/80" };
    if (pct > -2) return { bg: "bg-red-500/10 border-red-500/15", text: "text-red-400/80" };
    return { bg: "bg-red-500/20 border-red-500/30", text: "text-red-500" };
}

const WATCHLIST = ["NVDA", "AAPL", "TSLA", "AMZN", "MSFT", "GOOGL", "META"];

// ─── Sub-components ───────────────────────────────────────────
function IndexCardComponent({ card }: { card: IndexCard }) {
    const pos = card.pct >= 0;
    const stroke = pos ? "#00c805" : "#ef4444";
    const fillId = `grad-${card.symbol}`;
    return (
        <div className="flex-1 min-w-0 bg-[#111] border border-zinc-800 rounded-2xl p-3 flex flex-col gap-1">
            <span className="text-[11px] font-bold text-zinc-500 tracking-wider uppercase">{card.label}</span>
            <span className="text-lg font-bold leading-tight">
                {card.price > 0 ? card.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
            </span>
            <span className={`text-[11px] font-semibold ${pos ? "text-[#00c805]" : "text-red-500"}`}>
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
            className="flex items-center px-4 py-3 hover:bg-zinc-800/50 cursor-pointer transition-colors border-b border-zinc-800 last:border-0 group"
        >
            <div className="flex flex-col flex-1 min-w-0">
                <span className="font-bold text-sm">{item.symbol}</span>
                <span className="text-xs text-zinc-500 truncate">{item.name}</span>
                {showVol && <span className="text-[11px] text-zinc-600 mt-0.5">Vol: {fmtVol(item.volume)}</span>}
            </div>
            <div className="flex flex-col items-end mr-3">
                <span className="font-semibold text-sm">${item.price.toFixed(2)}</span>
                <span className={`text-xs font-bold ${pos ? "text-[#00c805]" : "text-red-500"}`}>
                    {pos ? "+" : ""}{item.changesPercentage.toFixed(2)}%
                </span>
            </div>
            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                <button
                    onClick={() => router.push(`/markets/${item.symbol}`)}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[#00c805]/15 text-[#00c805] border border-[#00c805]/30 hover:bg-[#00c805]/30 transition-colors"
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
        { label: "S&P 500", symbol: "SPY", price: 0, change: 0, pct: 0, path: randomSparkPath() },
        { label: "Nasdaq", symbol: "QQQ", price: 0, change: 0, pct: 0, path: randomSparkPath() },
        { label: "Dow Jones", symbol: "DIA", price: 0, change: 0, pct: 0, path: randomSparkPath() },
    ]);

    // Breadth (simulated)
    const [breadth] = useState({ up: 2645, down: 1189 });
    const breadthTotal = breadth.up + breadth.down;

    // Discovery tab
    const [discoveryTab, setDiscoveryTab] = useState<"gainers" | "losers" | "volume" | "gaps">("gainers");
    const [gainers, setGainers] = useState<MoverItem[]>([]);
    const [losers, setLosers] = useState<MoverItem[]>([]);
    const [volumeLeaders, setVolumeLeaders] = useState<MoverItem[]>([]);
    const [gaps, setGaps] = useState<MoverItem[]>([]);
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
    const fearGreedColor = fearGreed >= 55 ? "#00c805" : fearGreed >= 45 ? "#f59e0b" : "#ef4444";

    const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    const discoveryItems = { gainers, losers, volume: volumeLeaders, gaps } as Record<string, MoverItem[]>;
    const showVol = discoveryTab === "volume";

    // ── Data loading ──────────────────────────────────────────
    useEffect(() => {
        // Big Three indices
        Promise.all([getMarketIndex("SPY"), getMarketIndex("QQQ"), getMarketIndex("DIA")]).then(([spy, qqq, dia]) => {
            setIndices([
                { label: "S&P 500", symbol: "SPY", price: spy.price, change: spy.change, pct: spy.changesPercentage, path: randomSparkPath() },
                { label: "Nasdaq", symbol: "QQQ", price: qqq.price, change: qqq.change, pct: qqq.changesPercentage, path: randomSparkPath() },
                { label: "Dow Jones", symbol: "DIA", price: dia.price, change: dia.change, pct: dia.changesPercentage, path: randomSparkPath() },
            ]);
        });

        // Movers
        Promise.all([getTopGainersLosers(), getVolumeLeaders()]).then(([gl, vol]) => {
            setGainers(gl.gainers);
            setLosers(gl.losers);
            setVolumeLeaders(vol);
            // Gaps: movers with |pct| > 2
            const allMovers = [...gl.gainers, ...gl.losers, ...vol];
            const seen = new Set<string>();
            const gapList = allMovers.filter(m => {
                if (Math.abs(m.changesPercentage) >= 2 && !seen.has(m.symbol)) { seen.add(m.symbol); return true; }
                return false;
            }).sort((a, b) => Math.abs(b.changesPercentage) - Math.abs(a.changesPercentage));
            setGaps(gapList);
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
        getBatchQuotes(WATCHLIST).then((data: any[]) => {
            setWatchlistData(WATCHLIST.map(sym => {
                const q = data.find((x: any) => x.symbol === sym);
                return { symbol: sym, price: q?.price ?? 0, pct: q?.changesPercentage ?? 0, pos: (q?.changesPercentage ?? 0) >= 0 };
            }));
        });
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
        <div className="flex flex-col w-full animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans text-white pb-24 md:pb-8 max-w-2xl mx-auto gap-0">

            {/* ── Data Freshness Badge ── */}
            <div className="flex items-center justify-end px-4 mt-1 mb-1">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded-full px-2.5 py-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Data delayed 15 min
                </span>
            </div>

            {/* ── Big Three Indices ── */}
            <div className="px-4 mt-2">
                <h2 className="text-xs font-bold tracking-widest text-zinc-500 uppercase mb-3">Market Overview</h2>
                <div className="flex gap-2.5">
                    {indices.map(c => <IndexCardComponent key={c.symbol} card={c} />)}
                </div>
            </div>

            {/* ── Market Breadth ── */}
            <div className="px-4 mt-4">
                <div className="bg-[#111] border border-zinc-800 rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold tracking-widest text-zinc-500 uppercase">Market Breadth</span>
                        <span className="text-xs text-zinc-500">Advance / Decline</span>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-[#00c805] text-sm">↑ {breadth.up.toLocaleString()}</span>
                        <span className="text-zinc-600 text-xs">vs</span>
                        <span className="font-bold text-red-500 text-sm">↓ {breadth.down.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-red-500/20">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-[#00c805] to-[#00e306] transition-all duration-700"
                            style={{ width: `${(breadth.up / breadthTotal) * 100}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-zinc-600">{((breadth.up / breadthTotal) * 100).toFixed(0)}% advancing</span>
                        <span className="text-[10px] text-zinc-600">{((breadth.down / breadthTotal) * 100).toFixed(0)}% declining</span>
                    </div>
                </div>
            </div>

            {/* ── Fear & Greed ── */}
            <div className="px-4 mt-4">
                <div className="bg-[#111] border border-zinc-800 rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-xs font-bold tracking-widest text-zinc-500 uppercase">Fear &amp; Greed Index</span>
                        <span className="text-xs font-bold" style={{ color: fearGreedColor }}>{fearGreedLabel}</span>
                    </div>
                    <div className="relative w-full h-3 rounded-full bg-gradient-to-r from-red-600 via-amber-400 to-[#00c805]">
                        <div
                            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg shadow-black/50 transition-all duration-700"
                            style={{ left: `calc(${fearGreed}% - 8px)`, backgroundColor: fearGreedColor }}
                        />
                    </div>
                    <div className="flex justify-between mt-1.5">
                        <span className="text-[10px] text-red-500 font-semibold">Extreme Fear</span>
                        <span className="text-[10px] font-bold text-2xl" style={{ color: fearGreedColor }}>{fearGreed}</span>
                        <span className="text-[10px] text-[#00c805] font-semibold">Extreme Greed</span>
                    </div>
                </div>
            </div>

            {/* ── Search Bar ── */}
            <div ref={searchRef} className="relative px-4 mt-5">
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
                        placeholder="Search symbol / name..."
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setIsSearchDropdownOpen(true); }}
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
                        {searchResults.length > 0 ? searchResults.map(r => (
                            <button key={r.symbol} type="button"
                                onClick={() => { setSearchQuery(""); setIsSearchDropdownOpen(false); setSearchResults([]); router.push(`/markets/${r.symbol}`); }}
                                className="w-full flex justify-between items-center px-4 py-3 hover:bg-zinc-800 text-left transition">
                                <div>
                                    <span className="font-bold">{r.symbol}</span>
                                    <span className="text-zinc-500 text-sm ml-2">{r.name}</span>
                                </div>
                                <span className="text-zinc-400 text-sm">View →</span>
                            </button>
                        )) : <div className="px-4 py-6 text-center text-zinc-500 text-sm">No results found</div>}
                    </div>
                )}
            </div>

            {/* ── Quick Watchlist ── */}
            <div className="px-4 mt-5">
                <h2 className="text-xs font-bold tracking-widest text-zinc-500 uppercase mb-3">Quick Watch</h2>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {watchlistData.length === 0
                        ? WATCHLIST.map(s => (
                            <div key={s} className="flex flex-col items-center bg-[#111] border border-zinc-800 rounded-2xl px-4 py-2.5 min-w-[72px] shrink-0 animate-pulse">
                                <span className="font-bold text-sm">{s}</span>
                                <span className="text-xs text-zinc-600 mt-1">—</span>
                            </div>
                        ))
                        : watchlistData.map(w => (
                            <button key={w.symbol} onClick={() => router.push(`/markets/${w.symbol}`)}
                                className="flex flex-col items-center bg-[#111] border border-zinc-800 rounded-2xl px-4 py-2.5 min-w-[72px] shrink-0 hover:bg-zinc-800 transition-colors">
                                <span className="font-bold text-sm">{w.symbol}</span>
                                <span className={`text-[11px] font-semibold mt-0.5 ${w.pos ? "text-[#00c805]" : "text-red-500"}`}>
                                    {w.pos ? "+" : ""}{w.pct.toFixed(2)}%
                                </span>
                            </button>
                        ))}
                </div>
            </div>

            {/* ── Discovery Lists ── */}
            <div className="px-4 mt-5">
                <h2 className="text-xs font-bold tracking-widest text-zinc-500 uppercase mb-3">High-Velocity Discovery</h2>
                {/* Tab bar */}
                <div className="flex gap-1 bg-[#111] border border-zinc-800 rounded-xl p-1 mb-3">
                    {(["gainers", "losers", "volume", "gaps"] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setDiscoveryTab(tab)}
                            className={`flex-1 text-xs font-bold py-1.5 rounded-lg capitalize transition-all duration-200 ${discoveryTab === tab
                                ? "bg-zinc-700 text-white"
                                : "text-zinc-500 hover:text-zinc-300"
                                }`}
                        >
                            {tab === "gainers" ? "↑ Gainers" : tab === "losers" ? "↓ Losers" : tab === "volume" ? "⚡ Volume" : "⬡ Gaps"}
                        </button>
                    ))}
                </div>
                <div className="bg-[#111] border border-zinc-800 rounded-2xl overflow-hidden">
                    {moversLoading ? (
                        [...Array(5)].map((_, i) => (
                            <div key={i} className="flex justify-between items-center px-4 py-3 border-b border-zinc-800 last:border-0 animate-pulse">
                                <div className="flex flex-col gap-1.5"><div className="w-12 h-3 bg-zinc-800 rounded" /><div className="w-24 h-2.5 bg-zinc-800 rounded" /></div>
                                <div className="flex flex-col items-end gap-1.5"><div className="w-14 h-3 bg-zinc-800 rounded" /><div className="w-10 h-2.5 bg-zinc-800 rounded" /></div>
                            </div>
                        ))
                    ) : (discoveryItems[discoveryTab] || []).length === 0 ? (
                        <div className="px-4 py-8 text-center text-zinc-600 text-sm">No data available</div>
                    ) : (
                        (discoveryItems[discoveryTab] || []).map(item => (
                            <MoverRow key={item.symbol} item={item} router={router} showVol={showVol} />
                        ))
                    )}
                </div>
            </div>

            {/* ── Sector Performance Heatmap ── */}
            <div className="px-4 mt-5">
                <h2 className="text-xs font-bold tracking-widest text-zinc-500 uppercase mb-3">Sector Performance</h2>
                <div className="grid grid-cols-3 gap-2">
                    {(sectors.length === 0 ? Array(11).fill(null) : sectors).map((s, i) =>
                        s === null ? (
                            <div key={i} className="rounded-2xl border border-zinc-800 h-16 animate-pulse bg-zinc-900" />
                        ) : (() => {
                            const { bg, text } = sectorColor(s.changesPercentage);
                            return (
                                <button key={s.symbol} onClick={() => router.push(`/markets/${s.symbol}`)}
                                    className={`flex flex-col items-center justify-center rounded-2xl border p-2.5 h-16 transition-transform hover:scale-105 ${bg}`}>
                                    <span className="text-[11px] font-bold text-white/90 leading-tight text-center">{s.shortName}</span>
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
                <h2 className="text-xs font-bold tracking-widest text-zinc-500 uppercase mb-1">Live Events</h2>
                <p className="text-[11px] text-zinc-600 mb-3">{today}</p>

                {/* Earnings */}
                <div className="bg-[#111] border border-zinc-800 rounded-2xl overflow-hidden mb-3">
                    <div className="flex border-b border-zinc-800">
                        <div className="flex-1 border-r border-zinc-800 px-3 py-2">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">🌅 Before Open</span>
                        </div>
                        <div className="flex-1 px-3 py-2">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">🌆 After Close</span>
                        </div>
                    </div>
                    <div className="flex">
                        <div className="flex-1 border-r border-zinc-800 py-1">
                            {earningsBefore.map(e => (
                                <button key={e.symbol} onClick={() => router.push(`/markets/${e.symbol}`)}
                                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-800/50 transition-colors">
                                    <div className="flex flex-col items-start">
                                        <span className="font-bold text-sm">{e.symbol}</span>
                                        <span className="text-[10px] text-zinc-500">{e.epsEstimate}</span>
                                    </div>
                                    <span className="text-[10px] text-zinc-500">EPS est.</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 py-1">
                            {earningsAfter.map(e => (
                                <button key={e.symbol} onClick={() => router.push(`/markets/${e.symbol}`)}
                                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-zinc-800/50 transition-colors">
                                    <div className="flex flex-col items-start">
                                        <span className="font-bold text-sm">{e.symbol}</span>
                                        <span className="text-[10px] text-zinc-500">{e.epsEstimate}</span>
                                    </div>
                                    <span className="text-[10px] text-zinc-500">EPS est.</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Economic Releases */}
                <div className="bg-[#111] border border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-zinc-800">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">📊 Economic Releases</span>
                    </div>
                    {economicEvents.map((ev, i) => (
                        <div key={i} className="flex items-center px-4 py-3 border-b border-zinc-800 last:border-0 gap-3">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${ev.impact === "high" ? "bg-red-500" : ev.impact === "medium" ? "bg-amber-400" : "bg-zinc-600"}`} />
                            <div className="flex flex-col flex-1 min-w-0">
                                <span className="text-sm font-semibold">{ev.event}</span>
                                <span className="text-[11px] text-zinc-500">{ev.time}</span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="text-xs text-zinc-400 font-semibold">{ev.forecast}</span>
                                <span className={`text-[10px] capitalize ${ev.impact === "high" ? "text-red-400" : ev.impact === "medium" ? "text-amber-400" : "text-zinc-600"}`}>{ev.impact}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
}
