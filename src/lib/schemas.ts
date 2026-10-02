import { z } from "zod";

export const articleTypeSchema = z.enum([
  "news",
  "glossary",
  "summary",
  "explainer",
  "review",
]);

export const articleWritableStatusSchema = z.enum([
  "draft",
  "pending_review",
  "published",
]);

export const sourceInputSchema = z.object({
  url: z.string().url(),
  title: z.string().max(300).optional(),
  /** Raw excerpt the claims are grounded in (used for verification warnings). */
  excerpt: z.string().max(8000).optional(),
});

export const claimInputSchema = z.object({
  claim: z.string().min(3).max(600),
  /** Index into the `sources` array this claim is supported by. */
  sourceIndex: z.number().int().min(0),
});

export const embeddingSchema = z.array(z.number()).length(1536);

export const articleInputSchema = z.object({
  titleAr: z.string().min(5).max(300),
  excerptAr: z.string().max(600).optional(),
  bodyMd: z.string().min(80).max(60_000),
  type: articleTypeSchema.default("news"),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(120)
    .optional(),
  status: articleWritableStatusSchema.default("pending_review"),
  sources: z.array(sourceInputSchema).max(20).default([]),
  claims: z.array(claimInputSchema).max(80).default([]),
  confidenceScore: z.number().min(0).max(1).optional(),
  embedding: embeddingSchema.optional(),
  /** ISO date; defaults per-type when published. */
  recheckAfter: z.string().datetime().optional(),
});

export type ArticleInput = z.infer<typeof articleInputSchema>;

export const articlePatchSchema = z
  .object({
    titleAr: z.string().min(5).max(300).optional(),
    excerptAr: z.string().max(600).optional(),
    bodyMd: z.string().min(80).max(60_000).optional(),
    confidenceScore: z.number().min(0).max(1).optional(),
    reason: z.string().max(500).optional(),
  })
  .refine(
    (v) => Object.keys(v).some((k) => k !== "reason"),
    "at least one field to update is required",
  );

export type ArticlePatch = z.infer<typeof articlePatchSchema>;

export const glossaryInputSchema = z.object({
  termAr: z.string().min(2).max(120),
  termEn: z.string().min(2).max(120),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(120)
    .optional(),
  definitionAr: z.string().min(20).max(1200),
  sourceUrl: z.string().url().optional(),
  embedding: embeddingSchema.optional(),
});

export type GlossaryInput = z.infer<typeof glossaryInputSchema>;

export const correctionInputSchema = z
  .object({
    articleId: z.string().uuid().optional(),
    slug: z.string().optional(),
    whatChanged: z.string().min(5).max(2000),
    publishedNote: z.string().max(1000).optional(),
  })
  .refine((v) => v.articleId || v.slug, "articleId or slug is required");

export type CorrectionInput = z.infer<typeof correctionInputSchema>;

export const reviewActionSchema = z.object({
  articleId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(500).optional(),
  edits: z
    .object({
      titleAr: z.string().min(5).max(300).optional(),
      excerptAr: z.string().max(600).optional(),
      bodyMd: z.string().min(80).max(60_000).optional(),
    })
    .optional(),
});
