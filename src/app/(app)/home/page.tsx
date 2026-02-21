export default function HomePage() {
    return (
        <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header>
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Portfolio</h1>
                <p className="text-zinc-600 dark:text-zinc-400 mt-1">Here is how your stocks are performing today.</p>
            </header>

            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
                {/* Temporary placeholder for portfolio data */}
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500 dark:text-zinc-400">
                    <svg className="w-16 h-16 mb-4 text-zinc-300 dark:text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                    <p className="font-medium">Your portfolio is empty.</p>
                    <p className="text-sm">Start trading to see your balances here!</p>
                </div>
            </div>
        </div>
    );
}
