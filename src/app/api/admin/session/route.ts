import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  isAdminKey,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

function cookieOptions(maxAge = ADMIN_SESSION_MAX_AGE) {
  return {
    httpOnly: true as const,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

function isFormPost(req: Request): boolean {
  return (req.headers.get("content-type") ?? "")
    .toLowerCase()
    .startsWith("application/x-www-form-urlencoded");
}

/**
 * POST /api/admin/session — exchange an admin key for a review cookie.
 *
 * The review page posts the key here; we answer with an HttpOnly cookie so the
 * key never appears in a URL, browser history, a referrer, or an access log.
 * Deliberately no `?key=` variant — that is the pattern this endpoint exists
 * to replace.
 */
export async function POST(req: Request) {
  const form = isFormPost(req);
  let key: string | null = null;

  if (form) {
    const body = await req.formData();
    const value = body.get("key");
    key = typeof value === "string" ? value : null;
  } else {
    try {
      const parsed = (await req.json()) as { key?: unknown };
      key = typeof parsed.key === "string" ? parsed.key : null;
    } catch {
      key = null;
    }
  }

  if (!isAdminKey(key)) {
    if (form) {
      return NextResponse.redirect(new URL("/admin/review?error=1", req.url), 303);
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const target = new URL(
    form ? "/admin/review" : "/admin/review#authenticated",
    req.url,
  );
  const res = form
    ? NextResponse.redirect(target, 303)
    : NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, key as string, cookieOptions());
  return res;
}

/** DELETE /api/admin/session — end the review session. */
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, "", cookieOptions(0));
  return res;
}