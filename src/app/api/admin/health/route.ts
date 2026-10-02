import { authenticateAdmin } from "@/lib/auth";
import { errorResponse, json, unauthorized } from "@/lib/api";
import { getHealth } from "@/lib/content";

export const dynamic = "force-dynamic";

/** GET /api/admin/health — counts + recent audit events (admin only). */
export async function GET(req: Request) {
  if (!authenticateAdmin(req)) return unauthorized();
  try {
    return json(await getHealth());
  } catch (err) {
    return errorResponse(err);
  }
}

