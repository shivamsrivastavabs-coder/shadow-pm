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

/**
 * Slim shape of a GitHub PR passed into the prompt.
 * Independent from the GitHubPullRequest API type — keep them decoupled
 * so we can reshape the prompt-side without touching the connector.
 */
export type PullRequestForPrompt = {
  /** Stable identifier — "owner/repo#42" */
  ref: string;
  title: string;
  state: "open" | "closed";
  draft: boolean;
  author: string;
  updatedAt: string; // ISO date
  /** Number of review comments — null if unknown (search API doesn't expose it) */
  reviewComments: number | null;
};

/**
 * Slack message used as *context* for the prompt — not a flaggable item itself.
 * The model uses these to cite evidence when reasoning about issues/PRs:
 *   "alex said in #engineering 3 days ago that this would ship Friday."
 */
export type SlackMessageForPromptContext = {
  channel: string; // without #
  author: string;  // display name
  text: string;
  timestamp: string; // ISO
};

export type RiskFlag = {
  /**
   * Identifier of the flagged item. Must match an input item:
   *   - For Linear issues: "SHA-7"
   *   - For GitHub PRs:    "owner/repo#42"
   */
  id: string;
  /** Title or item kind label: "issue" or "pr". Helps UI render correctly. */
  kind?: "issue" | "pr";
  /** Title, copied verbatim, for UI display. */
  title: string;
  /** 1-3 sentence reasoning grounded in the input data. No speculation. */
  why: string;
  /** Concrete, single-step action a non-technical founder could take this week. */
  suggested_action: string;
  /** "high" | "medium" — Claude's confidence the item will actually slip. */
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
