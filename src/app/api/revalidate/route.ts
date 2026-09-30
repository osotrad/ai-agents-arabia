import { NextRequest, NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";

/**
 * POST /api/revalidate  (header: x-admin-key)
 * Body: { tag?: string; path?: string }
 * Called by the external agent worker after publishing.
 */
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (!process.env.ADMIN_API_KEY || key !== process.env.ADMIN_API_KEY) {
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
