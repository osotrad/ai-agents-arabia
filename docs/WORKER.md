# Worker deployment (external VPS)

The agent worker runs on any always-on Linux box — separate from the Cloudflare-hosted Next.js frontend. It talks only to Neon (Postgres) and the Gemini API.

## Requirements

- Node.js 22+
- pnpm 12+

## Setup

```bash
git clone https://github.com/osotrad/ai-agents-arabia.git
cd ai-agents-arabia
pnpm install

# Required env vars
cat > .env <<'EOF'
DATABASE_URL=postgres://...neon.tech/...   # Neon connection string
GEMINI_API_KEY=...                          # Google AI Studio key
ADMIN_API_KEY=...                           # shared with the Cloudflare app
SITE_URL=https://ai-agents-arabia.osotrad101.workers.dev
AGENT_ENABLED=true
EOF
```

## Run modes

```bash
# one pass (for cron)
pnpm agent:worker --once

# loop forever (systemd / pm2)
pnpm agent:worker
```

## Cron (one pass every 15 minutes)

```cron
*/15 * * * * cd /home/USER/ai-agents-arabia && /usr/bin/pnpm agent:worker --once >>/var/log/agent.log 2>&1
```

## What runs

- `discover` — polls curated RSS feeds, dedupes by normalized URL hash
- `pipeline` — dedupe (pgvector) → draft (Gemini, Arabic, claims mapped to sources) → verify (hard gates: ≥2 sources, numbers must appear in sources) → publish (DB insert + `/api/revalidate` call to Cloudflare)

## Safety switches

- `AGENT_ENABLED=false` → worker exits immediately
- Steps audited in `agent_runs` with confidence scores

## Logs

```bash
tail -f /var/log/agent.log | jq .
```
