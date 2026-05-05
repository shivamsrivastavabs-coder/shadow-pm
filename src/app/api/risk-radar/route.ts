import { NextResponse } from "next/server";
import { readTokens } from "@/lib/storage/tokens";
import { linearGraphQL } from "@/lib/linear/client";
import { fetchOpenPullRequests } from "@/lib/github/client";
import { fetchRecentSlackMessages } from "@/lib/slack/client";
import { getAnthropicClient, getDefaultModel } from "@/lib/llm/anthropic";
import {
  SYSTEM_PROMPT,
  buildUserMessage
} from "@/lib/risk-radar/prompt";
import type {
  IssueForPrompt,
  PullRequestForPrompt,
  SlackMessageForPromptContext,
  RiskRadarResponse,
  RiskRadarErrorResponse,
  RiskFlag
} from "@/lib/risk-radar/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds — Claude calls can take 20-40s

const ISSUES_QUERY = /* GraphQL */ `
  query RiskRadarIssues {
    issues(first: 100, orderBy: updatedAt) {
      nodes {
        id
        identifier
        title
        description
        priority
        state { name }
        assignee { name }
        updatedAt
      }
    }
  }
`;

type RawIssue = {
  identifier: string;
  title: string;
  description: string | null;
  priority: number;
  state: { name: string };
  assignee: { name: string } | null;
  updatedAt: string;
};

type IssuesResp = { issues: { nodes: RawIssue[] } };

export async function POST(): Promise<
  NextResponse<RiskRadarResponse | RiskRadarErrorResponse>
> {
  // 1. Auth check — Linear is required, GitHub + Slack are optional (graceful degrade).
  const tokens = await readTokens();
  const linearToken = tokens.linear?.access_token;
  const githubToken = tokens.github?.access_token;
  const slackToken = tokens.slack?.access_token;
  if (!linearToken) {
    return NextResponse.json(
      { error: "Linear is not connected. Connect it on the home page first." },
      { status: 400 }
    );
  }

  // 2a. Pull Linear issues
  let issues: IssueForPrompt[];
  try {
    const data = await linearGraphQL<IssuesResp>(linearToken, ISSUES_QUERY);
    issues = data.issues.nodes.map((n) => ({
      identifier: n.identifier,
      title: n.title,
      description: n.description,
      priority: n.priority,
      state: n.state.name,
      assignee: n.assignee?.name ?? null,
      updatedAt: n.updatedAt
    }));
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to pull Linear issues: ${errMsg(err)}` },
      { status: 502 }
    );
  }

  // 2b/2c. Pull GitHub PRs and Slack messages in parallel (both optional).
  // If a connector is wired but its call fails, log and continue — partial
  // analysis beats failing the whole request.
  const [prs, slackMessages] = await Promise.all([
    fetchPRsOrEmpty(githubToken),
    fetchSlackOrEmpty(slackToken)
  ]);

  // Filter out Done/Cancelled/Duplicate — they can't slip
  const activeIssues = issues.filter(
    (i) => !["Done", "Cancelled", "Duplicate"].includes(i.state)
  );

  if (activeIssues.length === 0 && prs.length === 0) {
    return NextResponse.json({
      generated_at: new Date().toISOString(),
      model: getDefaultModel(),
      at_risk: [],
      summary:
        "No active issues or open PRs to analyze. Add work to your Linear workspace or GitHub repos and re-run."
    });
  }

  // 3. Call Claude
  const model = getDefaultModel();
  let rawText: string;
  try {
    const client = getAnthropicClient();
    const response = await client.messages.create({
      model,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserMessage(activeIssues, prs, slackMessages)
        }
      ]
    });
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      throw new Error("Claude returned no text block");
    }
    rawText = block.text;
  } catch (err) {
    return NextResponse.json(
      { error: `LLM call failed: ${errMsg(err)}` },
      { status: 502 }
    );
  }

  // 4. Parse JSON. Be lenient with code fences, just in case.
  const parsed = parseRiskRadarJSON(rawText);
  if (!parsed) {
    return NextResponse.json(
      {
        error:
          "Couldn't parse Claude's response as JSON. This usually means the prompt needs a tweak. Raw response logged to server console."
      },
      { status: 502 }
    );
  }

  // 5. Validate the AI didn't hallucinate IDs not in the input.
  // Issue IDs (SHA-NN) and PR refs (owner/repo#NN) live in the same id field
  // — we accept anything that exactly matches one of our inputs.
  const validIds = new Set<string>([
    ...activeIssues.map((i) => i.identifier),
    ...prs.map((p) => p.ref)
  ]);
  const cleanFlags: RiskFlag[] = parsed.at_risk
    .filter((f) => validIds.has(f.id))
    .slice(0, 3);

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    model,
    at_risk: cleanFlags,
    summary: parsed.summary || "(no summary returned)"
  });
}

function parseRiskRadarJSON(
  text: string
): { summary: string; at_risk: RiskFlag[] } | null {
  // Try direct parse first
  const direct = safeParse(text);
  if (direct) return direct;

  // Strip markdown fences if Claude wrapped it
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) {
    const inner = safeParse(fenced[1]);
    if (inner) return inner;
  }

  // Last resort: find the first { ... } block
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    const block = safeParse(braceMatch[0]);
    if (block) return block;
  }

  console.error("[risk-radar] Could not parse Claude response:\n", text);
  return null;
}

function safeParse(s: string): { summary: string; at_risk: RiskFlag[] } | null {
  try {
    const obj = JSON.parse(s);
    if (
      obj &&
      typeof obj === "object" &&
      Array.isArray(obj.at_risk) &&
      typeof obj.summary === "string"
    ) {
      return obj;
    }
    return null;
  } catch {
    return null;
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function fetchPRsOrEmpty(
  token: string | undefined
): Promise<PullRequestForPrompt[]> {
  if (!token) return [];
  try {
    const raw = await fetchOpenPullRequests(token, 25);
    return raw.map((p) => ({
      ref: p.ref,
      title: p.title,
      state: p.state,
      draft: p.draft,
      author: p.author,
      updatedAt: p.updated_at,
      reviewComments: p.review_comments
    }));
  } catch (err) {
    console.error("[risk-radar] GitHub PR fetch failed:", errMsg(err));
    return [];
  }
}

async function fetchSlackOrEmpty(
  token: string | undefined
): Promise<SlackMessageForPromptContext[]> {
  if (!token) return [];
  try {
    const raw = await fetchRecentSlackMessages(token);
    return raw.map((m) => ({
      channel: m.channel,
      author: m.author,
      text: m.text,
      timestamp: m.timestamp
    }));
  } catch (err) {
    console.error("[risk-radar] Slack fetch failed:", errMsg(err));
    return [];
  }
}
