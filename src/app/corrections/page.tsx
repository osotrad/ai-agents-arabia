import { db, corrections, articles } from "@/db";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Container, EmptyState, PageHeader } from "@/components/ui";
import { formatDate, isoDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "سياسة التصحيحات",
  description:
    "سياسة التصحيح: يُصحَّح الخطأ داخل المقال، ويُوثَّق علنًا بتاريخه، ولا تُحذف المواد.",
};

const POLICY = [
  {
    n: "01",
    t: "يُصحَّح الخطأ في مكانه",
    d: "لا يُخفى الخطأ ولا يُعاد النشر دون أثر؛ يُعدَّل نص المقال نفسه مع إشارة واضحة على ما تغيّر.",
  },
  {
    n: "02",
    t: "يُوثَّق علنًا",
    d: "كل تصحيح يظهر هنا وفي نهاية المقال الذي يخصّه، بتاريخه وما تغيّر بالضبط.",
  },
  {
    n: "03",
    t: "لا حذف",
    d: "المادة الخاطئة لا تُحذف. تبقى في مكانها مصحّحة، لأن سجلّ الأخطاء جزء من مصداقية الموقع.",
  },
  {
    n: "04",
    t: "التاريخ محفوظ",
    d: "كل تعديل على النص يولّد نسخة سابقة محفوظة، فيمكن الرجوع إلى ما كُتب قبل التصحيح.",
  },
];

export default async function CorrectionsPage() {
  type Row = {
    id: string;
    whatChanged: string;
    note: string | null;
    createdAt: Date;
    slug: string | null;
    title: string | null;
  };

  let list: Row[] = [];
  try {
    list = await db
      .select({
        id: corrections.id,
        whatChanged: corrections.whatChanged,
        note: corrections.publishedNote,
        createdAt: corrections.createdAt,
        slug: articles.slug,
        title: articles.titleAr,
      })
      .from(corrections)
      .leftJoin(articles, eq(corrections.articleId, articles.id))
      .orderBy(desc(corrections.createdAt))
      .limit(50);
  } catch {
    // DB not configured yet
  }

  return (
    <main>
      <PageHeader
        eyebrow="corrections"
        title="سياسة التصحيحات"
        lede="الشفافية جزء من هوية هذا الموقع. هذا ما يحدث بالضبط عندما يخطئ:"
      />

      <Container width="narrow" className="pb-16">
        <ol className="space-y-6 border-b border-ink-line pb-10">
          {POLICY.map((p) => (
            <li key={p.n} className="flex gap-5">
              <span className="font-mono text-xs text-signal pt-1.5 shrink-0" dir="ltr">
                {p.n}
              </span>
              <div>
                <h2 className="font-bold">{p.t}</h2>
                <p className="mt-1 text-sm text-paper-dim leading-relaxed">
                  {p.d}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10">
          <h2 className="font-display text-xl font-bold mb-2">سجل التصحيحات</h2>
          <p className="text-sm text-paper-dim mb-8">
            الأحدث أولًا. كل تصحيح مرتبط بمقاله ومؤرَّخ.
          </p>

          {list.length === 0 ? (
            <EmptyState
              title="لا تصحيحات مسجّلة"
              body="هذا سجلّ فارغ — أي ما فيه يعني أن المادة المنشورة سليمة حتى الآن."
              href="/standards"
              linkLabel="معايير النشر"
            />
          ) : (
            <ul className="space-y-6">
              {list.map((c) => (
                <li key={c.id} className="border-r-2 border-warn pr-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    {c.slug ? (
                      <Link
                        href={`/news/${c.slug}`}
                        className="font-medium text-signal hover:underline"
                      >
                        {c.title ?? c.slug}
                      </Link>
                    ) : (
                      <span className="font-medium text-paper-dim">
                        {c.title ?? "مادة محذوفة"}
                      </span>
                    )}
                    <span className="font-mono text-[11px] text-paper-dim" dir="ltr">
                      {isoDate(c.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 leading-relaxed">{c.whatChanged}</p>
                  {c.note && (
                    <p className="mt-2 text-sm text-paper-dim border-t border-ink-line pt-2">
                      {c.note}
                    </p>
                  )}
                  <p className="mt-2 font-mono text-[11px] text-paper-dim/70" dir="ltr">
                    logged {formatDate(c.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </main>
  );
}