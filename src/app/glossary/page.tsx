import { db, glossaryTerms } from "@/db";
import { asc } from "drizzle-orm";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export const metadata: Metadata = { title: "المصطلحات" };

export default async function GlossaryPage() {
  const terms = await db
    .select()
    .from(glossaryTerms)
    .orderBy(asc(glossaryTerms.termAr))
    .limit(200);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold mb-8">المصطلحات</h1>
      {terms.length === 0 ? (
        <p className="text-paper-dim">لا مصطلحات منشورة بعد.</p>
      ) : (
        <dl className="grid gap-6 md:grid-cols-2">
          {terms.map((t) => (
            <div
              key={t.id}
              className="border border-ink-line rounded-lg p-5 bg-ink-raise"
            >
              <dt className="flex items-baseline justify-between gap-3 mb-2">
                <span className="font-bold">{t.termAr}</span>
                <span className="font-mono text-xs text-paper-dim" dir="ltr">
                  {t.termEn}
                </span>
              </dt>
              <dd className="text-sm text-paper-dim leading-relaxed">
                {t.definitionAr}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </main>
  );
}
