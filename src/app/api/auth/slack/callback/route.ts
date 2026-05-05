import { NextRequest, NextResponse } from "next/server";
import { exchangeSlackCodeForToken } from "@/lib/slack/oauth";
import { readTokens, writeTokens } from "@/lib/storage/tokens";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("slack_oauth_state")?.value;

  if (!code) {
    return NextResponse.json({ error: "missing_code" }, { status: 400 });
  }
  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.json({ error: "state_mismatch" }, { status: 400 });
  }

  const token = await exchangeSlackCodeForToken(code);
  const existing = await readTokens();

  await writeTokens({
    ...existing,
    slack: {
      access_token: token.authed_user.access_token,
      obtained_at: Date.now(),
      scope: token.authed_user.scope,
      user_id: token.authed_user.id,
      team_id: token.team.id,
      team_name: token.team.name
    }
  });

  const home = new URL("/", req.url);
  const res = NextResponse.redirect(home);
  res.cookies.set("slack_oauth_state", "", { path: "/", maxAge: 0 });
  return res;
}
