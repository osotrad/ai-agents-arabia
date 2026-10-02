import { caller, errorResponse, json, unauthorized } from "@/lib/api";
import { publishArticle } from "@/lib/content";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** POST /api/v1/articles/{id}/publish — publish (id or slug). */
export async function POST(req: Request, { params }: Params) {
  const actor = caller(req);
  if (!actor) return unauthorized();
  const { id } = await params;
  try {
    const article = await publishArticle(id, actor.actor);
    return json({
      ok: true,
      article: {
        id: article.id,
        slug: article.slug,
        status: article.status,
        publishedAt: article.publishedAt,
        url: `/news/${article.slug}`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
