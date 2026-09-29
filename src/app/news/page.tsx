import { db, articles } from "@/db";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 300;

export const metadata: Metadata = { title: "الأخبار" };

export default async function NewsPage() {
  const list = await db
    .select()
    .from(articles)
    .where(eq(articles.status, "published"))
    .orderBy(desc(articles.publishedAt))
    .limit(30);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold mb-8">الأخبار</h1>
      {list.length === 0 ? (
        <p className="text-paper-dim">
          لا مقالات منشورة بعد — الوكيل يعمل على أول دفعة.
        </p>
      ) : (
        <ul className="divide-y divide-ink-line border-y border-ink-line">
          {list.map((a) => (
            <li key={a.id}>
              <Link
                href={`/news/${a.slug}`}
                className="group block py-5 hover:bg-ink-raise -mx-4 px-4 transition-colors"
              >
                <h2 className="text-lg font-semibold group-hover:text-signal transition-colors">
                  {a.titleAr}
                </h2>
                {a.excerptAr && (
                  <p className="text-sm text-paper-dim mt-1 line-clamp-2">
                    {a.excerptAr}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
