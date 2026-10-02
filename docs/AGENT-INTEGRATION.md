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

### `GET /api/v1/search?q=&type=&limit=`
Keyword search over published titles and excerpts (case-insensitive).
Returns `{ query, articles }`. `400` when `q` is missing or `type` is not a
valid article type.

### `POST /api/v1/articles/similar`
Semantic dedupe: body `{ embedding: number[1536], limit?, threshold? }`.
Cosine nearest-neighbour search over `articles.embedding` (HNSW-indexed)
restricted to published articles. `threshold` is a minimum cosine similarity —
`0.9` is roughly "near-duplicate". Returns `{ threshold, articles }` where each
row carries a `similarity` score.

**Run this before drafting**, not after: it is the only check that catches a
near-duplicate phrased differently from what `GET /context`'s recent titles show.

### `POST /api/v1/images`
Store an article header image. Body: `{ slug?, dataBase64, contentType?, alt? }`.

Returns `201 { ok, image: { key, url, contentType, bytes }, hint }`. Pass
`image.url` as `imageUrl` (and the alt text as `imageAlt`) when creating or
patching the article.

- PNG, JPEG or WebP only. `contentType` is a hint — the **bytes** decide, and a
  payload whose magic bytes disagree with the declared type is rejected `422`.
- `413` when over `MAX_IMAGE_BYTES` (default 5 MiB); `503` when
  `NEON_STORAGE_*` / `IMAGE_BUCKET` are unset.
- Base64 is validated strictly, so malformed input fails before any upload.
- The object key is generated server-side as
  `articles/<slug>-<8 hex>.<ext>`; nothing user-supplied reaches the path.
- Private buckets are not supported for serving — the bucket must be
  `public_read` (or have `IMAGE_PUBLIC_BASE` pointed at a public origin).

### `POST /api/v1/glossary`
Upsert a term: `{ termAr, termEn, definitionAr, slug?, sourceUrl?, embedding? }`.
Responds `{ ok, term: { id, slug, termAr, termEn } }`.

### `POST /api/v1/corrections`
Log a correction: `{ articleId | slug, whatChanged, publishedNote? }`.

### `GET /api/v1/health`
Article counts, configuration validation issues (`config.issues` — empty when
the environment is valid), the schema report (`schema` — `ok`, and any tables
from `missing` that were never created), and the 20 most recent audit events.

**Check `schema` first whenever a write fails.** A database that was never
migrated still serves every page, because reads degrade to empty states — so
the site looks healthy while every insert fails with `42P01`.

## Validation semantics

`validate_article` / `POST /articles/validate` returns `{ok, errors, warnings}`.
Errors block the write; warnings do not.

### Errors

- `type: "news"` with fewer than 2 sources
- claims supplied with no sources attached
- a `claim.sourceIndex` beyond the end of `sources`

### Warnings that require action

- `number "X" was not found in any source excerpt` — put the figure verbatim
  in the excerpt of the source that carries it.
- `claim weakly supported by its source: … (all-figures-missing)` /
  `(figure-not-in-excerpt)` — the claim asserts a figure its source does not
  contain. Fix the claim or attach the right source.

`assessClaimSupport()` in `src/lib/content.ts` decides this. It has two
regimes, because lexical overlap is only meaningful when the claim and its
excerpt are in the same script:

| Claim vs excerpt | What is checked | Warning reasons |
| --- | --- | --- |
| same script | normalized word-set overlap (≥ 0.2), after folding case, Arabic tashkēl/tatweel, alef variants, `ة→ه`, `ى→ي` and the definite article | `no-lexical-overlap` |
| different script | the figures the claim asserts — a claim saying `70%` must find `70%` in its excerpt | `figure-not-in-excerpt`, `all-figures-missing` |
| different script, no figures | nothing comparable | none — returns `unverifiable` |

So a well-grounded Arabic claim citing an English excerpt is clean, while an
Arabic claim inventing a percentage is still caught.

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
| `search_articles` | `GET /search` |
| `find_similar_articles` | `POST /articles/similar` |
| `upload_image` | `POST /images` |
| `upsert_glossary` | `POST /glossary` |
| `submit_correction` | `POST /corrections` |
| `health` | `GET /health` |

Every tool validates with the **same Zod schema** the REST route uses
(`src/lib/schemas.ts`), so the two interfaces cannot drift: a payload rejected
over REST is rejected identically over MCP, including the length limits, the
`slug` pattern, and `recheckAfter` on `create_article`.

### Errors from a failed write

A database failure comes back as a tool-level error whose text includes the
driver's own diagnosis:

```json
{ "error": "Failed query: insert into \"sources\" …", 
  "driver": { "code": "42P01", "message": "relation \"sources\" does not exist" } }
```

Report `driver.code`. The wrapper message deliberately omits the query
parameters. `42P01` means the schema is behind the code — see
[OPERATIONS.md](./OPERATIONS.md).

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
- Header images live in `articles.image_url` / `image_alt` and are rendered by
  the page component. They never pass through `renderMarkdown`, so the
  sanitizer's allowlist still excludes `img` — a markdown `![alt](url)` in
  `bodyMd` renders to nothing at all.
- `sources` upserted by normalized URL; each `claim` linked to its source row.
- Revalidation (`/news/{slug}`, `/news`, `/`, tag `articles`) on publish, plus an
  optional IndexNow ping.
- Every mutation appends a row to `audit_log`.
- The daily publish cap is enforced on **every** path that can set an article to
  `published`: `POST /articles` with `status: "published"`,
  `POST /articles/{id}/publish`, and a human `approve` in the review queue.

## Human review

`/admin/review` is the queue. It authenticates with the admin key, exchanged for
an HttpOnly session cookie:

1. The reviewer posts `ADMIN_API_KEY` to `POST /api/admin/session`
   (form post → `303` back to `/admin/review`, or JSON → `{ ok: true }`).
2. The cookie (`woklaa_admin_session`, HttpOnly, SameSite=Strict, 8h) then
   authenticates `GET /api/admin/review` and `POST /api/admin/review`.
3. `DELETE /api/admin/session` ends the session.

The key is **never** accepted from the query string — that is the whole point of
this flow; a `?key=` URL leaks into browser history, referrers, and access logs.
