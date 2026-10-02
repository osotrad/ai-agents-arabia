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
2. Gather ≥2 independent sources per news item.
3. `POST /api/v1/articles/validate` (or `validate_article`) — dry run.
4. `POST /api/v1/articles` (or `create_article`) — create the article.
5. Publish: `POST /api/v1/articles/{id}/publish` (or `publish_article`).

## 3. Hard rules

- News requires **≥2 sources**; every claim maps to a source via `sourceIndex`.
- Every number/date/product name must appear **verbatim** in a provided source
  excerpt. Warnings are returned but do not block — treat them as red flags.
- Write original Arabic analysis; do **not** translate literally.
- `slug` is short English, lowercase-with-hyphens.
- The server enforces a **daily publish cap** (`DAILY_PUBLISH_CAP`, default 5) and
  returns `429` when exceeded.

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
  "confidenceScore": 0.8
}
```

`status` may be `draft`, `pending_review` (default), or `published`.
`type` is one of `news`, `summary`, `explainer`, `review`, `glossary`.

## 5. Other operations

- Glossary: `POST /api/v1/glossary`
- Corrections: `POST /api/v1/corrections`
- Existing content: `GET /api/v1/articles?status=published&limit=50`
- Health: `GET /api/v1/health`

## 6. Notes

- The server sanitizes all markdown → HTML; raw HTML you send is stripped.
- Human reviewers approve `pending_review` items; low-confidence ones are
  surfaced to them. Prefer `pending_review` for anything non-trivial.
