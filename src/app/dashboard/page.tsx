"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";

export default function DashboardPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [userPhone, setUserPhone] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserPhone(user.phoneNumber);
                setLoading(false);
            } else {
                router.push("/");
            }
        });

        return () => unsubscribe();
    }, [router]);

    const handleSignOut = async () => {
        await signOut(auth);
        router.push("/");
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black text-black dark:text-white">
                Loading...
            </div>
        );
    }

    return (
        <div className="min-h-screen p-8 bg-zinc-50 dark:bg-black font-sans">
            <main className="max-w-4xl mx-auto flex flex-col gap-6">
                <header className="flex justify-between items-center pb-6 border-b border-gray-200 dark:border-zinc-800">
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Dashboard</h1>
                    <button
                        onClick={handleSignOut}
                        className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                    >
                        Sign Out
                    </button>
                </header>

                <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
                    <h2 className="text-xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">Welcome Back!</h2>
                    <p className="text-zinc-600 dark:text-zinc-400">
                        You are successfully logged in with the phone number: <strong className="text-blue-600 dark:text-blue-400">{userPhone}</strong>
                    </p>
                </section>
            </main>
        </div>
    );
}
