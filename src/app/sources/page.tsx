import { db, articleSources, articles } from "@/db";
import { eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Container, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "المصادر الموثّقة",
  description:
    "كل نطاق استُشهد به في مادة منشورة على وكلاء، وعدد المواد التي استندت إليه.",
};

/**
 * The published source ledger. One row per cited source with the number of
 * published articles that rely on it — the site's core trust claim, auditable
 * from the outside.
 */
export default async function SourcesPage() {
  type Row = {
    url: string;
    domain: string;
    title: string | null;
    citations: number;
  };

  let list: Row[] = [];
  let totalSources = 0;
  let totalCitations = 0;

  try {
    const res = await db.execute(sql`
      SELECT s.url, s.domain, s.title,
             count(*)::int AS citations
      FROM sources s
      JOIN article_sources as_link ON as_link.source_id = s.id
      JOIN articles a ON a.id = as_link.article_id
      WHERE a.status = 'published'
      GROUP BY s.id, s.url, s.domain, s.title
      ORDER BY count(*) DESC, s.domain ASC
      LIMIT 500
    `);
    list = (res.rows ?? []) as Row[];

    const [totals] = await db
      .select({
        sources: sql<number>`count(DISTINCT ${articleSources.sourceId})::int`,
        citations: sql<number>`count(${articleSources.articleId})::int`,
      })
      .from(articleSources)
      .innerJoin(articles, eq(articleSources.articleId, articles.id))
      .where(eq(articles.status, "published"));

    totalSources = Number(totals?.sources ?? 0);
    totalCitations = Number(totals?.citations ?? 0);
  } catch {
    // DB not configured yet
  }

  return (
    <main>
      <PageHeader
        eyebrow="sources"
        title="المصادر الموثّقة"
        lede="لا يُنشر في هذا الموقع خبر بلا مصدرَين على الأقل. هذه صفحة تفتح سجل المصادر: كل نطاق استُشهد به، وعدد المواد المنشورة التي تستند إليه."
      />

      <Container className="pb-16">
        {list.length === 0 ? (
          <EmptyState
            title="لا مصادر مسجّلة بعد"
            body="السجل يمتلئ مع أول مادة تُنشر — كل مصدر يُحفظ برابطه ونطاقه ومقتطفه."
            href="/news"
            linkLabel="الأخبار"
          />
        ) : (
          <>
            <div className="grid gap-px bg-ink-line border border-ink-line mb-10 sm:grid-cols-3">
              <div className="bg-ink p-5">
                <p className="font-display text-2xl font-bold text-signal tabular-nums">
                  {totalSources}
                </p>
                <p className="mt-1 text-sm">نطاق موثّق</p>
              </div>
              <div className="bg-ink p-5">
                <p className="font-display text-2xl font-bold text-signal tabular-nums">
                  {totalCitations}
                </p>
                <p className="mt-1 text-sm">إسناد بين مصدر ومادة</p>
              </div>
              <div className="bg-ink p-5">
                <p className="font-display text-2xl font-bold text-signal tabular-nums">
                  {list.length ? (totalCitations / totalSources).toFixed(2) : "—"}
                </p>
                <p className="mt-1 text-sm">متوسط الإسناد لكل مصدر</p>
              </div>
            </div>

            <ul className="divide-y divide-ink-line border-y border-ink-line">
              {list.map((s) => (
                <li
                  key={s.url}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div className="min-w-0">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-signal hover:underline break-words"
                    >
                      {s.title ?? s.domain} ↗
                    </a>
                    <p className="font-mono text-[11px] text-paper-dim mt-0.5" dir="ltr">
                      {s.domain}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-paper-dim shrink-0" dir="ltr">
                    {s.citations} citation(s)
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-8 text-sm text-paper-dim leading-relaxed">
              المصدر يُحفظ برابطه ومقتطفه الأصلي، ويُربط بكل ادعاء يدعمه داخل المقال.
              التصحيح موثّق في{" "}
              <Link href="/corrections" className="text-signal hover:underline">
                سجل التصحيحات
              </Link>
              .
            </p>
          </>
        )}
      </Container>
    </main>
  );
}