const LINEAR_AUTHORIZE_URL = "https://linear.app/oauth/authorize";
const LINEAR_TOKEN_URL = "https://api.linear.app/oauth/token";

export type LinearTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
};

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: requireEnv("LINEAR_CLIENT_ID"),
    redirect_uri: requireEnv("LINEAR_REDIRECT_URI"),
    scope: "read,write,issues:create",
    state,
    prompt: "consent"
  });
  return `${LINEAR_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string
): Promise<LinearTokenResponse> {
  const body = new URLSearchParams({
    code,
    redirect_uri: requireEnv("LINEAR_REDIRECT_URI"),
    client_id: requireEnv("LINEAR_CLIENT_ID"),
    client_secret: requireEnv("LINEAR_CLIENT_SECRET"),
    grant_type: "authorization_code"
  });

  const res = await fetch(LINEAR_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Linear token exchange failed: ${res.status} ${text}`);
  }

  return (await res.json()) as LinearTokenResponse;
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v || v === "replace_me") {
    throw new Error(
      `Missing env var ${key}. Did you copy .env.local.example to .env.local and fill it in?`
    );
  }
  return v;
}
