"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, arrayUnion, addDoc, deleteDoc, getDocs } from "firebase/firestore";
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
                    setFriendsList(friendDocs.map(d => ({ uid: d.id, ...d.data() })));
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
        // Extremely basic search: get all users and filter by name/handle on client. 
        // In prod this would require Algolia/Typesense or Firebase extension, but fine for prototype
        try {
            const usersRef = collection(db, "users");
            const querySnapshot = await getDocs(usersRef);

            const allUsers = querySnapshot.docs.map(d => ({ uid: d.id, ...(d.data() as any) }));
            const filtered = allUsers.filter(u =>
                u.uid !== auth.currentUser?.uid &&
                (u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    u.handle?.toLowerCase().includes(searchQuery.toLowerCase()))
            );
            setSearchResults(filtered);
            setIsSearching(false);
        } catch (e) {
            console.error(e);
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

    return (
        <div className="flex flex-col w-full max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans text-white pb-24 md:pb-8">
            <header className="px-4 mt-2 mb-6">
                <h1 className="text-3xl font-bold tracking-tight">Friends</h1>
            </header>

            <div className="flex px-4 gap-2 mb-6">
                <button
                    onClick={() => setActiveTab("friends")}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition ${activeTab === "friends" ? "bg-white text-black" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}
                >
                    My Friends ({friendsList.length})
                </button>
                <button
                    onClick={() => setActiveTab("requests")}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition flex items-center gap-2 ${activeTab === "requests" ? "bg-white text-black" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}
                >
                    Requests
                    {incomingRequests.length > 0 && (
                        <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                            {incomingRequests.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab("search")}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition flex items-center gap-2 ${activeTab === "search" ? "bg-white text-black" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}
                >
                    Add Friends
                </button>
            </div>

            {activeTab === "friends" && (
                <div className="px-4 flex flex-col gap-3">
                    {friendsList.length === 0 ? (
                        <div className="text-center py-12 text-zinc-500 text-sm bg-[#111] rounded-2xl border border-zinc-800">
                            You don't have any friends yet. Let's fix that!
                        </div>
                    ) : (
                        friendsList.map(f => (
                            <div key={f.uid} onClick={() => router.push(`/profile/${f.uid}`)} className="flex items-center justify-between p-4 bg-[#111] border border-zinc-800 rounded-2xl hover:bg-zinc-800/50 transition cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold text-lg">
                                        {(f.displayName || "A").substring(0, 1).toUpperCase()}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold">{f.displayName || "Anonymous"}</span>
                                        <span className="text-sm text-zinc-500">{f.handle || "@user"}</span>
                                    </div>
                                </div>
                                <span className="text-sm text-zinc-400 font-medium bg-zinc-800 px-3 py-1 rounded-full">View Profile</span>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === "requests" && (
                <div className="px-4 flex flex-col gap-6">
                    <div>
                        <h2 className="text-sm font-bold tracking-widest text-zinc-500 uppercase mb-3 px-2">Incoming Requests</h2>
                        <div className="flex flex-col gap-3">
                            {incomingRequests.length === 0 ? (
                                <div className="text-center py-6 text-zinc-600 text-sm bg-[#111] rounded-2xl border border-zinc-800/50">
                                    No incoming requests.
                                </div>
                            ) : (
                                incomingRequests.map(req => (
                                    <div key={req.id} className="flex items-center justify-between p-4 bg-[#111] border border-zinc-800 rounded-2xl">
                                        <div className="flex items-center gap-3" onClick={() => router.push(`/profile/${req.fromUid}`)}>
                                            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold text-lg cursor-pointer">
                                                {(req.sender?.displayName || "A").substring(0, 1).toUpperCase()}
                                            </div>
                                            <div className="flex flex-col cursor-pointer">
                                                <span className="font-bold">{req.sender?.displayName || "Anonymous"}</span>
                                                <span className="text-sm text-zinc-500">{req.sender?.handle || "@user"}</span>
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
                        <h2 className="text-sm font-bold tracking-widest text-zinc-500 uppercase mb-3 px-2">Outgoing Requests</h2>
                        <div className="flex flex-col gap-3">
                            {outgoingRequests.length === 0 ? (
                                <div className="text-center py-6 text-zinc-600 text-sm bg-[#111] rounded-2xl border border-zinc-800/50">
                                    No pending outgoing requests.
                                </div>
                            ) : (
                                outgoingRequests.map(req => (
                                    <div key={req.id} className="flex items-center justify-between p-4 bg-[#111] border border-zinc-800 rounded-2xl opacity-60">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold text-lg">
                                                {(req.receiver?.displayName || "A").substring(0, 1).toUpperCase()}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold">{req.receiver?.displayName || "Anonymous"}</span>
                                                <span className="text-sm text-zinc-500">{req.receiver?.handle || "@user"}</span>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-zinc-500 bg-zinc-800 px-3 py-1 rounded-full">Pending</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === "search" && (
                <div className="px-4 flex flex-col gap-4">
                    <div className="relative flex items-center bg-[#1a1a1a] border border-zinc-600/60 rounded-xl py-3 pl-4 pr-3 gap-3 transition-all focus-within:border-zinc-400 focus-within:ring-2 focus-within:ring-zinc-500/30">
                        <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input
                            type="text"
                            placeholder="Search by name or @handle..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            className="flex-1 min-w-0 bg-transparent text-white placeholder-zinc-400 text-sm focus:outline-none"
                        />
                        <button onClick={handleSearch} className="text-xs font-bold bg-white text-black px-3 py-1.5 rounded-lg hover:bg-zinc-200 transition">
                            {isSearching ? "..." : "Search"}
                        </button>
                    </div>

                    <div className="flex flex-col gap-3">
                        {searchResults.length > 0 && searchResults.map(user => {
                            const isFriend = friendsList.some(f => f.uid === user.uid);
                            const hasPendingOutgoing = outgoingRequests.some(r => r.toUid === user.uid);

                            return (
                                <div key={user.uid} className="flex items-center justify-between p-4 bg-[#111] border border-zinc-800 rounded-2xl">
                                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push(`/profile/${user.uid}`)}>
                                        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center font-bold text-lg">
                                            {(user.displayName || "A").substring(0, 1).toUpperCase()}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-bold">{user.displayName || "Anonymous"}</span>
                                            <span className="text-sm text-zinc-500">{user.handle || "@user"}</span>
                                        </div>
                                    </div>

                                    {isFriend ? (
                                        <span className="text-xs font-bold text-[#00c805] bg-[#00c805]/10 px-3 py-1.5 rounded-lg border border-[#00c805]/20">Friends</span>
                                    ) : hasPendingOutgoing ? (
                                        <span className="text-xs font-bold text-zinc-400 bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700">Requested</span>
                                    ) : (
                                        <button
                                            onClick={() => sendRequest(user.uid)}
                                            className="text-xs font-bold bg-white text-black hover:bg-zinc-200 px-3 py-1.5 rounded-lg transition"
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
        </div>
    );
}
