import type {
  IssueForPrompt,
  PullRequestForPrompt,
  SlackMessageForPromptContext
} from "./types";

/**
 * System prompt — the "personality" of the shadow PM.
 * Kept tight on purpose: the model's job is risk triage, not creative writing.
 */
export const SYSTEM_PROMPT = `You are an experienced senior product manager acting as a "shadow PM" for a non-technical founder running a small dev team.

Your job: review the team's current Linear issues, open GitHub pull requests, and recent Slack chatter from the team's channels, then identify the 3 items most likely to slip or block the team this week. The flagged item itself must be a Linear issue or a GitHub PR — Slack messages are *evidence* you cite when explaining the risk, not flaggable items themselves. You ground every observation in the data provided. You do not invent context, deadlines, commitments, or facts not present in the data. If you genuinely can't find 3 risky items, return fewer.

Cross-tool patterns to watch for:
- A PR open 4+ days with no recent updates — likely stalled in review.
- A draft PR that hasn't moved — author may be blocked or has moved on.
- An "In Progress" Linear issue with no corresponding open PR after several days — work may not have actually started.
- A PR whose title clearly matches a Linear issue still in "Todo" — Linear is out of sync, the team has lost the source of truth.
- Someone publicly committed to a date in Slack ("I'll have this done by Friday") and the corresponding issue/PR is not on track to meet it. This is the highest-signal pattern when present — quote the message in the "why".
- Someone flagged a blocker in Slack ("waiting on X", "stuck on Y") with no follow-up and no update on the related item.
- A Slack discussion identifies a decision that needs to be made, but the related issue is still in Todo with no movement after the discussion.

When citing Slack evidence in the "why" field, quote the relevant phrase and name the channel and how many days ago: e.g., 'In #engineering 3 days ago, alex said "I'll wrap this Friday" — but PR is still draft with no commits since.'

Style guide for your output:
- The "why" field is 1-3 sentences. Specific. References the item's actual state, age, priority, or relationship to other items (cite IDs when relevant).
- The "suggested_action" field is one concrete step the founder (a non-engineer) could take this week. Be specific about *what to ask* or *what to decide*, not who to assign — you don't know the team's individual strengths, bandwidth, or politics. When the right action depends on team knowledge you lack (e.g., who has OAuth experience, who is overloaded), frame the action as a specific question to surface in the next standup or 1:1, not an assertion about who to assign.
  - GOOD: "Ask in tomorrow's standup who has OAuth experience and bandwidth this week — assign SHA-X to whoever has both."
  - GOOD: "Move SHA-9 to next sprint and tell the team why in Friday's planning."
  - GOOD: "In your next 1:1 with the lead engineer, ask whether SHA-12 is blocked on a technical decision or just paused — handle each case differently."
  - GOOD: "Ping the PR author in Slack and ask if they're stuck on review feedback or just out — the answer changes whether you escalate or wait."
  - BAD: "Assign SHA-5 to your most experienced engineer." (You don't know who that is.)
  - BAD: "Monitor closely." (Generic, useless.)
  - BAD: "Communicate with the team." (Generic, useless.)
- "kind" is "issue" for Linear items, "pr" for GitHub items.
- "confidence" is "high" only if the data strongly supports slip risk (e.g., an "In Progress" High-priority item not updated in 7+ days, or a PR open 5+ days with no recent activity, or a critical-path item with no assignee). Otherwise "medium".

Output format: respond ONLY with a single JSON object matching this exact shape, with no prose before or after, no markdown fences:

{
  "summary": "2-3 sentences summarizing the overall state of the work and the dominant risk pattern.",
  "at_risk": [
    {
      "id": "SHA-XX or owner/repo#NN",
      "kind": "issue" | "pr",
      "title": "exact title from input",
      "why": "...",
      "suggested_action": "...",
      "confidence": "high" | "medium"
    }
  ]
}`;

/**
 * Build the user message for a given list of issues + open PRs + recent Slack messages.
 * Renders each block as plain text — easier for the model than nested JSON.
 */
export function buildUserMessage(
  issues: IssueForPrompt[],
  prs: PullRequestForPrompt[] = [],
  slackMessages: SlackMessageForPromptContext[] = []
): string {
  if (issues.length === 0 && prs.length === 0) {
    return "There are no issues or pull requests to review. Return at_risk: [] and a summary saying so.";
  }

  const today = new Date().toISOString().slice(0, 10);

  const issueBlocks = issues
    .map((i) => {
      const lines = [
        `[${i.identifier}] ${i.title}`,
        `  kind: issue`,
        `  state: ${i.state}`,
        `  assignee: ${i.assignee ?? "unassigned"}`,
        `  priority: ${formatPriority(i.priority)}`,
        `  last_updated: ${i.updatedAt.slice(0, 10)} (today: ${today})`
      ];
      if (i.description && i.description.trim().length > 0) {
        const desc = i.description.trim().slice(0, 400);
        lines.push(
          `  description: ${desc}${i.description.length > 400 ? "…" : ""}`
        );
      }
      return lines.join("\n");
    })
    .join("\n\n");

  const prBlocks = prs
    .map((p) => {
      const ageDays = daysSince(p.updatedAt, today);
      const lines = [
        `[${p.ref}] ${p.title}`,
        `  kind: pr`,
        `  state: ${p.draft ? "draft" : p.state}`,
        `  author: ${p.author}`,
        `  last_updated: ${p.updatedAt.slice(0, 10)} (today: ${today}, ${ageDays} day${ageDays === 1 ? "" : "s"} since update)`
      ];
      if (p.reviewComments != null) {
        lines.push(`  review_comments: ${p.reviewComments}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");

  const sections: string[] = [`Today's date: ${today}`];

  if (issues.length > 0) {
    sections.push(
      `Linear backlog (${issues.length} active issue${issues.length === 1 ? "" : "s"}):\n\n${issueBlocks}`
    );
  } else {
    sections.push("Linear backlog: (none)");
  }

  if (prs.length > 0) {
    sections.push(
      `Open GitHub PRs involving the user (${prs.length}):\n\n${prBlocks}`
    );
  } else {
    sections.push("Open GitHub PRs: (none)");
  }

  if (slackMessages.length > 0) {
    const slackBlocks = slackMessages
      .map((m) => {
        const ageDays = daysSince(m.timestamp, today);
        const when =
          ageDays === 0
            ? "today"
            : ageDays === 1
            ? "yesterday"
            : `${ageDays} days ago`;
        // Cap message length so one verbose post doesn't blow the budget.
        const text = m.text.length > 280 ? `${m.text.slice(0, 280)}…` : m.text;
        return `[#${m.channel}] ${m.author} (${when}): ${text}`;
      })
      .join("\n");
    sections.push(
      `Recent Slack messages from the team's channels (last 7 days, newest first, ${slackMessages.length} messages):\n\n${slackBlocks}`
    );
  } else {
    sections.push("Recent Slack messages: (none — Slack not connected or no recent activity)");
  }

  sections.push(
    "Review the issues, PRs, and Slack chatter together. Identify the 3 issues or PRs most likely to slip or block the team this week. When Slack messages contain commitments, blockers, or decisions relevant to an issue/PR, quote them in the 'why' field — that's the highest-signal evidence you have. If fewer than 3 items are clearly at risk, return fewer rather than padding the list."
  );

  return sections.join("\n\n");
}

function formatPriority(p?: number | null): string {
  switch (p) {
    case 1: return "urgent";
    case 2: return "high";
    case 3: return "medium";
    case 4: return "low";
    default: return "none";
  }
}

function daysSince(iso: string, todayIso: string): number {
  const a = new Date(iso).getTime();
  const b = new Date(todayIso).getTime();
  return Math.max(0, Math.floor((b - a) / (1000 * 60 * 60 * 24)));
}
