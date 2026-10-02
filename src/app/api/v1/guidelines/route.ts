import { caller, unauthorized } from "@/lib/api";
import { GUIDELINES } from "@/lib/content";

export const dynamic = "force-dynamic";

/** GET /api/v1/guidelines — editorial policy as markdown. */
export async function GET(req: Request) {
  if (!caller(req)) return unauthorized();
  return new Response(GUIDELINES, {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
