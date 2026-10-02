---
name: publish-to-woklaa
description: Publish Arabic AI-agents content (news, summaries, explainers, glossary terms) to the وكلاء website via its REST or MCP content API. Use when the user asks to write/publish an article, add a glossary term, or log a correction on the وكلاء site.
---

# Publish to وكلاء (ai-agents-arabia)

The وكلاء site is headless: you create and publish content through its API.

## Setup

- Base URL: `${SITE_URL}/api/v1` (REST) or `${SITE_URL}/api/mcp` (MCP)
- Header on every request: `Authorization: Bearer ${AGENT_API_KEY}`

## Workflow

1. Read context: `GET {base}/context` — policy, counts, and recent titles
   (for dedupe).
2. Draft an Arabic article grounded in **≥2 independent sources**.
3. Check for near-duplicates before creating:
   `POST {base}/articles/similar` with the draft's 1536-dim embedding
   (`threshold: 0.9`), or `GET {base}/search?q=`.
4. Optional header image: `POST {base}/images` with `dataBase64` (PNG/JPEG/WebP)
   → pass the returned `url` as `imageUrl`, with Arabic `imageAlt`.
5. Validate: `POST {base}/articles/validate`.
6. Create: `POST {base}/articles`.
7. Publish: `POST {base}/articles/{id}/publish`.

## Rules that will fail your request

- `type: "news"` with fewer than 2 sources → `422`.
- A `claim.sourceIndex` outside the `sources` range → `422`.
- Exceeding the daily publish cap → `429`.
- Missing/invalid `AGENT_API_KEY` → `401`.

## Tips

- Numbers/dates must appear verbatim in a source `excerpt`, or the response
  contains a `warnings` entry.
- A claim asserting a figure its own excerpt does not contain is warned about
  as `(all-figures-missing)` — fix the claim or attach the right source.
  Claims in a different language from their excerpt are checked on figures
  only, so a well-grounded Arabic claim citing an English excerpt is clean.
- Prefer `status: "pending_review"` for long-form content; the human editor
  approves it. Use `published` only for short, well-sourced news.
- Markdown is sanitized server-side; don't rely on raw HTML.
- The MCP tools validate with the same schemas as REST — a payload one rejects,
  the other rejects identically.
- A failed write may return `{"driver": {"code": "42P01", …}}`. Report that
  Postgres code instead of the `Failed query: …` wrapper, and run
  `gh workflow run agent-probe.yml -f tool=health -f arguments='{}'` to read
  `.schema`. See `docs/OPERATIONS.md`.
