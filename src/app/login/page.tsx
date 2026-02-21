import PhoneAuth from "@/components/PhoneAuth";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black p-4">
      <main className="flex w-full max-w-md flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-gray-200 dark:border-zinc-800">
        <div className="mb-8 flex items-center gap-3">
          <div className="w-8 h-8 bg-[#4ade9a] rounded-lg flex items-center justify-center">
            <span className="text-[#0d1a14] font-bold text-sm">C</span>
          </div>
          <span className="font-semibold text-xl tracking-tight text-zinc-900 dark:text-zinc-100">CashMere</span>
        </div>

        <div className="w-full">
          <PhoneAuth />
        </div>
      </main>
    </div>
  );
}
