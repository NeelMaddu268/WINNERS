"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, arrayUnion, arrayRemove, addDoc, deleteDoc, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function FriendsPage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"friends" | "requests" | "search">("friends");

    const [friendsList, setFriendsList] = useState<any[]>([]);
    const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
    const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]);

    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState("");

    const [userToUnfriend, setUserToUnfriend] = useState<any | null>(null);

    // Listen to current user doc for friends array
    useEffect(() => {
        if (!auth.currentUser) return;
        const userRef = doc(db, "users", auth.currentUser.uid);

        const unsubUser = onSnapshot(userRef, async (snap) => {
            if (snap.exists()) {
                const friendsUids = snap.data().friends || [];
                // Fetch details for each friend
                if (friendsUids.length > 0) {
                    const friendDocs = await Promise.all(friendsUids.map((uid: string) => getDoc(doc(db, "users", uid))));
                    setFriendsList(friendDocs.filter(d => d.exists()).map(d => ({ uid: d.id, ...d.data() })));
                } else {
                    setFriendsList([]);
                }
            }
        });

        // Listen to friend requests matching 'toUid' (Incoming)
        const qIncoming = query(collection(db, "friend_requests"), where("toUid", "==", auth.currentUser.uid), where("status", "==", "pending"));
        const unsubIncoming = onSnapshot(qIncoming, async (snap) => {
            const reqs = await Promise.all(snap.docs.map(async d => {
                const data = d.data();
                const senderDoc = await getDoc(doc(db, "users", data.fromUid));
                return { id: d.id, ...data, sender: senderDoc.exists() ? senderDoc.data() : null };
            }));
            setIncomingRequests(reqs);
        });

        // Listen to friend requests matching 'fromUid' (Outgoing)
        const qOutgoing = query(collection(db, "friend_requests"), where("fromUid", "==", auth.currentUser.uid), where("status", "==", "pending"));
        const unsubOutgoing = onSnapshot(qOutgoing, async (snap) => {
            const reqs = await Promise.all(snap.docs.map(async d => {
                const data = d.data();
                const receiverDoc = await getDoc(doc(db, "users", data.toUid));
                return { id: d.id, ...data, receiver: receiverDoc.exists() ? receiverDoc.data() : null };
            }));
            setOutgoingRequests(reqs);
        });

        return () => {
            unsubUser();
            unsubIncoming();
            unsubOutgoing();
        };
    }, []);

    const handleSearch = async () => {
        if (!searchQuery.trim() || !auth.currentUser) return;
        setIsSearching(true);
        setSearchError("");
        // Extremely basic search: get all users and filter by name/handle on client. 
        // In prod this would require Algolia/Typesense or Firebase extension, but fine for prototype
        try {
            console.log("Searching for:", searchQuery);
            console.log("Current user:", auth.currentUser.uid);
            const usersRef = collection(db, "users");
            const querySnapshot = await getDocs(usersRef);
            console.log("QuerySnapshot docs length:", querySnapshot.docs.length);

            const allUsers = querySnapshot.docs.map(d => ({ uid: d.id, ...(d.data() as any) }));
            console.log("allUsers parsed:", allUsers.length);

            const filtered = allUsers.filter(u => {
                const isNotSelf = u.uid !== auth.currentUser?.uid;

                // Safe lowercasing
                const uName = (u.displayName || "").toString().toLowerCase();
                const uHandle = (u.handle || "").toString().toLowerCase();
                const uUsername = (u.username || "").toString().toLowerCase();

                // Allow searching with or without the @ symbol
                const sQuery = searchQuery.toLowerCase().replace("@", "");

                const matchesName = uName.includes(sQuery);
                const matchesHandle = uHandle.includes(sQuery);
                const matchesUsername = uUsername.includes(sQuery);

                return isNotSelf && (matchesName || matchesHandle || matchesUsername);
            });
            console.log("Filtered length:", filtered.length);

            setSearchResults(filtered);
            setIsSearching(false);
        } catch (e: any) {
            console.error("Search failed:", e);
            setSearchError(e.message || "An error occurred while searching.");
            setIsSearching(false);
        }
    };

    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
        } else {
            // Optional: Debounce handleSearch here for real-time as-you-type (but user might hit rate limits)
            // For now, let's just clear when empty, and rely on the button or Enter key.
            const timeoutId = setTimeout(() => {
                handleSearch();
            }, 500);
            return () => clearTimeout(timeoutId);
        }
    }, [searchQuery]);

    const sendRequest = async (toUid: string) => {
        if (!auth.currentUser) return;
        try {
            // we will use a global friend_requests collection
            await addDoc(collection(db, "friend_requests"), {
                fromUid: auth.currentUser.uid,
                toUid: toUid,
                status: "pending",
                timestamp: new Date().toISOString()
            });
        } catch (e) {
            console.error("Failed to send request", e);
        }
    };

    const acceptRequest = async (requestId: string, fromUid: string) => {
        if (!auth.currentUser) return;
        try {
            // 1. Mark request as accepted (or delete it to save space)
            await deleteDoc(doc(db, "friend_requests", requestId));

            // 2. Add to both users' friends array
            await updateDoc(doc(db, "users", auth.currentUser.uid), {
                friends: arrayUnion(fromUid)
            });
            await updateDoc(doc(db, "users", fromUid), {
                friends: arrayUnion(auth.currentUser.uid)
            });
        } catch (e) {
            console.error("Failed to accept request", e);
        }
    };

    const declineRequest = async (requestId: string) => {
        try {
            await deleteDoc(doc(db, "friend_requests", requestId));
        } catch (e) {
            console.error("Failed to decline request", e);
        }
    };

    const removeFriend = async (friendId: string) => {
        if (!auth.currentUser) return;

        try {
            // Remove from my friends
            await updateDoc(doc(db, "users", auth.currentUser.uid), {
                friends: arrayRemove(friendId)
            });

            // Remove me from their friends
            await updateDoc(doc(db, "users", friendId), {
                friends: arrayRemove(auth.currentUser.uid)
            });
        } catch (e) {
            console.error("Failed to remove friend", e);
        } finally {
            setUserToUnfriend(null);
        }
    };

    return (
        <div className="flex flex-col w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans text-white pb-24 md:pb-8">
            <header className="px-4 mt-2 mb-6">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Friends</h1>
            </header>

            <div className="flex px-4 gap-2 mb-6">
                <button
                    onClick={() => setActiveTab("friends")}
                    className={`px-5 py-2.5 rounded-full text-base font-bold transition ${activeTab === "friends" ? "bg-white text-black" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}
                >
                    My Friends ({friendsList.length})
                </button>
                <button
                    onClick={() => setActiveTab("requests")}
                    className={`px-5 py-2.5 rounded-full text-base font-bold transition flex items-center gap-2 ${activeTab === "requests" ? "bg-white text-black" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}
                >
                    Requests
                    {incomingRequests.length > 0 && (
                        <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                            {incomingRequests.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab("search")}
                    className={`px-5 py-2.5 rounded-full text-base font-bold transition flex items-center gap-2 ${activeTab === "search" ? "bg-white text-black" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}
                >
                    Add Friends
                </button>
            </div>

            {activeTab === "friends" && (
                <div className="px-4 flex flex-col gap-3">
                    {friendsList.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500 text-base bg-[#111] rounded-2xl border border-zinc-800">
                            You don't have any friends yet. Let's fix that!
                        </div>
                    ) : (
                        friendsList.map(f => (
                            <div key={f.uid} onClick={() => router.push(`/profile/${f.uid}`)} className="flex items-center justify-between p-5 bg-[#111] border border-zinc-800 rounded-2xl hover:bg-zinc-800/50 transition cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center font-bold text-xl">
                                        {(f.displayName || "A").substring(0, 1).toUpperCase()}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-lg">{f.displayName || f.username || "Anonymous"}</span>
                                        <span className="text-base text-zinc-500">{f.handle || (f.username ? `@${f.username}` : "@user")}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <span className="text-base text-zinc-400 font-medium bg-zinc-800 px-3 py-1.5 rounded-full hidden sm:block">View Profile</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setUserToUnfriend(f);
                                        }}
                                        className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition flex items-center justify-center border border-red-500/20"
                                        title="Unfriend"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === "requests" && (
                <div className="px-4 flex flex-col gap-6">
                    <div>
                        <h2 className="text-base font-bold tracking-widest text-zinc-500 uppercase mb-3 px-2">Incoming Requests</h2>
                        <div className="flex flex-col gap-3">
                            {incomingRequests.length === 0 ? (
                                <div className="text-center py-6 text-zinc-600 text-base bg-[#111] rounded-2xl border border-zinc-800/50">
                                    No incoming requests.
                                </div>
                            ) : (
                                incomingRequests.map(req => (
                                    <div key={req.id} className="flex items-center justify-between p-5 bg-[#111] border border-zinc-800 rounded-2xl">
                                        <div className="flex items-center gap-3" onClick={() => router.push(`/profile/${req.fromUid}`)}>
                                            <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center font-bold text-xl cursor-pointer">
                                                {(req.sender?.displayName || "A").substring(0, 1).toUpperCase()}
                                            </div>
                                            <div className="flex flex-col cursor-pointer">
                                                <span className="font-bold text-lg">{req.sender?.displayName || req.sender?.username || "Anonymous"}</span>
                                                <span className="text-base text-zinc-500">{req.sender?.handle || (req.sender?.username ? `@${req.sender?.username}` : "@user")}</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => acceptRequest(req.id, req.fromUid)} className="w-10 h-10 rounded-full bg-[#00c805]/20 text-[#00c805] flex items-center justify-center hover:bg-[#00c805]/30 transition">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                            </button>
                                            <button onClick={() => declineRequest(req.id)} className="w-10 h-10 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500/30 transition">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div>
                        <h2 className="text-base font-bold tracking-widest text-zinc-500 uppercase mb-3 px-2">Outgoing Requests</h2>
                        <div className="flex flex-col gap-3">
                            {outgoingRequests.length === 0 ? (
                                <div className="text-center py-6 text-zinc-600 text-base bg-[#111] rounded-2xl border border-zinc-800/50">
                                    No pending outgoing requests.
                                </div>
                            ) : (
                                outgoingRequests.map(req => (
                                    <div key={req.id} className="flex items-center justify-between p-5 bg-[#111] border border-zinc-800 rounded-2xl opacity-60">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center font-bold text-xl">
                                                {(req.receiver?.displayName || "A").substring(0, 1).toUpperCase()}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-lg">{req.receiver?.displayName || req.receiver?.username || "Anonymous"}</span>
                                                <span className="text-base text-zinc-500">{req.receiver?.handle || (req.receiver?.username ? `@${req.receiver?.username}` : "@user")}</span>
                                            </div>
                                        </div>
                                        <span className="text-sm font-bold text-zinc-500 bg-zinc-800 px-3 py-1.5 rounded-full">Pending</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "search" && (
                <div className="px-4 flex flex-col gap-4">
                    <div className="relative flex items-center bg-[#1a1a1a] border border-zinc-600/60 rounded-xl py-3.5 pl-4 pr-3 gap-3 transition-all focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-500/30">
                        <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input
                            type="text"
                            placeholder="Search by name or @handle..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            className="flex-1 min-w-0 bg-transparent text-white placeholder-zinc-400 text-base focus:outline-none"
                        />
                        <button onClick={handleSearch} className="text-sm font-bold bg-white text-black px-4 py-2 rounded-lg hover:bg-zinc-200 transition">
                            {isSearching ? "..." : "Search"}
                        </button>
                    </div>

                    {searchError && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-lg text-base break-all">
                            <strong>Error:</strong> {searchError}
                        </div>
                    )}

                    <div className="flex flex-col gap-3">
                        {searchResults.length > 0 && searchResults.map(user => {
                            const isFriend = friendsList.some(f => f.uid === user.uid);
                            const hasPendingOutgoing = outgoingRequests.some(r => r.toUid === user.uid);

                            return (
                                <div key={user.uid} className="flex items-center justify-between p-5 bg-[#111] border border-zinc-800 rounded-2xl">
                                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push(`/profile/${user.uid}`)}>
                                        <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center font-bold text-xl">
                                            {(user.displayName || "A").substring(0, 1).toUpperCase()}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-lg">{user.displayName || user.username || "Anonymous"}</span>
                                            <span className="text-base text-zinc-500">{user.handle || (user.username ? `@${user.username}` : "@user")}</span>
                                        </div>
                                    </div>

                                    {isFriend ? (
                                        <span className="text-sm font-bold text-[#00c805] bg-[#00c805]/10 px-4 py-2 rounded-lg border border-[#00c805]/20">Friends</span>
                                    ) : hasPendingOutgoing ? (
                                        <span className="text-sm font-bold text-zinc-400 bg-zinc-800 px-4 py-2 rounded-lg border border-zinc-700">Requested</span>
                                    ) : (
                                        <button
                                            onClick={() => sendRequest(user.uid)}
                                            className="text-sm font-bold bg-white text-black hover:bg-zinc-200 px-4 py-2 rounded-lg transition"
                                        >
                                            Add Friend
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Unfriend Confirmation Modal */}
            {userToUnfriend && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#111] border border-zinc-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-500 mx-auto flex items-center justify-center mb-4 border border-red-500/30">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Remove Friend?</h3>
                            <p className="text-zinc-400 text-base mb-6 leading-relaxed">
                                Are you sure you want to unfriend <strong className="text-white">{userToUnfriend.displayName || userToUnfriend.username}</strong>? You will no longer be able to see each other's private portfolios or friends-only posts.
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setUserToUnfriend(null)}
                                    className="flex-1 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => removeFriend(userToUnfriend.uid)}
                                    className="flex-1 py-3 px-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                                >
                                    Unfriend
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
