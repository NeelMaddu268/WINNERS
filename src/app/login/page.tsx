import PhoneAuth from "@/components/PhoneAuth";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a110e] font-sans p-4 relative overflow-hidden z-0">
      {/* Decorative gradient blur */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-96 bg-[#4ade9a]/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      <main className="flex w-full max-w-md flex-col items-center justify-center p-8 md:p-10 bg-[#111c18] rounded-3xl shadow-[0_0_40px_rgba(74,222,154,0.05)] border border-[#2a3d30]/50 relative z-10">
        <div className="mb-10 flex items-center gap-3 justify-center">
          <div className="w-10 h-10 bg-[#4ade9a] rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(74,222,154,0.3)]">
            <span className="text-[#0d1a14] font-bold text-xl">C</span>
          </div>
          <span className="font-serif font-bold text-3xl tracking-tight text-white" style={{ fontFamily: 'Playfair Display, serif' }}>CashMere</span>
        </div>

        <div className="w-full">
          <PhoneAuth />
        </div>
      </main>
    </div>
  );
}
