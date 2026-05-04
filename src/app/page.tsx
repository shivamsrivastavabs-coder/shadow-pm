import Link from "next/link";
import { isLinearConnected, isGitHubConnected } from "@/lib/storage/tokens";
import RiskRadar from "@/components/RiskRadar";

export default async function Home() {
  const [linearConnected, githubConnected] = await Promise.all([
    isLinearConnected(),
    isGitHubConnected()
  ]);

  return (
    <main className="min-h-screen flex flex-col items-center p-8 gap-8">
      <header className="flex flex-col items-center gap-2 mt-12">
        <h1 className="text-3xl font-semibold">Shadow PM — v0</h1>
        <p className="text-sm text-neutral-400 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span>
            Linear:{" "}
            <span
              className={
                linearConnected ? "text-emerald-400" : "text-amber-400"
              }
            >
              {linearConnected ? "connected" : "not connected"}
            </span>
          </span>
          <span>
            GitHub:{" "}
            <span
              className={
                githubConnected ? "text-emerald-400" : "text-neutral-500"
              }
            >
              {githubConnected ? "connected" : "not connected"}
            </span>
          </span>
        </p>
      </header>

      {!linearConnected ? (
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
        <div className="flex flex-col items-center gap-6 w-full">
          {!githubConnected && (
            <div className="flex flex-col items-center gap-2">
              <Link
                href="/api/auth/github/start"
                className="rounded-md bg-neutral-800 border border-neutral-700 px-4 py-2 text-sm font-medium hover:bg-neutral-700 transition-colors"
              >
                Connect GitHub (optional)
              </Link>
              <p className="text-xs text-neutral-500 max-w-sm text-center">
                Layers open PRs into the Risk Radar so it can spot stalled
                reviews and PR/issue mismatches.
              </p>
            </div>
          )}
          <RiskRadar />
        </div>
      )}
    </main>
  );
}
