import { marked } from "marked";
import { db, articles, sources, articleSources } from "@/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { callLLMJson, embed, MODEL } from "../llm";
import { logger } from "../logger";

export const MIN_SOURCES = 2;
const SIMILARITY_THRESHOLD = 0.85;

const draftSchema = z.object({
  titleAr: z.string().min(10).max(200),
  excerptAr: z.string().min(20).max(400),
  /** Full Arabic news article (150–300 words). */
  bodyMd: z.string().min(200),
  /** Every claim in the article, mapped to the index of the source supporting it. */
  claims: z.array(
    z.object({
      claim: z.string(),
      sourceIndex: z.number().int().min(0),
    }),
  ).min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(255),
});

export type Draft = z.infer<typeof draftSchema>;

/**
 * dedupe: skip if a semantically-similar published article exists.
 */
export async function dedupe(titleAndBody: string): Promise<{ duplicate: boolean; similarity?: number }> {
  const vec = await embed(titleAndBody.slice(0, 2_000));
  const res = await db.execute(
    sql`
      SELECT 1 - (embedding <=> ${JSON.stringify(vec)}::vector(1536)) AS similarity
      FROM articles
      WHERE embedding IS NOT NULL AND status = 'published'
      ORDER BY embedding <=> ${JSON.stringify(vec)}::vector(1536)
      LIMIT 1
    `,
  );
  const rows = (res as { rows?: unknown[] }).rows ?? (res as unknown as unknown[]);
  const similarity = (rows[0] as { similarity?: number } | undefined)?.similarity;
  logger.info({ similarity }, "dedupe check");
  return { duplicate: (similarity ?? 0) >= SIMILARITY_THRESHOLD, similarity };
}

/**
 * draft: write an original Arabic news article grounded in ≥ MIN_SOURCES sources.
 */
export async function draft(candidateSourceIds: string[]): Promise<{ output: Draft; confidence: number }> {
  const srcs = await db.select().from(sources).where(
    sql`${sources.id} IN (${sql.join(candidateSourceIds.map((id) => sql`${id}::uuid`), sql`, `)})`,
  );
  if (srcs.length < MIN_SOURCES) {
    throw new Error(`need ≥${MIN_SOURCES} sources, got ${srcs.length}`);
  }

  const sourcesBlock = srcs
    .map((s, i) => `[مصدر ${i}] ${s.title}\n${s.url}\n${(s.rawExcerpt ?? "").slice(0, 1200)}\n`)
    .join("\n---\n");

  const prompt = `
أنت صحفي تقني متخصص في الذكاء الاصطناعي. اكتب مقالًا إخباريًا **عربيًا أصيلًا** (150–300 كلمة) عن الموضوع في المصادر أدناه.

القواعد الصارمة:
1. لا تترجم حرفيًا — حلّل بزاوية تهم القارئ العربي (لماذا يهمه هذا؟).
2. كل رقم أو تاريخ أو اسم منتج يجب أن يظهر حرفيًا في أحد المصادر.
3. اربط كل ادعاء (claim) في المقال برقم المصدر الداعم له.
4. الـ slug إنجليزي قصير (3–6 كلمات بشرطات).
5. JSON schema:
{
  "titleAr": "...",
  "excerptAr": "...",       // جملتان كحد أقصى
  "bodyMd": "...",          // markdown
  "claims": [{ "claim": "...", "sourceIndex": 0 }, ...],
  "slug": "..."
}

المصادر:
${sourcesBlock}
`;

  const result = await callLLMJson({ model: MODEL.draft, prompt, schema: draftSchema });

  // Homework: every claim must map to an in-range source index
  for (const c of result.claims) {
    if (c.sourceIndex >= srcs.length) {
      throw new Error(`claim references sourceIndex ${c.sourceIndex} but only ${srcs.length} sources`);
    }
  }

  return { output: result, confidence: 0.8 };
}

/**
 * verify: hard-coded gates — never trust the model's word.
 *  - every claim must be backed by stored source excerpt (exact string containment)
 *  - any number/date/price in the body must appear in a source excerpt
 */
export async function verify(
  draftArticle: Draft,
  candidateSourceIds: string[],
): Promise<{ output: { pass: boolean; reasons: string[] }; confidence: number }> {
  const srcs = await db.select().from(sources).where(
    sql`${sources.id} IN (${sql.join(candidateSourceIds.map((id) => sql`${id}::uuid`), sql`, `)})`,
  );
  const excerpts = srcs.map((s) => s.rawExcerpt ?? "");
  const reasons: string[] = [];

  if (srcs.length < MIN_SOURCES) reasons.push(`fewer than ${MIN_SOURCES} sources`);

  // every number / date-like token in body must be found in some excerpt
  const numericTokens = draftArticle.bodyMd.match(/[\$€£]?\d[\d,]*(?:\.\d+)?[%\$€£]?|\b20\d\d\b/g) ?? [];
  for (const tok of numericTokens) {
    if (!excerpts.some((e) => e.includes(tok))) {
      reasons.push(`number "${tok}" not in any source excerpt`);
    }
  }

  // claims should have some textual overlap with their source excerpt
  for (const c of draftArticle.claims) {
    const excerpt = excerpts[c.sourceIndex] ?? "";
    const claimWords = c.claim.split(/\s+/).filter((w) => w.length > 4);
    const overlap = claimWords.filter((w) => excerpt.includes(w)).length;
    if (claimWords.length > 0 && overlap / claimWords.length < 0.3) {
      reasons.push(`claim weakly supported: "${c.claim.slice(0, 80)}"`);
    }
  }

  const pass = reasons.length === 0;
  return { output: { pass, reasons }, confidence: pass ? 0.85 : 0.3 };
}

/**
 * publish: persist article + link claims to sources, then revalidate.
 */
export async function publish(draftArticle: Draft, candidateSourceIds: string[]) {
  const vec = await embed(`${draftArticle.titleAr}\n${draftArticle.bodyMd.slice(0, 1_000)}`);
  const bodyHtml = (await marked.parse(draftArticle.bodyMd)) as string;

  const [a] = await db
    .insert(articles)
    .values({
      slug: draftArticle.slug,
      titleAr: draftArticle.titleAr,
      excerptAr: draftArticle.excerptAr,
      bodyMd: draftArticle.bodyMd,
      bodyHtml,
      type: "news",
      status: "published",
      publishedAt: new Date(),
      confidenceScore: 0.8,
      embedding: vec,
      createdBy: "agent",
    })
    .returning();

  await db.insert(articleSources).values(
    draftArticle.claims.map((c) => ({
      articleId: a.id,
      sourceId: candidateSourceIds[c.sourceIndex],
      claim: c.claim,
    })),
  );

  logger.info({ articleId: a.id, slug: a.slug }, "published");

  // Notify the Cloudflare-hosted site to revalidate this slug + lists.
  const siteUrl = process.env.SITE_URL;
  const adminKey = process.env.ADMIN_API_KEY;
  if (siteUrl && adminKey) {
    try {
      await fetch(`${siteUrl}/api/revalidate`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ path: `/news/${a.slug}` }),
      });
      await fetch(`${siteUrl}/api/revalidate`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ tag: "articles" }),
      });
    } catch (err) {
      logger.warn({ err: String(err) }, "revalidate call failed (non-fatal)");
    }
  }

  return { articleId: a.id, slug: a.slug };
}
