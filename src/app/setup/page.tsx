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
            <div className="flex items-center justify-between mb-3">
                {STEPS.map((s, i) => {
                    const isCompleted = i < step;
                    const isActive = i === step;
                    return (
                        <div key={s.label} className="flex flex-col items-center gap-1.5 flex-1">
                            <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300
                                    ${isCompleted
                                        ? "bg-[#4ade9a] text-[#0d1a14]"
                                        : isActive
                                            ? "bg-[#4ade9a]/20 text-[#4ade9a] ring-2 ring-[#4ade9a]/50"
                                            : "bg-[#1a2a22] text-[#a8a8a0] border border-[#2a3d30]"
                                    }`}
                            >
                                {isCompleted ? (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : i + 1}
                            </div>
                            <span className={`text-[11px] font-medium transition-colors ${isActive || isCompleted ? "text-[#4ade9a]" : "text-[#a8a8a0]"}`}>
                                {s.label}
                            </span>
                        </div>
                    );
                })}
            </div>
            <div className="relative h-1 bg-[#1a2a22] rounded-full overflow-hidden">
                <div
                    className="absolute inset-y-0 left-0 bg-[#4ade9a] rounded-full transition-all duration-500 ease-in-out"
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
                    router.push("/portfolio");
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
                cashBalance: 10000,
                portfolio: [],
                transactionHistory: [],
            });

            router.push("/portfolio");
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
            <div className="min-h-screen flex items-center justify-center bg-[#0d1a14]">
                <div className="w-8 h-8 border-2 border-[#4ade9a]/30 border-t-[#4ade9a] rounded-full animate-spin" />
            </div>
        );
    }

    // ─── Styles ───────────────────────────────────────────────────────────────

    const inputCls = "w-full px-4 py-3 border border-[#2a3d30] bg-[#1a2a22] text-[#f0ede8] rounded-xl focus:outline-none focus:border-[#4ade9a]/60 focus:ring-1 focus:ring-[#4ade9a]/30 transition-colors placeholder-[#a8a8a0]";
    const selectCls = `${inputCls} cursor-pointer`;
    const labelCls = "block text-sm font-semibold mb-2 text-[#a8a8a0] uppercase tracking-wider";

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0d1a14] font-sans py-12 px-4">
            {/* Subtle background glow */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#4ade9a]/5 rounded-full blur-3xl" />
            </div>

            <main className="relative w-full max-w-md bg-[#111c18] border border-[#2a3d30]/60 rounded-2xl p-8 shadow-2xl">
                {/* Logo */}
                <div className="flex items-center gap-2 mb-8">
                    <div className="w-7 h-7 bg-[#4ade9a] rounded-md flex items-center justify-center shrink-0">
                        <span className="text-[#0d1a14] font-bold text-sm">C</span>
                    </div>
                    <span className="font-semibold text-sm tracking-tight text-[#f0ede8]">CashMere</span>
                </div>

                <ProgressBar step={step} />

                {/* ── Step 1: Profile ── */}
                {step === 0 && (
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-[#f0ede8] mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>Create your profile</h1>
                        <p className="text-[#a8a8a0] text-sm mb-6">Pick a name and a unique username.</p>

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
                                    <span className="absolute left-4 top-3 text-[#a8a8a0] font-medium">@</span>
                                    <input
                                        type="text" id="username" name="username" value={formData.username}
                                        onChange={handleChange} placeholder="cool_investor" minLength={3}
                                        className={`${inputCls} pl-8 ${usernameStatus === "taken" ? "border-red-500/60 focus:border-red-500 focus:ring-red-500/30" :
                                            usernameStatus === "available" ? "border-[#4ade9a]/60" : ""
                                            }`}
                                    />
                                </div>
                                {usernameStatus === "checking" && <p className="text-xs text-[#4ade9a]/70 mt-1.5">Checking availability...</p>}
                                {usernameStatus === "taken" && <p className="text-xs text-red-400 mt-1.5">Username already taken.</p>}
                                {usernameStatus === "available" && <p className="text-xs text-[#4ade9a] mt-1.5">Username available!</p>}
                                {usernameStatus === "idle" && <p className="text-xs text-[#a8a8a0] mt-1.5">Letters, numbers, and underscores only.</p>}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Step 2: Birthday ── */}
                {step === 1 && (
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-[#f0ede8] mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>When&apos;s your birthday?</h1>
                        <p className="text-[#a8a8a0] text-sm mb-6">You must be 18 or older to use this platform.</p>

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
                        <h1 className="text-2xl font-bold tracking-tight text-[#f0ede8] mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>Tell us about yourself</h1>
                        <p className="text-[#a8a8a0] text-sm mb-6">Help us personalize your investing experience.</p>

                        <div className="flex flex-col gap-5">
                            <div>
                                <label htmlFor="investmentExperience" className={labelCls}>Investment Experience</label>
                                <select id="investmentExperience" name="investmentExperience" value={formData.investmentExperience}
                                    onChange={handleChange} className={selectCls} required>
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
                                    onChange={handleChange} className={selectCls} required>
                                    <option value="" disabled>How much risk are you comfortable with?</option>
                                    <option value="conservative">Conservative — I prefer stable, low-risk investments</option>
                                    <option value="moderate">Moderate — I can handle some ups and downs</option>
                                    <option value="aggressive">Aggressive — I&apos;m okay with high risk for high reward</option>
                                </select>
                            </div>

                            <div>
                                <label htmlFor="investmentGoal" className={labelCls}>Primary Investment Goal</label>
                                <select id="investmentGoal" name="investmentGoal" value={formData.investmentGoal}
                                    onChange={handleChange} className={selectCls} required>
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
                        <h1 className="text-2xl font-bold tracking-tight text-[#f0ede8] mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>Link a bank account</h1>
                        <p className="text-[#a8a8a0] text-sm mb-6">
                            Connect your bank to fund your paper trading account. You can skip this for now.
                        </p>

                        <div className="flex flex-col gap-2.5">
                            {BANKS.map((bank) => {
                                const isLinked = formData.linkedBank === bank.id;
                                return (
                                    <button
                                        key={bank.id}
                                        type="button"
                                        onClick={() => setFormData((prev) => ({ ...prev, linkedBank: isLinked ? null : bank.id }))}
                                        className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 text-left cursor-pointer
                                            ${isLinked
                                                ? "border-[#4ade9a]/60 bg-[#4ade9a]/10"
                                                : "border-[#2a3d30] bg-[#1a2a22] hover:border-[#2a3d30]/80 hover:bg-[#1f2f25]"
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{bank.emoji}</span>
                                            <span className="font-medium text-[#f0ede8]">{bank.name}</span>
                                        </div>
                                        {isLinked ? (
                                            <span className="flex items-center gap-1.5 text-sm font-semibold text-[#4ade9a]">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                                Connected
                                            </span>
                                        ) : (
                                            <span className="text-sm font-medium text-[#4ade9a]/70">Connect</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <p className="text-xs text-[#a8a8a0] mt-4 text-center">
                            🔒 Demo only — no real banking credentials are collected.
                        </p>
                    </div>
                )}

                {/* ── Error messages ── */}
                {(stepError || setupError) && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm">
                        {stepError || setupError}
                    </div>
                )}

                {/* ── Navigation ── */}
                <div className={`flex gap-3 mt-8 ${step === 0 ? "justify-end" : "justify-between"}`}>
                    {step > 0 && (
                        <button
                            type="button"
                            onClick={handleBack}
                            className="px-5 py-2.5 rounded-xl border border-[#2a3d30] text-[#a8a8a0] hover:bg-[#1a2a22] hover:text-[#f0ede8] font-medium transition-colors cursor-pointer"
                        >
                            Back
                        </button>
                    )}

                    {step < STEPS.length - 1 ? (
                        <button
                            type="button"
                            onClick={handleNext}
                            className="px-6 py-2.5 bg-[#4ade9a] text-[#0d1a14] font-semibold rounded-xl hover:bg-[#22c55e] focus:outline-none transition-colors cursor-pointer"
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="px-6 py-2.5 bg-[#4ade9a] text-[#0d1a14] font-semibold rounded-xl hover:bg-[#22c55e] focus:outline-none disabled:opacity-50 transition-colors cursor-pointer"
                        >
                            {submitting ? "Creating Account..." : "Create Account"}
                        </button>
                    )}
                </div>
            </main>
        </div>
    );
}
