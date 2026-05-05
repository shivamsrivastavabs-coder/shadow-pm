import { promises as fs } from "node:fs";
import path from "node:path";

const TOKEN_PATH = path.join(process.cwd(), ".data", "tokens.json");

export type StoredTokens = {
  linear?: {
    access_token: string;
    obtained_at: number; // ms epoch
    expires_in: number;  // seconds
    scope: string;
  };
  github?: {
    access_token: string;
    obtained_at: number;
    scope: string;
    token_type: string; // typically "bearer"
  };
  slack?: {
    /** User token, prefixed "xoxp-..." — acts on behalf of the authed user */
    access_token: string;
    obtained_at: number;
    scope: string;
    /** Slack user id, e.g. "U02ABCDE" */
    user_id: string;
    /** Workspace info — useful for the UI */
    team_id: string;
    team_name: string;
  };
};

export async function readTokens(): Promise<StoredTokens> {
  try {
    const raw = await fs.readFile(TOKEN_PATH, "utf8");
    return JSON.parse(raw) as StoredTokens;
  } catch {
    return {};
  }
}

export async function writeTokens(next: StoredTokens): Promise<void> {
  await fs.mkdir(path.dirname(TOKEN_PATH), { recursive: true });
  await fs.writeFile(TOKEN_PATH, JSON.stringify(next, null, 2), "utf8");
}

export async function isLinearConnected(): Promise<boolean> {
  const t = await readTokens();
  return Boolean(t.linear?.access_token);
}

export async function isGitHubConnected(): Promise<boolean> {
  const t = await readTokens();
  return Boolean(t.github?.access_token);
}

export async function isSlackConnected(): Promise<boolean> {
  const t = await readTokens();
  return Boolean(t.slack?.access_token);
}
