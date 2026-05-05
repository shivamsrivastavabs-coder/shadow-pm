/**
 * Minimal Slack client for the Risk Radar.
 *
 * Strategy for v0:
 *  - List the public channels the authed user is a member of.
 *  - Fetch the last N messages from each (capped, only the last 7 days).
 *  - Resolve user ids to display names so the model sees "alex: ..." not "U02..."
 *  - Cap the total at MAX_MESSAGES so prompt size stays sane.
 *
 * We deliberately keep this dumb and pragmatic. Better message-selection
 * (relevance, mentions, only-eng-channels) is a v1 problem.
 */

const SLACK_API_BASE = "https://slack.com/api";

const MAX_CHANNELS = 8;
const MAX_MESSAGES_PER_CHANNEL = 20;
const MAX_TOTAL_MESSAGES = 120;
const LOOKBACK_DAYS = 7;

export type SlackMessageForPrompt = {
  /** Channel name without the # prefix, e.g. "engineering" */
  channel: string;
  /** Display name of the message author, e.g. "alex" */
  author: string;
  /** Plain text of the message — Slack's mrkdwn, lightly cleaned */
  text: string;
  /** ISO timestamp */
  timestamp: string;
};

type SlackChannel = {
  id: string;
  name: string;
  is_member: boolean;
  is_archived: boolean;
};

type SlackMessage = {
  type: string;
  subtype?: string;
  user?: string;
  text?: string;
  ts: string; // unix timestamp string, e.g. "1714824000.123456"
  bot_id?: string;
};

type SlackUser = {
  id: string;
  name: string;
  real_name?: string;
  profile?: { display_name?: string; real_name?: string };
};

export async function fetchRecentSlackMessages(
  token: string
): Promise<SlackMessageForPrompt[]> {
  // 1. List channels the user is a member of
  const channels = await listMemberChannels(token);
  const top = channels.slice(0, MAX_CHANNELS);

  // 2. Pull recent messages from each, in parallel
  const oldest = String(
    Math.floor(Date.now() / 1000) - LOOKBACK_DAYS * 24 * 3600
  );
  const perChannel = await Promise.all(
    top.map(async (c) => {
      try {
        const msgs = await fetchChannelHistory(token, c.id, oldest);
        return msgs.map((m) => ({ channel: c.name, message: m }));
      } catch (err) {
        // If one channel errors (e.g. private after all, or not_in_channel),
        // skip it rather than failing the whole batch.
        console.error(
          `[slack] history failed for #${c.name}:`,
          err instanceof Error ? err.message : err
        );
        return [];
      }
    })
  );

  // 3. Flatten and filter to real human messages
  const flattened = perChannel.flat().filter(({ message: m }) => {
    if (m.type !== "message") return false;
    if (m.subtype) return false; // joined/left/topic-changed/etc.
    if (m.bot_id) return false;
    if (!m.user) return false;
    if (!m.text || m.text.trim().length === 0) return false;
    return true;
  });

  // 4. Resolve user ids → display names. One bulk pass.
  const userIds = Array.from(
    new Set(flattened.map(({ message: m }) => m.user!).filter(Boolean))
  );
  const userMap = await fetchUserMap(token, userIds);

  // 5. Sort newest first, cap total
  const out = flattened
    .map(({ channel, message: m }) => ({
      channel,
      author: userMap.get(m.user!) ?? m.user!,
      text: cleanMrkdwn(m.text!),
      timestamp: tsToIso(m.ts)
    }))
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, MAX_TOTAL_MESSAGES);

  return out;
}

async function listMemberChannels(token: string): Promise<SlackChannel[]> {
  // conversations.list with types=public_channel returns only public channels.
  // Slack also paginates; for v0 we take the first page (default 100) which is
  // plenty for any small workspace.
  const url = `${SLACK_API_BASE}/conversations.list?types=public_channel&exclude_archived=true&limit=200`;
  const json = await slackGet<{ ok: boolean; error?: string; channels: SlackChannel[] }>(
    token,
    url
  );
  return json.channels.filter((c) => c.is_member && !c.is_archived);
}

async function fetchChannelHistory(
  token: string,
  channelId: string,
  oldestTs: string
): Promise<SlackMessage[]> {
  const url = `${SLACK_API_BASE}/conversations.history?channel=${channelId}&oldest=${oldestTs}&limit=${MAX_MESSAGES_PER_CHANNEL}`;
  const json = await slackGet<{
    ok: boolean;
    error?: string;
    messages: SlackMessage[];
  }>(token, url);
  return json.messages;
}

async function fetchUserMap(
  token: string,
  userIds: string[]
): Promise<Map<string, string>> {
  // users.info has no bulk endpoint; we hit it per id but cache via Map.
  // For larger workspaces we'd switch to users.list once and cache, but
  // that costs more tokens (every workspace member). Per-id is fine for v0.
  const map = new Map<string, string>();
  await Promise.all(
    userIds.map(async (id) => {
      try {
        const json = await slackGet<{
          ok: boolean;
          error?: string;
          user: SlackUser;
        }>(token, `${SLACK_API_BASE}/users.info?user=${id}`);
        const u = json.user;
        const display =
          u.profile?.display_name?.trim() ||
          u.profile?.real_name?.trim() ||
          u.real_name ||
          u.name ||
          id;
        map.set(id, display);
      } catch {
        map.set(id, id);
      }
    })
  );
  return map;
}

async function slackGet<T extends { ok: boolean; error?: string }>(
  token: string,
  url: string
): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    }
  });
  if (!res.ok) {
    throw new Error(`Slack HTTP ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as T;
  if (!json.ok) {
    throw new Error(`Slack API error: ${json.error || "unknown"}`);
  }
  return json;
}

function tsToIso(ts: string): string {
  // Slack ts is "1714824000.123456" — seconds.microseconds
  const seconds = Number(ts.split(".")[0]);
  return new Date(seconds * 1000).toISOString();
}

/**
 * Strip Slack-specific mrkdwn artifacts that are noise to an LLM:
 *  - <@U123> mention syntax → @U123 (we don't resolve here; user_map covers authors)
 *  - <#C123|name> channel mentions → #name
 *  - <https://link|label> → label
 *  - <https://link> → https://link
 */
function cleanMrkdwn(text: string): string {
  return text
    .replace(/<@([A-Z0-9]+)(?:\|[^>]+)?>/g, "@$1")
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, "#$1")
    .replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, "$2")
    .replace(/<(https?:\/\/[^>]+)>/g, "$1")
    .trim();
}
