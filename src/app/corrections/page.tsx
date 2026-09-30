import { db, corrections, articles } from "@/db";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 3600;
export const metadata: Metadata = { title: "سياسة التصحيحات" };

export default async function CorrectionsPage() {
  let list: { id: string; whatChanged: string; note: string | null; createdAt: Date; slug: string | null; title: string | null }[] = [];
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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold mb-4">سياسة التصحيحات</h1>
      <p className="text-paper-dim leading-relaxed mb-6">
        الشفافية جزء من هوية هذا الموقع. عند اكتشاف خطأ في مقال منشور:
      </p>
      <ul className="text-paper-dim space-y-2 list-disc list-inside mb-10">
        <li>يُصحَّح الخطأ داخل المقال مع إشارة واضحة.</li>
        <li>يُوثَّق التصحيح هنا علنًا.</li>
        <li>لا تُحذف المقالات الخاطئة — تُصحَّح وتُعلَّم.</li>
      </ul>
      <h2 className="font-bold text-xl mb-4">سجل التصحيحات</h2>
      {list.length === 0 ? (
        <p className="text-paper-dim text-sm">لا تصحيحات مسجلة حتى الآن.</p>
      ) : (
        <ul className="space-y-4 text-sm">
          {list.map((c) => (
            <li key={c.id} className="border-r-2 border-warn pr-4">
              <a href={`/news/${c.slug}`} className="text-signal hover:underline font-medium">
                {c.title}
              </a>
              <p className="text-paper-dim mt-1">{c.whatChanged}</p>
              {c.note && <p className="text-xs text-paper-dim mt-1">{c.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
