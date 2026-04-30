/**
 * Shared types for the Risk Radar feature.
 * Kept in one file so the route, the prompt, and the UI agree on shape.
 */

export type IssueForPrompt = {
  identifier: string; // e.g. "SHA-7"
  title: string;
  state: string;
  assignee: string | null;
  updatedAt: string; // ISO date
  description?: string | null;
  priority?: number | null; // Linear: 0=none, 1=urgent, 2=high, 3=medium, 4=low
};

export type RiskFlag = {
  /** Issue identifier from Linear, e.g. "SHA-7". Must match an input issue. */
  id: string;
  /** Issue title, copied verbatim, for UI display. */
  title: string;
  /** 1-3 sentence reasoning grounded in the issue data. No speculation. */
  why: string;
  /** Concrete, single-step action a non-technical founder could take this week. */
  suggested_action: string;
  /** "high" | "medium" — Claude's confidence the issue will actually slip. */
  confidence: "high" | "medium";
};

export type RiskRadarResponse = {
  generated_at: string;
  model: string;
  at_risk: RiskFlag[];
  /** Brief overall summary, 2-3 sentences. */
  summary: string;
};

export type RiskRadarErrorResponse = {
  error: string;
};
