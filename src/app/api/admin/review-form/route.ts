import { NextRequest, NextResponse } from "next/server";

/** Form-friendly wrapper: HTML form → JSON → /api/admin/review */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const key = String(form.get("key") ?? "");
  const articleId = String(form.get("articleId") ?? "");
  const action = String(form.get("action") ?? "");

  const res = await fetch(new URL("/api/admin/review", req.url), {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-key": key },
    body: JSON.stringify({ articleId, action }),
  });
  const data = await res.json();
  return NextResponse.redirect(new URL(`/admin/review?key=${encodeURIComponent(key)}`, req.url));
}
