"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";

export default function Navbar() {
    const pathname = usePathname();
    const [pillStyle, setPillStyle] = useState<{ left: number; width: number } | null>(null);
    const [hasAnimated, setHasAnimated] = useState(false);
    const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);

    const links = [
        { href: "/portfolio", label: "Portfolio" },
        { href: "/markets", label: "Markets" },
        { href: "/social", label: "Feed" },
        { href: "/friends", label: "Friends" },
        { href: "/settings", label: "Settings" },
    ];

    const activeIndex = Math.max(0, links.findIndex(l => l.href === pathname));

    const measure = () => {
        const el = tabRefs.current[activeIndex];
        if (el) setPillStyle({ left: el.offsetLeft, width: el.offsetWidth });
    };

    // Measure on mount and on active tab change
    useEffect(() => {
        // Wait one frame for refs to be laid out
        const id = requestAnimationFrame(() => {
            measure();
            // Trigger the open animation after a short delay so the pill renders first
            setTimeout(() => setHasAnimated(true), 30);
        });
        return () => cancelAnimationFrame(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeIndex]);

    useEffect(() => {
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeIndex]);

    return (
        <>
            {/* Keyframe for the pill expand-from-center animation */}
            <style>{`
                @keyframes pillExpand {
                    0%   { transform: scaleX(0); opacity: 0; }
                    60%  { transform: scaleX(1.08); opacity: 1; }
                    100% { transform: scaleX(1); opacity: 1; }
                }
                .pill-enter {
                    animation: pillExpand 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                    transform-origin: center;
                }
            `}</style>

            <nav className="fixed top-0 w-full z-50 flex items-center justify-center pt-4 pointer-events-none">
                <div className="pointer-events-auto flex items-center bg-[#0d1612]/90 backdrop-blur-xl border border-[#2a3d30]/60 rounded-full px-1.5 py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] relative">

                    {/* Logo */}
                    <Link href="/portfolio" className="flex items-center gap-2 pl-2 pr-4 shrink-0">
                        <div className="w-7 h-7 bg-[#4ade9a] rounded-lg flex items-center justify-center">
                            <span className="text-[#0d1a14] font-bold text-xs">C</span>
                        </div>
                        <span className="font-semibold text-sm tracking-tight text-[#f0ede8] hidden sm:block">CashMere</span>
                    </Link>

                    {/* Divider */}
                    <div className="w-px h-5 bg-[#2a3d30]/60 mx-1 shrink-0" />

                    {/* Tabs + sliding pill */}
                    <div className="relative flex items-center">
                        {/* Active pill */}
                        {pillStyle && (
                            <div
                                className={`absolute inset-y-0 rounded-full bg-[#4ade9a]/15 border border-[#4ade9a]/30 ${!hasAnimated ? "pill-enter" : ""}`}
                                style={{
                                    left: pillStyle.left,
                                    width: pillStyle.width,
                                    // After initial animation, slide smoothly between tabs
                                    transition: hasAnimated
                                        ? "left 280ms cubic-bezier(0.4,0,0.2,1), width 280ms cubic-bezier(0.4,0,0.2,1)"
                                        : undefined,
                                }}
                            />
                        )}

                        {links.map((link, i) => {
                            const isActive = activeIndex === i;
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    ref={el => { tabRefs.current[i] = el; }}
                                    className={`relative z-10 px-5 py-2 text-sm font-medium rounded-full transition-colors duration-200 whitespace-nowrap select-none ${isActive ? "text-[#4ade9a]" : "text-[#a8a8a0] hover:text-[#f0ede8]"
                                        }`}
                                >
                                    {link.label}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </nav>
        </>
    );
}