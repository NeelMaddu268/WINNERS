'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Home() {
    const [candleData, setCandleData] = useState<any[]>([]);
    useEffect(() => {
        // Generate candlestick data only on client
        setCandleData(
            Array.from({ length: 60 }, (_, i) => ({
                high: Math.random() * 40 + 50,
                low: Math.random() * 30 + 40,
                open: Math.random() * 35 + 45,
                close: Math.random() * 35 + 45,
            }))
        );
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0d1a14] via-[#111c18] to-[#0d1f1a] text-[#f0ede8] overflow-hidden" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\\"100\\" height=\\"100\\" xmlns=\\"http://www.w3.org/2000/svg\\"%3E%3Cfilter id=\\"noise\\"%3E%3CfeTurbulence type=\\"fractalNoise\\" baseFrequency=\\"0.9\\" numOctaves=\\"4\\" /%3E%3C/filter%3E%3Crect width=\\"100\\" height=\\"100\\" filter=\\"url(%23noise)\\" opacity=\\"0.03\\"/>%3C/svg%3E")', backgroundSize: '100px 100px' }}>
            {/* Subtle radial gradient glow */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[#4ade9a]/5 rounded-full blur-3xl"></div>
            </div>

            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 bg-[#0d1a14]/80 backdrop-blur-md border-b border-[#2a3d30]/50">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-[#4ade9a] rounded-lg flex items-center justify-center">
                            <span className="text-[#0d1a14] font-bold text-sm">C</span>
                        </div>
                        <span className="font-semibold text-lg tracking-tight">CashMere</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <Link href="/login" className="text-sm text-[#a8a8a0] hover:text-[#4ade9a] transition">
                            Sign In
                        </Link>
                        <Link href="/login" className="px-6 py-2 bg-[#4ade9a] hover:bg-[#22c55e] text-[#0d1a14] rounded-full text-sm font-semibold transition">
                            Get Started
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <div className="relative pt-32 pb-0 px-6 min-h-screen flex flex-col items-center justify-center">
                {/* Vertical frame lines */}
                <div className="absolute left-0 top-1/4 bottom-0 w-px bg-gradient-to-b from-[#4ade9a]/20 to-transparent"></div>
                <div className="absolute right-0 top-1/4 bottom-0 w-px bg-gradient-to-b from-[#4ade9a]/20 to-transparent"></div>

                {/* Vertical hairline grid */}
                <div className="absolute inset-0 pointer-events-none opacity-5">
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div
                            key={i}
                            className="absolute top-0 bottom-0 w-px bg-[#4ade9a]"
                            style={{ left: `${(i + 1) * 5}%` }}
                        ></div>
                    ))}
                </div>

                <div className="relative max-w-4xl mx-auto w-full text-center z-10">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a2a22] border border-[#2a3d30] rounded-full mb-8">
                        <div className="w-2 h-2 bg-[#4ade9a] rounded-full"></div>
                        <span className="text-xs text-[#a8a8a0] font-medium">Smart Investing</span>
                    </div>

                    {/* Main Heading - Editorial serif style */}
                    <h1 className="text-6xl md:text-7xl font-serif font-bold mb-6 leading-tight text-[#f0ede8]" style={{ fontFamily: 'Playfair Display, serif' }}>
                        Invest with
                        <br />
                        Confidence
                    </h1>

                    {/* Subheading */}
                    <p className="text-lg text-[#a8a8a0] mb-10 max-w-2xl mx-auto leading-relaxed" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                        Build wealth with institutional-grade tools, real-time insights, and a platform designed for serious investors.
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
                        <Link href="/login" className="px-8 py-3 bg-[#4ade9a] hover:bg-[#22c55e] text-[#0d1a14] rounded-full font-semibold transition transform hover:scale-105">
                            Get Started
                        </Link>
                        <button className="px-8 py-3 border border-[#2a3d30] hover:border-[#4ade9a] text-[#f0ede8] rounded-full font-semibold transition flex items-center gap-2 group">
                            Explore
                            <span className="group-hover:translate-x-1 transition">→</span>
                        </button>
                    </div>
                </div>

                {/* Candlestick Chart Hero Background */}
                <div className="absolute bottom-0 left-0 right-0 h-96 flex items-end justify-center gap-1 px-6 pb-8">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#4ade9a]/10 via-transparent to-transparent"></div>
                    <div className="relative w-full max-w-4xl h-full flex items-end justify-center gap-1">
                        {candleData.map((candle: any, idx: number) => {
                            const wickHeight = candle.high - candle.low;
                            const bodyHeight = Math.abs(candle.close - candle.open);
                            const bodyTop = Math.min(candle.open, candle.close) - candle.low;
                            const maxHeight = 100;

                            return (
                                <div key={idx} className="flex-1 flex flex-col items-center justify-end relative group">
                                    {/* Wick */}
                                    <div
                                        className="w-0.5 bg-[#4ade9a]/40 group-hover:bg-[#4ade9a]/80 transition"
                                        style={{ height: `${(wickHeight / 50) * maxHeight}px` }}
                                    ></div>
                                    {/* Body */}
                                    <div
                                        className={`w-2 ${candle.close >= candle.open ? 'bg-[#4ade9a]' : 'bg-[#4ade9a]/30'} group-hover:bg-[#4ade9a] transition`}
                                        style={{ height: `${Math.max((bodyHeight / 50) * maxHeight, 2)}px` }}
                                    ></div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Chat bubble */}
            <div className="fixed bottom-8 right-8 w-16 h-16 bg-[#4ade9a] hover:bg-[#22c55e] rounded-full flex items-center justify-center cursor-pointer transition transform hover:scale-110 shadow-lg shadow-[#4ade9a]/20 z-40">
                <span className="text-2xl text-[#0d1a14]">💬</span>
            </div>
        </div>
    );
}