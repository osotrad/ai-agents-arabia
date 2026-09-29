import { db } from "@/db";
import { articles } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 300; // ISR: revalidate every 5 min

export default async function Home() {
  const latest = await db
    .select()
    .from(articles)
    .where(eq(articles.status, "published"))
    .orderBy(desc(articles.publishedAt))
    .limit(6);

  return (
    <main>
      <section className="mx-auto max-w-4xl px-6 pt-24 pb-16">
        <p className="font-mono text-xs text-signal mb-4" dir="ltr">
          {"// يُدار بوكيل ذكاء اصطناعي — بمراجعة بشرية"}
        </p>
        <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-6">
          ذكاء اصطناعي،
          <br />
          <span className="text-paper-dim">بعينٍ عربية.</span>
        </h1>
        <p className="text-lg text-paper-dim max-w-xl leading-relaxed">
          أخبار وشروحات ومصطلحات وكلاء الذكاء الاصطناعي — محتوى أصيل بمصادره،
          تكتبه منظومة وكيل وتُراجَع بشريًا.
        </p>
      </section>

      {latest.length > 0 && (
        <section className="mx-auto max-w-4xl px-6 pb-16">
          <h2 className="font-mono text-xs text-signal mb-6">أحدث المقالات</h2>
          <ul className="divide-y divide-ink-line border-y border-ink-line">
            {latest.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/news/${a.slug}`}
                  className="group block py-5 hover:bg-ink-raise -mx-4 px-4 transition-colors"
                >
                  <h3 className="text-lg font-semibold group-hover:text-signal transition-colors">
                    {a.titleAr}
                  </h3>
                  {a.excerptAr && (
                    <p className="text-sm text-paper-dim mt-1 line-clamp-2">
                      {a.excerptAr}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
