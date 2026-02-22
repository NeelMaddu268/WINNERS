"use client";

import { auth, db } from "@/lib/firebase";
import { signOut, deleteUser } from "firebase/auth";
import { doc, deleteDoc, getDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function SettingsPage() {
    const router = useRouter();
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");
    const [autoShare, setAutoShare] = useState(false);
    const [isPublic, setIsPublic] = useState(false);
    const [defaultAudience, setDefaultAudience] = useState<"public" | "friends">("public");
    const [loadingSettings, setLoadingSettings] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            if (!auth.currentUser) return;
            try {
                const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
                if (userDoc.exists()) {
                    setAutoShare(userDoc.data().autoShare || false);
                    setIsPublic(userDoc.data().isPublic || false);
                    setDefaultAudience(userDoc.data().defaultAudience || "public");
                }
            } catch (err) {
                console.error("Failed to load settings:", err);
            }
            setLoadingSettings(false);
        };
        fetchSettings();
    }, []);

    const toggleAutoShare = async () => {
        if (!auth.currentUser) return;
        const newVal = !autoShare;
        setAutoShare(newVal);
        try {
            await updateDoc(doc(db, "users", auth.currentUser.uid), {
                autoShare: newVal
            });
        } catch (err) {
            console.error("Failed to update auto share setting:", err);
            setAutoShare(!newVal); // revert on error
        }
    };

    const togglePrivacy = async () => {
        if (!auth.currentUser) return;
        const newVal = !isPublic;
        setIsPublic(newVal);
        try {
            await updateDoc(doc(db, "users", auth.currentUser.uid), {
                isPublic: newVal
            });
        } catch (err) {
            console.error("Failed to update privacy setting:", err);
            setIsPublic(!newVal); // revert on error
        }
    };

    const changeDefaultAudience = async (newVal: "public" | "friends") => {
        if (!auth.currentUser) return;
        const oldVal = defaultAudience;
        setDefaultAudience(newVal);
        try {
            await updateDoc(doc(db, "users", auth.currentUser.uid), {
                defaultAudience: newVal
            });
        } catch (err) {
            console.error("Failed to update audience setting:", err);
            setDefaultAudience(oldVal); // revert on error
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            router.push("/");
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    const handleDeleteAccount = async () => {
        const user = auth.currentUser;
        if (!user) return;

        const uid = user.uid; // Save uid to prevent null error

        setIsDeleting(true);
        setDeleteError("");
        try {
            // 1. Delete user document from Firestore FIRST using the saved uid
            await deleteDoc(doc(db, "users", uid));

            // 2. Try to Delete Firebase Auth user
            try {
                await deleteUser(user);
            } catch (authError: any) {
                // If it fails because of recent login, we must fail the whole process
                // so they know to log out and log back in, rather than getting stuck half-deleted.
                if (authError.code === 'auth/requires-recent-login') {
                    throw new Error("For security reasons, please log out and log back in before deleting your account.");
                }
                throw authError; // Rethrow other actual errors
            }

            // 3. Force sign out and redirect to home after successful auth deletion
            await signOut(auth);
            router.push("/");
        } catch (error: any) {
            console.error("Failed to delete account:", error);
            setDeleteError(error.message || "An error occurred while deleting your account.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6 w-full animate-in fade-in duration-500 text-[#f0ede8]">
                <header className="border-b border-[#2a3d30]/50 pb-6">
                    <h1 className="font-page-title text-[#f0ede8]">Settings</h1>
                    <p className="text-[#a8a8a0] mt-1 text-base">Manage your account preferences and profile.</p>
                </header>

                <div className="bg-[#111c18] border border-[#2a3d30]/50 rounded-2xl overflow-hidden shadow-xl">
                    <div className="p-6 border-b border-[#2a3d30]/50">
                        <h2 className="text-xl font-medium text-[#f0ede8]">Profile Information</h2>
                        <p className="text-base text-[#a8a8a0] mt-1">Update your personal details here.</p>

                        <div className="mt-6 flex flex-col gap-4">
                            <div className="p-5 bg-[#1a2a22] rounded-xl border border-[#2a3d30]/40">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-base font-medium text-[#f0ede8]">Auto-Share Transactions</h3>
                                        <p className="text-sm text-[#a8a8a0] mt-1">Automatically post your trades to the social feed.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={autoShare}
                                            onChange={toggleAutoShare}
                                            disabled={loadingSettings}
                                        />
                                        <div className="w-11 h-6 bg-[#2a3d30] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[#0d1a14] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#f0ede8] after:border after:border-[#2a3d30] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4ade9a]"></div>
                                    </label>
                                </div>
                            </div>
                            <div className="p-5 bg-[#1a2a22] rounded-xl border border-[#2a3d30]/40">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-base font-medium text-[#f0ede8]">Public Profile</h3>
                                        <p className="text-sm text-[#a8a8a0] mt-1">Allow anyone to view your portfolio holdings. If disabled, only friends can see them.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={isPublic}
                                            onChange={togglePrivacy}
                                            disabled={loadingSettings}
                                        />
                                        <div className="w-11 h-6 bg-[#2a3d30] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-[#0d1a14] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#f0ede8] after:border after:border-[#2a3d30] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#4ade9a]"></div>
                                    </label>
                                </div>
                            </div>
                            <div className="p-5 bg-[#1a2a22] rounded-xl border border-[#2a3d30]/40">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-base font-medium text-[#f0ede8]">Default Post Audience</h3>
                                        <p className="text-sm text-[#a8a8a0] mt-1">Choose who can see your trades when you post them to the feed.</p>
                                    </div>
                                    <select
                                        value={defaultAudience}
                                        onChange={(e) => changeDefaultAudience(e.target.value as "public" | "friends")}
                                        disabled={loadingSettings}
                                        className="bg-[#0d1a14] border border-[#2a3d30] text-[#f0ede8] text-base rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#4ade9a]/50 focus:border-[#4ade9a] outline-none cursor-pointer transition"
                                    >
                                        <option value="public">Public</option>
                                        <option value="friends">Friends Only</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Danger Zone — separate card */}
                <div className="bg-[#0a120f] border border-red-500/20 rounded-2xl overflow-hidden shadow-xl">
                    <div className="px-6 pt-6 pb-4">
                        <h2 className="text-2xl font-bold text-red-400 tracking-tight" style={{ fontFamily: 'Playfair Display, serif' }}>Danger Zone</h2>
                        <p className="text-base text-[#a8a8a0] mt-1">Careful, these actions might be destructive.</p>
                    </div>
                    <div className="px-6 pb-6 flex flex-col gap-4">
                        <button
                            onClick={handleSignOut}
                            className="w-full sm:w-auto px-5 py-2.5 border border-red-500/40 text-red-400 rounded-xl bg-transparent hover:bg-red-500/10 transition-colors font-medium text-base focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 text-left cursor-pointer"
                        >
                            Log Out
                        </button>

                        <div className="p-5 bg-[#0d1a14] rounded-xl border border-red-500/20">
                            <h3 className="text-lg font-semibold text-red-400 mb-2">Delete Account</h3>
                            <p className="text-sm text-[#a8a8a0] mb-4">Once you delete your account, there is no going back. All your portfolio data will be permanently destroyed.</p>
                            <button
                                onClick={() => setIsDeleteModalOpen(true)}
                                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors font-medium text-base focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 cursor-pointer"
                            >
                                Delete Account
                            </button>
                        </div>
                    </div>
                </div>

                {/* Delete Confirmation Modal */}
                {isDeleteModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="bg-[#111c18] border border-[#2a3d30] rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                            <h3 className="text-2xl font-bold text-red-400 mb-2">Are you absolutely sure?</h3>
                            <p className="text-base text-[#a8a8a0] mb-6 leading-relaxed">
                                This action cannot be undone. This will permanently delete your account, remove your user profile, and wipe all your portfolio data from our servers.
                            </p>

                            {deleteError && (
                                <div className="mb-6 p-4 bg-red-500/10 text-red-400 rounded-xl text-base border border-red-500/30">
                                    {deleteError}
                                </div>
                            )}

                            <div className="flex gap-3 justify-end mt-4">
                                <button
                                    onClick={() => {
                                        setIsDeleteModalOpen(false);
                                        setDeleteError("");
                                    }}
                                    disabled={isDeleting}
                                    className="px-5 py-2.5 text-base font-medium text-[#a8a8a0] hover:bg-[#2a3d30]/50 rounded-xl transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteAccount}
                                    disabled={isDeleting}
                                    className="px-5 py-2.5 text-base font-medium bg-red-600 hover:bg-red-500 text-white rounded-xl transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                                >
                                    {isDeleting ? "Deleting..." : "Yes, delete my account"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
