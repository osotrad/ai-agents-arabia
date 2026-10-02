import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { authenticateAgent } from "@/lib/auth";

/**
 * POST /api/revalidate  (Authorization: Bearer <AGENT_API_KEY> or x-admin-key)
 * Body: { tag?: string; path?: string }
 * Optional external hook — the Content API already revalidates on write.
 */
export async function POST(req: Request) {
  if (!authenticateAgent(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    tag?: string;
    path?: string;
  };
  if (!body.tag && !body.path) {
    return NextResponse.json({ error: "tag or path required" }, { status: 400 });
  }
  if (body.tag) revalidateTag(body.tag, "max");
  if (body.path) revalidatePath(body.path);
  return NextResponse.json({ revalidated: true });
}

