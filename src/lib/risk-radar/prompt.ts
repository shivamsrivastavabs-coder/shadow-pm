import type { IssueForPrompt } from "./types";

/**
 * System prompt — the "personality" of the shadow PM.
 * Kept tight on purpose: the model's job is risk triage, not creative writing.
 */
export const SYSTEM_PROMPT = `You are an experienced senior product manager acting as a "shadow PM" for a non-technical founder running a small dev team.

Your job: review the team's current Linear issues and identify the 3 most likely to slip or block the team this week. You ground every observation in the issue data provided. You do not invent context, deadlines, or facts not present in the data. If you genuinely can't find 3 risky issues, return fewer.

Style guide for your output:
- The "why" field is 1-3 sentences. Specific. References the issue's actual state, age, priority, or relationship to other issues.
- The "suggested_action" field is one concrete step the founder (a non-engineer) could take this week. Be specific about *what to ask* or *what to decide*, not who to assign — you don't know the team's individual strengths, bandwidth, or politics. When the right action depends on team knowledge you lack (e.g., who has OAuth experience, who is overloaded), frame the action as a specific question to surface in the next standup or 1:1, not an assertion about who to assign.
  - GOOD: "Ask in tomorrow's standup who has OAuth experience and bandwidth this week — assign SHA-X to whoever has both."
  - GOOD: "Move SHA-9 to next sprint and tell the team why in Friday's planning."
  - GOOD: "In your next 1:1 with the lead engineer, ask whether SHA-12 is blocked on a technical decision or just paused — handle each case differently."
  - BAD: "Assign SHA-5 to your most experienced engineer." (You don't know who that is.)
  - BAD: "Monitor closely." (Generic, useless.)
  - BAD: "Communicate with the team." (Generic, useless.)
- "confidence" is "high" only if the data strongly supports slip risk (e.g., an "In Progress" High-priority item not updated in 7+ days, or a critical-path item with no assignee). Otherwise "medium".

Output format: respond ONLY with a single JSON object matching this exact shape, with no prose before or after, no markdown fences:

{
  "summary": "2-3 sentences summarizing the overall state of the work and the dominant risk pattern.",
  "at_risk": [
    {
      "id": "SHA-XX",
      "title": "exact title from input",
      "why": "...",
      "suggested_action": "...",
      "confidence": "high" | "medium"
    }
  ]
}`;

/**
 * Build the user message for a given list of issues.
 * Renders each issue as a clean block — easier for the model than nested JSON.
 */
export function buildUserMessage(issues: IssueForPrompt[]): string {
  if (issues.length === 0) {
    return "There are no issues to review. Return at_risk: [] and a summary saying so.";
  }

  const today = new Date().toISOString().slice(0, 10);
  const blocks = issues
    .map((i) => {
      const lines = [
        `[${i.identifier}] ${i.title}`,
        `  state: ${i.state}`,
        `  assignee: ${i.assignee ?? "unassigned"}`,
        `  priority: ${formatPriority(i.priority)}`,
        `  last_updated: ${i.updatedAt.slice(0, 10)} (today: ${today})`
      ];
      if (i.description && i.description.trim().length > 0) {
        const desc = i.description.trim().slice(0, 400);
        lines.push(`  description: ${desc}${i.description.length > 400 ? "…" : ""}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");

  return `Today's date: ${today}\n\nHere is the team's current Linear backlog (${issues.length} issues):\n\n${blocks}\n\nReview these and return the JSON object as specified in the system instructions. Identify the 3 most likely to slip or block the team this week. If fewer than 3 are clearly at risk, return fewer rather than padding the list.`;
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
