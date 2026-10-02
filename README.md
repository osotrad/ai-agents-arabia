# وكلاء — ai-agents-arabia

An Arabic-language AI-agents news site that is **website-only**: it exposes a
clean content API (REST + MCP) so an already-configured external agent
(Hermes, OpenClaw, or any HTTP/MCP-capable agent) can discover, write, and
publish content. No agent runtime lives in this repo.

## Stack

- **Next.js 16** (App Router, RTL Arabic) on **Cloudflare Workers** via OpenNext
- **Neon Postgres** + **Drizzle ORM** + **pgvector** for semantic dedupe
- **Tailwind v4** design system
- **MCP** via `@modelcontextprotocol/server` (Streamable HTTP at `/api/mcp`)

## Local development

```bash
pnpm install
cp .env.example .env       # fill in DATABASE_URL, AGENT_API_KEY, ...
pnpm db:migrate            # apply Drizzle migrations
pnpm dev
```

## Database

```bash
pnpm db:generate           # generate a migration from src/db/schema.ts
pnpm db:migrate            # apply migrations
pnpm db:studio             # inspect data
```

Migrations require `pgvector`; it is created by the migrations themselves.

## The agent interface

Everything an external agent needs is under `/api/v1` and `/api/mcp`. Both are
authenticated with `Authorization: Bearer <AGENT_API_KEY>`.

See **[AGENTS.md](./AGENTS.md)** (operating manual) and
**[docs/AGENT-INTEGRATION.md](./docs/AGENT-INTEGRATION.md)** (full reference).

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/context` | Bootstrap: guidelines, counts, recent titles |
| GET | `/api/v1/guidelines` | Editorial policy (markdown) |
| POST | `/api/v1/articles/validate` | Dry-run checks (no write) |
| POST | `/api/v1/articles` | Create (`draft` \| `pending_review` \| `published`) |
| PATCH | `/api/v1/articles/{id}` | Edit (body edits create a revision) |
| POST | `/api/v1/articles/{id}/publish` | Publish by id or slug |
| GET | `/api/v1/articles` | List |
| POST | `/api/v1/glossary` | Upsert a glossary term |
| POST | `/api/v1/corrections` | Log a correction |
| GET | `/api/v1/health` | Counts + recent audit events |
| POST/GET | `/api/mcp` | MCP Streamable HTTP (tools) |

Also public: `/llms.txt`, `/feed.xml`, `/sitemap.xml`, `/robots.txt`.

## Editorial transparency

- `/how-it-works` — how publishing works
- `/corrections` — public corrections log
- `/editor` — the accountable human editor
- `/admin/review` — human review queue (`?key=<ADMIN_API_KEY>`)

## Human review

Drafts created with `status: "pending_review"` appear at `/admin/review`.
Approve (optionally with edits) or reject via the header-authenticated
`POST /api/admin/review`.

## Deploy

CI runs lint + typecheck + build (`.github/workflows/ci.yml`). Deployment to
Cloudflare Workers happens in `.github/workflows/deploy.yml`, which sets all
required Worker secrets. Configure GitHub secrets: `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, `DATABASE_URL`, `AGENT_API_KEY`, `ADMIN_API_KEY`,
`INDEXNOW_KEY`; and the `SITE_URL` repository variable.
