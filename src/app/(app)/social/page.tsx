export default function SocialPage() {
    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Social Feed</h1>
                <p className="text-zinc-600 dark:text-zinc-400 mt-1">See what your friends are trading and discussing.</p>
            </header>

            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                {/* Temporary placeholder for social feed */}
                <div className="flex flex-col items-center justify-center py-16 text-zinc-500 dark:text-zinc-400">
                    <svg className="w-16 h-16 mb-4 text-zinc-300 dark:text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                    <p className="font-medium">It's quiet here...</p>
                    <p className="text-sm">Follow some friends to see their activity.</p>
                </div>
            </div>
        </div>
    );
}
