"use client";

import AutoScroll from "embla-carousel-auto-scroll";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";

// Top S&P 500 companies with their ticker, name, and brand color accent
const SP500_COMPANIES = [
    { id: "AAPL", name: "Apple", ticker: "AAPL", accent: "#a2aaad" },
    { id: "MSFT", name: "Microsoft", ticker: "MSFT", accent: "#737373" },
    { id: "NVDA", name: "NVIDIA", ticker: "NVDA", accent: "#76b900" },
    { id: "AMZN", name: "Amazon", ticker: "AMZN", accent: "#ff9900" },
    { id: "GOOGL", name: "Alphabet", ticker: "GOOGL", accent: "#4285f4" },
    { id: "META", name: "Meta", ticker: "META", accent: "#0082fb" },
    { id: "TSLA", name: "Tesla", ticker: "TSLA", accent: "#e82127" },
    { id: "BRK", name: "Berkshire", ticker: "BRK.B", accent: "#9e8c6b" },
    { id: "LLY", name: "Eli Lilly", ticker: "LLY", accent: "#e3001b" },
    { id: "JPM", name: "JPMorgan", ticker: "JPM", accent: "#005eb8" },
    { id: "V", name: "Visa", ticker: "V", accent: "#1434cb" },
    { id: "UNH", name: "UnitedHealth", ticker: "UNH", accent: "#002677" },
    { id: "XOM", name: "ExxonMobil", ticker: "XOM", accent: "#e00000" },
    { id: "WMT", name: "Walmart", ticker: "WMT", accent: "#0071ce" },
    { id: "MA", name: "Mastercard", ticker: "MA", accent: "#eb001b" },
    { id: "AVGO", name: "Broadcom", ticker: "AVGO", accent: "#cc0000" },
    { id: "PG", name: "P&G", ticker: "PG", accent: "#003399" },
    { id: "JNJ", name: "J&J", ticker: "JNJ", accent: "#d61f26" },
    { id: "HD", name: "Home Depot", ticker: "HD", accent: "#f96302" },
    { id: "COST", name: "Costco", ticker: "COST", accent: "#005dab" },
];

export function SmpCarousel() {
    return (
        <div className="relative w-full overflow-hidden">
            {/* Fade edges */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-16 z-10 bg-gradient-to-r from-black to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-16 z-10 bg-gradient-to-l from-black to-transparent" />

            <Carousel
                opts={{ loop: true }}
                plugins={[AutoScroll({ playOnInit: true, speed: 1.2, stopOnInteraction: false })]}
                className="w-full"
            >
                <CarouselContent className="ml-0 items-center">
                    {SP500_COMPANIES.map((co) => (
                        <CarouselItem
                            key={co.id}
                            className="pl-0 basis-1/3 sm:basis-1/4 md:basis-1/5 lg:basis-[12%]"
                        >
                            <div className="mx-3 flex items-center justify-center">
                                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#111] border border-zinc-800 hover:border-zinc-600 transition-colors group">
                                    {/* Dot accent */}
                                    <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: co.accent }}
                                    />
                                    <div className="flex flex-col leading-none">
                                        <span className="text-[11px] font-bold text-white tracking-tight whitespace-nowrap">
                                            {co.name}
                                        </span>
                                        <span className="text-[9px] text-zinc-500 font-mono tracking-wider uppercase">
                                            {co.ticker}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </CarouselItem>
                    ))}
                </CarouselContent>
            </Carousel>
        </div>
    );
}
