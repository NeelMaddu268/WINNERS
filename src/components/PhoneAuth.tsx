"use client";

import { useState, useEffect } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult, getAdditionalUserInfo } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

declare global {
    interface Window {
        recaptchaVerifier: any;
    }
}

export default function PhoneAuth() {
    const router = useRouter();
    const [countryCode, setCountryCode] = useState("+1");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [verificationCode, setVerificationCode] = useState("");
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Initialize reCAPTCHA on component mount
        if (typeof window !== "undefined" && !window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'invisible',
                'callback': (response: any) => {
                    // reCAPTCHA solved
                },
                'expired-callback': () => {
                    // Response expired. Ask user to solve reCAPTCHA again.
                    setError("reCAPTCHA expired. Please try again.");
                    if (window.recaptchaVerifier) {
                        try { window.recaptchaVerifier.clear(); } catch (e) { }
                        window.recaptchaVerifier = null;
                    }
                }
            });
            // Try to render it early so it catches errors early, but it's optional
            window.recaptchaVerifier.render().catch(console.error);
        }
    }, []);

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (!window.recaptchaVerifier) {
                throw new Error("reCAPTCHA not initialized");
            }

            const appVerifier = window.recaptchaVerifier;
            // Clean phone number input of non-digits
            const cleanedNumber = phoneNumber.replace(/\D/g, "");
            const formattedPhoneNumber = `${countryCode}${cleanedNumber}`;

            const result = await signInWithPhoneNumber(auth, formattedPhoneNumber, appVerifier);
            setConfirmationResult(result);
        } catch (err: any) {
            console.error(err);
            if (err.code === "auth/invalid-phone-number") {
                setError("That phone number looks invalid. Please check it and try again.");
            } else if (err.code === "auth/too-many-requests") {
                setError("Too many attempts. Please try again later.");
            } else {
                setError("Failed to send verification code. Please try again.");
            }

            // Safely clear the recaptcha, because if it failed before fully rendering it throws an error reading 'style'
            if (window.recaptchaVerifier) {
                try {
                    window.recaptchaVerifier.clear();
                } catch (clearErr) {
                    console.error("Failed to clear reCAPTCHA:", clearErr);
                }
                window.recaptchaVerifier = null;

                // Re-initialize for the next attempt
                window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
                window.recaptchaVerifier.render().catch(console.error);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!confirmationResult) return;

        setLoading(true);
        setError(null);
        try {
            const credential = await confirmationResult.confirm(verificationCode);

            // Check if user is newly created or an existing user
            const additionalInfo = getAdditionalUserInfo(credential);

            // NOTE: For phone auth, isNewUser isn't always perfectly populated if the number was merged or tricky,
            // but generally works perfectly for brand new sign ups!
            if (additionalInfo?.isNewUser || !auth.currentUser?.displayName) {
                // If new user (or they don't have a displayName set up), take them to setup
                router.push("/setup");
            } else {
                // Existing completed user
                router.push("/home");
            }

        } catch (err: any) {
            if (err.code === "auth/invalid-verification-code") {
                setError("That code is incorrect. Please double check and try again.");
            } else if (err.code === "auth/code-expired") {
                setError("That code has expired. Please request a new one.");
            } else {
                setError("Failed to verify code. Please try again.");
            }
            setLoading(false);
        }
    };



    return (
        <div className="w-full flex flex-col gap-4">
            <h2 className="text-2xl font-bold mb-2 text-center text-zinc-900 dark:text-zinc-100">Phone Login</h2>

            {error && (
                <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-md text-sm">
                    {error}
                </div>
            )}

            <div id="recaptcha-container"></div>

            {!confirmationResult ? (
                <form onSubmit={handleSendCode} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300" htmlFor="phone">
                            Phone Number
                        </label>
                        <div className="flex w-full">
                            <select
                                value={countryCode}
                                onChange={(e) => setCountryCode(e.target.value)}
                                className="px-3 py-2 border border-r-0 border-gray-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 rounded-l-md text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-24"
                            >
                                <option value="+1">🇺🇸 +1</option>
                                <option value="+44">🇬🇧 +44</option>
                                <option value="+91">🇮🇳 +91</option>
                                <option value="+61">🇦🇺 +61</option>
                            </select>
                            <input
                                type="tel"
                                id="phone"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="(555) 000-0000"
                                className="flex-1 w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-r-md text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !phoneNumber}
                        className="w-full bg-blue-600 text-white font-medium py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                    >
                        {loading ? "Sending..." : "Send Verification Code"}
                    </button>
                </form>
            ) : (
                <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300" htmlFor="code">
                            6-Digit Verification Code
                        </label>
                        <input
                            type="text"
                            id="code"
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value)}
                            placeholder="123456"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-md text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-widest text-lg"
                            maxLength={6}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !verificationCode}
                        className="w-full bg-blue-600 text-white font-medium py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                    >
                        {loading ? "Verifying..." : "Verify Code"}
                    </button>
                </form>
            )}
        </div>
    );
}
