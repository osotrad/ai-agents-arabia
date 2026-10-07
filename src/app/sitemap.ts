import type { MetadataRoute } from "next";
import { db, articles, glossaryTerms } from "@/db";
import { desc, eq } from "drizzle-orm";

/** Used only when SITE_URL is absent (e.g. a build-time crawl). */
const FALLBACK_SITE_URL = "https://ai-agents-arabia.osotrad101.workers.dev";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.SITE_URL ?? FALLBACK_SITE_URL;

  const statics: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/news`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/glossary`, changeFrequency: "daily", priority: 0.8 },
    { url: `${base}/standards`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/corrections`, changeFrequency: "weekly", priority: 0.4 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/sources`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.4 },
    // Series hubs. Kept in sync with TOPICS in app/topics/[topic]/page.tsx;
    // a series with no published articles still resolves to an empty state.
    { url: `${base}/topics/langchain`, changeFrequency: "weekly", priority: 0.9 },
  ];

  try {
    const arts = await db
      .select({ slug: articles.slug, publishedAt: articles.publishedAt })
      .from(articles)
      .where(eq(articles.status, "published"))
      .orderBy(desc(articles.publishedAt))
      .limit(1000);

    const terms = await db
      .select({ slug: glossaryTerms.slug })
      .from(glossaryTerms)
      .where(eq(glossaryTerms.published, true))
      .limit(1000);

    return [
      ...statics,
      ...arts.map((a) => ({
        url: `${base}/news/${a.slug}`,
        lastModified: a.publishedAt ?? undefined,
        changeFrequency: "daily" as const,
        priority: 0.7,
      })),
      ...terms.map((t) => ({
        url: `${base}/glossary/${t.slug}`,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    // DB unavailable at build time — serve static routes only
    return statics;
  }
}
