import { db, articles } from "@/db";
import { desc, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArticleThumbnail,
  Container,
  EmptyState,
  PageHeader,
  type ArticleSummary,
} from "@/components/ui";
import { ARTICLE_TYPES, TYPE_LABELS_PLURAL } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export const metadata: Metadata = {
  title: "البحث",
  description: "ابحث في عناوين المواد المنشورة ومقتطفاتها.",
  robots: { index: false, follow: true },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { q, type } = await searchParams;
  const query = (q ?? "").trim();
  const active = ARTICLE_TYPES.includes(type as never) ? type : undefined;

  let results: ArticleSummary[] = [];
  if (query) {
    try {
      const pattern = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      results = (await db
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
          sql`status = 'published'
              AND (title_ar ILIKE ${pattern} OR excerpt_ar ILIKE ${pattern})
              ${active ? sql`AND type = ${active}::article_type` : sql``}`,
        )
        .orderBy(desc(articles.publishedAt))
        .limit(40)) as ArticleSummary[];
    } catch {
      // DB not configured yet — show the empty form
    }
  }

  return (
    <main>
      <PageHeader
        eyebrow="search"
        title="البحث في الموقع"
        lede="يشمل البحث العناوين والمقتطفات. ابدأ من الأعلى، أو تصفّح قسم الأخبار كاملًا."
      />

      <Container width="narrow" className="pb-16">
        <form action="/search" className="flex flex-wrap gap-3">
          <label htmlFor="q" className="sr-only">
            كلمة البحث
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="اكتب كلمة أو اسم منتج…"
            className="flex-1 min-w-56 border border-ink-line bg-ink-raise px-4 py-3 text-sm placeholder:text-paper-dim focus:border-signal focus:outline-none transition-colors"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-signal text-ink text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            ابحث
          </button>
        </form>

        {active && (
          <p className="mt-4 font-mono text-xs text-paper-dim" dir="ltr">
            filter: type = {active}
          </p>
        )}

        {!query ? (
          <div className="mt-10">
            <p className="font-mono text-xs text-signal mb-4">اقتراحات</p>
            <div className="flex flex-wrap gap-2">
              {ARTICLE_TYPES.map((t) => (
                <Link
                  key={t}
                  href={`/news?type=${t}`}
                  className="px-3 py-1.5 border border-ink-line text-xs text-paper-dim hover:border-signal hover:text-signal transition-colors"
                >
                  {TYPE_LABELS_PLURAL[t]}
                </Link>
              ))}
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              title={`لا نتائج لـ «${query}»`}
              body="جرّب كلمة أقصر، أو تصفّح الأخبار مباشرة."
              href="/news"
              linkLabel="كل الأخبار"
            />
          </div>
        ) : (
          <div className="mt-10">
            <p className="font-mono text-xs text-paper-dim mb-6" dir="ltr">
              {`${results.length} result(s) for "${query}"`}
            </p>
            <ul className="divide-y divide-ink-line border-y border-ink-line">
              {results.map((r) => (
                <li key={r.id} className="py-5">
                  <Link href={`/news/${r.slug}`} className="group flex gap-5">
                    <ArticleThumbnail article={r} />
                    <div className="min-w-0">
                      <span className="font-semibold group-hover:text-signal transition-colors">
                        {r.titleAr}
                      </span>
                      {r.excerptAr && (
                        <p className="mt-1.5 text-sm text-paper-dim line-clamp-2">
                          {r.excerptAr}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Container>
    </main>
  );
}