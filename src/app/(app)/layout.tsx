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
            if (user) {
                // If the user doesn't have a displayName, they haven't finished setup
                if (!user.displayName) {
                    router.push("/setup");
                } else {
                    setLoading(false);
                }
            } else {
                // Not logged in
                router.push("/login");
            }
        });

        return () => unsubscribe();
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-[#0d1a14] text-zinc-900 dark:text-zinc-100">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-8 h-8 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                    <p className="text-sm text-zinc-500">Loading your world...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0d1a14] text-zinc-50">
            <Navbar />
            <main className="max-w-4xl mx-auto px-4 pb-4 pt-24 sm:px-6 sm:pb-6 sm:pt-24 lg:px-8 lg:pb-8 lg:pt-24">
                {children}
            </main>
        </div>
    );
}
