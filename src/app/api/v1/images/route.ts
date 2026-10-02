import { z } from "zod";
import { caller, errorResponse, json, readBody, unauthorized } from "@/lib/api";
import { ALLOWED_TYPES, ImageError, uploadArticleImage } from "@/lib/images";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** Short ASCII slug the key is built from, e.g. the article's slug. */
  slug: z
    .string()
    .regex(/^[a-z0-9-]{1,120}$/)
    .default("article"),
  /** Base64 of the raw image bytes. JSON keeps this consistent with the rest. */
  dataBase64: z.string().min(16),
  /** A hint only — the bytes decide. Mismatches are rejected. */
  contentType: z.enum(ALLOWED_TYPES).optional(),
  /** Arabic alt text, recorded for the caller to pass back as imageAlt. */
  alt: z.string().min(5).max(300).optional(),
});

/**
 * POST /api/v1/images
 * Store an image for use as an article header. Returns `{ url }` to pass as
 * `imageUrl` when creating or patching an article.
 */
export async function POST(req: Request) {
  if (!caller(req)) return unauthorized();
  const body = await readBody(req, bodySchema);
  if (!body.ok) return body.response;
  try {
    const image = await uploadArticleImage(body.data);
    return json(
      {
        ok: true,
        image,
        hint: "pass image.url as imageUrl (and alt as imageAlt) on the article",
      },
      201,
    );
  } catch (err) {
    if (err instanceof ImageError) return json({ error: err.message }, err.status);
    return errorResponse(err);
  }
}