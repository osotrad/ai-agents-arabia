import { db, articles } from "@/db";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "مراجعة المقالات",
  robots: { index: false, follow: false },
};

export default async function AdminReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  const authorized = process.env.ADMIN_API_KEY && key === process.env.ADMIN_API_KEY;

  if (!authorized) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-2xl font-bold mb-4">غير مصرّح</h1>
        <p className="text-paper-dim">هذه الصفحة تتطلب مفتاح المدير.</p>
      </main>
    );
  }

  const queue = await db
    .select()
    .from(articles)
    .where(eq(articles.status, "pending_review"))
    .orderBy(desc(articles.createdAt))
    .limit(50);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold mb-8">قائمة المراجعة ({queue.length})</h1>
      {queue.length === 0 ? (
        <p className="text-paper-dim">لا مسودات بانتظار المراجعة.</p>
      ) : (
        <ul className="space-y-6">
          {queue.map((a) => (
            <li key={a.id} className="border border-ink-line bg-ink-raise rounded-lg p-6">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h2 className="font-bold text-lg">{a.titleAr}</h2>
                <span className="font-mono text-xs text-paper-dim shrink-0" dir="ltr">
                  conf: {a.confidenceScore?.toFixed(2) ?? "—"}
                </span>
              </div>
              {a.excerptAr && <p className="text-paper-dim text-sm mb-3">{a.excerptAr}</p>}
              <details className="text-sm">
                <summary className="cursor-pointer text-signal">عرض النص الكامل</summary>
                <pre className="whitespace-pre-wrap font-sans text-paper-dim mt-3 leading-loose border-t border-ink-line pt-3">
                  {a.bodyMd}
                </pre>
              </details>
              <ReviewActions articleId={a.id} adminKey={key!} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function ReviewActions({ articleId, adminKey }: { articleId: string; adminKey: string }) {
  return (
    <form className="flex gap-3 mt-4 pt-4 border-t border-ink-line" method="post" action="/api/admin/review-form">
      <input type="hidden" name="articleId" value={articleId} />
      <input type="hidden" name="key" value={adminKey} />
      <button
        name="action"
        value="approve"
        className="px-4 py-2 bg-signal text-ink font-semibold rounded hover:opacity-90"
      >
        اعتمد وانشر
      </button>
      <button
        name="action"
        value="reject"
        className="px-4 py-2 border border-ink-line text-paper-dim rounded hover:text-warn hover:border-warn"
      >
        ارفض
      </button>
    </form>
  );
}
