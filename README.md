# وكلاء — ai-agents-arabia

An Arabic-language AI-agents site. It exposes a clean content API (REST + MCP)
so content is written and published through a documented, verifiable pipeline:
every article carries its sources, every number is checked against a stored
excerpt, and every change is recorded. No agent runtime lives in this repo.

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
| GET | `/api/v1/search?q=` | Keyword search over published articles |
| POST | `/api/v1/articles/similar` | pgvector cosine search (semantic dedupe) |
| POST | `/api/v1/glossary` | Upsert a glossary term |
| POST | `/api/v1/corrections` | Log a correction |
| GET | `/api/v1/health` | Counts, config issues, recent audit events |
| POST/GET | `/api/mcp` | MCP Streamable HTTP (12 tools) |

The REST routes and the MCP tools share one set of Zod schemas, so validation
cannot drift between the two interfaces.

Also public: `/llms.txt`, `/feed.xml`, `/sitemap.xml`, `/robots.txt`.

## Pages

- `/` — homepage: live counts, latest material, editorial guarantees
- `/news`, `/news/{slug}` — articles, filterable by type, each with its sources
- `/glossary`, `/glossary/{slug}` — filterable Arabic–English glossary
- `/search?q=` — site search
- `/sources` — every cited domain and how many articles rely on it
- `/standards` — publishing standards
- `/corrections` — corrections policy and public log
- `/about` — about this site

## Editorial transparency

- `/standards` — publishing standards and auto-publish limits
- `/corrections` — public corrections log
- `/sources` — the source ledger (every cited domain, citation count)
- `/about` — scope of what is published, and how to reach us

## Human review

Articles created with `status: "pending_review"` appear at `/admin/review`.
Log in by posting `ADMIN_API_KEY` to `POST /api/admin/session`, which sets an
HttpOnly session cookie — the key never travels in a URL. Approve (optionally
with edits) or reject via the cookie-authenticated `POST /api/admin/review`.

## Deploy

CI runs lint + typecheck + build (`.github/workflows/ci.yml`). Deployment to
Cloudflare Workers happens in `.github/workflows/deploy.yml`, which sets all
required Worker secrets. Configure GitHub secrets: `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`, `DATABASE_URL`, `AGENT_API_KEY`, `ADMIN_API_KEY`,
`INDEXNOW_KEY`; and the `SITE_URL` repository variable.
