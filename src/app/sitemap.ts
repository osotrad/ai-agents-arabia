import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/env";
import { SERIES } from "@/lib/series";
import { db, articles, glossaryTerms } from "@/db";
import { desc, eq } from "drizzle-orm";

/**
 * Articles are published at runtime (Content API / MCP) with no redeploy.
 * Without this flag Next.js prerenders the sitemap once at build time and
 * serves that snapshot until the next deploy: the live file listed 34
 * articles (newest lastmod 2026-10-15) while the site had 59 published.
 * Same pattern as src/app/feed.xml/route.ts.
 */
export const dynamic = "force-dynamic";

/** Used only when SITE_URL is absent. */
const FALLBACK_SITE_URL = "https://ai-agents-arabia.osotrad101.workers.dev";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = canonicalUrl() || FALLBACK_SITE_URL;

  const statics: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/news`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/standards`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/corrections`, changeFrequency: "weekly", priority: 0.4 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/sources`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/contact`, changeFrequency: "monthly", priority: 0.4 },
    // Series hubs, generated from the registry so the sitemap can never
    // advertise a series that no longer exists.
    { url: `${base}/topics`, changeFrequency: "weekly", priority: 0.9 },
    ...SERIES.map((s) => ({
      url: `${base}/topics/${s.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
  ];

  try {
    const arts = await db
      .select({
        slug: articles.slug,
        publishedAt: articles.publishedAt,
        updatedAt: articles.updatedAt,
      })
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
      // An empty glossary is a thin page: advertise it only once it has terms.
      ...(terms.length > 0
        ? [
            {
              url: `${base}/glossary`,
              changeFrequency: "daily" as const,
              priority: 0.8,
            },
          ]
        : []),
      ...arts.map((a) => ({
        url: `${base}/news/${a.slug}`,
        // Real modification time, so edited articles (version 2+) are recrawled.
        lastModified: a.updatedAt ?? a.publishedAt ?? undefined,
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
    // DB unavailable — serve static routes only
    return statics;
  }
}