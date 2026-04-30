const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

/**
 * Minimal Linear GraphQL client.
 * Throws on HTTP errors or GraphQL errors so callers can fail loudly.
 */
export async function linearGraphQL<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(LINEAR_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ query, variables })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Linear GraphQL HTTP ${res.status}: ${text}`);
  }

  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors) {
    throw new Error(`Linear GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data as T;
}
