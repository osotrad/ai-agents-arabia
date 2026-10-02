import { caller, errorResponse, json, unauthorized } from "@/lib/api";
import { searchArticles } from "@/lib/content";
import { articleTypeSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/search?q=openai&type=news&limit=20
 * Keyword search over published titles and excerpts.
 */
export async function GET(req: Request) {
  if (!caller(req)) return unauthorized();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return json({ error: "q is required" }, 400);
  }
  const rawType = url.searchParams.get("type") ?? undefined;
  const parsedType = articleTypeSchema.safeParse(rawType);
  if (rawType && !parsedType.success) {
    return json(
      {
        error: `invalid type "${rawType}"`,
        allowed: articleTypeSchema.options,
      },
      400,
    );
  }
  const rawLimit = Number(url.searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(rawLimit) ? rawLimit : 20;

  try {
    const articles = await searchArticles({
      q,
      type: parsedType.success ? parsedType.data : undefined,
      limit,
    });
    return json({ query: q, articles });
  } catch (err) {
    return errorResponse(err);
  }
}