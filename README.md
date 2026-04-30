# Shadow PM — v0

AI shadow PM for non-technical founders running dev teams.
Day-1 scope: connect Linear via OAuth, pull issues, prove the spine.

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- pnpm workspaces (single app for now; will expand to `/packages/connectors` when GitHub/Slack join)
- Token cache: flat JSON file at `.data/tokens.json` (will move to SQLite + Prisma in week 2)

## First-time setup

```bash
pnpm install
cp .env.local.example .env.local
# fill in LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET from
# https://linear.app/settings/api/applications
```

## Run

```bash
pnpm dev
# open http://localhost:3000
# click "Connect Linear" → approve → redirected back

pnpm pull:linear
# prints your Linear issues as a table
```

## Layout

```
src/
  app/
    page.tsx                              # connect button + status
    api/auth/linear/start/route.ts        # OAuth: redirect user to Linear
    api/auth/linear/callback/route.ts     # OAuth: exchange code, persist token
  lib/
    linear/oauth.ts                       # build authorize URL, exchange code
    linear/client.ts                      # GraphQL fetch wrapper
    storage/tokens.ts                     # JSON-backed token cache
scripts/
  pull-issues.ts                          # CLI: pulls issues using cached token
```

## What's intentionally not here yet

- No DB. Tokens live in `.data/tokens.json`. Swap to Prisma + SQLite when we add a second connector.
- No refresh-token handling. Linear access tokens last ~10 years for OAuth apps, so v0 ignores refresh.
- No auth on the Next.js app itself. Single-user local dev only.
- No GitHub/Slack/Notion connectors. Linear first; ship one, then fan out.
- No LLM calls yet. Connector spine first, reasoning layer second.

## Roadmap (next 2 weeks)

1. Webhook receiver for Linear (real-time updates, not just polling)
2. Add GitHub connector (OAuth + PR/issue pull) — proves the connector pattern generalizes
3. SQLite via Prisma — replace `.data/tokens.json`
4. First "shadow PM" prompt — feed pulled issues to Claude, ask "what should the team focus on this week?"
