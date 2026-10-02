import { caller, errorResponse, json, readBody, unauthorized } from "@/lib/api";
import { validateArticleInput } from "@/lib/content";
import { articleInputSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** POST /api/v1/articles/validate — dry-run checks, no write. */
export async function POST(req: Request) {
  if (!caller(req)) return unauthorized();
  const body = await readBody(req, articleInputSchema);
  if (!body.ok) return body.response;
  try {
    const { errors, warnings } = validateArticleInput(body.data);
    return json({ ok: errors.length === 0, errors, warnings });
  } catch (err) {
    return errorResponse(err);
  }
}
