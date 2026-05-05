import Link from "next/link";
import {
  isLinearConnected,
  isGitHubConnected,
  isSlackConnected
} from "@/lib/storage/tokens";
import RiskRadar from "@/components/RiskRadar";

export default async function Home() {
  const [linearConnected, githubConnected, slackConnected] = await Promise.all([
    isLinearConnected(),
    isGitHubConnected(),
    isSlackConnected()
  ]);

  return (
    <main className="min-h-screen flex flex-col items-center p-8 gap-8">
      <header className="flex flex-col items-center gap-2 mt-12">
        <h1 className="text-3xl font-semibold">Shadow PM — v0</h1>
        <p className="text-sm text-neutral-400 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <ConnectorPill name="Linear" connected={linearConnected} required />
          <ConnectorPill name="GitHub" connected={githubConnected} />
          <ConnectorPill name="Slack" connected={slackConnected} />
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
          <div className="flex flex-wrap gap-2 justify-center">
            {!githubConnected && (
              <ConnectButton
                href="/api/auth/github/start"
                label="Connect GitHub"
              />
            )}
            {!slackConnected && (
              <ConnectButton
                href="/api/auth/slack/start"
                label="Connect Slack"
              />
            )}
          </div>
          {(!githubConnected || !slackConnected) && (
            <p className="text-xs text-neutral-500 max-w-md text-center -mt-3">
              GitHub layers open PRs into the analysis. Slack adds recent team
              chatter so the radar can spot dropped commitments and mentioned
              blockers.
            </p>
          )}
          <RiskRadar />
        </div>
      )}
    </main>
  );
}

function ConnectorPill({
  name,
  connected,
  required = false
}: {
  name: string;
  connected: boolean;
  required?: boolean;
}) {
  const label = connected
    ? "connected"
    : required
    ? "not connected"
    : "not connected";
  const color = connected
    ? "text-emerald-400"
    : required
    ? "text-amber-400"
    : "text-neutral-500";
  return (
    <span>
      {name}: <span className={color}>{label}</span>
    </span>
  );
}

function ConnectButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md bg-neutral-800 border border-neutral-700 px-4 py-2 text-sm font-medium hover:bg-neutral-700 transition-colors"
    >
      {label}
    </Link>
  );
}
