import { caller, errorResponse, json, readBody, unauthorized } from "@/lib/api";
import { updateArticle } from "@/lib/content";
import { articlePatchSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/v1/articles/{id} — edit fields; body edits create a revision. */
export async function PATCH(req: Request, { params }: Params) {
  const actor = caller(req);
  if (!actor) return unauthorized();
  const { id } = await params;
  const body = await readBody(req, articlePatchSchema);
  if (!body.ok) return body.response;
  try {
    const article = await updateArticle(id, body.data, actor.actor);
    return json({
      ok: true,
      article: {
        id: article.id,
        slug: article.slug,
        status: article.status,
        version: article.version,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
