import { db, articles, articleSources, sources } from "@/db";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 300;

type Params = { params: Promise<{ slug: string }> };

/** Load a published article; returns null (never throws) if the DB is down. */
async function getArticle(slug: string) {
  try {
    const [a] = await db
      .select()
      .from(articles)
      .where(and(eq(articles.slug, slug), eq(articles.status, "published")))
      .limit(1);
    return a ?? null;
  } catch {
    return null;
  }
}

async function getSources(articleId: string) {
  try {
    return await db
      .select({
        url: sources.url,
        domain: sources.domain,
        title: sources.title,
        claim: articleSources.claim,
      })
      .from(articleSources)
      .innerJoin(sources, eq(articleSources.sourceId, sources.id))
      .where(eq(articleSources.articleId, articleId));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) return {};
  return {
    title: a.titleAr,
    description: a.excerptAr ?? undefined,
    alternates: { canonical: `/news/${a.slug}` },
    openGraph: {
      title: a.titleAr,
      description: a.excerptAr ?? undefined,
      locale: "ar_AR",
      type: "article",
    },
  };
}

export default async function ArticlePage({ params }: Params) {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) notFound();

  const srcs = await getSources(a.id);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <article>
        <header className="mb-8">
          <p className="font-mono text-xs text-signal mb-3" dir="ltr">
            {"// "}{a.type}{" · "}{a.publishedAt?.toISOString().slice(0, 10)}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold leading-snug">
            {a.titleAr}
          </h1>
          {a.excerptAr && (
            <p className="text-lg text-paper-dim mt-4 leading-relaxed">
              {a.excerptAr}
            </p>
          )}
        </header>

        <div
          className="prose-ar leading-loose"
          dangerouslySetInnerHTML={{ __html: a.bodyHtml ?? "" }}
        />

        {srcs.length > 0 && (
          <section className="mt-12 border-t border-ink-line pt-6">
            <h2 className="font-mono text-xs text-signal mb-4">المصادر</h2>
            <ul className="space-y-3 text-sm">
              {srcs.map((s, i) => (
                <li key={i} className="flex flex-col gap-1">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-signal hover:underline font-medium"
                    dir="ltr"
                  >
                    {s.title ?? s.domain} ↗
                  </a>
                  <p className="text-paper-dim text-xs">{s.claim}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "NewsArticle",
              headline: a.titleAr,
              description: a.excerptAr ?? undefined,
              datePublished: a.publishedAt?.toISOString(),
              inLanguage: "ar",
            }),
          }}
        />
      </article>
    </main>
  );
}
