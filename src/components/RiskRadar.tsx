"use client";

import { useState } from "react";
import type {
  RiskRadarResponse,
  RiskFlag
} from "@/lib/risk-radar/types";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: RiskRadarResponse }
  | { kind: "error"; message: string };

export default function RiskRadar() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function run() {
    setStatus({ kind: "loading" });
    try {
      const res = await fetch("/api/risk-radar", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setStatus({
          kind: "error",
          message: json.error || `HTTP ${res.status}`
        });
        return;
      }
      setStatus({ kind: "ok", data: json as RiskRadarResponse });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err)
      });
    }
  }

  return (
    <section className="w-full max-w-3xl flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Risk Radar</h2>
        <button
          onClick={run}
          disabled={status.kind === "loading"}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {status.kind === "loading" ? "Analyzing…" : "Run analysis"}
        </button>
      </div>

      {status.kind === "idle" && (
        <p className="text-sm text-neutral-500">
          Asks Claude to review your active Linear issues and flag the 3 most likely
          to slip this week, with reasoning and a suggested action.
        </p>
      )}

      {status.kind === "loading" && (
        <p className="text-sm text-neutral-400">
          Pulling issues + thinking… (typically 15–40 seconds)
        </p>
      )}

      {status.kind === "error" && (
        <div className="rounded-md border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {status.message}
        </div>
      )}

      {status.kind === "ok" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-300 italic border-l-2 border-neutral-700 pl-3">
            {status.data.summary}
          </p>

          {status.data.at_risk.length === 0 ? (
            <p className="text-sm text-emerald-400">
              No issues flagged as at-risk. Everything looks healthy.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {status.data.at_risk.map((flag) => (
                <RiskCard key={flag.id} flag={flag} />
              ))}
            </ul>
          )}

          <p className="text-xs text-neutral-600">
            Generated {new Date(status.data.generated_at).toLocaleString()} ·{" "}
            {status.data.model}
          </p>
        </div>
      )}
    </section>
  );
}

function RiskCard({ flag }: { flag: RiskFlag }) {
  const confidenceColor =
    flag.confidence === "high"
      ? "bg-red-900/60 text-red-200"
      : "bg-amber-900/60 text-amber-200";
  return (
    <li className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xs text-neutral-500">{flag.id}</span>
          <h3 className="text-sm font-medium text-neutral-100">{flag.title}</h3>
        </div>
        <span
          className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${confidenceColor}`}
        >
          {flag.confidence}
        </span>
      </div>

      <p className="text-sm text-neutral-300">
        <span className="text-neutral-500">Why: </span>
        {flag.why}
      </p>

      <p className="text-sm text-neutral-300">
        <span className="text-neutral-500">Action: </span>
        {flag.suggested_action}
      </p>
    </li>
  );
}
