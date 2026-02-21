"use client";

import { useState } from "react";

export default function SocialPage() {
    const [isFriendsMenuOpen, setIsFriendsMenuOpen] = useState(false);
    const [selectedFriend, setSelectedFriend] = useState<any | null>(null);

    // Mock Feed Data
    const feedActivities = [
        {
            id: 1,
            user: { name: "Sarah Jenkins", handle: "@sarahj", avatar: "SJ", color: "bg-blue-500" },
            action: "purchased 15 shares of",
            ticker: "TSLA",
            time: "2 hours ago",
            likes: 12,
            comments: 3,
            isPositive: false
        },
        {
            id: 2,
            user: { name: "Mike Ross", handle: "@miker", avatar: "MR", color: "bg-purple-500" },
            action: "hit a new all-time high portfolio value!",
            ticker: "Portfolio",
            time: "5 hours ago",
            likes: 45,
            comments: 8,
            isPositive: true
        },
        {
            id: 3,
            user: { name: "Elena Chen", handle: "@elena_invests", avatar: "EC", color: "bg-pink-500" },
            action: "sold their position in",
            ticker: "AAPL",
            time: "1 day ago",
            likes: 5,
            comments: 1,
            isPositive: true
        }
    ];

    // Mock Friends List
    const friends = [
        { name: "Sarah Jenkins", handle: "@sarahj", avatar: "SJ", color: "bg-blue-500", status: "Online" },
        { name: "Mike Ross", handle: "@miker", avatar: "MR", color: "bg-purple-500", status: "2h ago" },
        { name: "Elena Chen", handle: "@elena_invests", avatar: "EC", color: "bg-pink-500", status: "Online" },
        { name: "David Kim", handle: "@dkim", avatar: "DK", color: "bg-orange-500", status: "1d ago" },
    ];

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

            {/* Scrolling Feed */}
            <div className="flex flex-col gap-6">
                {feedActivities.map((activity) => (
                    <div key={activity.id} className="bg-[#111c18] border border-[#2a3d30]/50 rounded-3xl p-6 shadow-xl">
                        {/* Header: User Info */}
                        <div className="flex items-center gap-3 mb-4 cursor-pointer group" onClick={() => setSelectedFriend(activity.user)}>
                            <div className={`w-12 h-12 rounded-full ${activity.user.color} flex items-center justify-center font-bold text-white text-lg shadow-inner group-hover:ring-2 ring-[#4ade9a] transition-all`}>
                                {activity.user.avatar}
                            </div>
                            <div>
                                <h3 className="font-bold text-lg group-hover:text-[#4ade9a] transition-colors">{activity.user.name}</h3>
                                <p className="text-sm text-[#a8a8a0]">{activity.time}</p>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="bg-[#1a2a22] border border-[#2a3d30] rounded-2xl p-5 mb-4">
                            <p className="text-lg">
                                <span className="text-zinc-300">{activity.action}</span>{" "}
                                <span className={`font-bold px-2 py-0.5 rounded-md ${activity.isPositive ? 'bg-[#00c805]/10 text-[#00c805]' : 'bg-white/10 text-white'}`}>
                                    {activity.ticker}
                                </span>
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-6 text-[#a8a8a0] font-medium text-sm px-2">
                            <button className="flex items-center gap-2 hover:text-[#00c805] transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                                {activity.likes}
                            </button>
                            <button className="flex items-center gap-2 hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                {activity.comments}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Floating Friends Button */}
            <button
                onClick={() => setIsFriendsMenuOpen(true)}
                className="fixed bottom-24 right-6 md:bottom-10 md:right-10 w-16 h-16 bg-[#00c805] hover:bg-[#00e306] text-black rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(0,200,5,0.3)] transition-transform hover:scale-105 z-40"
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
                            <button className="flex-1 bg-[#00c805] hover:bg-[#00e306] text-black font-bold py-2 rounded-xl transition text-sm">Add Friend</button>
                            <button className="flex-1 bg-[#1a2a22] hover:bg-[#2a3d30] border border-[#2a3d30] text-white font-bold py-2 rounded-xl transition text-sm">Requests (2)</button>
                        </div>

                        <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                            {friends.map((friend, i) => (
                                <div key={i} onClick={() => { setIsFriendsMenuOpen(false); setSelectedFriend(friend); }} className="flex justify-between items-center p-3 hover:bg-[#1a2a22] rounded-2xl cursor-pointer transition border border-transparent hover:border-[#2a3d30]/50">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full ${friend.color} flex items-center justify-center font-bold text-white text-sm shadow-inner`}>
                                            {friend.avatar}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-white">{friend.name}</h4>
                                            <div className="text-xs text-[#a8a8a0]">{friend.handle}</div>
                                        </div>
                                    </div>
                                    <div className={`text-xs font-medium px-2 py-1 rounded-md ${friend.status === 'Online' ? 'bg-[#00c805]/10 text-[#00c805]' : 'bg-black/40 text-zinc-500 border border-white/5'}`}>
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
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
                    <div className="bg-gradient-to-b from-[#1a2a22] to-[#111c18] border border-[#2a3d30] rounded-3xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">

                        {/* Header Banner */}
                        <div className={`h-24 w-full ${selectedFriend.color} opacity-80`}></div>

                        {/* Profile Content */}
                        <div className="px-6 pb-6 relative">
                            {/* Avatar pushing up into banner */}
                            <div className="absolute -top-12 left-6">
                                <div className={`w-24 h-24 rounded-full ${selectedFriend.color} border-4 border-[#1a2a22] flex items-center justify-center font-bold text-white text-3xl shadow-xl`}>
                                    {selectedFriend.avatar}
                                </div>
                            </div>

                            {/* Close Button */}
                            <button onClick={() => setSelectedFriend(null)} className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-black/50 hover:bg-black/80 w-8 h-8 rounded-full flex items-center justify-center border border-white/10 transition">✕</button>

                            <div className="mt-14">
                                <h3 className="text-2xl font-bold text-white">{selectedFriend.name}</h3>
                                <p className="text-[#00c805] font-medium">{selectedFriend.handle}</p>
                            </div>

                            <div className="mt-6 flex gap-4">
                                <div className="flex-1 bg-black/40 border border-[#2a3d30]/50 rounded-2xl p-4 text-center">
                                    <div className="text-2xl font-bold text-white">12</div>
                                    <div className="text-xs text-[#a8a8a0] uppercase tracking-wider mt-1">Following</div>
                                </div>
                                <div className="flex-1 bg-black/40 border border-[#2a3d30]/50 rounded-2xl p-4 text-center">
                                    <div className="text-2xl font-bold text-white">48</div>
                                    <div className="text-xs text-[#a8a8a0] uppercase tracking-wider mt-1">Followers</div>
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-[#2a3d30]/50">
                                <h4 className="font-bold text-[#a8a8a0] text-sm mb-3">Top Holdings</h4>
                                <div className="flex gap-2">
                                    <span className="bg-[#1a2a22] border border-[#2a3d30] px-3 py-1.5 rounded-lg text-sm font-bold">NVDA</span>
                                    <span className="bg-[#1a2a22] border border-[#2a3d30] px-3 py-1.5 rounded-lg text-sm font-bold">MSFT</span>
                                    <span className="bg-[#1a2a22] border border-[#2a3d30] px-3 py-1.5 rounded-lg text-sm font-bold">AAPL</span>
                                </div>
                            </div>

                            <button className="w-full mt-8 py-3.5 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-bold transition">
                                View Full Portfolio
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
