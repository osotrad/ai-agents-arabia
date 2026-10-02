import { caller, errorResponse, json, unauthorized } from "@/lib/api";
import { getSiteContext } from "@/lib/content";

export const dynamic = "force-dynamic";

/** GET /api/v1/context — bootstrap payload for the agent. */
export async function GET(req: Request) {
  if (!caller(req)) return unauthorized();
  try {
    return json(await getSiteContext());
  } catch (err) {
    return errorResponse(err);
  }
}
