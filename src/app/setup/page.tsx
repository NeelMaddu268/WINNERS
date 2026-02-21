"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, updateProfile } from "firebase/auth";
import { doc, setDoc, collection, query, where, getDocs } from "firebase/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
    firstName: string;
    lastName: string;
    username: string;
    dob: string;
    investmentExperience: string;
    riskTolerance: string;
    investmentGoal: string;
    linkedBank: string | null;
}

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
    { label: "Profile" },
    { label: "Birthday" },
    { label: "Experience" },
    { label: "Bank" },
];

// ─── Bank options (demo) ──────────────────────────────────────────────────────

const BANKS = [
    { id: "chase", name: "Chase", emoji: "🏦" },
    { id: "bofa", name: "Bank of America", emoji: "🏛️" },
    { id: "wells_fargo", name: "Wells Fargo", emoji: "🐎" },
    { id: "citi", name: "Citi", emoji: "🌐" },
    { id: "schwab", name: "Schwab", emoji: "📈" },
    { id: "fidelity", name: "Fidelity", emoji: "🔷" },
];

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
                {STEPS.map((s, i) => {
                    const isCompleted = i < step;
                    const isActive = i === step;
                    return (
                        <div key={s.label} className="flex flex-col items-center gap-1 flex-1">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300
                                    ${isCompleted ? "bg-blue-600 text-white" : isActive ? "bg-blue-600 text-white ring-4 ring-blue-200 dark:ring-blue-900" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"}`}
                            >
                                {isCompleted ? (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : i + 1}
                            </div>
                            <span className={`text-[11px] font-medium transition-colors ${isActive || isCompleted ? "text-blue-600 dark:text-blue-400" : "text-zinc-400 dark:text-zinc-500"}`}>
                                {s.label}
                            </span>
                        </div>
                    );
                })}
            </div>
            <div className="relative h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div
                    className="absolute inset-y-0 left-0 bg-blue-600 rounded-full transition-all duration-500 ease-in-out"
                    style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
                />
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SetupPage() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [step, setStep] = useState(0);
    const [stepError, setStepError] = useState<string | null>(null);

    const [userPhone, setUserPhone] = useState<string | null>(null);

    const [formData, setFormData] = useState<FormData>({
        firstName: "",
        lastName: "",
        username: "",
        dob: "",
        investmentExperience: "",
        riskTolerance: "",
        investmentGoal: "",
        linkedBank: null,
    });

    const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
    const [setupError, setSetupError] = useState<string | null>(null);

    // Auth guard
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
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

    // Username check (debounced)
    useEffect(() => {
        const checkUsername = async () => {
            const username = formData.username.trim().toLowerCase();
            if (username.length < 3) { setUsernameStatus("idle"); return; }
            setUsernameStatus("checking");
            try {
                const q = query(collection(db, "users"), where("username", "==", username));
                const snap = await getDocs(q);
                setUsernameStatus(snap.empty ? "available" : "taken");
            } catch {
                setUsernameStatus("idle");
            }
        };
        const id = setTimeout(() => { if (formData.username) checkUsername(); }, 500);
        return () => clearTimeout(id);
    }, [formData.username]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        let value = e.target.value;
        if (e.target.name === "username") {
            value = value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
        }
        setFormData((prev) => ({ ...prev, [e.target.name]: value }));
        setStepError(null);
    };

    // ── Step validation ───────────────────────────────────────────────────────

    const validateStep = (): boolean => {
        setStepError(null);

        if (step === 0) {
            if (!formData.firstName.trim() || !formData.lastName.trim()) {
                setStepError("Please enter your first and last name.");
                return false;
            }
            if (formData.username.length < 3) {
                setStepError("Username must be at least 3 characters.");
                return false;
            }
            if (usernameStatus === "checking") {
                setStepError("Still checking username availability. Please wait a moment.");
                return false;
            }
            if (usernameStatus === "taken") {
                setStepError("That username is already taken. Please choose another.");
                return false;
            }
        }

        if (step === 1) {
            if (!formData.dob) {
                setStepError("Please enter your date of birth.");
                return false;
            }
            const dob = new Date(formData.dob);
            const today = new Date();
            let age = today.getFullYear() - dob.getFullYear();
            const m = today.getMonth() - dob.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
            if (age < 18) {
                setStepError("You must be at least 18 years old to create an account.");
                return false;
            }
        }

        if (step === 2) {
            if (!formData.investmentExperience || !formData.riskTolerance || !formData.investmentGoal) {
                setStepError("Please answer all three questions.");
                return false;
            }
        }

        return true;
    };

    const handleNext = () => {
        if (!validateStep()) return;
        setStep((s) => s + 1);
    };

    const handleBack = () => {
        setStepError(null);
        setStep((s) => s - 1);
    };

    // ── Final submit ──────────────────────────────────────────────────────────

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSetupError(null);
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        setSubmitting(true);
        try {
            const displayName = `${formData.firstName} ${formData.lastName}`.trim();
            const username = formData.username.trim().toLowerCase();

            await updateProfile(currentUser, { displayName });

            const now = new Date();
            const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
            const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

            await setDoc(doc(db, "users", currentUser.uid), {
                uid: currentUser.uid,
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                displayName,
                username,
                dob: formData.dob,
                investmentExperience: formData.investmentExperience,
                riskTolerance: formData.riskTolerance,
                investmentGoal: formData.investmentGoal,
                linkedBank: formData.linkedBank,
                phoneNumber: userPhone,
                createdAt: now.toISOString(),
                portfolio: [
                    { ticker: "NVDA", name: "NVIDIA", shares: 10, priceAtPurchase: 150.00, costBasis: 1500.00, timestamp: twoWeeksAgo },
                    { ticker: "NVDA", name: "NVIDIA", shares: 2, priceAtPurchase: 200.00, costBasis: 400.00, timestamp: oneWeekAgo },
                ],
                cashBalance: 100000.00 - 1900.00,
            });

            router.push("/home");
        } catch (err: any) {
            console.error("Failed to complete setup:", err);
            setSetupError(err.message || "An unexpected error occurred. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    // ─── Loading ─────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black text-black dark:text-white">
                Loading...
            </div>
        );
    }

    // ─── Render ───────────────────────────────────────────────────────────────

    const inputCls = "w-full px-3 py-2.5 border border-gray-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors";
    const labelCls = "block text-sm font-medium mb-1.5 text-zinc-700 dark:text-zinc-300";

    return (
        <div className="min-h-screen p-4 flex items-center justify-center bg-zinc-50 font-sans dark:bg-black py-12">
            <main className="w-full max-w-md bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-8 shadow-lg">

                <ProgressBar step={step} />

                {/* ── Step 1: Profile ── */}
                {step === 0 && (
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-1">Create your profile</h1>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">Pick a name and a unique username.</p>

                        <div className="flex flex-col gap-5">
                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label htmlFor="firstName" className={labelCls}>First Name</label>
                                    <input type="text" id="firstName" name="firstName" value={formData.firstName}
                                        onChange={handleChange} className={inputCls} placeholder="Jane" required />
                                </div>
                                <div className="flex-1">
                                    <label htmlFor="lastName" className={labelCls}>Last Name</label>
                                    <input type="text" id="lastName" name="lastName" value={formData.lastName}
                                        onChange={handleChange} className={inputCls} placeholder="Doe" required />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="username" className={labelCls}>Username</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-zinc-500 font-medium">@</span>
                                    <input
                                        type="text" id="username" name="username" value={formData.username}
                                        onChange={handleChange} placeholder="cool_investor" minLength={3}
                                        className={`${inputCls} pl-8 ${usernameStatus === "taken" ? "border-red-500 focus:ring-red-500" :
                                                usernameStatus === "available" ? "border-green-500 focus:ring-green-500" : ""
                                            }`}
                                    />
                                </div>
                                {usernameStatus === "checking" && <p className="text-xs text-blue-500 mt-1">Checking availability...</p>}
                                {usernameStatus === "taken" && <p className="text-xs text-red-500 mt-1">Username already taken.</p>}
                                {usernameStatus === "available" && <p className="text-xs text-green-500 mt-1">Username available!</p>}
                                {usernameStatus === "idle" && <p className="text-xs text-zinc-400 mt-1">Letters, numbers, and underscores only.</p>}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Step 2: Birthday ── */}
                {step === 1 && (
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-1">When&apos;s your birthday?</h1>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">You must be 18 or older to use this platform.</p>

                        <div>
                            <label htmlFor="dob" className={labelCls}>Date of Birth</label>
                            <input
                                type="date" id="dob" name="dob" value={formData.dob}
                                onChange={handleChange} className={inputCls}
                                max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split("T")[0]}
                            />
                        </div>
                    </div>
                )}

                {/* ── Step 3: Investment Experience ── */}
                {step === 2 && (
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-1">Tell us about yourself</h1>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">Help us personalize your investing experience.</p>

                        <div className="flex flex-col gap-5">
                            <div>
                                <label htmlFor="investmentExperience" className={labelCls}>Investment Experience</label>
                                <select id="investmentExperience" name="investmentExperience" value={formData.investmentExperience}
                                    onChange={handleChange} className={inputCls} required>
                                    <option value="" disabled>Select your experience level</option>
                                    <option value="none">No experience — I&apos;m just starting out</option>
                                    <option value="beginner">Beginner — I&apos;ve bought a stock or two</option>
                                    <option value="intermediate">Intermediate — I actively manage a portfolio</option>
                                    <option value="advanced">Advanced — I trade regularly and understand markets</option>
                                    <option value="expert">Expert — I work in finance or have deep expertise</option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="riskTolerance" className={labelCls}>Risk Tolerance</label>
                                <select id="riskTolerance" name="riskTolerance" value={formData.riskTolerance}
                                    onChange={handleChange} className={inputCls} required>
                                    <option value="" disabled>How much risk are you comfortable with?</option>
                                    <option value="conservative">Conservative — I prefer stable, low-risk investments</option>
                                    <option value="moderate">Moderate — I can handle some ups and downs</option>
                                    <option value="aggressive">Aggressive — I&apos;m okay with high risk for high reward</option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="investmentGoal" className={labelCls}>Primary Investment Goal</label>
                                <select id="investmentGoal" name="investmentGoal" value={formData.investmentGoal}
                                    onChange={handleChange} className={inputCls} required>
                                    <option value="" disabled>What are you investing for?</option>
                                    <option value="wealth_growth">Long-term wealth growth</option>
                                    <option value="retirement">Retirement savings</option>
                                    <option value="short_term">Short-term gains</option>
                                    <option value="income">Passive income / dividends</option>
                                    <option value="learning">Learning and practice</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Step 4: Bank Linking ── */}
                {step === 3 && (
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-1">Link a bank account</h1>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
                            Connect your bank to fund your paper trading account. You can skip this for now.
                        </p>

                        <div className="flex flex-col gap-3">
                            {BANKS.map((bank) => {
                                const isLinked = formData.linkedBank === bank.id;
                                return (
                                    <button
                                        key={bank.id}
                                        type="button"
                                        onClick={() => setFormData((prev) => ({ ...prev, linkedBank: isLinked ? null : bank.id }))}
                                        className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 text-left
                                            ${isLinked
                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40"
                                                : "border-gray-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-zinc-500 bg-white dark:bg-zinc-800"
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{bank.emoji}</span>
                                            <span className="font-medium text-zinc-900 dark:text-zinc-100">{bank.name}</span>
                                        </div>
                                        {isLinked ? (
                                            <span className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 dark:text-blue-400">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                                Connected
                                            </span>
                                        ) : (
                                            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Connect</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <p className="text-xs text-zinc-400 mt-4 text-center">
                            🔒 Demo only — no real banking credentials are collected.
                        </p>
                    </div>
                )}

                {/* ── Error messages ── */}
                {(stepError || setupError) && (
                    <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg text-sm">
                        {stepError || setupError}
                    </div>
                )}

                {/* ── Navigation ── */}
                <div className={`flex gap-3 mt-8 ${step === 0 ? "justify-end" : "justify-between"}`}>
                    {step > 0 && (
                        <button
                            type="button"
                            onClick={handleBack}
                            className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium transition-colors"
                        >
                            Back
                        </button>
                    )}

                    {step < STEPS.length - 1 ? (
                        <button
                            type="button"
                            onClick={handleNext}
                            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                        >
                            {submitting ? "Creating Account..." : "Create Account"}
                        </button>
                    )}
                </div>

            </main>
        </div>
    );
}
