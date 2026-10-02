import { NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/auth";
import { pingIndexNow } from "@/lib/indexnow";

/**
 * POST /api/indexnow  (Authorization: Bearer <AGENT_API_KEY> or x-admin-key)
 * Body: { url?: string, urls?: string[] }
 * Pings IndexNow (Bing/Yandex) with one or more site-relative paths.
 */
export async function POST(req: Request) {
  if (!authenticateAgent(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    url?: string;
    urls?: string[];
  };
  const paths = body.urls ?? (body.url ? [body.url] : []);
  if (paths.length === 0) {
    return NextResponse.json({ error: "url or urls required" }, { status: 400 });
  }
  const status = await pingIndexNow(paths);
  if (status === null) {
    return NextResponse.json({ skipped: true, reason: "INDEXNOW_KEY not configured" });
  }
  return NextResponse.json({ status });
}

