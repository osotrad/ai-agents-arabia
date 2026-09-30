import { db, glossaryTerms, sources } from "@/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { callLLMJson, embed, MODEL } from "../llm";
import { logger } from "../logger";

const termSchema = z.object({
  termAr: z.string().min(2).max(80),
  termEn: z.string().min(2).max(80),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(80),
  definitionAr: z.string().min(40).max(600),
});

/**
 * PR-013: generate a glossary term from a source excerpt, or refine an
 * existing one. Auto-publishes (glossary is low-risk evergreen content).
 */
export async function glossaryStep(input: { term: string; sourceId?: string }) {
  return { output: await run(input), confidence: 0.7 };

  async function run(inp: { term: string; sourceId?: string }) {
    let sourceText = "";
    const sourceId: string | undefined = inp.sourceId;
    if (sourceId) {
      const [s] = await db.select().from(sources).where(eq(sources.id, sourceId)).limit(1);
      sourceText = (s?.rawExcerpt ?? "").slice(0, 1500);
    }

    const prompt = `
عرّف المصطلح التقني "${inp.term}" تعريفًا عربيًا موجزًا (2–4 جمل) دقيقًا ومحايدًا.
${sourceText ? `السياق من المصدر:\n${sourceText}\n` : ""}
JSON: { "termAr": "...", "termEn": "...", "slug": "...", "definitionAr": "..." }
`;

    const t = await callLLMJson({ model: MODEL.draft, prompt, schema: termSchema });
    const vec = await embed(`${t.termAr} ${t.termEn} ${t.definitionAr}`);

    await db
      .insert(glossaryTerms)
      .values({
        termAr: t.termAr,
        termEn: t.termEn,
        slug: t.slug,
        definitionAr: t.definitionAr,
        sourceId,
        embedding: vec,
        published: true,
      })
      .onConflictDoUpdate({
        target: glossaryTerms.slug,
        set: { definitionAr: t.definitionAr, embedding: vec, published: true },
      });

    logger.info({ slug: t.slug }, "glossary term upserted");
    return { slug: t.slug };
  }
}
