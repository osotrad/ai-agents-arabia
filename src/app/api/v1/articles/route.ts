import { caller, errorResponse, json, readBody, unauthorized } from "@/lib/api";
import { createArticle, listArticles } from "@/lib/content";
import { articleInputSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** GET /api/v1/articles?status=&type=&limit= — list for dedupe/awareness. */
export async function GET(req: Request) {
  if (!caller(req)) return unauthorized();
  const q = new URL(req.url).searchParams;
  try {
    const articles = await listArticles({
      status: q.get("status") ?? undefined,
      type: q.get("type") ?? undefined,
      limit: q.get("limit") ? Number(q.get("limit")) : undefined,
    });
    return json({ articles });
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/v1/articles — create a draft / pending_review / published article. */
export async function POST(req: Request) {
  const actor = caller(req);
  if (!actor) return unauthorized();
  const body = await readBody(req, articleInputSchema);
  if (!body.ok) return body.response;
  try {
    const { article, warnings, sources } = await createArticle(body.data, actor.actor);
    return json(
      {
        ok: true,
        warnings,
        article: {
          id: article.id,
          slug: article.slug,
          status: article.status,
          type: article.type,
          publishedAt: article.publishedAt,
          url: `/news/${article.slug}`,
        },
        sources: sources.map((s) => ({ id: s.id, url: s.url })),
      },
      201,
    );
  } catch (err) {
    return errorResponse(err);
  }
}
