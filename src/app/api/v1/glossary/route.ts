import { caller, errorResponse, json, readBody, unauthorized } from "@/lib/api";
import { upsertGlossary } from "@/lib/content";
import { glossaryInputSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** POST /api/v1/glossary — create or update a glossary term. */
export async function POST(req: Request) {
  const actor = caller(req);
  if (!actor) return unauthorized();
  const body = await readBody(req, glossaryInputSchema);
  if (!body.ok) return body.response;
  try {
    const term = await upsertGlossary(body.data, actor.actor);
    return json(
      {
        ok: true,
        term: {
          id: term.id,
          slug: term.slug,
          termAr: term.termAr,
          termEn: term.termEn,
        },
      },
      201,
    );
  } catch (err) {
    return errorResponse(err);
  }
}
