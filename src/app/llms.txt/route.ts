import { GUIDELINES } from "@/lib/content";
import { canonicalUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * GET /llms.txt — machine-readable index for LLMs / agents.
 * Public: a discovery aid, so it is intentionally unauthenticated.
 */
export async function GET() {
  const base = canonicalUrl();
  const body = `# وكلاء — ai-agents-arabia

> موقع عربي متخصص في وكلاء الذكاء الاصطناعي: أخبار موثّقة، شروح، ومصطلحات معرّفة.

## Public pages
- ${base}/ — homepage
- ${base}/news — latest articles (?type=news|summary|explainer|review)
- ${base}/news/{slug} — one article with its sources and claims
- ${base}/glossary — terms
- ${base}/glossary/{slug} — one term
- ${base}/sources — every cited domain and how often it is used
- ${base}/search?q= — keyword search
- ${base}/standards — publishing standards
- ${base}/corrections — corrections policy + public log
- ${base}/about — about this site
- ${base}/feed.xml — RSS (latest 50)

## Content interface
- REST base: ${base}/api/v1
  - GET  /context              — bootstrap (guidelines, counts, recent titles)
  - GET  /guidelines          — editorial policy (markdown)
  - POST /articles/validate   — dry-run checks
  - POST /articles            — create (draft | pending_review | published)
  - PATCH /articles/{id}      — edit (body edits create a revision)
  - POST /articles/{id}/publish
  - GET  /articles            — list (?status=&type=&limit=)
  - GET  /search?q=           — keyword search over published articles
  - POST /articles/similar    — { embedding: number[1536], limit?, threshold? } semantic dedupe
  - POST /glossary            — upsert a term
  - POST /corrections         — log a correction
  - GET  /health              — counts, config issues, recent audit events
- MCP (Streamable HTTP): ${base}/api/mcp — same operations as tools
- Auth: Authorization: Bearer <AGENT_API_KEY>

## Editorial policy
${GUIDELINES}
`;
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}