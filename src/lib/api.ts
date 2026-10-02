import { NextResponse } from "next/server";
import type { z } from "zod";
import { authenticateAgent, type Actor } from "./auth";
import { ContentError } from "./content";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

/** Resolve the caller for a content request, or null when unauthorized. */
export function caller(req: Request): Actor | null {
  return authenticateAgent(req);
}

/**
 * Unwrap the reason a driver error actually failed. Drizzle/Neon wrap the
 * Postgres error in `cause`, and the wrapper's own message ("Failed query: …")
 * never says what the database complained about — which makes a migration or
 * schema mismatch nearly impossible to diagnose from a Worker log.
 */
function describeCause(err: unknown, depth = 0): string[] {
  if (!err || typeof err !== "object" || depth > 3) return [];
  const e = err as { cause?: unknown; message?: unknown; code?: unknown };
  const out: string[] = [];
  if (typeof e.code === "string") out.push(`code=${e.code}`);
  if (typeof e.message === "string") out.push(e.message);
  if (e.cause) {
    out.push(...describeCause(e.cause, depth + 1));
  }
  return out;
}

/** Convert thrown errors into API responses. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ContentError) {
    return NextResponse.json(
      { error: err.message, details: err.details },
      { status: err.code },
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  const cause = describeCause(err);
  console.error("[api] unhandled error:", message, ...cause);
  return NextResponse.json({ error: "internal error" }, { status: 500 });
}

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/** Read + validate a JSON body against a zod schema. */
export async function readBody<T extends z.ZodType>(
  req: Request,
  schema: T,
): Promise<ParseResult<z.infer<T>>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "invalid JSON body" },
        { status: 400 },
      ),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "validation failed", issues: parsed.error.issues },
        { status: 422 },
      ),
    };
  }
  return { ok: true, data: parsed.data as z.infer<T> };
}
