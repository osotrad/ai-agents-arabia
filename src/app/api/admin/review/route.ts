import { authenticateAdmin } from "@/lib/auth";
import { errorResponse, json, readBody, unauthorized } from "@/lib/api";
import {
  isReviewableStatus,
  listReviewQueue,
  reviewArticle,
  REVIEWABLE_STATUSES,
} from "@/lib/content";
import { reviewActionSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/review?status=pending_review&limit=50
 * Human review queue (admin only, header or session cookie — never the query
 * string). `status` defaults to pending_review and must be reviewable.
 */
export async function GET(req: Request) {
  if (!authenticateAdmin(req)) return unauthorized();
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "pending_review";
  if (!isReviewableStatus(status)) {
    return json(
      {
        error: `invalid status "${status}"`,
        allowed: REVIEWABLE_STATUSES,
      },
      400,
    );
  }
  const limitParam = Number(url.searchParams.get("limit") ?? 50);
  const limit = Number.isFinite(limitParam) ? limitParam : 50;
  try {
    return json({
      status,
      queue: await listReviewQueue({ status, limit }),
    });
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