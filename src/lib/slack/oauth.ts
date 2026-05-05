/**
 * Slack OAuth v2 flow.
 *
 * We request *user_scope* (not bot scope) because Shadow PM reads on behalf
 * of the authed user — same surface area they have in Slack themselves —
 * rather than acting as a bot. The token returned is at
 * `authed_user.access_token`, prefixed `xoxp-...`.
 */
const SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";

/**
 * Minimal scopes for v0:
 *   channels:history — read messages in public channels the user is in
 *   channels:read    — list public channels (so we know which to read)
 *   users:read       — resolve user ids to display names in messages
 *
 * Private channels and DMs are deliberately omitted from v0 — they're more
 * sensitive and we want to test the public-channel signal first before
 * asking design partners to grant broader access.
 */
const SLACK_USER_SCOPES = "channels:history,channels:read,users:read";

export type SlackTokenResponse = {
  ok: true;
  app_id: string;
  authed_user: {
    id: string;
    scope: string;
    access_token: string; // xoxp-...
    token_type: "user";
  };
  team: { id: string; name: string };
};

type SlackTokenErrorResponse = {
  ok: false;
  error: string;
};

export function buildSlackAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("SLACK_CLIENT_ID"),
    user_scope: SLACK_USER_SCOPES,
    redirect_uri: requireEnv("SLACK_REDIRECT_URI"),
    state
  });
  return `${SLACK_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeSlackCodeForToken(
  code: string
): Promise<SlackTokenResponse> {
  const res = await fetch(SLACK_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: requireEnv("SLACK_CLIENT_ID"),
      client_secret: requireEnv("SLACK_CLIENT_SECRET"),
      code,
      redirect_uri: requireEnv("SLACK_REDIRECT_URI")
    })
  });

  if (!res.ok) {
    throw new Error(
      `Slack token exchange HTTP ${res.status}: ${await res.text()}`
    );
  }

  const json = (await res.json()) as
    | SlackTokenResponse
    | SlackTokenErrorResponse;

  // Slack returns ok:false with a 200 on logical errors (invalid_code, etc.).
  if (!json.ok) {
    throw new Error(`Slack token error: ${json.error}`);
  }

  if (!json.authed_user?.access_token) {
    throw new Error(
      "Slack token response missing authed_user.access_token — the app may be configured with bot scopes only. Add user-token scopes (channels:history, channels:read, users:read) and reinstall."
    );
  }

  return json;
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v || v === "replace_me") {
    throw new Error(
      `Missing env var ${key}. Did you add it to .env.local? See .env.local.example.`
    );
  }
  return v;
}
