"use client";

import { useStreamingText } from "@/hooks/useStreamingText";

type StreamingTextProps = {
    prompt: string;
    systemPrompt?: string;
    onStart?: () => void;
    autoStart?: boolean;
    className?: string;
    renderTrigger?: (props: { start: () => void; isLoading: boolean }) => React.ReactNode;
};

export function StreamingText({
    prompt,
    systemPrompt,
    onStart,
    autoStart = false,
    className = "",
    renderTrigger,
}: StreamingTextProps) {
    const { text, isLoading, error, start, reset } = useStreamingText();

    const handleStart = () => {
        reset();
        start(prompt, systemPrompt);
        onStart?.();
    };

    return (
        <div className={className}>
            {renderTrigger ? (
                renderTrigger({ start: handleStart, isLoading })
            ) : (
                <button
                    onClick={handleStart}
                    disabled={isLoading}
                    className="text-sm font-bold px-4 py-2 rounded-lg bg-[#4ade9a]/20 text-[#4ade9a] hover:bg-[#4ade9a]/30 border border-[#4ade9a]/30 transition disabled:opacity-50"
                >
                    {isLoading ? "Streaming..." : "Stream analysis"}
                </button>
            )}
            {error && (
                <p className="mt-2 text-sm text-red-400">{error}</p>
            )}
            {text && (
                <div className="mt-8 whitespace-pre-wrap text-sm leading-relaxed text-[#a8a8a0] border-t border-[#2a3d30]/50 pt-4 min-h-[60px]">
                    {text}
                    {isLoading && (
                        <span className="inline-block w-2 h-4 ml-0.5 bg-[#4ade9a] animate-pulse" />
                    )}
                </div>
            )}
        </div>
    );
}
