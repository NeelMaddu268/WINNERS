"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface Tab {
    title: string;
    icon: LucideIcon;
    type?: never;
}

interface Separator {
    type: "separator";
    title?: never;
    icon?: never;
}

type TabItem = Tab | Separator;

interface ExpandableTabsProps {
    tabs: TabItem[];
    className?: string;
    activeColor?: string;
    onChange?: (index: number | null) => void;
    activeIndex?: number | null;
}

const buttonVariants = {
    initial: {
        gap: 0,
        paddingLeft: ".5rem",
        paddingRight: ".5rem",
    },
    animate: (isSelected: boolean) => ({
        gap: isSelected ? ".5rem" : 0,
        paddingLeft: isSelected ? "1rem" : ".5rem",
        paddingRight: isSelected ? "1rem" : ".5rem",
    }),
};

const spanVariants = {
    initial: { width: 0, opacity: 0 },
    animate: { width: "auto", opacity: 1 },
    exit: { width: 0, opacity: 0 },
};

const transition = { delay: 0.1, type: "spring" as const, bounce: 0, duration: 0.6 };

export function ExpandableTabs({
    tabs,
    className,
    activeColor = "text-[#4ade9a]",
    onChange,
    activeIndex: externalActive,
}: ExpandableTabsProps) {
    const [internalSelected, setInternalSelected] = React.useState<number | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Use external active index if provided (controlled), else internal
    const selected = externalActive !== undefined ? externalActive : internalSelected;

    // Outside click — collapse only in uncontrolled mode
    React.useEffect(() => {
        if (externalActive !== undefined) return;
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setInternalSelected(null);
                onChange?.(null);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [externalActive, onChange]);

    const handleSelect = (index: number) => {
        if (externalActive === undefined) setInternalSelected(index);
        onChange?.(index);
    };

    const SeparatorEl = () => (
        <div className="mx-1 h-[24px] w-[1.2px] bg-[#2a3d30]/60" aria-hidden="true" />
    );

    return (
        <div
            ref={containerRef}
            className={cn(
                "flex flex-wrap items-center gap-1 rounded-full border border-[#2a3d30]/60 bg-[#0d1612]/90 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl",
                className
            )}
        >
            {tabs.map((tab, index) => {
                if (tab.type === "separator") {
                    return <SeparatorEl key={`separator-${index}`} />;
                }

                const Icon = tab.icon;
                return (
                    <motion.button
                        key={tab.title}
                        variants={buttonVariants}
                        initial={false}
                        animate="animate"
                        custom={selected === index}
                        onClick={() => handleSelect(index)}
                        transition={transition}
                        className={cn(
                            "relative flex items-center rounded-full py-2 text-sm font-medium transition-colors duration-300",
                            selected === index
                                ? cn("bg-[#4ade9a]/15 border border-[#4ade9a]/30", activeColor)
                                : "text-[#a8a8a0] hover:text-[#f0ede8] hover:bg-[#1a2a22]/50"
                        )}
                    >
                        <Icon size={18} />
                        <AnimatePresence initial={false}>
                            {selected === index && (
                                <motion.span
                                    variants={spanVariants}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    transition={transition}
                                    className="overflow-hidden whitespace-nowrap"
                                >
                                    {tab.title}
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </motion.button>
                );
            })}
        </div>
    );
}
