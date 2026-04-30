import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "replace_me") {
    throw new Error(
      "Missing ANTHROPIC_API_KEY in .env.local. Get one at https://console.anthropic.com/settings/keys"
    );
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

export function getDefaultModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
}
