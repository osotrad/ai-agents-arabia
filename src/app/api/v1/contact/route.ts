import { z } from "zod";
import { NextResponse } from "next/server";
import { db, contactRequests } from "@/db";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Lead capture for /contact — the site's only unauthenticated *write* path,
 * and therefore its only spam surface. Four defences:
 *
 *  1. **Content negotiation** — a browser form post (`form-encoded`) is
 *     answered with a redirect back to /contact, while a JSON caller gets
 *     JSON. This is what lets /contact work with no client-side JS.
 *  2. **Honeypot** — `website` is hidden from humans and filled by bots. A
 *     non-empty value is redirected as though it succeeded, so the bot
 *     learns nothing and no row is written.
 *  3. **Per-IP rate limit** — 5 per rolling hour, counted in this table. It
 *     must live in Postgres: a Worker isolate's memory is per-colocation,
 *     so an in-process counter would not be a real limit.
 *  4. **Length caps + email shape** — bounded rows, no header injection.
 *
 * Captcha is deliberately absent. It would add a third-party dependency and a
 * key to rotate in order to defend a form that should receive a handful of
 * legitimate leads rather than scale.
 */

const ContactInput = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  // Honeypot: must arrive empty. Hidden from humans, never announced.
  website: z.string().max(200).optional().default(""),
  /** Article slug the CTA came from, for attribution. */
  from: z.string().trim().max(255).optional(),
  kind: z.enum(["agent", "correction", "collab", "other"]).default("agent"),
  message: z.string().trim().min(10).max(4000),
});

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

/** Best-effort client IP. Cloudflare sets cf-connect-ip; a proxy may not. */
function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connect-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** Salted SHA-256 of the IP, so the raw address is never persisted. */
async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(`woklaa-rl:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export async function POST(req: Request) {
  const type = req.headers.get("content-type") ?? "";
  const isForm = type.includes("application/x-www-form-urlencoded");

  let body: unknown;
  try {
    body = isForm ? Object.fromEntries(new URLSearchParams(await req.text())) : await req.json();
  } catch {
    return isForm
      ? redirect("/contact?error=invalid")
      : json({ error: "invalid_json" }, 400);
  }

  const parsed = ContactInput.safeParse(body);
  if (!parsed.success) {
    return isForm
      ? redirect("/contact?error=invalid")
      : json({ error: "invalid_input", issues: parsed.error.issues }, 400);
  }
  const data = parsed.data;

  // Honeypot — redirect as though it worked so bots don't adapt.
  if (data.website.length > 0) {
    return isForm ? redirect("/contact?sent=1") : json({ ok: true, request: { id: null } }, 201);
  }

  const ipHash = await hashIp(clientIp(req));
  const since = new Date(Date.now() - WINDOW_MS);

  try {
    const [{ count } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(contactRequests)
      .where(and(eq(contactRequests.ipHash, ipHash), gt(contactRequests.createdAt, since)));
    if ((count ?? 0) >= MAX_PER_WINDOW) {
      return isForm
        ? redirect("/contact?error=too_many")
        : json(
            { error: "too_many_requests", message: "تجاوزت الحد المسموح. حاول بعد قليل." },
            429,
          );
    }

    const [row] = await db
      .insert(contactRequests)
      .values({
        name: data.name,
        email: data.email,
        sourceSlug: data.from?.slice(0, 255) || null,
        kind: data.kind,
        message: data.message,
        ipHash,
      })
      .returning({ id: contactRequests.id });

    return isForm
      ? redirect("/contact?sent=1")
      : json({ ok: true, request: { id: row?.id ?? null } }, 201);
  } catch (err) {
    // Never leak a driver code or message to an unauthenticated caller.
    console.error("contact submission failed", err);
    return isForm ? redirect("/contact?error=failed") : json({ error: "server_error" }, 500);
  }
}

/** 303 so the browser follows up with GET and a refresh cannot repost. */
function redirect(to: string) {
  return NextResponse.redirect(new URL(to, req_origin()), 303);
}

function req_origin(): string {
  return process.env.SITE_URL ?? "http://localhost:3000";
}

/** GET /api/v1/contact — admin-only listing of received leads. */
export async function GET(req: Request) {
  const { authenticateAdmin } = await import("@/lib/auth");
  const admin = await authenticateAdmin(req);
  if (!admin) return json({ error: "unauthorized" }, 401);
  try {
    const rows = await db
      .select()
      .from(contactRequests)
      .orderBy(desc(contactRequests.createdAt))
      .limit(100);
    return json({ ok: true, requests: rows });
  } catch (err) {
    console.error("contact listing failed", err);
    return json({ error: "server_error" }, 500);
  }
}
