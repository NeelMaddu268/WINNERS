"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            console.log("AppLayout: Auth state changed", user ? "User logged in" : "No user");
            if (user) {
                console.log("AppLayout: User display name:", user.displayName);
                // If the user doesn't have a displayName, they haven't finished setup
                if (!user.displayName) {
                    console.log("AppLayout: Redirecting to /setup");
                    router.push("/setup");
                } else {
                    console.log("AppLayout: Setup complete, showing app");
                    setLoading(false);
                }
            } else {
                // Not logged in
                console.log("AppLayout: Redirecting to /login");
                router.push("/login");
            }
        });

        return () => unsubscribe();
    }, [router]);

    const [showRefresh, setShowRefresh] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (loading) setShowRefresh(true);
        }, 5000);
        return () => clearTimeout(timer);
    }, [loading]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 p-6 text-center">
                <div className="flex flex-col items-center gap-6">
                    <div className="animate-pulse flex flex-col items-center gap-4">
                        <div className="w-10 h-10 rounded-full border-4 border-[#00c805] border-t-transparent animate-spin"></div>
                        <p className="text-lg font-medium text-zinc-400">Loading your world...</p>
                    </div>

                    {showRefresh && (
                        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <p className="text-sm text-zinc-500 mb-4 max-w-xs">It&apos;s taking longer than usual. This might be due to a stale connection.</p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => window.location.reload()}
                                    className="px-6 py-2.5 bg-[#00c805] text-black font-bold rounded-full hover:bg-[#00e006] transition-all"
                                >
                                    Force Refresh Page
                                </button>
                                <button
                                    onClick={() => setLoading(false)}
                                    className="text-xs text-zinc-600 underline hover:text-zinc-400"
                                >
                                    Skip to App (Debug)
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-zinc-50">
            <Navbar />
            <main className="max-w-4xl mx-auto px-4 pb-4 pt-24 sm:px-6 sm:pb-6 sm:pt-24 lg:px-8 lg:pb-8 lg:pt-24">
                {children}
            </main>
        </div>
    );
}
