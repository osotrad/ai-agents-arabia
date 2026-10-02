import { authenticateAdmin } from "@/lib/auth";
import { errorResponse, json, readBody, unauthorized } from "@/lib/api";
import { listPendingReview, reviewArticle } from "@/lib/content";
import { reviewActionSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/review?status=pending_review
 * Human review queue (admin only, headers only).
 */
export async function GET(req: Request) {
  if (!authenticateAdmin(req)) return unauthorized();
  try {
    return json({ queue: await listPendingReview(50) });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * POST /api/admin/review
 * Body: { articleId, action: "approve" | "reject", reason?, edits? }
 */
export async function POST(req: Request) {
  const actor = authenticateAdmin(req);
  if (!actor) return unauthorized();
  const body = await readBody(req, reviewActionSchema);
  if (!body.ok) return body.response;
  try {
    const result = await reviewArticle(body.data, actor.actor);
    return json({ ok: true, ...result });
  } catch (err) {
    return errorResponse(err);
  }
}

