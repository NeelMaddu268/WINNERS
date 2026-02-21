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
        <nav className="fixed top-0 w-full z-50 flex items-center justify-center pt-4 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-0">
                {/* Logo pill */}
                <Link
                    href="/portfolio"
                    className="flex items-center gap-2 bg-[#0d1612]/90 backdrop-blur-xl border border-[#2a3d30]/60 rounded-full px-3 py-2 mr-2 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
                >
                    <div className="w-6 h-6 bg-[#4ade9a] rounded-md flex items-center justify-center shrink-0">
                        <span className="text-[#0d1a14] font-bold text-xs">C</span>
                    </div>
                    <span className="font-semibold text-sm tracking-tight text-[#f0ede8] hidden sm:block pr-1">
                        CashMere
                    </span>
                </Link>

                {/* ExpandableTabs nav */}
                <ExpandableTabs
                    tabs={tabs}
                    activeIndex={activeIndex === -1 ? null : activeIndex}
                    onChange={(i) => {
                        if (i !== null && links[i]) router.push(links[i].href);
                    }}
                />
            </div>
        </nav>
    );
}