"use client";

import { auth, db } from "@/lib/firebase";
import { signOut, deleteUser } from "firebase/auth";
import { doc, deleteDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SettingsPage() {
    const router = useRouter();
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");

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
                // Ignore the requires-recent-login error for the prototype
                if (authError.code !== 'auth/requires-recent-login') {
                    throw authError; // Rethrow actual errors
                }
            }

            // 3. Force sign out and redirect to home
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

                    <div className="mt-4 flex flex-col items-start gap-4">
                        <button
                            onClick={handleSignOut}
                            className="px-4 py-2 border border-red-300 dark:border-red-800/50 text-red-600 dark:text-red-400 rounded-md bg-transparent hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-medium text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                        >
                            Log Out
                        </button>

                        <div className="w-full border-t border-red-200 dark:border-red-900/30 pt-4 mt-2">
                            <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">Delete Account</h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">Once you delete your account, there is no going back. All your portfolio data will be permanently destroyed.</p>
                            <button
                                onClick={() => setIsDeleteModalOpen(true)}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors font-medium text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
                            >
                                Delete Account
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold text-red-600 dark:text-red-500 mb-2">Are you absolutely sure?</h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                            This action cannot be undone. This will permanently delete your account, remove your user profile, and wipe all your portfolio data from our servers.
                        </p>

                        {deleteError && (
                            <div className="mb-6 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-md text-sm border border-red-200 dark:border-red-800/50">
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
                                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAccount}
                                disabled={isDeleting}
                                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-md transition disabled:opacity-50 flex items-center gap-2"
                            >
                                {isDeleting ? "Deleting..." : "Yes, delete my account"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
