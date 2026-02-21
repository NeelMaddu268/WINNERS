"use client";

import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
    const router = useRouter();

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            router.push("/");
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Settings</h1>
                <p className="text-zinc-600 dark:text-zinc-400 mt-1">Manage your account preferences and profile.</p>
            </header>

            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-gray-200 dark:border-zinc-800">
                    <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">Profile Information</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Update your personal details here.</p>

                    <div className="mt-6 flex flex-col gap-4">
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800 text-sm text-zinc-500">
                            Profile updating logic will go here.
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50">
                    <h2 className="text-lg font-medium text-red-600 dark:text-red-400">Danger Zone</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Careful, these actions might be destructive.</p>

                    <div className="mt-4">
                        <button
                            onClick={handleSignOut}
                            className="px-4 py-2 border border-red-300 dark:border-red-800/50 text-red-600 dark:text-red-400 rounded-md bg-transparent hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-medium text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                        >
                            Log Out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
