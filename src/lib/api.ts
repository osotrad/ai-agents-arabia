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

/** Convert thrown errors into API responses. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof ContentError) {
    return NextResponse.json(
      { error: err.message, details: err.details },
      { status: err.code },
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  console.error("[api] unhandled error:", message);
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
