import { GUIDELINES } from "@/lib/content";

export const dynamic = "force-dynamic";

/**
 * GET /llms.txt — machine-readable index for LLMs / agents.
 * Public: a discovery aid, so it is intentionally unauthenticated.
 */
export async function GET() {
  const base = process.env.SITE_URL ?? "http://localhost:3000";
  const body = `# وكلاء — ai-agents-arabia

> موقع عربي عن وكلاء الذكاء الاصطناعي، يُدار بمحتوى يكتبه وكيل خارجي عبر واجهة برمجية موثّقة.

## Public pages
- ${base}/ — homepage
- ${base}/news — latest articles
- ${base}/glossary — terms
- ${base}/how-it-works — how it works
- ${base}/corrections — corrections policy
- ${base}/editor — the human editor
- ${base}/feed.xml — RSS

## Agent interface
- REST base: ${base}/api/v1
  - GET  /context          — bootstrap (guidelines, counts, recent titles)
  - POST /articles/validate — dry-run checks
  - POST /articles         — create (draft | pending_review | published)
  - PATCH /articles/{id}   — edit
  - POST /articles/{id}/publish
  - POST /glossary         — upsert a term
  - POST /corrections      — log a correction
  - GET  /health
- MCP (Streamable HTTP): ${base}/api/mcp
- Auth: Authorization: Bearer <AGENT_API_KEY>

## Editorial policy
${GUIDELINES}
`;
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
