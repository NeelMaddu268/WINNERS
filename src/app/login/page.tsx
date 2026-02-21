import Image from "next/image";
import PhoneAuth from "@/components/PhoneAuth";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black p-4">
      <main className="flex w-full max-w-md flex-col items-center justify-center p-8 bg-white dark:bg-zinc-900 rounded-2xl shadow-lg border border-gray-200 dark:border-zinc-800">
        <div className="mb-8 w-full flex justify-center">
          <Image
            className="dark:invert"
            src="/next.svg"
            alt="Next.js logo"
            width={100}
            height={20}
            priority
          />
        </div>

        <div className="w-full">
          <PhoneAuth />
        </div>
      </main>
    </div>
  );
}
