"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";

export default function Navbar() {
    const pathname = usePathname();
    const [activeTab, setActiveTab] = useState(0);
    const [sliderStyle, setSliderStyle] = useState({ left: 0, width: 0 });
    const navRef = useRef<HTMLDivElement>(null);
    const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);

    const links = [
        { href: "/home", label: "Invest" },
        { href: "/portfolio", label: "Portfolio" },
        { href: "/markets", label: "Markets" },
        { href: "/resources", label: "Resources" },
        { href: "/company", label: "Company" },
        { href: "/settings", label: "Settings" } // Added settings so they can log out
    ];

    // Set active tab based on pathname
    useEffect(() => {
        const index = links.findIndex(link => link.href === pathname);
        if (index !== -1) {
            setActiveTab(index);
        }
    }, [pathname]);

    useEffect(() => {
        const updateSlider = () => {
            if (tabRefs.current[activeTab]) {
                const activeElement = tabRefs.current[activeTab];
                setSliderStyle({
                    left: activeElement.offsetLeft,
                    width: activeElement.offsetWidth,
                });
            }
        };

        updateSlider();
        window.addEventListener('resize', updateSlider);
        return () => window.removeEventListener('resize', updateSlider);
    }, [activeTab]);

    return (
        <nav className="fixed top-0 w-full z-50 bg-[#0d1a14]/80 backdrop-blur-md border-b border-[#2a3d30]/50">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">

                {/* Logo/Brand */}
                <div className="flex items-center gap-3 pr-6">
                    <div className="w-8 h-8 bg-[#4ade9a] rounded-lg flex items-center justify-center">
                        <span className="text-[#0d1a14] font-bold text-sm">W</span>
                    </div>
                    <span className="font-semibold text-lg tracking-tight text-[#f0ede8]">Winners</span>
                </div>

                {/* Navigation Links */}
                <div className="hidden md:flex items-center relative" ref={navRef}>
                    <div
                        className="absolute bottom-0 h-0.5 bg-[#4ade9a] transition-all duration-300 ease-out"
                        style={{
                            left: `${sliderStyle.left}px`,
                            width: `${sliderStyle.width}px`,
                        }}
                    ></div>
                    {links.map((link, index) => {
                        const isActive = activeTab === index;
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                ref={(el) => {
                                    tabRefs.current[index] = el;
                                }}
                                className={`px-6 py-3 text-sm font-medium transition-colors duration-200 ${isActive ? 'text-[#4ade9a]' : 'text-[#a8a8a0] hover:text-[#f0ede8]'
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