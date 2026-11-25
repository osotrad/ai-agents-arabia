import {
  db,
  glossaryTerms,
  sources,
  articles,
  articleSources,
  corrections,
} from "@/db";
import { and, eq, asc, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Container, MetaRow } from "@/components/ui";
import { formatDate, isoDate } from "@/lib/format";
import { canonicalUrl, siteName } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

type Params = { params: Promise<{ slug: string }> };

async function getTerm(slug: string) {
  try {
    const [term] = await db
      .select()
      .from(glossaryTerms)
      .where(and(eq(glossaryTerms.slug, slug), eq(glossaryTerms.published, true)))
      .limit(1);
    return term ?? null;
  } catch {
    return null;
  }
}

/**
 * Optional long-form guide for a term: a published article of type
 * "glossary" that shares the term's slug. Terms without one render exactly
 * as before (definition box only).
 */
async function getGuide(slug: string) {
  try {
    const [a] = await db
      .select()
      .from(articles)
      .where(
        and(
          eq(articles.slug, slug),
          eq(articles.type, "glossary"),
          eq(articles.status, "published"),
        ),
      )
      .limit(1);
    return a ?? null;
  } catch {
    return null;
  }
}

async function getGuideSources(articleId: string) {
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
      .where(eq(articleSources.articleId, articleId))
      .orderBy(articleSources.claim);
  } catch {
    return [];
  }
}

async function getGuideCorrections(articleId: string) {
  try {
    return await db
      .select({
        id: corrections.id,
        whatChanged: corrections.whatChanged,
        createdAt: corrections.createdAt,
      })
      .from(corrections)
      .where(eq(corrections.articleId, articleId))
      .orderBy(desc(corrections.createdAt));
  } catch {
    return [];
  }
}

async function getSourceUrl(sourceId: string | null) {
  if (!sourceId) return null;
  try {
    const [s] = await db
      .select({ url: sources.url, domain: sources.domain })
      .from(sources)
      .where(eq(sources.id, sourceId))
      .limit(1);
    return s ?? null;
  } catch {
    return null;
  }
}

/** Sibling terms for on-page navigation. */
async function getAllPublished() {
  try {
    return await db
      .select({
        slug: glossaryTerms.slug,
        termAr: glossaryTerms.termAr,
        termEn: glossaryTerms.termEn,
      })
      .from(glossaryTerms)
      .where(eq(glossaryTerms.published, true))
      .orderBy(asc(glossaryTerms.termAr))
      .limit(60);
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const term = await getTerm(slug);
  if (!term) return {};

  const guide = await getGuide(slug);
  if (!guide) {
    return {
      title: term.termAr,
      description: term.definitionAr.slice(0, 160),
      alternates: { canonical: `/glossary/${term.slug}` },
    };
  }

  // Same precedence as the article page: SERP-sized SEO fields first, then
  // the on-page copy.
  const metaTitle = guide.metaTitle?.trim() || null;
  const description =
    guide.metaDescription?.trim() ||
    guide.excerptAr?.trim() ||
    term.definitionAr.slice(0, 160);
  return {
    title: metaTitle ? { absolute: metaTitle } : guide.titleAr,
    description,
    alternates: { canonical: `/glossary/${term.slug}` },
    openGraph: {
      title: guide.ogTitle?.trim() || metaTitle || guide.titleAr,
      description: guide.ogDescription?.trim() || description,
      locale: "ar_AR",
      type: "article",
      publishedTime: guide.publishedAt?.toISOString(),
      modifiedTime: guide.updatedAt?.toISOString(),
      ...(guide.imageUrl
        ? { images: [{ url: guide.imageUrl, alt: guide.imageAlt ?? "" }] }
        : {}),
    },
    twitter: {
      card: guide.imageUrl ? "summary_large_image" : "summary",
      ...(guide.imageUrl ? { images: [guide.imageUrl] } : {}),
    },
  };
}

export default async function GlossaryTermPage({ params }: Params) {
  const { slug } = await params;
  const term = await getTerm(slug);
  if (!term) notFound();

  const guide = await getGuide(slug);
  const [source, all, guideSources, guideFixes] = await Promise.all([
    getSourceUrl(term.sourceId),
    getAllPublished(),
    guide ? getGuideSources(guide.id) : Promise.resolve([]),
    guide ? getGuideCorrections(guide.id) : Promise.resolve([]),
  ]);
  const others = all.filter((t) => t.slug !== term.slug).slice(0, 12);

  const origin = canonicalUrl().replace(/\/+$/, "");
  const termUrl = `${origin}/glossary/${term.slug}`;
  const domains = [...new Set(guideSources.map((s) => s.domain))];

  const definedTerm = {
    "@type": "DefinedTerm",
    "@id": `${termUrl}#term`,
    name: term.termAr,
    alternateName: term.termEn,
    description: term.definitionAr,
    inLanguage: "ar",
    url: termUrl,
    ...(source ? { sameAs: source.url } : {}),
  };

  const jsonLd = guide
    ? {
        "@context": "https://schema.org",
        "@graph": [
          definedTerm,
          {
            "@type": "Article",
            headline: guide.titleAr,
            description:
              guide.metaDescription?.trim() || guide.excerptAr || undefined,
            url: termUrl,
            mainEntityOfPage: { "@type": "WebPage", "@id": termUrl },
            about: { "@id": `${termUrl}#term` },
            datePublished: guide.publishedAt?.toISOString(),
            dateModified: guide.updatedAt?.toISOString(),
            inLanguage: "ar",
            image: guide.imageUrl ? [guide.imageUrl] : undefined,
            keywords: guide.seoKeywords?.length
              ? guide.seoKeywords.join(", ")
              : undefined,
            author: { "@type": "Organization", name: siteName() },
            publisher: {
              "@type": "Organization",
              name: siteName(),
              url: origin,
            },
            citation: [...new Set(guideSources.map((s) => s.url))],
          },
        ],
      }
    : { "@context": "https://schema.org", ...definedTerm };

  return (
    <main>
      <Container width="reading" className="pt-10 pb-16">
        <nav className="font-mono text-xs text-paper-dim mb-8">
          <Link href="/glossary" className="hover:text-signal transition-colors">
            المعجم
          </Link>
          <span className="mx-2">/</span>
          <span dir="ltr">{term.slug}</span>
        </nav>

        <article>
          <p className="font-mono text-xs text-signal" dir="ltr">
            {"// glossary term"}
          </p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold leading-tight">
            {guide ? guide.titleAr : term.termAr}
          </h1>
          <p className="mt-3 font-mono text-sm text-paper-dim" dir="ltr">
            {term.termEn}
          </p>

          <div className="mt-8 border-s-2 border-signal bg-ink-raise/50 p-6">
            {guide && (
              <p className="font-mono text-[11px] text-signal mb-2">
                {term.termAr}
              </p>
            )}
            <p className="text-lg leading-loose">{term.definitionAr}</p>
          </div>

          <MetaRow
            className="mt-6"
            items={[
              <span key="slug" dir="ltr">
                slug: {term.slug}
              </span>,
              ...(guide
                ? [
                    <span key="pub">
                      نُشر {formatDate(guide.publishedAt)}
                    </span>,
                    <span key="src-count">
                      {domains.length} {domains.length === 1 ? "مصدر" : "مصادر"}
                    </span>,
                  ]
                : []),
              ...(source
                ? [
                    <a
                      key="src"
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-signal hover:underline"
                      dir="ltr"
                    >
                      source: {source.domain} ↗
                    </a>,
                  ]
                : []),
            ]}
          />

          {guide && (
            <>
              {guide.imageUrl && (
                <figure className="mt-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={guide.imageUrl}
                    alt={guide.imageAlt ?? guide.titleAr}
                    loading="eager"
                    decoding="async"
                    className="w-full aspect-[16/9] max-h-80 object-cover border border-ink-line bg-ink-raise"
                  />
                </figure>
              )}

              <div
                className="mt-10 prose-ar text-[1.05rem] leading-loose"
                dangerouslySetInnerHTML={{ __html: guide.bodyHtml ?? "" }}
              />

              {guideFixes.length > 0 && (
                <section className="mt-12 border border-warn/40 bg-warn/5 p-6">
                  <h2 className="font-bold text-warn mb-3">تصحيحات على هذا الدليل</h2>
                  <ul className="space-y-3 text-sm">
                    {guideFixes.map((f) => (
                      <li key={f.id} className="border-r-2 border-warn pr-3">
                        <p className="text-paper leading-relaxed">{f.whatChanged}</p>
                        <p
                          className="mt-1 font-mono text-[11px] text-paper-dim"
                          dir="ltr"
                        >
                          {isoDate(f.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {guideSources.length > 0 && (
                <section className="mt-14 border-t border-ink-line pt-8">
                  <h2 className="font-mono text-xs text-signal mb-1">المصادر</h2>
                  <p className="text-xs text-paper-dim mb-6">
                    كل ادعاء في الدليل مرتبط بمصدره. الروابط تفتح في نافذة جديدة.
                  </p>
                  <ol className="space-y-5">
                    {guideSources.map((s, i) => (
                      <li key={`${s.url}-${i}`} className="flex gap-4">
                        <span
                          className="font-mono text-xs text-paper-dim pt-1 shrink-0"
                          dir="ltr"
                        >
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
                          <p
                            className="font-mono text-[11px] text-paper-dim mt-0.5"
                            dir="ltr"
                          >
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
                  {`// version ${guide.version} · updated ${isoDate(guide.updatedAt)}`}
                </p>
                <div className="flex gap-4 text-xs">
                  <Link
                    href="/corrections"
                    className="text-paper-dim hover:text-signal transition-colors"
                  >
                    أبلغ عن خطأ
                  </Link>
                  <Link
                    href="/standards"
                    className="text-paper-dim hover:text-signal transition-colors"
                  >
                    معايير النشر
                  </Link>
                </div>
              </footer>
            </>
          )}
        </article>

        {others.length > 0 && (
          <section className="mt-16">
            <div className="flex items-baseline justify-between border-b border-ink-line pb-3 mb-5">
              <h2 className="font-display text-lg font-bold">مصطلحات أخرى</h2>
              <Link href="/glossary" className="font-mono text-xs text-signal hover:underline">
                المعجم كاملًا ←
              </Link>
            </div>
            <ul className="grid gap-px bg-ink-line border border-ink-line sm:grid-cols-2">
              {others.map((t) => (
                <li key={t.slug} className="bg-ink p-4">
                  <Link
                    href={`/glossary/${t.slug}`}
                    className="font-medium hover:text-signal transition-colors"
                  >
                    {t.termAr}
                  </Link>
                  <span className="block font-mono text-[11px] text-paper-dim mt-0.5" dir="ltr">
                    {t.termEn}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Container>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}
