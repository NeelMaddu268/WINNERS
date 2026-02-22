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
        // Optional: for development/testing, you can bypass the real reCAPTCHA if you
        // use a testing phone number from the Firebase console, OR set this flag to
        // true to use dummy recaptchas on localhost (this only works if also enabled in console)
        if (process.env.NODE_ENV === "development") {
            auth.settings.appVerificationDisabledForTesting = true;
        }

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
                router.push("/portfolio");
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
        <div className="w-full flex flex-col gap-6">
            <h2 className="text-3xl font-serif font-bold mb-4 text-center text-[#f0ede8]" style={{ fontFamily: 'Playfair Display, serif' }}>Phone Login</h2>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-sm">
                    {error}
                </div>
            )}

            <div id="recaptcha-container"></div>

            {!confirmationResult ? (
                <form onSubmit={handleSendCode} className="flex flex-col gap-5">
                    <div>
                        <label className="block text-xs uppercase tracking-wider font-bold mb-2 text-[#a8a8a0]" htmlFor="phone">
                            Phone Number
                        </label>
                        <div className="flex w-full">
                            <select
                                value={countryCode}
                                onChange={(e) => setCountryCode(e.target.value)}
                                className="px-4 py-3 border border-r-0 border-[#2a3d30] bg-[#1a2a22] rounded-l-xl text-white focus:outline-none focus:border-[#4ade9a] focus:ring-1 focus:ring-[#4ade9a] w-28 appearance-none cursor-pointer"
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
                                className="flex-1 w-full px-4 py-3 border border-[#2a3d30] bg-[#1a2a22] rounded-r-xl text-white placeholder-[#a8a8a0]/50 focus:outline-none focus:border-[#4ade9a] focus:ring-1 focus:ring-[#4ade9a] transition-colors"
                                required
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !phoneNumber}
                        className="w-full mt-2 bg-[#4ade9a] text-black font-bold py-3.5 rounded-xl hover:bg-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#4ade9a] focus:ring-offset-2 focus:ring-offset-[#111c18] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(74,222,154,0.2)]"
                    >
                        {loading ? "Sending..." : "Send Verification Code"}
                    </button>
                </form>
            ) : (
                <form onSubmit={handleVerifyCode} className="flex flex-col gap-5">
                    <div>
                        <label className="block text-xs uppercase tracking-wider font-bold mb-2 text-[#a8a8a0]" htmlFor="code">
                            6-Digit Verification Code
                        </label>
                        <input
                            type="text"
                            id="code"
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value)}
                            placeholder="123456"
                            className="w-full px-4 py-4 border border-[#2a3d30] bg-[#1a2a22] rounded-xl text-white placeholder-[#a8a8a0]/30 focus:outline-none focus:border-[#4ade9a] focus:ring-1 focus:ring-[#4ade9a] text-center tracking-[0.5em] text-2xl font-medium transition-colors"
                            maxLength={6}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !verificationCode}
                        className="w-full mt-2 bg-[#4ade9a] text-black font-bold py-3.5 rounded-xl hover:bg-[#22c55e] focus:outline-none focus:ring-2 focus:ring-[#4ade9a] focus:ring-offset-2 focus:ring-offset-[#111c18] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(74,222,154,0.2)]"
                    >
                        {loading ? "Verifying..." : "Verify Code"}
                    </button>
                </form>
            )}
        </div>
    );
}
