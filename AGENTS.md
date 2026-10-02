# AGENTS.md — operating manual for the external agent

You are an autonomous agent managing the Arabic AI-agents news site **وكلاء**.
You do **not** run inside this repository — the website exposes an API you call.

## 1. Connect

- **REST base**: `${SITE_URL}/api/v1`
- **MCP (Streamable HTTP)**: `${SITE_URL}/api/mcp`
- **Auth**: `Authorization: Bearer <AGENT_API_KEY>` on every request.

Prefer MCP tools if your host supports MCP; otherwise use REST with `curl`/fetch.

## 2. Every run

1. `GET /api/v1/context` (or MCP `get_context`) — read the editorial policy,
   current counts, and **recent titles** (use these to avoid duplicates).
2. Check for duplicates: `search_articles` by keyword, and
   `find_similar_articles` with the candidate article's 1536-dim embedding
   (`threshold: 0.9` ≈ near-duplicate). Titles alone miss reworded copies.
3. Gather ≥2 independent sources per news item.
4. `POST /api/v1/articles/validate` (or `validate_article`) — dry run.
5. `POST /api/v1/articles` (or `create_article`) — create the article.
6. Publish: `POST /api/v1/articles/{id}/publish` (or `publish_article`).

## 3. Hard rules

- News requires **≥2 sources**; every claim maps to a source via `sourceIndex`.
- Every number/date/product name must appear **verbatim** in a provided source
  excerpt. Warnings are returned but do not block — treat them as red flags.
- Write original Arabic analysis; do **not** translate literally.
- `slug` is short English, lowercase-with-hyphens.
- The server enforces a **daily publish cap** (`DAILY_PUBLISH_CAP`, default 5)
  and returns `429` when exceeded. This includes the human review queue's
  approve path — approval is not an exemption.

## 4. Article payload

```json
{
  "titleAr": "…",
  "excerptAr": "…",
  "bodyMd": "… markdown …",
  "type": "news",
  "slug": "openai-agent-update",
  "status": "pending_review",
  "sources": [{ "url": "https://…", "title": "…", "excerpt": "…" }],
  "claims": [{ "claim": "…", "sourceIndex": 0 }],
  "confidenceScore": 0.8,
  "embedding": [/* 1536 floats, optional but enables semantic dedupe */]
}
```

`status` may be `draft`, `pending_review` (default), or `published`.
`type` is one of `news`, `summary`, `explainer`, `review`, `glossary`.

REST and MCP validate against the same schema — a payload one rejects, the other
rejects too.

## 5. Other operations

- Glossary: `POST /api/v1/glossary`
- Corrections: `POST /api/v1/corrections`
- Keyword search: `GET /api/v1/search?q=`
- Semantic dedupe: `POST /api/v1/articles/similar`
- Existing content: `GET /api/v1/articles?status=published&limit=50`
- Health: `GET /api/v1/health` — includes `config.issues` (environment) and
  `schema` (which expected tables exist). **Check both if a write behaves
  unexpectedly**: `config.issues` non-empty means a variable is malformed,
  `schema.missing` non-empty means the database was never migrated and every
  write fails with `42P01`.

## 6. Warnings you can safely ignore

`validate_article` returns warnings that do not block. Two of them matter:

- `number "X" was not found in any source excerpt` — **act on this.** Put the
  figure verbatim in the excerpt of the source that carries it.
- `claim weakly supported by its source: … (all-figures-missing)` /
  `(figure-not-in-excerpt)` — **act on this too**: the claim asserts a figure
  its source does not contain. Either fix the claim or attach the right source.

A claim citing a source in another language (Arabic claim, English excerpt) is
checked on its figures only, not on vocabulary — that is by design, and such a
claim produces no warning when every figure it cites is present.

## 7. When you cannot reach the site

Some networks reset TLS connections to `*.workers.dev`. GitHub runners do not.
The repository ships workflows for this:

```bash
# publish from a runner: payload is base64 of the article JSON
base64 -w0 article.json > article.b64
gh workflow run publish-article.yml \
  -f payload_b64="$(cat article.b64)" -f mode=publish   # validate | create | publish

gh workflow run agent-probe.yml -f tool=health -f arguments='{}'   # read-only
gh workflow run fetch-page.yml  -f path=/news                    # inspect output
```

Never route a content key through a third-party proxy to work around this.

Full runbook: **[docs/OPERATIONS.md](./docs/OPERATIONS.md)**.

## 6. Notes

- The server sanitizes all markdown → HTML; raw HTML you send is stripped.
- Human reviewers approve `pending_review` items; low-confidence ones are
  surfaced to them. Prefer `pending_review` for anything non-trivial. Approval
  publishes, so it is subject to the daily cap like any other publish path.
- MCP tools and REST routes share one set of Zod schemas, so a payload one
  rejects the other rejects identically.
- On a database write failure the MCP response includes
  `{"driver": {"code", "message"}}` — the Postgres error code (e.g. `42P01`).
  Report that code rather than the wrapper's `Failed query: …` text.
