import { db, articles } from "@/db";
import { and, count, desc, eq, isNotNull, max } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Container, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export const metadata: Metadata = {
  title: "السلاسل",
  description:
    "كل سلسلة مقالات مرتّبة ترتيب قراءة، من السؤال الأول حتى بناء شيء يعمل.",
};

/** Mirror of the registry in topics/[topic]/page.tsx — titles and ledes. */
const META: Record<string, { title: string; lede: string }> = {
  langchain: {
    title: "لانغ تشين ولانغ غراف",
    lede: "من السؤال الأول — ما هو الوكيل؟ — إلى وكيل حقيقي تحفظ حالته، وتطلب موافقة بشرية قبل أي إجراء حسّاس.",
  },
  n8n: {
    title: "n8n — أتمتة سير العمل",
    lede: "من السؤال الأول — ما هو n8n ولماذا يختلف عن كتابة الكود؟ — إلى أتمتة تعمل في الإنتاج، بسرعات متدرّجة لا تفترض خبرة برمجية.",
  },
  "open-weight-models": {
    title: "النماذج مفتوحة الأوزان",
    lede: "إصدارات النماذج مفتوحة الأوزان: الأرقام التي تعلنها، وما يُتاح فعلياً من معاملات وتنزيل.",
  },
};

/**
 * Index of editorial series.
 *
 * Counts come from the database, not from the registry above, so a series that
 * exists in content but has not been given a lede yet still appears here. The
 * registry supplies presentation copy only.
 */
type Row = { topic: string; n: number; last: Date | null };

export default async function TopicsIndexPage() {
  type RawRow = { topic: string | null; n: number; last: Date | null };
  let rows: RawRow[] = [];
  try {
    rows = await db
      .select({
        topic: articles.topic,
        n: count(),
        last: max(articles.publishedAt),
      })
      .from(articles)
      .where(
        and(eq(articles.status, "published"), isNotNull(articles.topic)),
      )
      .groupBy(articles.topic)
      .orderBy(desc(max(articles.publishedAt)));
  } catch {
    // The index is a navigation surface: degrade to "no series yet" rather
    // than a 500, because a dead nav entry costs more than an empty list.
    rows = [];
  }

  // The WHERE clause guarantees topic IS NOT NULL, but the column's type does
  // not, so narrow it rather than asserting.
  const list = rows.filter((r): r is Row => typeof r.topic === "string");

  return (
    <main>
      <PageHeader
        eyebrow="السلاسل"
        title="سلسلة مقالات"
        lede="كل سلسلة مرتّبة ترتيب قراءة: كل مقال يبني على سابقه ويخبرك بماذا ستبني بعده. ابدأ من المُدخل ثم تابع."
      />

      <Container className="pb-20">
        {list.length === 0 ? (
          <EmptyState
            title="لا توجد سلاسل منشورة بعد"
            body="ستظهر هنا أولما تُنشر سلسلة من أكثر من مقال."
            href="/news"
            linkLabel="كل الأخبار"
          />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2">
            {list.map((t) => {
              const meta = META[t.topic];
              return (
                <li key={t.topic}>
                  <Link
                    href={`/topics/${t.topic}`}
                    className="group flex h-full flex-col border border-ink-line bg-ink-raise/60 p-6 transition-colors hover:border-signal/50"
                  >
                    <span className="font-mono text-xs text-signal" dir="ltr">
                      /topics/{t.topic}
                    </span>
                    <h2 className="mt-3 text-lg font-bold leading-snug group-hover:text-signal">
                      {meta?.title ?? t.topic}
                    </h2>
                    {meta?.lede ? (
                      <p className="mt-2 text-sm leading-relaxed text-paper-dim">
                        {meta.lede}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm leading-relaxed text-paper-dim">
                        سلسلة نُشرت {t.n} مقالات.
                      </p>
                    )}
                    <span className="mt-auto pt-5 font-mono text-xs text-paper-dim">
                      {t.n} مقال
                      {t.last ? ` · آخر تحديث ${t.last.toISOString().slice(0, 10)}` : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Container>
    </main>
  );
}