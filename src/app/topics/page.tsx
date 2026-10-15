import { db, articles } from "@/db";
import { and, count, eq, isNotNull } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Container, EmptyState, PageHeader } from "@/components/ui";
import { SERIES } from "@/lib/series";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export const metadata: Metadata = {
  title: "السلاسل",
  description:
    "سلاسل مقالات مرتّبة ترتيب قراءة، من السؤال الأول حتى بناء شيء يعمل.",
};

/**
 * Index of editorial series.
 *
 * Driven by the registry in lib/series.ts, not by `SELECT DISTINCT topic`.
 *
 * That distinction is the whole point. The column holds both curated series
 * slugs and free-text labels an agent attached to a single article — "AI
 * Agents", "أمن وكلاء الذكاء الاصطناعي", and even a whole sentence. Counting
 * distinct column values turned all of those into "series" containing one
 * article, which is not a reading path and reads as broken.
 *
 * Counts still come from the database, so a series drops off the index when
 * its last article is archived rather than lingering with a stale total.
 */
export default async function TopicsIndexPage() {
  const counts = new Map<string, number>();
  try {
    const rows = await db
      .select({ topic: articles.topic, n: count() })
      .from(articles)
      .where(
        and(eq(articles.status, "published"), isNotNull(articles.topic)),
      )
      .groupBy(articles.topic);

    for (const r of rows) {
      if (typeof r.topic === "string") counts.set(r.topic, r.n);
    }
  } catch {
    // A navigation surface should degrade to an empty list, not a 500.
  }

  const live = SERIES.map((s) => ({ ...s, n: counts.get(s.slug) ?? 0 })).filter(
    (s) => s.n >= s.minArticles,
  );

  return (
    <main>
      <PageHeader
        eyebrow="السلاسل"
        title="سلسلة مقالات"
        lede="كل سلسلة مرتّبة ترتيب قراءة: كل مقال يبني على سابقه ويخبرك بماذا ستبني بعده. ابدأ من المُدخل ثم تابع."
      />

      <Container className="pb-20">
        {live.length === 0 ? (
          <EmptyState
            title="لا توجد سلاسل منشورة بعد"
            body="ستظهر هنا أولما تُنشر سلسلة من أكثر من مقال."
            href="/news"
            linkLabel="كل الأخبار"
          />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2">
            {live.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/topics/${s.slug}`}
                  className="group flex h-full flex-col border border-ink-line bg-ink-raise/60 p-6 transition-colors hover:border-signal/50"
                >
                  <span className="font-mono text-xs text-signal" dir="ltr">
                    /topics/{s.slug}
                  </span>
                  <h2 className="mt-3 text-lg font-bold leading-snug group-hover:text-signal">
                    {s.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-paper-dim">
                    {s.lede}
                  </p>
                  <span className="mt-auto pt-5 font-mono text-xs text-paper-dim">
                    {s.n} مقال
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-10 pt-8 border-t border-ink-line text-paper-dim text-sm leading-relaxed">
          هذه الصفحة تعرض <strong>السلاسل</strong> فقط — المقالات التي رتّبناها
          ترتيب قراءة واعتنى عنوانها ووصفها. التصنيفات الموضوعية التي تُوضع على
          خبر واحد لا تظهر هنا.
        </p>
      </Container>
    </main>
  );
}
