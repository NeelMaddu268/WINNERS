"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, TrendingUp, Rss, Users, Settings } from "lucide-react";
import { ExpandableTabs } from "@/components/ui/expandable-tabs";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";

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

    const { scrollY } = useScroll();
    const [hidden, setHidden] = useState(false);

    useMotionValueEvent(scrollY, "change", (latest) => {
        const previous = scrollY.getPrevious() ?? 0;
        if (latest > previous && latest > 150) {
            setHidden(true);
        } else {
            setHidden(false);
        }
    });

    return (
        <motion.div
            variants={{
                visible: { y: 0 },
                hidden: { y: "-100%" },
            }}
            animate={hidden ? "hidden" : "visible"}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="fixed top-0 left-0 right-0 z-50 flex justify-between pointer-events-none"
        >
            {/* Logo pill — absolute to the left */}
            <div className="absolute left-0 top-0 pt-5 pl-6 pointer-events-auto">
                <Link
                    href="/portfolio"
                    className="flex items-center gap-2 cursor-pointer"
                >
                    <div className="w-9 h-9 bg-[#4ade9a] rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-[#4ade9a]/20">
                        <span className="text-[#0d1a14] font-bold text-lg">C</span>
                    </div>
                    <span className="font-semibold text-lg tracking-tight text-[#f0ede8] hidden sm:block">
                        CashMere
                    </span>
                </Link>
            </div>

            {/* Centered nav bar */}
            <nav className="w-full flex items-center justify-center pt-4 pb-4 pointer-events-none">
                <div className="pointer-events-auto cursor-pointer">
                    <ExpandableTabs
                        tabs={tabs}
                        activeIndex={activeIndex === -1 ? null : activeIndex}
                        onChange={(i) => {
                            if (i !== null && links[i]) router.push(links[i].href);
                        }}
                        className="px-4 py-2.5 shadow-xl"
                    />
                </div>
            </nav>
        </motion.div>
    );
}