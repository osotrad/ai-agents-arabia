import { caller, errorResponse, json, readBody, unauthorized } from "@/lib/api";
import { submitCorrection } from "@/lib/content";
import { correctionInputSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** POST /api/v1/corrections — log a public correction against an article. */
export async function POST(req: Request) {
  const actor = caller(req);
  if (!actor) return unauthorized();
  const body = await readBody(req, correctionInputSchema);
  if (!body.ok) return body.response;
  try {
    const row = await submitCorrection(body.data, actor.actor);
    return json({ ok: true, correction: { id: row.id, articleId: row.articleId } }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
