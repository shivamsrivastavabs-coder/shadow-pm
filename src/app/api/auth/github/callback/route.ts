import { NextRequest, NextResponse } from "next/server";
import { exchangeGitHubCodeForToken } from "@/lib/github/oauth";
import { readTokens, writeTokens } from "@/lib/storage/tokens";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("github_oauth_state")?.value;

  if (!code) {
    return NextResponse.json({ error: "missing_code" }, { status: 400 });
  }
  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.json({ error: "state_mismatch" }, { status: 400 });
  }

  const token = await exchangeGitHubCodeForToken(code);
  const existing = await readTokens();

  await writeTokens({
    ...existing,
    github: {
      access_token: token.access_token,
      obtained_at: Date.now(),
      scope: token.scope,
      token_type: token.token_type
    }
  });

  const home = new URL("/", req.url);
  const res = NextResponse.redirect(home);
  // clear the one-shot state cookie
  res.cookies.set("github_oauth_state", "", { path: "/", maxAge: 0 });
  return res;
}
