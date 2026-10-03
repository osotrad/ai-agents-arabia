import { db, articles, articleSources, sources, corrections } from "@/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArticleThumbnail,
  Container,
  MetaRow,
  TypeBadge,
  type ArticleSummary,
} from "@/components/ui";
import {
  confidenceLabel,
  formatDate,
  isoDate,
  timeAgo,
  typeLabel,
} from "@/lib/format";

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

interface SourceLink {
  url: string;
  domain: string;
  title: string | null;
  claim: string;
}

/** Sources with the claims they support — grouped so each link shows its duty. */
async function getSources(articleId: string): Promise<SourceLink[]> {
  try {
    const rows = await db
      .select({
        url: sources.url,
        domain: sources.domain,
        title: sources.title,
        claim: articleSources.claim,
      })
      .from(articleSources)
      .innerJoin(sources, eq(articleSources.sourceId, sources.id))
      .where(eq(articleSources.articleId, articleId))
      .orderBy(articleSources.claim);
    return rows;
  } catch {
    return [];
  }
}

/** Public corrections attached to this article, oldest last. */
async function getCorrections(articleId: string) {
  try {
    return await db
      .select({
        id: corrections.id,
        whatChanged: corrections.whatChanged,
        note: corrections.publishedNote,
        createdAt: corrections.createdAt,
      })
      .from(corrections)
      .where(eq(corrections.articleId, articleId))
      .orderBy(desc(corrections.createdAt));
  } catch {
    return [];
  }
}

/** More from the same type — related reading without a recommendation model. */
async function getRelated(article: { id: string; type: string }): Promise<
  ArticleSummary[]
> {
  try {
    return (await db
      .select({
        id: articles.id,
        slug: articles.slug,
        titleAr: articles.titleAr,
        excerptAr: articles.excerptAr,
        type: articles.type,
        publishedAt: articles.publishedAt,
        confidenceScore: articles.confidenceScore,
        imageUrl: articles.imageUrl,
        imageAlt: articles.imageAlt,
      })
      .from(articles)
      .where(
        sql`status = 'published' AND type = ${article.type}::article_type AND id <> ${article.id}::uuid`,
      )
      .orderBy(desc(articles.publishedAt))
      .limit(3)) as ArticleSummary[];
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
      publishedTime: a.publishedAt?.toISOString(),
      modifiedTime: a.updatedAt?.toISOString(),
      ...(a.imageUrl ? { images: [{ url: a.imageUrl, alt: a.imageAlt ?? "" }] } : {}),
    },
    twitter: {
      card: a.imageUrl ? "summary_large_image" : "summary",
      ...(a.imageUrl ? { images: [a.imageUrl] } : {}),
    },
  };
}

export default async function ArticlePage({ params }: Params) {
  const { slug } = await params;
  const a = await getArticle(slug);
  if (!a) notFound();

  const [srcs, fixes, related] = await Promise.all([
    getSources(a.id),
    getCorrections(a.id),
    getRelated(a),
  ]);

  // One domain row can back several claims; show each source once.
  const domains = [...new Set(srcs.map((s) => s.domain))];

  return (
    <main>
      <Container width="reading" className="pt-10">
        <nav className="font-mono text-xs text-paper-dim mb-8">
          <Link href="/news" className="hover:text-signal transition-colors">
            الأخبار
          </Link>
          <span className="mx-2">/</span>
          <span>{typeLabel(a.type)}</span>
        </nav>

        <article>
          <header className="mb-10 pb-8 border-b border-ink-line">
            <EyebrowRow type={a.type} publishedAt={a.publishedAt} />
            <h1 className="mt-4 text-3xl sm:text-4xl font-bold leading-tight">
              {a.titleAr}
            </h1>
            {a.excerptAr && (
              <p className="mt-5 text-lg text-paper-dim leading-relaxed">
                {a.excerptAr}
              </p>
            )}
            <MetaRow
              className="mt-6"
              items={[
                <span key="pub">
                  نُشر {formatDate(a.publishedAt)} · {timeAgo(a.publishedAt)}
                </span>,
                <span key="conf">
                  {"confidence "}
                  {confidenceLabel(a.confidenceScore)}
                </span>,
                <span key="ver">
                  {domains.length} {domains.length === 1 ? "مصدر" : "مصادر"}
                </span>,
                ...(a.recheckAfter
                  ? [
                      <span key="recheck">
                        {"recheck "}
                        {isoDate(a.recheckAfter)}
                      </span>,
                    ]
                  : []),
              ]}
            />
          </header>

          {/*
            Header image, rendered by the page component rather than living in
            `bodyMd`, so the markdown sanitizer is never involved. Constrained to
            a 16:9 crop and inset rather than full-bleed, so it reads as a
            thumbnail next to the title. `alt` falls back to the title.
          */}
          {a.imageUrl && (
            <figure className="mt-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.imageUrl}
                alt={a.imageAlt ?? a.titleAr}
                loading="eager"
                decoding="async"
                className="w-full aspect-[16/9] max-h-80 object-cover border border-ink-line bg-ink-raise"
              />
            </figure>
          )}

          <div
            className="prose-ar text-[1.05rem] leading-loose"
            dangerouslySetInnerHTML={{ __html: a.bodyHtml ?? "" }}
          />

          {fixes.length > 0 && (
            <section className="mt-12 border border-warn/40 bg-warn/5 p-6">
              <h2 className="font-bold text-warn mb-3">تصحيحات على هذا المقال</h2>
              <ul className="space-y-3 text-sm">
                {fixes.map((f) => (
                  <li key={f.id} className="border-r-2 border-warn pr-3">
                    <p className="text-paper leading-relaxed">{f.whatChanged}</p>
                    <p className="mt-1 font-mono text-[11px] text-paper-dim" dir="ltr">
                      {isoDate(f.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {srcs.length > 0 && (
            <section className="mt-14 border-t border-ink-line pt-8">
              <h2 className="font-mono text-xs text-signal mb-1">المصادر</h2>
              <p className="text-xs text-paper-dim mb-6">
                كل ادعاء في المقال مرتبط بمصدره. الروابط تفتح في نافذة جديدة.
              </p>
              <ol className="space-y-5">
                {srcs.map((s, i) => (
                  <li key={`${s.url}-${i}`} className="flex gap-4">
                    <span className="font-mono text-xs text-paper-dim pt-1 shrink-0" dir="ltr">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-signal hover:underline font-medium break-words"
                      >
                        {s.title ?? s.domain} ↗
                      </a>
                      <p className="font-mono text-[11px] text-paper-dim mt-0.5" dir="ltr">
                        {s.domain}
                      </p>
                      <p className="text-sm text-paper-dim mt-1.5 leading-relaxed">
                        {s.claim}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <footer className="mt-12 pt-8 border-t border-ink-line flex flex-wrap items-center justify-between gap-4">
            <p className="font-mono text-[11px] text-paper-dim" dir="ltr">
              {`// version ${a.version} · updated ${isoDate(a.updatedAt)}`}
            </p>
            <div className="flex gap-4 text-xs">
              <Link href="/corrections" className="text-paper-dim hover:text-signal transition-colors">
                أبلغ عن خطأ
              </Link>
              <Link href="/standards" className="text-paper-dim hover:text-signal transition-colors">
                معايير النشر
              </Link>
            </div>
          </footer>
        </article>

        {related.length > 0 && (
          <section className="mt-16">
            <div className="flex items-baseline justify-between border-b border-ink-line pb-3 mb-6">
              <h2 className="font-display text-lg font-bold">
                {TYPE_LABELS_PLURAL_SECTION[a.type] ?? "مزيد من المواد"}
              </h2>
              <Link href={`/news?type=${a.type}`} className="font-mono text-xs text-signal hover:underline">
                الكل ←
              </Link>
            </div>
            <ul className="divide-y divide-ink-line border-y border-ink-line">
              {related.map((r) => (
                <li key={r.id} className="py-4">
                  <Link
                    href={`/news/${r.slug}`}
                    className="group flex gap-4"
                  >
                    <ArticleThumbnail article={r} />
                    <div className="min-w-0">
                      <span className="font-medium group-hover:text-signal transition-colors">
                        {r.titleAr}
                      </span>
                      {r.excerptAr && (
                        <p className="mt-1 text-xs text-paper-dim line-clamp-2">
                          {r.excerptAr}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Container>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: a.titleAr,
            description: a.excerptAr ?? undefined,
            datePublished: a.publishedAt?.toISOString(),
            dateModified: a.updatedAt?.toISOString(),
            inLanguage: "ar",
            author: { "@type": "Organization", name: "وكلاء" },
            citation: [...new Set(srcs.map((s) => s.url))],
          }),
        }}
      />
    </main>
  );
}

const TYPE_LABELS_PLURAL_SECTION: Record<string, string> = {
  news: "أخبار أخرى",
  summary: "ملخصات أخرى",
  explainer: "شروح أخرى",
  review: "مراجعات أخرى",
  glossary: "مواد أخرى",
};

function EyebrowRow({
  type,
  publishedAt,
}: {
  type: string;
  publishedAt: Date | null;
}) {
  return (
    <div className="flex items-center gap-3">
      <TypeBadge type={type} />
      <span className="font-mono text-xs text-paper-dim" dir="ltr">
        {type} · {isoDate(publishedAt)}
      </span>
    </div>
  );
}