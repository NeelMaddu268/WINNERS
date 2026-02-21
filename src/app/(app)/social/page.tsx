"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, updateDoc, arrayUnion, arrayRemove, addDoc, getDocs, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

export default function SocialPage() {
    const router = useRouter();
    const [isFriendsMenuOpen, setIsFriendsMenuOpen] = useState(false);
    const [selectedFriend, setSelectedFriend] = useState<any | null>(null);
    const [selectedUserDoc, setSelectedUserDoc] = useState<any | null>(null);
    const [selectedUserHoldings, setSelectedUserHoldings] = useState<any[]>([]);
    const [isFriend, setIsFriend] = useState(false);
    const [isPublic, setIsPublic] = useState(false);

    const [activities, setActivities] = useState<any[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [myFriends, setMyFriends] = useState<string[]>([]);
    const [loadingFeed, setLoadingFeed] = useState(true);
    const [activeTab, setActiveTab] = useState<"explore" | "friends">("explore");

    const [openCommentsId, setOpenCommentsId] = useState<string | null>(null);
    const [newCommentText, setNewCommentText] = useState("");

    // Mock Friends List
    const friends = [
        { name: "Sarah Jenkins", handle: "@sarahj", avatar: "SJ", color: "bg-blue-500", status: "Online" },
        { name: "Mike Ross", handle: "@miker", avatar: "MR", color: "bg-purple-500", status: "2h ago" },
        { name: "Elena Chen", handle: "@elena_invests", avatar: "EC", color: "bg-pink-500", status: "Online" },
        { name: "David Kim", handle: "@dkim", avatar: "DK", color: "bg-orange-500", status: "1d ago" },
    ];

    useEffect(() => {
        let unsubUser: (() => void) | undefined;
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            if (user) {
                unsubUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
                    if (snap.exists()) {
                        setMyFriends(snap.data().friends || []);
                    }
                });
            } else {
                setMyFriends([]);
                if (unsubUser) unsubUser();
            }
        });
        return () => {
            unsubscribeAuth();
            if (unsubUser) unsubUser();
        };
    }, []);

    // Load full details for mini-profile
    useEffect(() => {
        if (!selectedFriend || !selectedFriend.uid) return;

        const loadSelectedUser = async () => {
            const uDoc = await getDoc(doc(db, "users", selectedFriend.uid));
            if (uDoc.exists()) {
                const data = uDoc.data();
                setSelectedUserDoc(data);
                setIsPublic(data.isPublic === true);
                setIsFriend(currentUser && myFriends.includes(selectedFriend.uid));

                // Compute holdings for the top 3 display
                if (data.transactionHistory) {
                    const byTicker = new Map<string, number>();
                    for (const tx of data.transactionHistory) {
                        const current = byTicker.get(tx.ticker) || 0;
                        if (tx.type === "BUY") {
                            byTicker.set(tx.ticker, current + tx.shares);
                        } else if (tx.type === "SELL") {
                            byTicker.set(tx.ticker, current - tx.shares);
                        }
                    }
                    const activeHoldings = Array.from(byTicker.entries())
                        .filter(([, shares]) => shares > 0)
                        .map(([ticker]) => ticker);
                    setSelectedUserHoldings(activeHoldings);
                } else {
                    setSelectedUserHoldings([]);
                }
            }
        };

        loadSelectedUser();
    }, [selectedFriend, currentUser, myFriends]);

    useEffect(() => {
        const feedRef = collection(db, "global_feed");
        const q = query(feedRef, orderBy("timestamp", "desc"));

        // Seed initial data if empty
        getDocs(q).then(snap => {
            if (snap.empty) {
                const mocks = [
                    {
                        user: { name: "Sarah Jenkins", handle: "@sarahj", avatar: "SJ", color: "bg-blue-500" },
                        action: "purchased 15 shares of",
                        ticker: "TSLA",
                        timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
                        likes: [],
                        commentsList: [
                            { id: "101", uid: "mock_user_3", user: "Mike Ross", text: "Bold move on TSLA!", timestamp: new Date().toISOString() },
                            { id: "102", uid: "mock_user_4", user: "Elena Chen", text: "To the moon 🚀", timestamp: new Date().toISOString() }
                        ],
                        isPositive: false
                    },
                    {
                        user: { name: "Mike Ross", handle: "@miker", avatar: "MR", color: "bg-purple-500" },
                        action: "hit a new all-time high portfolio value!",
                        ticker: "Portfolio",
                        timestamp: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
                        likes: [],
                        commentsList: [
                            { id: "201", uid: "mock_user_6", user: "David Kim", text: "Congrats man, huge W!", timestamp: new Date().toISOString() }
                        ],
                        isPositive: true
                    },
                    {
                        user: { name: "Elena Chen", handle: "@elena_invests", avatar: "EC", color: "bg-pink-500" },
                        action: "sold their position in",
                        ticker: "AAPL",
                        timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
                        likes: [],
                        commentsList: [],
                        isPositive: true
                    }
                ];
                mocks.forEach(m => addDoc(feedRef, m));
            }
        });

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setActivities(fetched);
            setLoadingFeed(false);
        });
        return () => unsubscribe();
    }, []);

    const toggleLike = async (activity: any) => {
        if (!currentUser) return;
        const ref = doc(db, "global_feed", activity.id);
        const liked = activity.likes?.includes(currentUser.uid);

        try {
            if (liked) {
                await updateDoc(ref, { likes: arrayRemove(currentUser.uid) });
            } else {
                await updateDoc(ref, { likes: arrayUnion(currentUser.uid) });
            }
        } catch (e) {
            console.error("Failed to toggle like", e);
        }
    };

    const handleAddComment = async (activityId: string) => {
        if (!newCommentText.trim() || !currentUser) return;
        const ref = doc(db, "global_feed", activityId);
        const username = currentUser.displayName || currentUser.username || "Anonymous";

        const newComment = {
            id: Date.now().toString(),
            uid: currentUser.uid,
            user: username,
            text: newCommentText.trim(),
            timestamp: new Date().toISOString()
        };

        try {
            await updateDoc(ref, { commentsList: arrayUnion(newComment) });
            setNewCommentText("");
        } catch (e) {
            console.error("Failed to add comment", e);
        }
    };

    const timeAgo = (dateStr: string) => {
        if (!dateStr) return "";
        const diff = Date.now() - new Date(dateStr).getTime();
        const m = Math.floor(diff / 60000);
        if (m < 60) return `${Math.max(m, 1)}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
    };

    return (
        <div className="flex flex-col w-full animate-in fade-in slide-in-from-bottom-4 duration-500 font-sans text-[#f0ede8] pb-24 max-w-2xl mx-auto px-4 mt-2">
            <header className="flex justify-between items-end border-b border-[#2a3d30]/50 pb-6 mb-6">
                <div>
                    <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
                        The Feed
                    </h1>
                    <p className="text-[#a8a8a0] mt-2 text-lg">Market moves from your inner circle.</p>
                </div>
            </header>

            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveTab("explore")}
                    className={`px-5 py-2 rounded-full text-sm font-bold transition-all duration-300 ${activeTab === "explore" ? "bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]" : "bg-[#111c18] border border-[#2a3d30]/50 text-[#a8a8a0] hover:text-white hover:border-[#4ade9a]/50"}`}
                >
                    Explore
                </button>
                <button
                    onClick={() => setActiveTab("friends")}
                    className={`px-5 py-2 rounded-full text-sm font-bold transition-all duration-300 ${activeTab === "friends" ? "bg-[#4ade9a] text-[#0d1a14] shadow-[0_0_15px_rgba(74,222,154,0.3)]" : "bg-[#111c18] border border-[#2a3d30]/50 text-[#a8a8a0] hover:text-white hover:border-[#4ade9a]/50"}`}
                >
                    Friends Only
                </button>
            </div>

            {loadingFeed ? (
                <div className="flex justify-center items-center py-12">
                    <div className="w-8 h-8 border-2 border-[#4ade9a] border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    {activities.filter(a => {
                        const isMyPost = currentUser && a.user.uid === currentUser.uid;
                        const isFriendPost = currentUser && myFriends.includes(a.user.uid);

                        // First apply audience rules
                        let canView = false;
                        if (!a.audience || a.audience === "public") canView = true;
                        if (a.audience === "friends") canView = (isMyPost || isFriendPost);

                        if (!canView) return false;

                        // Then apply tab filtering
                        if (activeTab === "friends") {
                            // Only show friends posts (or my own posts)
                            return isMyPost || isFriendPost;
                        }

                        // Explore tab: show everything we can view
                        return true;
                    }).map((activity) => {
                        const likesCount = activity.likes?.length || 0;
                        const likedByMe = currentUser && activity.likes?.includes(currentUser.uid);
                        const commentsList = activity.commentsList || [];

                        return (
                            <div key={activity.id} className="bg-[#111c18] border border-[#2a3d30]/50 rounded-3xl p-6 shadow-xl transition-all duration-300">
                                {/* Header: User Info */}
                                <div className="flex items-center gap-3 mb-4 cursor-pointer group" onClick={() => setSelectedFriend(activity.user)}>
                                    <div className={`w-12 h-12 rounded-full ${activity.user.color} flex items-center justify-center font-bold text-white text-lg shadow-inner group-hover:ring-2 ring-[#4ade9a] transition-all`}>
                                        {activity.user.avatar}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg group-hover:text-[#4ade9a] transition-colors">{activity.user.name}</h3>
                                        <p className="text-sm text-[#a8a8a0]">{timeAgo(activity.timestamp)}</p>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="bg-[#1a2a22] border border-[#2a3d30] rounded-2xl p-5 mb-4 shadow-inner">
                                    <p className="text-lg">
                                        <span className="text-zinc-300">{activity.action}</span>{" "}
                                        <span className={`font-bold px-2 py-0.5 rounded-md ${activity.isPositive ? 'bg-[#00c805]/10 text-[#00c805] border border-[#00c805]/20' : 'bg-white/10 text-white border border-white/20'}`}>
                                            {activity.ticker}
                                        </span>
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-6 text-[#a8a8a0] font-medium text-sm px-2">
                                    <button
                                        onClick={() => toggleLike(activity)}
                                        className={`flex items-center gap-2 transition-colors ${likedByMe ? 'text-[#00c805]' : 'hover:text-[#00c805]'}`}
                                    >
                                        <svg className={`w-6 h-6 transform transition-transform ${likedByMe ? 'scale-110' : ''}`} fill={likedByMe ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                        </svg>
                                        {likesCount}
                                    </button>
                                    <button
                                        onClick={() => setOpenCommentsId(openCommentsId === activity.id ? null : activity.id)}
                                        className={`flex items-center gap-2 transition-colors ${openCommentsId === activity.id ? 'text-white' : 'hover:text-white'}`}
                                    >
                                        <svg className="w-6 h-6" fill={openCommentsId === activity.id ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                        {commentsList.length}
                                    </button>
                                </div>

                                {/* Comments Section */}
                                {openCommentsId === activity.id && (
                                    <div className="mt-6 pt-4 border-t border-[#2a3d30]/50 animate-in slide-in-from-top-2 duration-300">
                                        <div className="flex flex-col gap-4 mb-4">
                                            {commentsList.length === 0 ? (
                                                <p className="text-sm text-[#a8a8a0] italic">No comments yet. Be the first!</p>
                                            ) : (
                                                commentsList.map((comment: any) => (
                                                    <div key={comment.id} className="flex gap-3 items-start">
                                                        <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center font-bold text-white text-xs shrink-0">
                                                            {comment.uid === currentUser?.uid ? "ME" : comment.user.slice(0, 2).toUpperCase()}
                                                        </div>
                                                        <div className="bg-[#1a2a22] border border-[#2a3d30] rounded-2xl rounded-tl-sm px-4 py-2">
                                                            <span className="font-bold text-white text-sm block mb-0.5">{comment.user}</span>
                                                            <span className="text-[#e2e2e2] text-sm">{comment.text}</span>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 relative">
                                            <input
                                                type="text"
                                                placeholder="Add a comment..."
                                                className="w-full bg-[#1a2a22] border border-[#2a3d30] rounded-full py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-[#4ade9a] transition-colors"
                                                value={newCommentText}
                                                onChange={(e) => setNewCommentText(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleAddComment(activity.id);
                                                }}
                                                disabled={!currentUser}
                                            />
                                            <button
                                                onClick={() => handleAddComment(activity.id)}
                                                disabled={!newCommentText.trim() || !currentUser}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-[#00c805] hover:bg-[#00e306] text-black rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <svg className="w-4 h-4 translate-x-[1px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14M12 5l7 7-7 7" /></svg>
                                            </button>
                                        </div>
                                        {!currentUser && <p className="text-xs text-red-400 mt-2">Log in to comment.</p>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Floating Friends Button */}
            <button
                onClick={() => setIsFriendsMenuOpen(true)}
                className="fixed bottom-24 right-6 md:bottom-10 md:right-10 w-16 h-16 bg-[#00c805] hover:bg-[#00e306] text-black rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(0,200,5,0.4)] transition-transform hover:scale-105 z-40"
            >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </button>

            {/* Friends List Slide-up Menu */}
            {isFriendsMenuOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-0">
                    <div className="bg-[#111c18] border border-[#2a3d30] rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300 transform-gpu mb-0 sm:mb-0">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold font-serif text-white">Friends</h3>
                            <button onClick={() => setIsFriendsMenuOpen(false)} className="text-zinc-500 hover:text-white bg-black/50 w-8 h-8 rounded-full flex items-center justify-center border border-[#2a3d30]">✕</button>
                        </div>

                        <div className="flex gap-2 mb-6">
                            <button className="flex-1 bg-[#00c805] hover:bg-[#00e306] text-black font-bold py-2 rounded-xl transition text-sm shadow-[0_0_15px_rgba(0,200,5,0.2)]">Add Friend</button>
                            <button className="flex-1 bg-[#1a2a22] hover:bg-[#2a3d30] border border-[#2a3d30] text-white font-bold py-2 rounded-xl transition text-sm">Requests (2)</button>
                        </div>

                        <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                            {friends.map((friend, i) => (
                                <div key={i} onClick={() => { setIsFriendsMenuOpen(false); setSelectedFriend(friend); }} className="flex justify-between items-center p-3 hover:bg-[#1a2a22] rounded-2xl cursor-pointer transition border border-transparent hover:border-[#2a3d30] group">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-full ${friend.color} flex items-center justify-center font-bold text-white text-base shadow-inner group-hover:ring-2 ring-white/20 transition-all`}>
                                            {friend.avatar}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-white text-base">{friend.name}</h4>
                                            <div className="text-sm text-[#a8a8a0]">{friend.handle}</div>
                                        </div>
                                    </div>
                                    <div className={`text-xs font-medium px-2 py-1 rounded-md ${friend.status === 'Online' ? 'bg-[#00c805]/15 text-[#00c805] border border-[#00c805]/20 animate-pulse' : 'bg-black/40 text-zinc-500 border border-white/5'}`}>
                                        {friend.status}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Friend Profile Popup Modal */}
            {selectedFriend && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
                    <div className="bg-[#0a100d] border border-[#2a3d30]/80 rounded-[2rem] w-full max-w-sm shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-300 overflow-hidden relative group">

                        {/* Glassmorphism Header Banner */}
                        <div className={`h-32 w-full ${selectedFriend.color} opacity-40 relative overflow-hidden`}>
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0a100d] to-transparent"></div>
                            {/* Decorative particles */}
                            <div className="absolute top-4 left-1/4 w-32 h-32 bg-white/20 rounded-full blur-3xl mix-blend-overlay"></div>
                        </div>

                        {/* Profile Content */}
                        <div className="px-6 pb-8 relative -mt-8">
                            {/* Avatar pushing up into banner with glow */}
                            <div className="absolute -top-12 left-6">
                                <div className={`w-24 h-24 rounded-full ${selectedFriend.color} border-4 border-[#0a100d] flex items-center justify-center font-bold text-white text-4xl shadow-[0_0_20px_rgba(255,255,255,0.2)] relative z-10`}>
                                    {selectedFriend.avatar}
                                </div>
                            </div>

                            {/* Close Button */}
                            <button onClick={() => setSelectedFriend(null)} className="absolute top-0 right-4 -translate-y-[4.5rem] text-zinc-400 hover:text-white bg-black/40 backdrop-blur-md hover:bg-black/60 w-10 h-10 rounded-full flex items-center justify-center border border-white/10 transition z-20">
                                ✕
                            </button>

                            {/* Correct margin to clear the absolute positioned avatar properly (pt-20 gives ~5rem clearance) */}
                            <div className="pt-20">
                                <h3 className="text-3xl font-serif font-bold text-white tracking-tight" style={{ fontFamily: 'Playfair Display, serif' }}>{selectedUserDoc?.displayName || selectedUserDoc?.username || selectedFriend.name}</h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <p className="text-[#00c805] font-semibold tracking-wide flex items-center gap-1.5">
                                        {selectedUserDoc?.handle || (selectedUserDoc?.username ? `@${selectedUserDoc.username}` : selectedFriend.handle)}
                                        {selectedFriend.status === "Online" && <span className="w-2 h-2 rounded-full bg-[#00c805] shadow-[0_0_10px_#00c805] animate-pulse relative inline-block"></span>}
                                    </p>
                                    {isFriend && <span className="text-xs bg-[#00c805]/20 text-[#00c805] px-2 py-0.5 rounded-full font-bold">Friend</span>}
                                    {!isFriend && isPublic && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">Public</span>}
                                    {!isFriend && !isPublic && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold">Private</span>}
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="mt-8 grid grid-cols-2 gap-4">
                                <div className="bg-gradient-to-br from-[#1a2a22] to-[#111c18] border border-[#2a3d30]/60 rounded-2xl p-4 text-center shadow-inner hover:border-[#4ade9a]/30 transition-colors">
                                    <div className="text-3xl font-bold text-white drop-shadow-md">{selectedUserDoc?.friends?.length || 0}</div>
                                    <div className="text-xs text-[#4ade9a] font-bold uppercase tracking-widest mt-1 opacity-80">Friends</div>
                                </div>
                                <div className="bg-gradient-to-br from-[#1a2a22] to-[#111c18] border border-[#2a3d30]/60 rounded-2xl p-4 text-center shadow-inner hover:border-[#4ade9a]/30 transition-colors">
                                    <div className="text-3xl font-bold text-white drop-shadow-md">{selectedUserHoldings.length || 0}</div>
                                    <div className="text-xs text-[#4ade9a] font-bold uppercase tracking-widest mt-1 opacity-80">Assets</div>
                                </div>
                            </div>

                            {/* Top Holdings */}
                            <div className="mt-8 pt-6 border-t border-[#2a3d30]/50">
                                <h4 className="font-bold text-[#a8a8a0] text-sm mb-4 uppercase tracking-widest flex items-center gap-2">
                                    Top Holdings <span className="text-[#00c805]">★</span>
                                </h4>
                                <div className="flex flex-wrap gap-2.5">
                                    {(!isFriend && !isPublic) ? (
                                        <div className="text-sm text-zinc-500 italic">Portfolio is private 🔒</div>
                                    ) : selectedUserHoldings.length > 0 ? (
                                        selectedUserHoldings.slice(0, 3).map((ticker, idx) => (
                                            <span key={ticker} className={`${idx === 0 ? 'bg-[#00c805]/10 border-[#00c805]/30 text-[#00c805] shadow-[0_0_10px_rgba(0,200,5,0.05)]' : (idx === 1 ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.05)]' : 'bg-white/5 border-white/20 text-white')} border px-4 py-2 rounded-xl text-sm font-bold tracking-wide`}>
                                                {ticker}
                                            </span>
                                        ))
                                    ) : (
                                        <div className="text-sm text-zinc-500 italic">No current holdings</div>
                                    )}
                                </div>
                            </div>

                            {/* Action Button */}
                            <button onClick={() => router.push(`/profile/${selectedFriend.uid}`)} className="w-full mt-10 py-4 bg-gradient-to-r from-[#1a2a22] to-[#111c18] hover:from-[#2a3d30] hover:to-[#1a2a22] text-white border border-[#4ade9a]/30 rounded-2xl font-bold tracking-wide transition-all shadow-[0_5px_15px_rgba(0,0,0,0.3)] hover:shadow-[0_0_20px_rgba(74,222,154,0.15)] group relative overflow-hidden">
                                <span className="relative z-10">View Full Profile</span>
                                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
