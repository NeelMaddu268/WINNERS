"use client";

import { useEffect, useState, useRef } from "react";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, updateProfile } from "firebase/auth";
import { doc, setDoc, collection, query, where, getDocs } from "firebase/firestore";

export default function SetupPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [userPhone, setUserPhone] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        dob: "",
        username: "",
    });

    const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
    const [setupError, setSetupError] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // If they already have a complete profile with display name, they shouldn't be here
                if (user.displayName) {
                    router.push("/home");
                    return;
                }
                setUserPhone(user.phoneNumber);
                setLoading(false);
            } else {
                router.push("/login");
            }
        });

        return () => unsubscribe();
    }, [router]);

    // Check username uniqueness (debounced)
    useEffect(() => {
        const checkUsername = async () => {
            const username = formData.username.trim().toLowerCase();
            if (username.length < 3) {
                setUsernameStatus("idle");
                return;
            }

            setUsernameStatus("checking");
            try {
                const usersRef = collection(db, "users");
                const q = query(usersRef, where("username", "==", username));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    setUsernameStatus("available");
                } else {
                    setUsernameStatus("taken");
                }
            } catch (err) {
                console.error("Error checking username:", err);
                setUsernameStatus("idle");
            }
        };

        const timeoutId = setTimeout(() => {
            if (formData.username) checkUsername();
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [formData.username]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value;
        if (e.target.name === 'username') {
            // Only allow alphanumeric and underscore, force lowercase
            value = value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
        }
        setFormData((prev) => ({ ...prev, [e.target.name]: value }));
    };

    const handleCompleteSetup = async (e: React.FormEvent) => {
        e.preventDefault();
        setSetupError(null);

        const currentUser = auth.currentUser;
        if (!currentUser) return;

        if (usernameStatus === "checking") {
            setSetupError("Still checking username availability. Please wait.");
            return;
        }
        if (usernameStatus === "taken") {
            setSetupError("That username is already taken. Please choose another.");
            return;
        }

        setSubmitting(true);
        try {
            const displayName = `${formData.firstName} ${formData.lastName}`.trim();
            const username = formData.username.trim().toLowerCase();

            // 1. Update Firebase Auth Profile
            await updateProfile(currentUser, {
                displayName
            });

            // Calculate timestamps for mock portfolio
            const now = new Date();
            const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

            // 2. Save User Data to Firestore
            await setDoc(doc(db, "users", currentUser.uid), {
                uid: currentUser.uid,
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                displayName,
                username,
                dob: formData.dob,
                phoneNumber: userPhone,
                createdAt: now.toISOString(),
                portfolio: [
                    {
                        ticker: "NVDA",
                        name: "NVIDIA",
                        shares: 10,
                        priceAtPurchase: 150.00,
                        costBasis: 1500.00,
                        timestamp: twoWeeksAgo,
                    },
                    {
                        ticker: "NVDA",
                        name: "NVIDIA",
                        shares: 2,
                        priceAtPurchase: 200.00,
                        costBasis: 400.00,
                        timestamp: oneWeekAgo,
                    }
                ],
                cashBalance: 100000.00 - 1900.00, // Paper trading balance minus mock investments
            });

            // 3. Navigate to home
            router.push("/home");
        } catch (err: any) {
            console.error("Failed to complete setup:", err);
            setSetupError(err.message || "An unexpected error occurred. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black text-black dark:text-white">
                Loading...
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4 flex items-center justify-center bg-zinc-50 font-sans dark:bg-black py-12">
            <main className="w-full max-w-md bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-8 shadow-lg">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2">Complete Your Profile</h1>
                <p className="text-zinc-600 dark:text-zinc-400 mb-6 text-sm">
                    Almost there! Pick a username and tell us a bit about yourself.
                </p>

                {setupError && (
                    <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-md text-sm">
                        {setupError}
                    </div>
                )}

                <form onSubmit={handleCompleteSetup} className="flex flex-col gap-5">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label htmlFor="firstName" className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">
                                First Name
                            </label>
                            <input
                                type="text"
                                id="firstName"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-md text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>
                        <div className="flex-1">
                            <label htmlFor="lastName" className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">
                                Last Name
                            </label>
                            <input
                                type="text"
                                id="lastName"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-md text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="username" className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">
                            Username
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-zinc-500 font-medium">@</span>
                            <input
                                type="text"
                                id="username"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                placeholder="cool_user"
                                minLength={3}
                                className={`w-full pl-8 pr-3 py-2 border bg-zinc-50 dark:bg-zinc-800 rounded-md text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${usernameStatus === "taken"
                                    ? "border-red-500 focus:ring-red-500"
                                    : usernameStatus === "available"
                                        ? "border-green-500 focus:ring-green-500"
                                        : "border-gray-300 dark:border-zinc-700"
                                    }`}
                                required
                            />
                        </div>
                        {usernameStatus === "checking" && <p className="text-xs text-blue-500 mt-1">Checking availability...</p>}
                        {usernameStatus === "taken" && <p className="text-xs text-red-500 mt-1">This username is already taken.</p>}
                        {usernameStatus === "available" && <p className="text-xs text-green-500 mt-1">Username available!</p>}
                        {usernameStatus === "idle" && <p className="text-xs text-zinc-500 mt-1">Letters, numbers, and underscores only</p>}
                    </div>

                    <div>
                        <label htmlFor="dob" className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">
                            Date of Birth
                        </label>
                        <input
                            type="date"
                            id="dob"
                            name="dob"
                            value={formData.dob}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-md text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={submitting || usernameStatus === "taken" || usernameStatus === "checking" || formData.username.length < 3}
                        className="w-full bg-blue-600 text-white font-medium py-2.5 mt-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                    >
                        {submitting ? "Creating Account..." : "Create Account"}
                    </button>
                </form>
            </main>
        </div>
    );
}
