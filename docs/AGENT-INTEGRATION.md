# Agent integration reference

The وكلاء website is a **content backend**. An external agent (Hermes,
OpenClaw, a custom script, or anything that speaks HTTP or MCP) manages it.

- REST: `${SITE_URL}/api/v1`
- MCP (Streamable HTTP): `${SITE_URL}/api/mcp`
- Auth: `Authorization: Bearer <AGENT_API_KEY>` (headers only — never a query
  string). `x-admin-key: <ADMIN_API_KEY>` is also accepted for privileged use.

## REST endpoints

### `GET /api/v1/context`
Bootstrap payload: site URL, publish cap, allowed types, article counts,
`recentTitles` (for dedupe), and the editorial `guidelines` markdown.

### `GET /api/v1/guidelines`
The editorial policy as `text/markdown`.

### `POST /api/v1/articles/validate`
Dry-run. Body = article payload (below). Returns `{ ok, errors, warnings }`.
`errors` would block a create; `warnings` (e.g. a number not found in any
excerpt) do not.

### `POST /api/v1/articles`
Create an article. Returns `201` with the created `article` (id, slug, status,
url) and `sources`.

```jsonc
{
  "titleAr": "العنوان بالعربية",
  "excerptAr": "جملتان",
  "bodyMd": "## نص المقال\n…",
  "type": "news",                 // news | summary | explainer | review | glossary
  "slug": "optional-latin-slug",  // auto-generated if omitted
  "status": "pending_review",     // draft | pending_review | published
  "sources": [
    { "url": "https://…", "title": "…", "excerpt": "raw text used for grounding" }
  ],
  "claims": [{ "claim": "…", "sourceIndex": 0 }],
  "confidenceScore": 0.8,
  "embedding": [/* optional, 1536 floats */]
}
```

Errors: `422` validation (e.g. `type:"news"` needs ≥2 sources), `429` daily cap.

### `PATCH /api/v1/articles/{id}`
Update title/excerpt/body. A body change stores a `revision` and bumps
`version`. Body: `{ titleAr?, excerptAr?, bodyMd?, confidenceScore?, reason? }`.

### `POST /api/v1/articles/{id}/publish`
Publish by **id or slug**. Enforces the daily cap and sets `recheckAfter`.

### `GET /api/v1/articles?status=&type=&limit=`
List articles (id, slug, title, type, status, confidence, timestamps).

### `POST /api/v1/glossary`
Upsert a term: `{ termAr, termEn, definitionAr, slug?, sourceUrl?, embedding? }`.

### `POST /api/v1/corrections`
Log a correction: `{ articleId | slug, whatChanged, publishedNote? }`.

### `GET /api/v1/health`
Article counts + the 20 most recent audit events.

## MCP tools

Connect any MCP client to `${SITE_URL}/api/mcp`:

| Tool | Mirrors |
| --- | --- |
| `get_context` | `GET /context` |
| `get_guidelines` | `GET /guidelines` |
| `validate_article` | `POST /articles/validate` |
| `create_article` | `POST /articles` |
| `update_article` | `PATCH /articles/{id}` |
| `publish_article` | `POST /articles/{id}/publish` |
| `list_articles` | `GET /articles` |
| `upsert_glossary` | `POST /glossary` |
| `submit_correction` | `POST /corrections` |
| `health` | `GET /health` |

### Example: Hermes / OpenClaw MCP config

Most MCP hosts accept an HTTP server entry with a bearer token:

```json
{
  "mcpServers": {
    "woklaa": {
      "type": "http",
      "url": "https://your-site.example.com/api/mcp",
      "headers": { "Authorization": "Bearer YOUR_AGENT_API_KEY" }
    }
  }
}
```

(Consult your host's docs for the exact key name — the endpoint itself is a
plain Streamable-HTTP MCP server.)

## Semantics enforced server-side

- Markdown → sanitized HTML (raw HTML stripped; links forced `rel="nofollow"`).
- Unique slugs (auto-suffixed on collision).
- `sources` upserted by normalized URL; each `claim` linked to its source row.
- Revalidation (`/news/{slug}`, `/news`, `/`, tag `articles`) on publish, plus an
  optional IndexNow ping.
- Every mutation appends a row to `audit_log`.
