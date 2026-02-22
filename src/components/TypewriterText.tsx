"use client";

import { useState, useEffect } from "react";

interface TypewriterTextProps {
    text: string;
    speed?: number; // ms per character
    delay?: number; // initial delay in ms
    className?: string;
    cursor?: boolean;
}

export function TypewriterText({
    text,
    speed = 15,
    delay = 0,
    className = "",
    cursor = true
}: TypewriterTextProps) {
    const [displayedText, setDisplayedText] = useState("");
    const [isComplete, setIsComplete] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);

    useEffect(() => {
        // Reset state if text changes completely
        setDisplayedText("");
        setIsComplete(false);
        setHasStarted(false);

        let timeoutId: NodeJS.Timeout;

        timeoutId = setTimeout(() => {
            setHasStarted(true);
        }, delay);

        return () => clearTimeout(timeoutId);
    }, [text, delay]);

    useEffect(() => {
        if (!hasStarted) return;
        if (displayedText.length >= text.length) {
            setIsComplete(true);
            return;
        }

        const timeoutId = setTimeout(() => {
            setDisplayedText(text.slice(0, displayedText.length + 1));
        }, speed);

        return () => clearTimeout(timeoutId);
    }, [displayedText, text, speed, hasStarted]);

    return (
        <span className={className}>
            {displayedText}
            {cursor && !isComplete && (
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-current animate-pulse align-middle" />
            )}
        </span>
    );
}
