"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, addDoc } from "firebase/firestore";
import { getInvestorHypeScore } from "@/app/actions/gemini";
import { getQuote, getChartData, getPriceForDate } from "@/app/actions/fmp";
import { recalculatePortfolioFromTransactions } from "@/app/actions/portfolio";

type TickerItem = { ticker: string; name: string; price: number; diff: string; isPositive: boolean };
type Position = { ticker: string; name: string; shares: number; avgCost: number; costBasis: number; priceAtPurchase?: number };

export default function TickerPage() {
    const params = useParams();
    const router = useRouter();
    const tickerSymbol = (params.ticker as string)?.toUpperCase();
    const [tickerData, setTickerData] = useState<TickerItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
    const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy");
    const [inputMode, setInputMode] = useState<"shares" | "dollars">("shares");
    const [sharesInput, setSharesInput] = useState("1");
    const [dollarsInput, setDollarsInput] = useState("");
    const [isTrading, setIsTrading] = useState(false);
    const [tradeError, setTradeError] = useState("");
    const [tradeSuccess, setTradeSuccess] = useState(false);
    const [userPosition, setUserPosition] = useState<Position | null>(null);
    const [chartPosition, setChartPosition] = useState<Position | null>(null);
    const [chartDisplayBounds, setChartDisplayBounds] = useState<{ min: number; max: number } | null>(null);
    const [activeTimeframe, setActiveTimeframe] = useState("1M");
    const [fullChartData, setFullChartData] = useState<any[]>([]);
    const [historicalChartPath, setHistoricalChartPath] = useState("M 0,40 L 50,50 L 100,40");
    const [chartPriceRange, setChartPriceRange] = useState<{ min: number; max: number } | null>(null);
    const [chartGradientMeanOffset, setChartGradientMeanOffset] = useState<number>(0.5);
    const [chartDateLabels, setChartDateLabels] = useState<string[]>([]);
    const [chartStats, setChartStats] = useState({ open: "-", high: "-", vol: "-", range: "-" });
    const [hypeData, setHypeData] = useState<{ score: number | null; points: string[] } | null>(null);
    const [isHypeLoading, setIsHypeLoading] = useState(false);
    const [isSharingPosition, setIsSharingPosition] = useState(false);
    const [sharePositionSuccess, setSharePositionSuccess] = useState(false);

    // Trade Share Tracking
    const [recentTradeShareState, setRecentTradeShareState] = useState<"pending" | "shared" | "auto-shared" | "none">("none");
    const [recentTradeDetails, setRecentTradeDetails] = useState<any>(null);

    useEffect(() => {
        if (!tickerSymbol) return;
        setLoading(true);
        setNotFound(false);
        getQuote(tickerSymbol).then((quote) => {
            if (!quote) {
                setNotFound(true);
                setLoading(false);
                return;
            }
            const diff = `${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)} (${quote.changesPercentage.toFixed(2)}%)`;
            setTickerData({
                ticker: quote.symbol,
                name: quote.name || quote.symbol,
                price: quote.price,
                diff,
                isPositive: quote.change >= 0,
            });
            setLoading(false);
        });
    }, [tickerSymbol]);

    // Fetch user position for chart (derived from transaction history)
    useEffect(() => {
        if (!tickerData || !auth.currentUser) {
            setChartPosition(null);
            return;
        }
        const fetchChartPosition = async () => {
            const userRef = doc(db, "users", auth.currentUser!.uid);
            const snap = await getDoc(userRef);
            if (snap.exists()) {
                const transactions = snap.data().transactionHistory || [];
                const { portfolio } = await recalculatePortfolioFromTransactions(transactions);
                const pos = portfolio.find((p) => p.ticker === tickerData.ticker);
                if (pos && pos.shares > 0) {
                    setChartPosition(pos);
                } else {
                    setChartPosition(null);
                }
            } else {
                setChartPosition(null);
            }
        };
        fetchChartPosition();
    }, [tickerData, auth.currentUser]);

    useEffect(() => {
        if (!tickerData) return;
        setIsHypeLoading(true);
        setHypeData(null);
        getInvestorHypeScore(tickerData.ticker, tickerData.name).then((data) => {
            setHypeData(data);
            setIsHypeLoading(false);
        });

        const cacheRef = doc(db, "market_cache", `${tickerData.ticker}_daily`);
        getDoc(cacheRef)
            .then((snap) => {
                if (snap.exists() && snap.data().chartData) {
                    setFullChartData(snap.data().chartData);
                } else {
                    getChartData(tickerData.ticker).then((data) => setFullChartData(data));
                }
            })
            .catch(() => getChartData(tickerData.ticker).then((data) => setFullChartData(data)));
    }, [tickerData]);

    useEffect(() => {
        if (!fullChartData || fullChartData.length === 0) return;
        let daysToShow;
        switch (activeTimeframe) {
            case "1W":
                daysToShow = 5;
                break;
            case "1M":
                daysToShow = 21;
                break;
            case "3M":
                daysToShow = 63;
                break;
            case "YTD":
                daysToShow = fullChartData.filter((d) => new Date(d.date).getFullYear() === new Date().getFullYear()).length;
                if (daysToShow === 0) daysToShow = 21;
                break;
            case "1Y":
                daysToShow = 252;
                break;
            case "ALL":
                daysToShow = fullChartData.length;
                break;
            default:
                daysToShow = 21;
        }
        const slicedData = fullChartData.slice(Math.max(fullChartData.length - daysToShow, 0));
        if (slicedData.length > 0) {
            const closes = slicedData.map((d: any) => d.close);
            const isShortTerm = ["1W", "1M", "YTD"].includes(activeTimeframe);
            const hasOHLC = slicedData.every((d: any) => d.open != null && d.high != null && d.low != null);
            const allVals = hasOHLC && isShortTerm ? slicedData.flatMap((d: any) => [d.open, d.high, d.low, d.close]) : closes;
            let min = Math.min(...allVals);
            let max = Math.max(...allVals);
            const range = max - min;
            const paddingFactor = isShortTerm ? 0.55 : 0.25;
            const padding = range > 0 ? range * paddingFactor : min * 0.02 || 1;
            const displayMin = min - padding;
            const displayMax = max + padding;
            const scaleRange = displayMax - displayMin;
            const formatDate = (d: string, tf: string) => {
                const date = new Date(d);
                if (tf === "1W") {
                    return date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
                }
                if (tf === "1M") {
                    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                }
                if (tf === "YTD") {
                    return date.toLocaleDateString("en-US", { month: "short" });
                }
                const month = date.toLocaleDateString("en-US", { month: "short" });
                const year = date.getFullYear().toString().slice(-2);
                return `${month} '${year}`;
            };
            let labelIndices: number[];
            if (activeTimeframe === "1W") {
                labelIndices = slicedData.length <= 7 ? slicedData.map((_, i) => i) : [0, Math.floor(slicedData.length / 4), Math.floor(slicedData.length / 2), Math.floor((3 * slicedData.length) / 4), slicedData.length - 1];
            } else if (activeTimeframe === "1M") {
                labelIndices = [0, Math.floor(slicedData.length * 0.2), Math.floor(slicedData.length * 0.4), Math.floor(slicedData.length * 0.6), Math.floor(slicedData.length * 0.8), slicedData.length - 1];
            } else if (activeTimeframe === "YTD") {
                const monthIndices: number[] = [0];
                let lastMonth = new Date(slicedData[0].date).getMonth();
                slicedData.forEach((d, i) => {
                    const m = new Date(d.date).getMonth();
                    if (m !== lastMonth) {
                        monthIndices.push(i);
                        lastMonth = m;
                    }
                });
                if (slicedData.length - 1 !== monthIndices[monthIndices.length - 1]) monthIndices.push(slicedData.length - 1);
                labelIndices = monthIndices;
            } else {
                labelIndices = [0, Math.floor(slicedData.length * 0.25), Math.floor(slicedData.length * 0.5), Math.floor(slicedData.length * 0.75), slicedData.length - 1];
            }
            const uniqueIndices = [...new Set(labelIndices)].sort((a, b) => a - b);
            setChartDateLabels(uniqueIndices.map((i) => formatDate(slicedData[i].date, activeTimeframe)));
            const toY = (v: number) => 50 - ((v - displayMin) / scaleRange) * 50;
            let path: string;
            if (isShortTerm && hasOHLC) {
                const n = slicedData.length;
                const dayWidth = 100 / n;
                path = `M 0,${toY(slicedData[0].open)}`;
                slicedData.forEach((d: any, idx: number) => {
                    const xBase = idx * dayWidth;
                    path += ` L ${xBase + dayWidth / 4},${toY(d.high)} L ${xBase + dayWidth / 2},${toY(d.low)} L ${xBase + (dayWidth * 3) / 4},${toY(d.close)}`;
                    if (idx < n - 1) path += ` L ${(idx + 1) * dayWidth},${toY(slicedData[idx + 1].open)}`;
                });
                path += ` L 100,${toY(slicedData[n - 1].close)}`;
            } else {
                path = `M 0,${toY(closes[0])}`;
                closes.forEach((val: number, idx: number) => {
                    const x = (idx / Math.max(closes.length - 1, 1)) * 100;
                    path += ` L ${x},${toY(val)}`;
                });
                if (closes.length === 1) path += ` L 100,${toY(closes[0])}`;
            }
            setHistoricalChartPath(path);
            setChartPriceRange({ min, max });
            setChartDisplayBounds({ min: displayMin, max: displayMax });
            const mean = (min + max) / 2;
            const meanY = 50 - ((mean - displayMin) / scaleRange) * 50;
            setChartGradientMeanOffset(Math.max(0.05, Math.min(0.95, meanY / 50)));
            const latest = slicedData[slicedData.length - 1];
            setChartStats({
                open: latest.open.toFixed(2),
                high: latest.high.toFixed(2),
                vol: (latest.volume / 1000000).toFixed(2) + "M",
                range: `${min.toFixed(2)} - ${max.toFixed(2)}`,
            });
        } else {
            setChartPriceRange(null);
            setChartDateLabels([]);
            setChartGradientMeanOffset(0.5);
            setChartDisplayBounds(null);
        }
    }, [activeTimeframe, fullChartData]);

    // Fetch user position when modal opens (derived from transaction history)
    useEffect(() => {
        if (!isTradeModalOpen || !auth.currentUser || !tickerData) return;
        const fetchPosition = async () => {
            const userRef = doc(db, "users", auth.currentUser!.uid);
            const snap = await getDoc(userRef);
            if (snap.exists()) {
                const transactions = snap.data().transactionHistory || [];
                const { portfolio } = await recalculatePortfolioFromTransactions(transactions);
                const pos = portfolio.find((p) => p.ticker === tickerData.ticker);
                setUserPosition(pos && pos.shares > 0 ? pos : null);
            } else {
                setUserPosition(null);
            }
        };
        fetchPosition();
    }, [isTradeModalOpen, tickerData, auth.currentUser]);

    const price = tickerData?.price ?? 0;
    const sharesFromInput = inputMode === "shares"
        ? parseFloat(sharesInput || "0")
        : price > 0 ? parseFloat(dollarsInput || "0") / price : 0;
    const dollarsFromInput = sharesFromInput * price;

    const handleTrade = async () => {
        if (!auth.currentUser || !tickerData) return;
        if (sharesFromInput <= 0) {
            setTradeError("Enter a valid amount.");
            return;
        }
        setIsTrading(true);
        setTradeError("");
        try {
            const userRef = doc(db, "users", auth.currentUser.uid);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
                setTradeError("User not found.");
                setIsTrading(false);
                return;
            }
            const autoShare = userSnap.data().autoShare || false;

            const transactionHistory = userSnap.data().transactionHistory || [];
            const timestamp = new Date().toISOString();
            const execPrice = (await getPriceForDate(tickerData.ticker, timestamp)) ?? price;
            const shares = inputMode === "shares" ? sharesFromInput : parseFloat(dollarsInput || "0") / execPrice;
            const total = shares * execPrice;

            const { portfolio, cashBalance } = await recalculatePortfolioFromTransactions(transactionHistory);
            const pos = portfolio.find((p) => p.ticker === tickerData.ticker);
            const existingShares = pos?.shares ?? 0;

            if (tradeMode === "buy") {
                if (cashBalance < total) {
                    setTradeError("Insufficient funds.");
                    setIsTrading(false);
                    return;
                }
            } else {
                if (existingShares < shares) {
                    setTradeError(`You only have ${existingShares} shares available to sell.`);
                    setIsTrading(false);
                    return;
                }
            }

            const tx = { type: tradeMode, ticker: tickerData.ticker, name: tickerData.name, shares, timestamp };
            await updateDoc(userRef, {
                transactionHistory: [...transactionHistory, tx],
            });

            if (autoShare) {
                // Post to feed
                const feedRef = collection(db, "global_feed");
                const actionText = tradeMode === "buy" ? `purchased ${shares.toLocaleString(undefined, { maximumFractionDigits: 2 })} shares of` : `sold ${shares.toLocaleString(undefined, { maximumFractionDigits: 2 })} shares of`;
                await addDoc(feedRef, {
                    user: {
                        name: auth.currentUser.displayName || "Anonymous",
                        handle: `@${(auth.currentUser.displayName || "user").replace(/\s+/g, '').toLowerCase()}`,
                        avatar: (auth.currentUser.displayName || "A").substring(0, 2).toUpperCase(),
                        color: "bg-blue-500",
                        uid: auth.currentUser.uid
                    },
                    action: actionText,
                    ticker: tickerData.ticker,
                    timestamp: new Date().toISOString(),
                    likes: [],
                    commentsList: [],
                    isPositive: tradeMode === "buy"
                });
                setRecentTradeShareState("auto-shared");
                setTradeSuccess(true);
                setTimeout(() => {
                    closeTradeModalAndRedirect();
                }, 2000);
            } else {
                setRecentTradeShareState("pending");
                setRecentTradeDetails({ tradeMode, shares, ticker: tickerData.ticker });
                setTradeSuccess(true);
            }

        } catch (error) {
            console.error(error);
            setTradeError("Failed to execute trade.");
        }
        setIsTrading(false);
    };

    const closeTradeModalAndRedirect = () => {
        setIsTradeModalOpen(false);
        setTradeSuccess(false);
        setRecentTradeShareState("none");
        setUserPosition(null);
        router.push("/portfolio");
    };

    const handleShareRecentTrade = async () => {
        if (!auth.currentUser || !recentTradeDetails) return;
        setRecentTradeShareState("shared");
        try {
            const feedRef = collection(db, "global_feed");
            const actionText = recentTradeDetails.tradeMode === "buy"
                ? `purchased ${recentTradeDetails.shares.toLocaleString(undefined, { maximumFractionDigits: 2 })} shares of`
                : `sold ${recentTradeDetails.shares.toLocaleString(undefined, { maximumFractionDigits: 2 })} shares of`;

            await addDoc(feedRef, {
                user: {
                    name: auth.currentUser.displayName || "Anonymous",
                    handle: `@${(auth.currentUser.displayName || "user").replace(/\s+/g, '').toLowerCase()}`,
                    avatar: (auth.currentUser.displayName || "A").substring(0, 2).toUpperCase(),
                    color: "bg-blue-500",
                    uid: auth.currentUser.uid
                },
                action: actionText,
                ticker: recentTradeDetails.ticker,
                timestamp: new Date().toISOString(),
                likes: [],
                commentsList: [],
                isPositive: recentTradeDetails.tradeMode === "buy"
            });
            setTimeout(() => {
                closeTradeModalAndRedirect();
            }, 1000);
        } catch (error) {
            console.error("Error sharing trade:", error);
            setRecentTradeShareState("pending");
        }
    };

    const handleSharePosition = async () => {
        if (!auth.currentUser || !tickerData || !chartPosition) return;
        setIsSharingPosition(true);
        try {
            const feedRef = collection(db, "global_feed");
            const profit = (chartPosition.shares * price - chartPosition.costBasis);
            const isProfit = profit >= 0;
            const actionText = `is holding ${chartPosition.shares.toLocaleString(undefined, { maximumFractionDigits: 2 })} shares of`;

            await addDoc(feedRef, {
                user: {
                    name: auth.currentUser.displayName || "Anonymous",
                    handle: `@${(auth.currentUser.displayName || "user").replace(/\s+/g, '').toLowerCase()}`,
                    avatar: (auth.currentUser.displayName || "A").substring(0, 2).toUpperCase(),
                    color: "bg-blue-500", // Defaulting to blue for real users right now
                    uid: auth.currentUser.uid
                },
                action: actionText,
                ticker: tickerData.ticker,
                timestamp: new Date().toISOString(),
                likes: [],
                commentsList: [],
                isPositive: isProfit
            });
            setSharePositionSuccess(true);
            setTimeout(() => setSharePositionSuccess(false), 3000);
        } catch (error) {
            console.error("Error sharing position:", error);
        }
        setIsSharingPosition(false);
    };

    if (!tickerSymbol) return null;
    if (loading) {
        return (
            <div className="flex flex-col w-full min-h-[60vh] items-center justify-center text-zinc-400">
                <div className="w-8 h-8 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p>Loading {tickerSymbol}...</p>
            </div>
        );
    }
    if (notFound || !tickerData) {
        return (
            <div className="flex flex-col w-full min-h-[60vh] items-center justify-center text-zinc-400 gap-4">
                <p>Ticker &quot;{tickerSymbol}&quot; not found.</p>
                <Link href="/markets" className="text-white underline hover:no-underline">
                    ← Back to Markets
                </Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans text-white pb-24 md:pb-8 max-w-2xl mx-auto">
            {/* Header with Back Button */}
            <div className="sticky top-0 bg-black/80 backdrop-blur-xl z-50 px-4 py-4 flex justify-between items-center border-b border-zinc-800">
                <Link
                    href="/markets"
                    className="text-white w-10 h-10 flex items-center justify-center rounded-full bg-zinc-900 hover:bg-zinc-800 transition"
                    aria-label="Back to markets"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>
                <span className="font-bold">{tickerData.ticker}</span>
                <div className="w-10" />
            </div>

            <div className="px-4">
                {/* Ticker Header */}
                <div className="flex flex-col gap-1 mt-6">
                    <h1 className="text-3xl font-bold tracking-tight">{tickerData.name}</h1>
                    <div className="text-4xl font-bold mt-2">${tickerData.price.toFixed(2)}</div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`font-semibold text-sm ${tickerData.isPositive ? "text-[#00c805]" : "text-red-500"}`}>
                            {tickerData.isPositive ? "▲" : "▼"} {tickerData.diff}
                        </span>
                        <span className="text-zinc-400 text-sm">Today</span>
                    </div>
                </div>

                {/* Chart */}
                <div className="w-full mt-8 relative pr-14">
                    {chartPriceRange && (
                        <div className="absolute right-0 top-0 bottom-10 w-12 flex flex-col justify-between py-1 z-20 pointer-events-none text-right">
                            <span className="text-xs font-medium text-zinc-400">
                                ${chartPriceRange.max.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-xs font-medium text-zinc-400">
                                ${chartPriceRange.min.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    )}
                    <div className="h-64">
                        <svg className="w-full h-full relative z-10" viewBox="0 0 100 50" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="tickerChartGradientGreen" x1="0" y1="0" x2="0" y2="50" gradientUnits="userSpaceOnUse">
                                    <stop offset="0%" stopColor="#00c805" stopOpacity="0.35" />
                                    <stop offset={`${chartGradientMeanOffset * 100}%`} stopColor="#00c805" stopOpacity="0.2" />
                                    <stop offset="100%" stopColor="#00c805" stopOpacity="0" />
                                </linearGradient>
                                <linearGradient id="tickerChartGradientRed" x1="0" y1="0" x2="0" y2="50" gradientUnits="userSpaceOnUse">
                                    <stop offset="0%" stopColor="#ff5000" stopOpacity="0.35" />
                                    <stop offset={`${chartGradientMeanOffset * 100}%`} stopColor="#ff5000" stopOpacity="0.2" />
                                    <stop offset="100%" stopColor="#ff5000" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            {[5, 10, 15, 20, 25, 30, 35, 40, 45].map((y) => (
                                <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="0.4" />
                            ))}
                            {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((x) => (
                                <line key={x} x1={x} y1="0" x2={x} y2="50" stroke="rgba(255,255,255,0.05)" strokeWidth="0.3" />
                            ))}
                            <path
                                d={`${historicalChartPath} L 100,50 L 0,50 Z`}
                                fill={tickerData.isPositive ? "url(#tickerChartGradientGreen)" : "url(#tickerChartGradientRed)"}
                                className="transition-all duration-700 ease-in-out"
                            />
                            <path
                                d={historicalChartPath}
                                fill="none"
                                stroke={tickerData.isPositive ? "#00c805" : "#ff5000"}
                                strokeWidth="1.5"
                                vectorEffect="non-scaling-stroke"
                                className="transition-all duration-700 ease-in-out"
                            />
                            {chartPosition && chartPosition.shares > 0 && chartDisplayBounds && (
                                <>
                                    <line
                                        x1="0"
                                        y1={50 - ((chartPosition.avgCost - chartDisplayBounds.min) / (chartDisplayBounds.max - chartDisplayBounds.min)) * 50}
                                        x2="100"
                                        y2={50 - ((chartPosition.avgCost - chartDisplayBounds.min) / (chartDisplayBounds.max - chartDisplayBounds.min)) * 50}
                                        stroke="#a78bfa"
                                        strokeWidth="0.5"
                                        strokeDasharray="2 2"
                                        opacity="0.9"
                                    />
                                    <text
                                        x="2"
                                        y={50 - ((chartPosition.avgCost - chartDisplayBounds.min) / (chartDisplayBounds.max - chartDisplayBounds.min)) * 50 - 1}
                                        fill="#a78bfa"
                                        fontSize="3"
                                        fontWeight="bold"
                                    >
                                        My position (${chartPosition.avgCost.toFixed(2)})
                                    </text>
                                </>
                            )}
                        </svg>
                    </div>
                    {chartDateLabels.length > 0 && (
                        <div className="flex justify-between mt-2 px-0.5 min-h-[20px]">
                            {chartDateLabels.map((label, i) => (
                                <span key={i} className="text-[10px] text-zinc-500 font-medium">
                                    {label}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Timeframe Selector */}
                <div className="flex items-center justify-between px-2 mt-6 mb-2">
                    {["1W", "1M", "3M", "YTD", "1Y", "ALL"].map((tf) => (
                        <button
                            key={tf}
                            onClick={() => setActiveTimeframe(tf)}
                            className={`text-xs font-bold transition-all duration-200 ${activeTimeframe === tf ? "bg-zinc-800 text-white px-3 py-1.5 rounded-full" : "text-zinc-400 hover:text-white px-3 py-1.5"
                                }`}
                        >
                            {tf}
                        </button>
                    ))}
                </div>

                {/* Trade Button */}
                <div className="mt-8">
                    <button
                        onClick={() => {
                            setTradeMode("buy");
                            setInputMode("shares");
                            setSharesInput("1");
                            setDollarsInput("");
                            setTradeError("");
                            setRecentTradeShareState("none");
                            setRecentTradeDetails(null);
                            setIsTradeModalOpen(true);
                        }}
                        className={`w-full py-4 rounded-full font-bold text-lg transition shadow-lg ${tickerData.isPositive
                            ? "bg-[#00c805] hover:bg-[#00e306] text-black shadow-[#00c805]/20"
                            : "bg-[#ff5000] hover:bg-[#ff6a26] text-white shadow-[#ff5000]/20"
                            }`}
                    >
                        Trade {tickerData.ticker}
                    </button>
                </div>

                {/* AI Rundown */}
                <div className="mt-12 mb-8">
                    <div className="bg-gradient-to-br from-[#1a1025] to-[#110c18] border border-purple-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden min-h-[250px]">
                        <h2 className="text-2xl font-serif font-bold text-purple-100 mb-6 flex items-center gap-2">
                            <span className="text-purple-400">✨</span> AI Rundown
                        </h2>
                        {isHypeLoading ? (
                            <div className="flex flex-col items-center justify-center py-8 opacity-70">
                                <div className="w-8 h-8 rounded-full border-t-2 border-r-2 border-purple-500 animate-spin mb-4" />
                                <p className="text-purple-300 text-sm animate-pulse">Analyzing web signals & sentiment...</p>
                            </div>
                        ) : hypeData ? (
                            <div className="flex flex-col gap-6 animate-in fade-in duration-500">
                                <div className="flex flex-col md:flex-row gap-6 items-center">
                                    <div className="flex flex-col items-center p-6 bg-black/40 border border-purple-500/20 rounded-2xl w-full md:w-1/3 shadow-inner">
                                        <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-2 text-center">Investor Hype Score</span>
                                        <div className="relative flex items-center justify-center w-24 h-24">
                                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                                <path className="text-white/5" strokeDasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" stroke="currentColor" strokeWidth="3" fill="none" />
                                                <path
                                                    className={`transition-all duration-1000 ease-out ${hypeData.score && hypeData.score > 60 ? "text-red-500" : hypeData.score && hypeData.score > 40 ? "text-yellow-500" : "text-blue-500"}`}
                                                    strokeDasharray={`${hypeData.score || 0}, 100`}
                                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                    stroke="currentColor"
                                                    strokeWidth="3"
                                                    fill="none"
                                                />
                                            </svg>
                                            <div className="absolute flex items-center justify-center flex-col">
                                                <span className="text-3xl font-bold text-white leading-none">{hypeData.score || "?"}</span>
                                            </div>
                                        </div>
                                        <span
                                            className={`text-sm font-bold mt-4 ${hypeData.score && hypeData.score > 80 ? "text-red-400" : hypeData.score && hypeData.score > 60 ? "text-yellow-400" : "text-blue-400"
                                                }`}
                                        >
                                            {hypeData.score && hypeData.score > 80 ? "Extreme / Meme" : hypeData.score && hypeData.score > 60 ? "High Hype" : hypeData.score && hypeData.score > 40 ? "Moderate Hype" : "Low Hype"}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-4 w-full md:w-2/3">
                                        {hypeData.points.map((point, idx) => (
                                            <div key={idx} className="bg-black/40 border border-white/5 p-4 rounded-2xl flex items-start gap-3">
                                                <span className="text-purple-400 mt-0.5">•</span>
                                                <p className="text-sm text-zinc-200 leading-relaxed font-medium">{point}</p>
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

                {/* Key Statistics */}
                <div className="mt-8">
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

                {/* Your Position (when user holds this ticker) */}
                {chartPosition && chartPosition.shares > 0 && (
                    <div className="mt-8 pb-32">
                        <h2 className="text-xl font-bold mb-4 text-zinc-400">Your Position</h2>
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-zinc-500">Shares</span>
                                <span className="font-bold text-lg">{chartPosition.shares.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-zinc-500">Avg Cost</span>
                                <span className="font-bold">${chartPosition.avgCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-zinc-500">Cost Basis</span>
                                <span className="font-bold">${chartPosition.costBasis.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-zinc-500">Market Value</span>
                                <span className="font-bold">${(chartPosition.shares * price).toFixed(2)}</span>
                            </div>
                            <div className="pt-4 border-t border-zinc-800 flex justify-between items-center">
                                <span className="text-zinc-500">Unrealized P&L</span>
                                <span className={`font-bold ${(chartPosition.shares * price - chartPosition.costBasis) >= 0 ? "text-[#00c805]" : "text-red-500"}`}>
                                    {((chartPosition.shares * price - chartPosition.costBasis) >= 0 ? "+" : "")}
                                    ${(chartPosition.shares * price - chartPosition.costBasis).toFixed(2)}
                                    {" "}
                                    (${chartPosition.costBasis > 0 ? ((chartPosition.shares * price - chartPosition.costBasis) / chartPosition.costBasis * 100).toFixed(2) : "0"}%)
                                </span>
                            </div>

                            {/* Share Position Button */}
                            <div className="pt-4 flex justify-end items-center">
                                {sharePositionSuccess ? (
                                    <span className="text-[#00c805] text-sm font-bold flex items-center gap-1 animate-in fade-in duration-300">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Shared to Feed
                                    </span>
                                ) : (
                                    <button
                                        onClick={handleSharePosition}
                                        disabled={isSharingPosition}
                                        className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-full font-bold flex items-center gap-2 transition disabled:opacity-50"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                        </svg>
                                        {isSharingPosition ? "Sharing..." : "Share to Feed"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {(!chartPosition || chartPosition.shares <= 0) && <div className="pb-32" />}
            </div>

            {/* Trade Modal */}
            {isTradeModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">{tradeMode === "buy" ? "Buy" : "Sell"} {tickerData.ticker}</h3>
                            <button onClick={() => setIsTradeModalOpen(false)} className="text-zinc-400 hover:text-white bg-zinc-800 w-8 h-8 rounded-full flex items-center justify-center">
                                ✕
                            </button>
                        </div>
                        {tradeSuccess ? (
                            <div className="py-8 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-[#00c805]/20 text-[#00c805] rounded-full flex items-center justify-center mb-4 border-2 border-[#00c805]">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h4 className="text-2xl font-bold mb-2">Order Complete</h4>
                                <p className="text-zinc-400 text-sm mb-8">Your {tickerData.ticker} {tradeMode === "buy" ? "purchase" : "sale"} has been executed.</p>

                                {recentTradeShareState === "auto-shared" && (
                                    <div className="text-sm text-[#00c805] font-bold flex items-center gap-2 bg-[#00c805]/10 px-4 py-2 rounded-full mt-2 animate-in slide-in-from-bottom-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                        Automatically shared to feed
                                    </div>
                                )}

                                {recentTradeShareState === "shared" && (
                                    <div className="text-sm text-[#00c805] font-bold flex items-center gap-2 bg-[#00c805]/10 px-4 py-2 rounded-full mt-2 animate-in slide-in-from-bottom-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                        Shared to feed!
                                    </div>
                                )}

                                {recentTradeShareState === "pending" && (
                                    <div className="flex flex-col w-full gap-3 mt-4">
                                        <button
                                            onClick={handleShareRecentTrade}
                                            className="w-full py-3 bg-[#00c805] hover:bg-[#00e306] text-black rounded-xl font-bold transition flex items-center justify-center gap-2"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                            Share Trade to Feed
                                        </button>
                                        <button
                                            onClick={closeTradeModalAndRedirect}
                                            className="w-full py-3 text-zinc-400 hover:text-white bg-zinc-800 rounded-xl font-bold transition"
                                        >
                                            Done
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="flex rounded-full bg-zinc-800 p-1 mb-6">
                                    <button
                                        onClick={() => tradeMode !== "buy" && setTradeMode("buy")}
                                        className={`flex-1 py-2 rounded-full text-sm font-bold transition ${tradeMode === "buy" ? "bg-[#00c805] text-black" : "text-zinc-400 hover:text-white"}`}
                                    >
                                        Buy
                                    </button>
                                    <button
                                        onClick={() => tradeMode !== "sell" && setTradeMode("sell")}
                                        disabled={!userPosition || userPosition.shares <= 0}
                                        className={`flex-1 py-2 rounded-full text-sm font-bold transition ${tradeMode === "sell" ? "bg-red-500 text-white" : "text-zinc-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"}`}
                                    >
                                        Sell
                                    </button>
                                </div>
                                {tradeMode === "sell" && userPosition && (
                                    <div className="mb-4 flex items-center justify-between gap-3 p-3 bg-zinc-800/50 rounded-xl text-sm text-zinc-400">
                                        <span>Shares available: <span className="font-bold text-white">{userPosition.shares}</span></span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setInputMode("shares");
                                                setSharesInput(userPosition.shares.toString());
                                                setDollarsInput("");
                                            }}
                                            className="text-xs font-bold text-red-400 hover:text-red-300 px-3 py-1 rounded-full border border-red-500/50 hover:border-red-400/50 transition"
                                        >
                                            Sell All
                                        </button>
                                    </div>
                                )}
                                <div className="flex justify-between items-center bg-black/50 p-4 rounded-xl mb-4 border border-zinc-800">
                                    <span className="text-zinc-400">Current Price</span>
                                    <span className="font-bold text-lg">${price.toFixed(2)}</span>
                                </div>
                                <div className="flex rounded-full bg-zinc-800 p-1 mb-4">
                                    <button
                                        onClick={() => setInputMode("shares")}
                                        className={`flex-1 py-1.5 rounded-full text-xs font-bold transition ${inputMode === "shares" ? "bg-zinc-600 text-white" : "text-zinc-400 hover:text-white"}`}
                                    >
                                        Shares
                                    </button>
                                    <button
                                        onClick={() => setInputMode("dollars")}
                                        className={`flex-1 py-1.5 rounded-full text-xs font-bold transition ${inputMode === "dollars" ? "bg-zinc-600 text-white" : "text-zinc-400 hover:text-white"}`}
                                    >
                                        Dollars
                                    </button>
                                </div>
                                <div className="mb-6">
                                    {inputMode === "shares" ? (
                                        <>
                                            <label className="block text-sm text-zinc-400 mb-2">Number of Shares</label>
                                            <input
                                                type="number"
                                                value={sharesInput}
                                                onChange={(e) => setSharesInput(e.target.value)}
                                                min="0"
                                                step="0.0001"
                                                className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-2xl font-bold focus:outline-none focus:border-[#00c805] transition"
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <label className="block text-sm text-zinc-400 mb-2">Amount ($)</label>
                                            <input
                                                type="number"
                                                value={dollarsInput}
                                                onChange={(e) => setDollarsInput(e.target.value)}
                                                min="0"
                                                step="0.01"
                                                placeholder="0.00"
                                                className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-2xl font-bold focus:outline-none focus:border-[#00c805] transition"
                                            />
                                        </>
                                    )}
                                </div>
                                <div className="flex justify-between items-center mb-8 px-2">
                                    <span className="text-zinc-400 font-medium">{tradeMode === "buy" ? "Estimated Cost" : "Cashout"}</span>
                                    <span className="font-bold text-xl">${dollarsFromInput.toFixed(2)}</span>
                                </div>
                                {inputMode === "dollars" && sharesFromInput > 0 && (
                                    <div className="mb-4 px-2 text-sm text-zinc-500">≈ {sharesFromInput.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares</div>
                                )}
                                {tradeError && <div className="text-red-500 text-sm mb-4 px-2 font-medium">{tradeError}</div>}
                                <button
                                    onClick={handleTrade}
                                    disabled={isTrading || sharesFromInput <= 0}
                                    className={`w-full py-4 rounded-2xl font-bold text-lg transition disabled:opacity-50 ${tradeMode === "buy"
                                        ? "bg-[#00c805] hover:bg-[#00e306] text-black"
                                        : "bg-red-500 hover:bg-red-600 text-white"
                                        }`}
                                >
                                    {isTrading ? "Processing..." : `${tradeMode === "buy" ? "Buy" : "Sell"} ${tickerData.ticker}`}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
