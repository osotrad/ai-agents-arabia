import {
  db,
  articles,
  articleSources,
  sources,
  revisions,
  glossaryTerms,
  corrections,
} from "@/db";
import { and, desc, eq, sql } from "drizzle-orm";
import { renderMarkdown, slugify } from "./sanitize";
import { sha256Hex } from "./hash";
import { recordAudit, type AuditActor } from "./audit";
import { revalidateArticle, revalidateGlossary } from "./revalidate";
import { pingIndexNow } from "./indexnow";
import { envIssues, publishCap, siteUrl } from "./env";
import type {
  ArticleInput,
  ArticlePatch,
  GlossaryInput,
  CorrectionInput,
} from "./schemas";

/** Error carrying an HTTP-ish code plus structured details for the caller. */
export class ContentError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ContentError";
  }
}

const RECHECK_DAYS: Record<string, number> = {
  news: 45,
  summary: 60,
  explainer: 90,
  review: 90,
  glossary: 120,
};
const DEFAULT_RECHECK_DAYS = 75;
const MIN_SOURCES_NEWS = 2;
/** Share of a claim's comparable words that must appear in its excerpt. */
const MIN_LEXICAL_OVERLAP = 0.2;

function recheckDate(type: string, override?: string): Date {
  if (override) return new Date(override);
  const days = RECHECK_DAYS[type] ?? DEFAULT_RECHECK_DAYS;
  return new Date(Date.now() + days * 24 * 3600 * 1000);
}

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = "";
    for (const k of [...url.searchParams.keys()]) {
      if (k.startsWith("utm_") || k === "ref") url.searchParams.delete(k);
    }
    return url.toString();
  } catch {
    return u;
  }
}

function domainOf(u: string): string {
  try {
    return new URL(u).host;
  } catch {
    return "unknown";
  }
}

/**
 * Pure pre-flight checks. `errors` block a write; `warnings` are surfaced to
 * the caller (and recorded) but do not block.
 */
export function validateArticleInput(input: ArticleInput): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (input.type === "news" && input.sources.length < MIN_SOURCES_NEWS) {
    errors.push(
      `type "news" requires at least ${MIN_SOURCES_NEWS} sources (got ${input.sources.length})`,
    );
  }
  if (input.claims.length > 0 && input.sources.length === 0) {
    errors.push("claims were provided but no sources are attached");
  }
  for (const [i, c] of input.claims.entries()) {
    if (c.sourceIndex >= input.sources.length) {
      errors.push(
        `claim #${i} references sourceIndex ${c.sourceIndex} but only ${input.sources.length} sources exist`,
      );
    }
  }

  // Numbers/dates in the body should be traceable to a provided excerpt.
  const excerpts = input.sources.map((s) => s.excerpt ?? "");
  const numericTokens =
    input.bodyMd.match(/[$€£]?\d[\d,]*(?:\.\d+)?[%$€£]?|\b20\d\d\b/g) ?? [];
  for (const tok of new Set(numericTokens)) {
    if (!excerpts.some((e) => e.includes(tok))) {
      warnings.push(`number "${tok}" was not found in any source excerpt`);
    }
  }

  // Each claim should be supportable by the excerpt it cites.
  for (const c of input.claims) {
    const support = assessClaimSupport(c.claim, excerpts[c.sourceIndex] ?? "");
    if (support.verdict === "weak") {
      warnings.push(
        `claim weakly supported by its source: "${c.claim.slice(0, 60)}" (${support.reason})`,
      );
    }
  }

  return { errors, warnings };
}

const ARABIC_RE = /[\u0600-\u06FF]/;
const LATIN_RE = /[A-Za-z]/;
/** Figures worth grounding: money, percentages, counts, years, version-like. */
const FIGURE_RE = /[$€£]?\d[\d,]*(?:\.\d+)?\s*[%$€£]?|\b\d{4}\b|\b\d+(?:[.,]\d+)?\s*[KkMm]\b/g;

/**
 * Fold away the differences that should not count as different words:
 * case, Arabic tashkēl/tatweel, the alef and yā' variants, ta-marbuta, and the
 * definite article. Without this, «اَلْمَصَادِر» and «المصادر» look unrelated.
 */
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0649/g, "\u064A")
    .replace(/\u0623/g, "\u0627");
}

function wordSet(s: string, minLength: number): Set<string> {
  const words = normalizeForMatch(s).match(/[\p{L}\p{N}]+/gu) ?? [];
  const out = new Set<string>();
  for (const raw of words) {
    // Strip a leading definite article so "المصادر" matches "مصادر".
    const w = raw.startsWith("\u0627\u0644") && raw.length > 4 ? raw.slice(2) : raw;
    if (w.length >= minLength) out.add(w);
  }
  return out;
}

/** Which script dominates a string: "arabic", "latin", or "other". */
function dominantScript(s: string): "arabic" | "latin" | "other" {
  const letters = normalizeForMatch(s).match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return "other";
  let arabic = 0;
  let latin = 0;
  for (const ch of letters) {
    if (ARABIC_RE.test(ch)) arabic++;
    else if (LATIN_RE.test(ch)) latin++;
  }
  const total = arabic + latin;
  if (total === 0) return "other";
  return arabic / total >= 0.5 ? "arabic" : "latin";
}

export type ClaimVerdict =
  /** Meaningful overlap, or every figure in the claim found its source. */
  | "grounded"
  /** A check ran and the claim did not pass it. */
  | "weak"
  /** No check could run (no excerpt, or nothing comparable to check). */
  | "unverifiable";

export interface ClaimSupport {
  verdict: ClaimVerdict;
  /** Machine-readable failure cause; absent when grounded or unverifiable. */
  reason?: "no-lexical-overlap" | "figure-not-in-excerpt" | "all-figures-missing";
  /** Fraction of comparable items that matched, when a ratio was computed. */
  ratio?: number;
  /** How many items the check actually compared. */
  checked?: number;
}

/**
 * Decide whether a claim is supported by the excerpt it cites.
 *
 * Two regimes, because one rule cannot serve both:
 *
 * - **Same script** — lexical overlap is meaningful, so compare normalized word
 *   sets. Arabic folding (tashkēl, alef/yā' variants, ta-marbuta, the definite
 *   article) is applied first, otherwise ordinary Arabic prose scores ~0.
 * - **Different script** — an Arabic claim citing an English excerpt has no
 *   lexical overlap *by construction*, so warning about it is a false positive
 *   on every single claim. Lexical comparison is meaningless here; the honest
 *   check is on the figures the claim asserts, because a claim that says "30%"
 *   must have "30%" in its source.
 */
export function assessClaimSupport(
  claim: string,
  excerpt: string,
): ClaimSupport {
  const claimTrimmed = claim.trim();
  if (!claimTrimmed || !excerpt.trim()) return { verdict: "unverifiable" };

  const claimScript = dominantScript(claimTrimmed);
  const excerptScript = dominantScript(excerpt);

  if (claimScript !== "other" && excerptScript !== "other" && claimScript !== excerptScript) {
    const figures = [
      ...new Set(claimTrimmed.match(FIGURE_RE) ?? []),
    ].map((f) => f.trim());
    if (figures.length === 0) {
      // Cross-language and figure-free: nothing comparable, so nothing to warn about.
      return { verdict: "unverifiable", checked: 0 };
    }
    const haystack = normalizeForMatch(excerpt);
    const missing = figures.filter((f) => !haystack.includes(normalizeForMatch(f)));
    if (missing.length === 0) {
      return { verdict: "grounded", checked: figures.length, ratio: 1 };
    }
    if (missing.length === figures.length) {
      return {
        verdict: "weak",
        reason: "all-figures-missing",
        checked: figures.length,
        ratio: 0,
      };
    }
    return {
      verdict: "weak",
      reason: "figure-not-in-excerpt",
      checked: figures.length,
      ratio: (figures.length - missing.length) / figures.length,
    };
  }

  const claimWords = wordSet(claimTrimmed, 4);
  if (claimWords.size === 0) return { verdict: "unverifiable", checked: 0 };
  const excerptWords = wordSet(excerpt, 1);

  let overlap = 0;
  for (const w of claimWords) if (excerptWords.has(w)) overlap++;
  const ratio = overlap / claimWords.size;

  return ratio >= MIN_LEXICAL_OVERLAP
    ? { verdict: "grounded", ratio, checked: claimWords.size }
    : { verdict: "weak", reason: "no-lexical-overlap", ratio, checked: claimWords.size };
}

async function ensureUniqueSlug(desired: string): Promise<string> {
  const base = slugify(desired);
  const rows = await db
    .select({ slug: articles.slug })
    .from(articles)
    .where(sql`${articles.slug} = ${base} OR ${articles.slug} LIKE ${base + "-%"}`);
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new ContentError("could not allocate a unique slug", 500);
}

interface ResolvedSource {
  id: string;
  url: string;
  title: string | null;
  excerpt: string | null;
}

async function upsertSources(
  input: ArticleInput["sources"],
): Promise<ResolvedSource[]> {
  const out: ResolvedSource[] = [];
  for (const s of input) {
    const url = normalizeUrl(s.url);
    const contentHash = await sha256Hex(url);
    const [row] = await db
      .insert(sources)
      .values({
        url,
        domain: domainOf(url),
        title: s.title ?? null,
        rawExcerpt: s.excerpt ?? null,
        contentHash,
      })
      .onConflictDoUpdate({
        target: sources.url,
        set: {
          title: s.title ?? null,
          rawExcerpt: s.excerpt ?? null,
          fetchedAt: new Date(),
        },
      })
      .returning({
        id: sources.id,
        url: sources.url,
        title: sources.title,
        excerpt: sources.rawExcerpt,
      });
    out.push(row);
  }
  return out;
}

async function assertPublishCap(): Promise<void> {
  const cap = publishCap();
  const res = await db.execute(
    sql`SELECT count(*)::int AS n FROM articles WHERE status='published' AND published_at > now() - interval '24 hours'`,
  );
  const rows =
    (res as unknown as { rows?: { n?: number }[] }).rows ??
    (res as unknown as { n?: number }[]);
  const n = rows[0]?.n ?? 0;
  if (n >= cap) throw new ContentError(`daily publish cap reached (${cap})`, 429);
}

async function afterPublish(slug: string): Promise<void> {
  revalidateArticle(slug);
  await pingIndexNow([`/news/${slug}`, "/news", "/"]);
}

/** Create an article (optionally publishing it in the same call). */
export async function createArticle(input: ArticleInput, actor: AuditActor) {
  const { errors, warnings } = validateArticleInput(input);
  if (errors.length) {
    throw new ContentError("validation failed", 422, { errors, warnings });
  }

  const resolved = await upsertSources(input.sources);
  const slug = await ensureUniqueSlug(input.slug ?? input.titleAr);
  const bodyHtml = await renderMarkdown(input.bodyMd);
  const publish = input.status === "published";
  if (publish) await assertPublishCap();

  const [article] = await db
    .insert(articles)
    .values({
      slug,
      titleAr: input.titleAr,
      excerptAr: input.excerptAr ?? null,
      imageUrl: input.imageUrl ?? null,
      imageAlt: input.imageAlt ?? null,
      topic: input.topic ?? null,
      topicOrder: input.topicOrder ?? null,
      bodyMd: input.bodyMd,
      bodyHtml,
      type: input.type,
      status: input.status,
      confidenceScore: input.confidenceScore ?? null,
      publishedAt: publish ? new Date() : null,
      recheckAfter: publish
        ? recheckDate(input.type, input.recheckAfter)
        : input.recheckAfter
          ? new Date(input.recheckAfter)
          : null,
      embedding: input.embedding ?? null,
      createdBy: actor === "human" ? "human" : "agent",
    })
    .returning();

  const links = new Map<
    string,
    { articleId: string; sourceId: string; claim: string }
  >();
  for (const c of input.claims) {
    const src = resolved[c.sourceIndex];
    if (!src) continue;
    links.set(`${src.id}::${c.claim}`, {
      articleId: article.id,
      sourceId: src.id,
      claim: c.claim,
    });
  }
  if (links.size > 0) {
    await db.insert(articleSources).values([...links.values()]);
  }

  await recordAudit({
    actor,
    action: "article.create",
    targetType: "article",
    targetId: article.id,
    metadata: {
      slug,
      type: input.type,
      status: input.status,
      sources: resolved.length,
      warnings,
    },
  });

  if (publish) await afterPublish(slug);
  return { article, warnings, sources: resolved };
}

/** Patch an existing article; body edits create a revision. */
export async function updateArticle(
  id: string,
  patch: ArticlePatch,
  actor: AuditActor,
) {
  const [a] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);
  if (!a) throw new ContentError("article not found", 404);

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.titleAr !== undefined) updates.titleAr = patch.titleAr;
  if (patch.excerptAr !== undefined) updates.excerptAr = patch.excerptAr;
  if (patch.imageUrl !== undefined) updates.imageUrl = patch.imageUrl;
  if (patch.imageAlt !== undefined) updates.imageAlt = patch.imageAlt;
  if (patch.confidenceScore !== undefined)
    updates.confidenceScore = patch.confidenceScore;

  if (patch.bodyMd !== undefined) {
    updates.bodyMd = patch.bodyMd;
    updates.bodyHtml = await renderMarkdown(patch.bodyMd);
    updates.version = a.version + 1;
    await db.insert(revisions).values({
      articleId: a.id,
      version: a.version + 1,
      bodyMd: patch.bodyMd,
      changedBy: actor === "human" ? "human" : "agent",
      reason: patch.reason ?? "edit",
    });
  }

  const [updated] = await db
    .update(articles)
    .set(updates as never)
    .where(eq(articles.id, id))
    .returning();

  if (updated.status === "published") revalidateArticle(updated.slug);
  await recordAudit({
    actor,
    action: "article.update",
    targetType: "article",
    targetId: id,
    metadata: { fields: Object.keys(updates), reason: patch.reason ?? null },
  });
  return updated;
}

/** Publish a draft / needs_recheck article (id or slug accepted). */
export async function publishArticle(idOrSlug: string, actor: AuditActor) {
  const [a] = await db
    .select()
    .from(articles)
    .where(
      sql`${articles.id}::text = ${idOrSlug} OR ${articles.slug} = ${idOrSlug}`,
    )
    .limit(1);
  if (!a) throw new ContentError("article not found", 404);
  if (a.status === "published") return a;

  await assertPublishCap();
  const [updated] = await db
    .update(articles)
    .set({
      status: "published",
      publishedAt: new Date(),
      recheckAfter: recheckDate(a.type),
      updatedAt: new Date(),
    })
    .where(eq(articles.id, a.id))
    .returning();

  await recordAudit({
    actor,
    action: "article.publish",
    targetType: "article",
    targetId: a.id,
    metadata: { slug: updated.slug },
  });
  await afterPublish(updated.slug);
  return updated;
}

/** Create or update a glossary term (always published — evergreen content). */
export async function upsertGlossary(input: GlossaryInput, actor: AuditActor) {
  const slug = slugify(input.slug ?? input.termEn ?? input.termAr);

  let sourceId: string | null = null;
  if (input.sourceUrl) {
    const url = normalizeUrl(input.sourceUrl);
    const contentHash = await sha256Hex(url);
    const [row] = await db
      .insert(sources)
      .values({ url, domain: domainOf(url), contentHash })
      .onConflictDoUpdate({
        target: sources.url,
        set: { fetchedAt: new Date() },
      })
      .returning({ id: sources.id });
    sourceId = row.id;
  }

  const [term] = await db
    .insert(glossaryTerms)
    .values({
      termAr: input.termAr,
      termEn: input.termEn,
      slug,
      definitionAr: input.definitionAr,
      sourceId,
      embedding: input.embedding ?? null,
      published: true,
    })
    .onConflictDoUpdate({
      target: glossaryTerms.slug,
      set: {
        termAr: input.termAr,
        termEn: input.termEn,
        definitionAr: input.definitionAr,
        ...(input.embedding ? { embedding: input.embedding } : {}),
        published: true,
      },
    })
    .returning();

  revalidateGlossary();
  await recordAudit({
    actor,
    action: "glossary.upsert",
    targetType: "glossary_term",
    targetId: term.id,
    metadata: { slug },
  });
  return term;
}

/** Log a public correction against a published article. */
export async function submitCorrection(
  input: CorrectionInput,
  actor: AuditActor,
) {
  const [a] = await db
    .select()
    .from(articles)
    .where(
      input.articleId
        ? eq(articles.id, input.articleId)
        : eq(articles.slug, input.slug as string),
    )
    .limit(1);
  if (!a) throw new ContentError("article not found", 404);

  const [row] = await db
    .insert(corrections)
    .values({
      articleId: a.id,
      whatChanged: input.whatChanged,
      publishedNote: input.publishedNote ?? null,
    })
    .returning();

  await recordAudit({
    actor,
    action: "correction.create",
    targetType: "correction",
    targetId: row.id,
    metadata: { articleId: a.id, slug: a.slug },
  });
  return row;
}

/** List articles for the agent (dedupe / awareness). */
export async function listArticles(opts: {
  status?: string;
  type?: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
  const conditions = [];
  if (opts.status) conditions.push(eq(articles.status, opts.status as never));
  if (opts.type) conditions.push(eq(articles.type, opts.type as never));

  return db
    .select({
      id: articles.id,
      slug: articles.slug,
      titleAr: articles.titleAr,
      type: articles.type,
      status: articles.status,
      confidenceScore: articles.confidenceScore,
      publishedAt: articles.publishedAt,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(articles.createdAt))
    .limit(limit);
}

async function scalarCount(query: ReturnType<typeof sql>): Promise<number> {
  const res = await db.execute(query);
  const rows =
    (res as unknown as { rows?: { n?: number }[] }).rows ??
    (res as unknown as { n?: number }[]);
  return rows[0]?.n ?? 0;
}

/** Serialize an embedding for a pgvector cast — the DB rejects stray spaces. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.map((n) => (Number.isFinite(n) ? n : 0)).join(",")}]`;
}

export interface SimilarArticle {
  id: string;
  slug: string;
  titleAr: string;
  type: string;
  publishedAt: Date | null;
  similarity: number;
}

/**
 * Cosine nearest-neighbour search over `articles.embedding` (HNSW-indexed).
 * The agent calls this before drafting to avoid semantically duplicating an
 * article that already exists under different wording.
 */
export async function findSimilarArticles(opts: {
  embedding: number[];
  limit?: number;
  /** Minimum cosine similarity to report; 0.9 ≈ near-duplicate. */
  threshold?: number;
}): Promise<SimilarArticle[]> {
  const limit = Math.min(Math.max(opts.limit ?? 5, 1), 25);
  const threshold = opts.threshold ?? 0;
  const literal = toVectorLiteral(opts.embedding);

  const res = await db.execute(sql`
    SELECT id::text AS id,
           slug,
           title_ar AS "titleAr",
           type::text AS type,
           published_at AS "publishedAt",
           (1 - (embedding <=> ${literal}::vector))::float AS similarity
    FROM articles
    WHERE status = 'published'
      AND embedding IS NOT NULL
      AND (1 - (embedding <=> ${literal}::vector)) >= ${threshold}
    ORDER BY embedding <=> ${literal}::vector
    LIMIT ${limit}
  `);

  const rows =
    (res as unknown as { rows?: SimilarArticle[] }).rows ??
    (res as unknown as SimilarArticle[]);
  return rows ?? [];
}

/** Keyword search across published titles and excerpts (public site search). */
export async function searchArticles(opts: {
  q: string;
  type?: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const q = opts.q.trim();
  if (!q) return [];
  const pattern = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const typeFilter =
    opts.type && opts.type !== "all"
      ? sql`AND type = ${opts.type}::article_type`
      : sql``;

  return db
    .select({
      slug: articles.slug,
      titleAr: articles.titleAr,
      excerptAr: articles.excerptAr,
      type: articles.type,
      publishedAt: articles.publishedAt,
    })
    .from(articles)
    .where(
      sql`status = 'published'
          AND (title_ar ILIKE ${pattern} OR excerpt_ar ILIKE ${pattern})
          ${typeFilter}`,
    )
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
}

/** Bootstrap payload the agent fetches before each run. */
export async function getSiteContext() {
  const counts = {
    published: await scalarCount(
      sql`SELECT count(*)::int AS n FROM articles WHERE status='published'`,
    ),
    pendingReview: await scalarCount(
      sql`SELECT count(*)::int AS n FROM articles WHERE status='pending_review'`,
    ),
    needsRecheck: await scalarCount(
      sql`SELECT count(*)::int AS n FROM articles WHERE status='needs_recheck'`,
    ),
    publishedLast24h: await scalarCount(
      sql`SELECT count(*)::int AS n FROM articles WHERE status='published' AND published_at > now() - interval '24 hours'`,
    ),
  };

  const recentTitles = await db
    .select({
      slug: articles.slug,
      titleAr: articles.titleAr,
      type: articles.type,
    })
    .from(articles)
    .where(eq(articles.status, "published"))
    .orderBy(desc(articles.publishedAt))
    .limit(40);

  return {
    site: siteUrl(),
    publishCap: publishCap(),
    allowedTypes: ["news", "summary", "explainer", "review", "glossary"],
    counts,
    recentTitles,
    guidelines: GUIDELINES,
  };
}

/** Tables the application expects to exist; a missing one breaks writes. */
const REQUIRED_TABLES = [
  "articles",
  "sources",
  "article_sources",
  "revisions",
  "glossary_terms",
  "corrections",
  "audit_log",
] as const;

/**
 * Read-only schema report. A write failing with `42P01 relation ... does not
 * exist` is otherwise undiagnosable from the caller side, and an unapplied
 * migration ledger is invisible until something tries to insert.
 */
async function getSchemaReport() {
  try {
    const tablesRes = await db.execute(
      sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    const rows =
      (tablesRes as unknown as { rows?: { tablename: string }[] }).rows ??
      (tablesRes as unknown as { tablename: string }[]);
    const present = new Set((rows ?? []).map((r) => r.tablename));
    const missing = REQUIRED_TABLES.filter((t) => !present.has(t));
    return { missing, ok: missing.length === 0 };
  } catch (err) {
    return {
      missing: [...REQUIRED_TABLES],
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Operational health for dashboards / the agent's own status checks. */
export async function getHealth() {
  const [published, pendingReview, needsRecheck] = await Promise.all([
    scalarCount(
      sql`SELECT count(*)::int AS n FROM articles WHERE status='published'`,
    ),
    scalarCount(
      sql`SELECT count(*)::int AS n FROM articles WHERE status='pending_review'`,
    ),
    scalarCount(
      sql`SELECT count(*)::int AS n FROM articles WHERE status='needs_recheck'`,
    ),
  ]);

  const recentAuditRes = await db.execute(
    sql`SELECT actor, action, target_type, target_id, created_at FROM audit_log ORDER BY created_at DESC LIMIT 20`,
  );
  const recentAudit =
    (recentAuditRes as unknown as { rows?: unknown[] }).rows ??
    (recentAuditRes as unknown as unknown[]);

  return {
    articles: { published, pendingReview, needsRecheck },
    schema: await getSchemaReport(),
    config: { issues: envIssues() },
    recentAudit,
  };
}

/** Editorial policy, served to the agent as markdown. */
export const GUIDELINES = `# سياسة النشر — وكلاء

## المهمة
انشر محتوى عربيًا أصيلًا عن وكلاء الذكاء الاصطناعي: أخبار، ملخصات، شروحات، مراجعات، ومصطلحات.

## قواعد إلزامية
1. كل خبر يحتاج مصدرين مستقلين على الأقل قبل النشر.
2. كل رقم أو تاريخ أو اسم منتج في النص يجب أن يوجد حرفيًا في أحد المصادر المرفقة.
3. لا ترجمة حرفية: اكتب بزاوية تهم القارئ العربي.
4. اربط كل ادعاء بمصدره عبر حقل claims (sourceIndex).
5. الـ slug إنجليزي قصير، أحرف صغيرة وشرطات فقط.

## سير العمل
- اقرأ GET /api/v1/context أولًا: السياسة، الأعداد، وعناوين آخر 40 مقالًا.
- قبل الصياغة، ابحث عن تكرار محتمل: find_similar_articles (بحث متجهي) أو search_articles.
- أنشئ المقال عبر POST /api/v1/articles بحالة pending_review أو draft.
- استخدم POST /api/v1/articles/validate للتحقق قبل الإنشاء.
- النشر: POST /api/v1/articles/{id}/publish أو أنشئ بحالة published.
- حد النشر اليومي مفروض من الخادم على كل مسار نشر — بما فيه موافقة المحرر البشري؛ عند التجاوز يعيد 429.
`;

/** Statuses a reviewer may inspect in the queue. */
export const REVIEWABLE_STATUSES = [
  "pending_review",
  "draft",
  "needs_recheck",
  "published",
  "archived",
] as const;

export type ReviewableStatus = (typeof REVIEWABLE_STATUSES)[number];

export function isReviewableStatus(value: string): value is ReviewableStatus {
  return (REVIEWABLE_STATUSES as readonly string[]).includes(value);
}

/** Full rows awaiting a review decision (default: pending_review), newest first. */
export async function listReviewQueue(
  opts: { status?: ReviewableStatus; limit?: number } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  return db
    .select()
    .from(articles)
    .where(eq(articles.status, opts.status ?? "pending_review"))
    .orderBy(desc(articles.createdAt))
    .limit(limit);
}

/** Human reviewer decision on a queued article (approve with edits, or reject). */
export async function reviewArticle(
  input: {
    articleId: string;
    action: "approve" | "reject";
    reason?: string;
    edits?: { titleAr?: string; excerptAr?: string; bodyMd?: string };
  },
  actor: AuditActor,
) {
  const [a] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, input.articleId))
    .limit(1);
  if (!a) throw new ContentError("article not found", 404);

  if (input.action === "reject") {
    await db
      .update(articles)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(articles.id, a.id));
    await recordAudit({
      actor,
      action: "article.reject",
      targetType: "article",
      targetId: a.id,
      metadata: { reason: input.reason ?? null },
    });
    return { status: "archived" as const, slug: a.slug };
  }

  // Human approval still publishes, so it is subject to the same cap as any
  // other write path — otherwise the queue becomes a cap bypass.
  await assertPublishCap();

  const updates: Record<string, unknown> = {
    status: "published",
    publishedAt: new Date(),
    recheckAfter: recheckDate(a.type),
    updatedAt: new Date(),
  };
  if (input.edits?.titleAr) updates.titleAr = input.edits.titleAr;
  if (input.edits?.excerptAr !== undefined) updates.excerptAr = input.edits.excerptAr;
  if (input.edits?.bodyMd) {
    updates.bodyMd = input.edits.bodyMd;
    updates.bodyHtml = await renderMarkdown(input.edits.bodyMd);
    updates.version = a.version + 1;
    await db.insert(revisions).values({
      articleId: a.id,
      version: a.version + 1,
      bodyMd: input.edits.bodyMd,
      changedBy: "human",
      reason: input.reason ?? "edit on approval",
    });
  }

  const [updated] = await db
    .update(articles)
    .set(updates as never)
    .where(eq(articles.id, a.id))
    .returning();

  await recordAudit({
    actor,
    action: "article.approve",
    targetType: "article",
    targetId: a.id,
    metadata: { reason: input.reason ?? null, edited: Boolean(input.edits?.bodyMd) },
  });
  await afterPublish(updated.slug);
  return { status: "published" as const, slug: updated.slug };
}

