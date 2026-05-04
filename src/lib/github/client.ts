/**
 * Minimal GitHub REST client.
 * We use search/issues for PR pulls because it's the cheapest way to get
 * "PRs across all the user's repos" without iterating every repo.
 */

const GITHUB_API_BASE = "https://api.github.com";

export type GitHubPullRequest = {
  /** GitHub's PR number, e.g. 42 */
  number: number;
  /** "owner/repo#42" — useful as a stable identifier in prompts */
  ref: string;
  title: string;
  state: "open" | "closed";
  draft: boolean;
  /** GitHub login of the PR author, e.g. "shivamsrivastavabs-coder" */
  author: string;
  /** ISO timestamp */
  updated_at: string;
  created_at: string;
  /** Number of review comments on the PR (rough proxy for review activity) */
  review_comments: number | null;
  /** URL to the PR for the UI */
  html_url: string;
  /** Repo full name, e.g. "shivamsrivastavabs-coder/shadow-pm" */
  repo: string;
  /** Body, truncated by caller. May be null. */
  body: string | null;
};

type SearchIssuesItem = {
  number: number;
  title: string;
  state: "open" | "closed";
  draft?: boolean;
  user: { login: string } | null;
  updated_at: string;
  created_at: string;
  body: string | null;
  html_url: string;
  pull_request?: { url: string };
  repository_url: string;
};

type SearchIssuesResponse = {
  total_count: number;
  incomplete_results: boolean;
  items: SearchIssuesItem[];
};

/**
 * Pull all open PRs that involve the authenticated user across their repos.
 * "Involves" = author, assignee, mentioned, or review-requested.
 */
export async function fetchOpenPullRequests(
  token: string,
  limit: number = 50
): Promise<GitHubPullRequest[]> {
  // GitHub's search API: PRs where the user is involved, open, sorted by recent updates
  const q = encodeURIComponent("is:pr is:open involves:@me");
  const url = `${GITHUB_API_BASE}/search/issues?q=${q}&sort=updated&order=desc&per_page=${limit}`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  if (!res.ok) {
    throw new Error(
      `GitHub search/issues failed: ${res.status} ${await res.text()}`
    );
  }

  const json = (await res.json()) as SearchIssuesResponse;
  return json.items
    .filter((i) => i.pull_request) // search/issues returns issues + PRs; filter to PRs
    .map((i) => {
      const repo = repoFromApiUrl(i.repository_url);
      return {
        number: i.number,
        ref: `${repo}#${i.number}`,
        title: i.title,
        state: i.state,
        draft: Boolean(i.draft),
        author: i.user?.login ?? "unknown",
        updated_at: i.updated_at,
        created_at: i.created_at,
        review_comments: null, // search API doesn't include this; fetch per-PR if we want it later
        html_url: i.html_url,
        repo,
        body: i.body
      } satisfies GitHubPullRequest;
    });
}

export async function fetchAuthenticatedUser(
  token: string
): Promise<{ login: string; name: string | null }> {
  const res = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if (!res.ok) {
    throw new Error(`GitHub /user failed: ${res.status}`);
  }
  const j = (await res.json()) as { login: string; name: string | null };
  return { login: j.login, name: j.name };
}

function repoFromApiUrl(repoApiUrl: string): string {
  // "https://api.github.com/repos/owner/repo" -> "owner/repo"
  const m = repoApiUrl.match(/\/repos\/([^/]+\/[^/]+)$/);
  return m ? m[1] : repoApiUrl;
}
