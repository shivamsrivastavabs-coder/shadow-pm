/**
 * Slice 2: pull issues from Linear using the cached OAuth token
 * and print them as a table in the terminal.
 *
 * Usage: pnpm pull:linear
 * Prereq: complete the OAuth flow at http://localhost:3000 first.
 */
import { readFile } from "node:fs/promises";
import { readTokens } from "../src/lib/storage/tokens";
import { linearGraphQL } from "../src/lib/linear/client";

type Issue = {
  id: string;
  identifier: string;
  title: string;
  state: { name: string };
  assignee: { name: string } | null;
  updatedAt: string;
};

type IssuesResponse = {
  issues: { nodes: Issue[] };
  viewer: { name: string; email: string };
};

const ISSUES_QUERY = /* GraphQL */ `
  query PullIssues {
    viewer { name email }
    issues(first: 50, orderBy: updatedAt) {
      nodes {
        id
        identifier
        title
        state { name }
        assignee { name }
        updatedAt
      }
    }
  }
`;

async function main(): Promise<void> {
  await loadEnvLocal();

  const tokens = await readTokens();
  const accessToken = tokens.linear?.access_token;
  if (!accessToken) {
    console.error(
      "Not connected to Linear yet.\n" +
        "Run `pnpm dev`, open http://localhost:3000, click 'Connect Linear', then re-run this."
    );
    process.exit(1);
  }

  const data = await linearGraphQL<IssuesResponse>(accessToken, ISSUES_QUERY);

  console.log(
    `\nConnected as ${data.viewer.name} <${data.viewer.email}>\n` +
      `Pulled ${data.issues.nodes.length} issues:\n`
  );

  const rows = data.issues.nodes.map((i) => ({
    id: i.identifier,
    state: i.state.name,
    assignee: i.assignee?.name ?? "—",
    updated: i.updatedAt.slice(0, 10),
    title: truncate(i.title, 60)
  }));

  console.table(rows);
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

/**
 * Lightweight .env.local loader so this script can run standalone
 * without pulling in dotenv as a dependency.
 */
async function loadEnvLocal(): Promise<void> {
  try {
    const raw = await readFile(".env.local", "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].trim();
      }
    }
  } catch {
    // .env.local missing is fine — env vars may be set externally
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
