"use client";

import { useState, useCallback } from "react";

type StreamState = {
    text: string;
    isLoading: boolean;
    error: string | null;
};

export function useStreamingText() {
    const [state, setState] = useState<StreamState>({
        text: "",
        isLoading: false,
        error: null,
    });

    const start = useCallback(
        async (prompt: string, systemPrompt?: string) => {
            setState({ text: "", isLoading: true, error: null });

            try {
                const res = await fetch("/api/stream-gemini", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ prompt, systemPrompt }),
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || `HTTP ${res.status}`);
                }

                const reader = res.body?.getReader();
                if (!reader) throw new Error("No response body");

                const decoder = new TextDecoder();
                let accumulated = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    accumulated += chunk;
                    setState((s) => ({ ...s, text: accumulated }));
                }
            } catch (err) {
                setState((s) => ({
                    ...s,
                    isLoading: false,
                    error: err instanceof Error ? err.message : "Stream failed",
                }));
                return;
            }

            setState((s) => ({ ...s, isLoading: false }));
        },
        []
    );

    const reset = useCallback(() => {
        setState({ text: "", isLoading: false, error: null });
    }, []);

    return { ...state, start, reset };
}
