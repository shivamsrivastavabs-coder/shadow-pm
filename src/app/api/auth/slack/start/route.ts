import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { buildSlackAuthorizeUrl } from "@/lib/slack/oauth";

export async function GET() {
  const state = randomBytes(16).toString("hex");
  const url = buildSlackAuthorizeUrl(state);

  const res = NextResponse.redirect(url);
  res.cookies.set("slack_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600 // 10 min
  });
  return res;
}
