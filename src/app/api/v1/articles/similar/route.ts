import { z } from "zod";
import { caller, errorResponse, json, readBody, unauthorized } from "@/lib/api";
import { findSimilarArticles } from "@/lib/content";
import { embeddingSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  embedding: embeddingSchema,
  limit: z.number().int().min(1).max(25).optional(),
  /** Minimum cosine similarity to report; 0.9 ≈ near-duplicate. */
  threshold: z.number().min(-1).max(1).optional(),
});

/**
 * POST /api/v1/articles/similar
 * Body: { embedding: number[1536], limit?, threshold? }
 * Cosine nearest-neighbour search — the semantic dedupe check the agent runs
 * before drafting.
 */
export async function POST(req: Request) {
  if (!caller(req)) return unauthorized();
  const body = await readBody(req, bodySchema);
  if (!body.ok) return body.response;
  try {
    const articles = await findSimilarArticles(body.data);
    return json({ threshold: body.data.threshold ?? 0, articles });
  } catch (err) {
    return errorResponse(err);
  }
}