const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

/**
 * Scopes:
 *   repo       — read PRs and issues across user's repos (public + private)
 *   read:user  — get the authenticated user's login + name
 *   read:org   — see PRs/issues in org repos the user belongs to
 */
const GITHUB_SCOPES = "repo read:user read:org";

export type GitHubTokenResponse = {
  access_token: string;
  token_type: string; // "bearer"
  scope: string;
};

export function buildGitHubAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requireEnv("GITHUB_CLIENT_ID"),
    redirect_uri: requireEnv("GITHUB_REDIRECT_URI"),
    scope: GITHUB_SCOPES,
    state,
    allow_signup: "false"
  });
  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeGitHubCodeForToken(
  code: string
): Promise<GitHubTokenResponse> {
  const res = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: requireEnv("GITHUB_CLIENT_ID"),
      client_secret: requireEnv("GITHUB_CLIENT_SECRET"),
      code,
      redirect_uri: requireEnv("GITHUB_REDIRECT_URI")
    })
  });

  if (!res.ok) {
    throw new Error(
      `GitHub token exchange failed: ${res.status} ${await res.text()}`
    );
  }

  const json = (await res.json()) as
    | GitHubTokenResponse
    | { error: string; error_description: string };

  if ("error" in json) {
    throw new Error(
      `GitHub token error: ${json.error} — ${json.error_description}`
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
