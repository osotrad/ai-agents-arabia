import { db, articles } from "@/db";
import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArticleCard,
  Container,
  EmptyState,
  PageHeader,
  type ArticleSummary,
} from "@/components/ui";
import { SERIES, isSeries, seriesFor } from "@/lib/series";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export function generateStaticParams() {
  return SERIES.map((s) => ({ topic: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string }>;
}): Promise<Metadata> {
  const { topic } = await params;
  const s = seriesFor(topic);
  if (!s) return { title: "سلسلة غير موجودة" };
  return { title: s.title, description: s.lede };
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;

  /*
   * An unregistered slug is a label an agent put on one article, not a series.
   * Rendering a hub for it produced the empty shells this page used to show:
   * a header with no title and a list of one.
   *
   * Redirect rather than 404. When exactly one article carries the label, that
   * article is what the visitor meant, so send them there. A bare 404 would be
   * a dead end, and these URLs can already be indexed.
   */
  if (!isSeries(topic)) {
    const labelled = await db
      .select({ slug: articles.slug })
      .from(articles)
      .where(and(eq(articles.topic, topic), eq(articles.status, "published")))
      .limit(2);
    redirect(
      labelled.length === 1 ? `/news/${labelled[0].slug}` : "/news",
    );
  }

  const t = seriesFor(topic)!;

  let list: ArticleSummary[] = [];
  try {
    list = await db
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
      .where(and(eq(articles.topic, topic), eq(articles.status, "published")))
      // Reading order is editorial (topicOrder), not chronological: a series
      // must not reshuffle itself when a later part is published out of order.
      .orderBy(asc(articles.topicOrder), asc(articles.publishedAt));
  } catch {
    // A series page must degrade to an empty state, not a 500 — it is a
    // navigation surface, and a dead nav link is worse than an empty list.
    list = [];
  }

  const [first, ...rest] = list;

  return (
    <main>
      <PageHeader eyebrow="سلسلة" title={t.title} lede={t.lede}>
        <p className="mt-4 text-paper-dim text-sm font-mono" dir="ltr">
          {list.length} article{list.length === 1 ? "" : "s"} in this series
        </p>
      </PageHeader>

      <Container className="pb-20">
        {list.length === 0 ? (
          <EmptyState
            title="لا توجد مقالات منشورة في هذه السلسلة بعد"
            body="مقالات السلسلة تُنشر تباعاً. تابع صفحة الأخبار، أو ابدأ بالمقالة الأولى حين تُنشر."
            href="/news"
            linkLabel="كل الأخبار"
          />
        ) : (
          <ol className="space-y-5">
            {first ? (
              <li className="flex gap-4">
                <span className="font-mono text-signal text-xs pt-1 shrink-0 w-8">
                  01
                </span>
                <div className="flex-1">
                  <ArticleCard article={first} featured />
                  <p className="mt-2 text-paper-dim text-xs">
                    ابدأ من هنا — المقالة الأولى في السلسلة.
                  </p>
                </div>
              </li>
            ) : null}

            {rest.map((a, i) => (
              <li key={a.id} className="flex gap-4">
                <span className="font-mono text-paper-dim text-xs pt-1 shrink-0 w-8">
                  {String(i + 2).padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <ArticleCard article={a} />
                </div>
              </li>
            ))}
          </ol>
        )}

        <p className="mt-12 pt-8 border-t border-ink-line text-paper-dim text-sm leading-relaxed">
          هذه السلسلة مكتوبة على{' '}
          <a
            href="https://docs.langchain.com/oss/python/langchain/overview"
            className="text-signal hover:underline"
            target="_blank"
            rel="noopener noreferrer"
            dir="ltr"
          >
            docs.langchain.com ↗
          </a>{' '}
          الأصلية. كل رقم واسم حزمة فيها موثّق بمصدره داخل كل مقال، وكل الأكواد
          منقولة من الوثائق الرسمية. إن اختلفت الوثائق عن مقالنا، فالوثائق هي
          المرجع — وأي خطأ يُصحَّح علنًا في{' '}
          <Link href="/corrections" className="text-signal hover:underline">
            سجل التصحيحات
          </Link>
          .
        </p>
      </Container>
    </main>
  );
}
