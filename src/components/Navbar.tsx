"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useEffect, useState } from "react";

const links = [
    { href: "/portfolio", label: "Portfolio" },
    { href: "/markets", label: "Markets" },
    { href: "/social", label: "Feed" },
    { href: "/friends", label: "Friends" },
    { href: "/settings", label: "Settings" },
];

export default function Navbar() {
    const pathname = usePathname();
    const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
    const [pill, setPill] = useState<{ left: number; width: number } | null>(null);

    const activeIdx = Math.max(0, links.findIndex(l => l.href === pathname));

    useEffect(() => {
        const el = tabRefs.current[activeIdx];
        if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
    }, [activeIdx]);

    useEffect(() => {
        const update = () => {
            const el = tabRefs.current[activeIdx];
            if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth });
        };
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, [activeIdx]);

    return (
        <nav className="fixed top-0 w-full z-50 flex items-center justify-center pt-4 pointer-events-none">
            <div className="pointer-events-auto flex items-center bg-[#0d1612]/90 backdrop-blur-xl border border-[#2a3d30]/60 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)] px-2 py-2 gap-0">

                {/* Logo */}
                <Link href="/portfolio" className="flex items-center gap-2 pl-1 pr-4 shrink-0">
                    <div className="w-7 h-7 bg-[#4ade9a] rounded-lg flex items-center justify-center">
                        <span className="text-[#0d1a14] font-bold text-xs">C</span>
                    </div>
                    <span className="font-semibold text-sm tracking-tight text-[#f0ede8] hidden sm:block">CashMere</span>
                </Link>

                {/* Divider */}
                <div className="w-px h-5 bg-[#2a3d30]/60 mr-2 shrink-0" />

                {/* Tabs */}
                <div className="relative flex items-center">
                    {/* Sliding pill */}
                    {pill && (
                        <span
                            className="absolute inset-y-0 rounded-full bg-[#4ade9a] pointer-events-none"
                            style={{
                                left: pill.left,
                                width: pill.width,
                                transition: "left 300ms cubic-bezier(0.4,0,0.2,1), width 300ms cubic-bezier(0.4,0,0.2,1)",
                            }}
                        />
                    )}

                    {links.map((link, i) => {
                        const isActive = activeIdx === i;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                ref={el => { tabRefs.current[i] = el; }}
                                className={`relative z-10 px-5 py-2 text-sm font-semibold rounded-full whitespace-nowrap transition-colors duration-200 ${isActive ? "text-[#0d1a14]" : "text-[#a8a8a0] hover:text-[#f0ede8]"
                                    }`}
                            >
                                {link.label}
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
}