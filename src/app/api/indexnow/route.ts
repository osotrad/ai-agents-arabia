import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/indexnow?url=/news/slug  (header: x-admin-key)
 * Pings IndexNow (Bing/Yandex) after publish. Key file route below.
 */
export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (!process.env.ADMIN_API_KEY || key !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { url } = (await req.json()) as { url?: string };
  if (!url) return NextResponse.json({ error: "url required" }, { status: 400 });

  const indexnowKey = process.env.INDEXNOW_KEY;
  if (!indexnowKey) return NextResponse.json({ skipped: true, reason: "no INDEXNOW_KEY" });

  const host = new URL(process.env.SITE_URL ?? "http://localhost").host;
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      host,
      key: indexnowKey,
      keyLocation: `${process.env.SITE_URL}/${indexnowKey}.txt`,
      urlList: [`${process.env.SITE_URL}${url}`],
    }),
  });
  return NextResponse.json({ status: res.status });
}
