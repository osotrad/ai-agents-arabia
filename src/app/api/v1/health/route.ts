import { caller, errorResponse, json, unauthorized } from "@/lib/api";
import { getHealth } from "@/lib/content";

export const dynamic = "force-dynamic";

/** GET /api/v1/health — article counts + recent audit events. */
export async function GET(req: Request) {
  if (!caller(req)) return unauthorized();
  try {
    return json(await getHealth());
  } catch (err) {
    return errorResponse(err);
  }
}
