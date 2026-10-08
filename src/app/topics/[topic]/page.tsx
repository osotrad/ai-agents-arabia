import { db, articles } from "@/db";
import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ArticleCard,
  Container,
  EmptyState,
  PageHeader,
  type ArticleSummary,
} from "@/components/ui";

export const dynamic = "force-dynamic";
export const revalidate = 300;

/**
 * Editorial series. Content lives in `articles.topic`; the hub is pure
 * presentation over a query, so adding a series never needs a route change.
 */
const TOPICS: Record<
  string,
  { eyebrow: string; title: string; lede: string }
> = {
  langchain: {
    eyebrow: "سلسلة",
    title: "لانغ تشين ولانغ غراف",
    lede: "ثمانية مقالات تأخذك من السؤال الأول — ما هو الوكيل؟ — إلى وكيل حقيقي تحفظ حالته، وتطلب موافقة بشرية قبل أي إجراء حسّاس. كل مقال يبني على سابقه، وكل مقال يخبرك بماذا ستبني بعده.",
  },
  "open-weight-models": {
    eyebrow: "سلسلة",
    title: "النماذج مفتوحة الأوزان",
    lede: "إصدارات النماذج مفتوحة الأوزان: الأرقام التي تعلنها، وما يُتاح فعلياً من معاملات وتنزيل.",
  },
  n8n: {
    eyebrow: "سلسلة",
    title: "n8n — أتمتة سير العمل",
    lede: "تسعة مقالات تأخذك من السؤال الأول — ما هو n8n ولماذا يختلف عن كتابة الكود؟ — إلى أتمتة تعمل في الإنتاج: تتعامل مع البيانات، وتعيد المحاولة عند الفشل، وتحفظ أسرارها بشكل صحيح. المقالات الأولى لا تفترض أي خبرة برمجية، ثم تتعمّق حتى تصل إلى التعبيرات والنشر على خادم خاص.",
  },
};

export function generateStaticParams() {
  return Object.keys(TOPICS).map((topic) => ({ topic }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string }>;
}): Promise<Metadata> {
  const { topic } = await params;
  const t = TOPICS[topic];
  if (!t) return { title: "سلسلة غير موجودة" };
  return { title: t.title, description: t.lede };
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;
  // Do NOT 404 on an unregistered topic: `articles.topic` is the source of
  // truth, and a series can hold articles before anyone has written a lede
  // for it. A dead link costs more than an untitled page.
  const t = TOPICS[topic] ?? {
    eyebrow: "سلسلة",
    title: topic,
    lede: "",
  };

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
      <PageHeader eyebrow={t.eyebrow} title={t.title} lede={t.lede}>
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
