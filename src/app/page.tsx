import Link from "next/link";
import { isLinearConnected } from "@/lib/storage/tokens";
import RiskRadar from "@/components/RiskRadar";

export default async function Home() {
  const connected = await isLinearConnected();

  return (
    <main className="min-h-screen flex flex-col items-center p-8 gap-8">
      <header className="flex flex-col items-center gap-2 mt-12">
        <h1 className="text-3xl font-semibold">Shadow PM — v0</h1>
        <p className="text-sm text-neutral-400">
          Linear:{" "}
          <span
            className={
              connected ? "text-emerald-400" : "text-amber-400"
            }
          >
            {connected ? "connected" : "not connected"}
          </span>
        </p>
      </header>

      {!connected ? (
        <div className="flex flex-col items-center gap-3">
          <Link
            href="/api/auth/linear/start"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 transition-colors"
          >
            Connect Linear
          </Link>
          <p className="text-xs text-neutral-500 max-w-sm text-center">
            We'll redirect you to Linear, you authorize the app, and you bounce
            back here.
          </p>
        </div>
      ) : (
        <RiskRadar />
      )}
    </main>
  );
}
