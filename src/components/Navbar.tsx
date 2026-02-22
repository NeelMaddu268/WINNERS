"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, TrendingUp, Rss, Users, Settings } from "lucide-react";
import { ExpandableTabs } from "@/components/ui/expandable-tabs";

const links = [
    { href: "/portfolio", label: "Portfolio", icon: LayoutDashboard },
    { href: "/markets", label: "Markets", icon: TrendingUp },
    { href: "/social", label: "Feed", icon: Rss },
    { href: "/friends", label: "Friends", icon: Users },
    { href: "/settings", label: "Settings", icon: Settings },
];

const tabs = links.map(l => ({ title: l.label, icon: l.icon }));

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const activeIndex = links.findIndex(l => l.href === pathname);

    return (
        <>
            {/* Logo pill — fixed to the left, not clickable cursor */}
            <div className="fixed top-0 left-0 z-50 pt-5 pl-6 pointer-events-auto">
                <Link
                    href="/portfolio"
                    className="flex items-center gap-2 cursor-default"
                >
                    <div className="w-7 h-7 bg-[#4ade9a] rounded-md flex items-center justify-center shrink-0">
                        <span className="text-[#0d1a14] font-bold text-sm">C</span>
                    </div>
                    <span className="font-semibold text-sm tracking-tight text-[#f0ede8] hidden sm:block">
                        CashMere
                    </span>
                </Link>
            </div>

            {/* Centered nav bar */}
            <nav className="fixed top-0 w-full z-50 flex items-center justify-center pt-4 pb-4 pointer-events-none">
                <div className="pointer-events-auto cursor-pointer">
                    <ExpandableTabs
                        tabs={tabs}
                        activeIndex={activeIndex === -1 ? null : activeIndex}
                        onChange={(i) => {
                            if (i !== null && links[i]) router.push(links[i].href);
                        }}
                        className="px-4 py-2.5"
                    />
                </div>
            </nav>
        </>
    );
}