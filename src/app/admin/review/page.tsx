import { cookies } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { Container, Eyebrow } from "@/components/ui";
import { ReviewActions } from "@/components/review-actions";
import { db, articles } from "@/db";
import { desc, eq } from "drizzle-orm";
import { ADMIN_SESSION_COOKIE, isAdminKey } from "@/lib/auth";
import { isoDate, typeLabel } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "مراجعة المقالات",
  robots: { index: false, follow: false },
};

const TABS = [
  { status: "pending_review", label: "بانتظار المراجعة" },
  { status: "draft", label: "مسودّات" },
  { status: "needs_recheck", label: "بحاجة تحديث" },
  { status: "published", label: "منشورة" },
  { status: "archived", label: "مرفوضة" },
] as const;

export default async function AdminReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const jar = await cookies();
  // The admin key lives in an HttpOnly cookie set by /api/admin/session — it is
  // never read from, or written to, the URL.
  const authorized = isAdminKey(jar.get(ADMIN_SESSION_COOKIE)?.value);
  const { error } = await searchParams;

  if (!authorized) {
    return (
      <main>
        <Container width="reading" className="py-24">
          <Eyebrow>admin</Eyebrow>
          <h1 className="mt-3 text-2xl font-bold mb-3">قائمة المراجعة</h1>
          <p className="text-paper-dim leading-relaxed mb-8">
            هذه الصفحة تتطلب مفتاح المدير. أدخله هنا فيُحفظ في جلسة قصيرة
            (HttpOnly) — لا يظهر في الرابط ولا في سجل المتصفح.
          </p>

          {error && (
            <p className="mb-6 border-r-2 border-warn pr-3 text-sm text-warn">
              المفتاح غير صحيح، أو انتهت الجلسة. حاول مجددًا.
            </p>
          )}

          <form
            action="/api/admin/session"
            method="post"
            className="flex flex-wrap gap-3 max-w-md"
          >
            <label htmlFor="admin-key" className="sr-only">
              مفتاح المدير
            </label>
            <input
              id="admin-key"
              name="key"
              type="password"
              autoComplete="current-password"
              placeholder="ADMIN_API_KEY"
              dir="ltr"
              className="flex-1 min-w-48 border border-ink-line bg-ink-raise px-4 py-2.5 font-mono text-sm placeholder:text-paper-dim focus:border-signal focus:outline-none transition-colors"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-signal text-ink text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              دخول
            </button>
          </form>

          <p className="mt-6 text-xs text-paper-dim">
            <Link href="/" className="text-signal hover:underline">
              العودة إلى الموقع
            </Link>
          </p>
        </Container>
      </main>
    );
  }

  const { status } = await searchParams;
  const active = TABS.some((t) => t.status === status)
    ? (status as (typeof TABS)[number]["status"])
    : "pending_review";

  let queue: (typeof articles.$inferSelect)[] = [];
  try {
    queue = await db
      .select()
      .from(articles)
      .where(eq(articles.status, active as never))
      .orderBy(desc(articles.createdAt))
      .limit(50);
  } catch {
    // DB unavailable
  }

  return (
    <main>
      <Container className="py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ink-line pb-6">
          <div>
            <Eyebrow>admin</Eyebrow>
            <h1 className="mt-2 text-2xl font-bold">
              قائمة المراجعة{" "}
              <span className="font-mono text-sm text-paper-dim" dir="ltr">
                ({queue.length})
              </span>
            </h1>
          </div>
          <form action="/api/admin/session" method="post">
            <button
              type="submit"
              className="border border-ink-line px-4 py-2 text-xs text-paper-dim hover:border-warn hover:text-warn transition-colors"
            >
              إنهاء الجلسة
            </button>
          </form>
        </div>

        <nav className="flex flex-wrap gap-2 py-5">
          {TABS.map((t) => (
            <Link
              key={t.status}
              href={`/admin/review?status=${t.status}`}
              className={`px-3 py-1.5 font-mono text-xs border transition-colors ${
                active === t.status
                  ? "border-signal text-signal"
                  : "border-ink-line text-paper-dim hover:text-paper"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {queue.length === 0 ? (
          <p className="border border-dashed border-ink-line p-10 text-center text-paper-dim">
            لا مواد في هذا القسم.
          </p>
        ) : (
          <ul className="space-y-5">
            {queue.map((a) => (
              <li
                key={a.id}
                className="border border-ink-line bg-ink-raise/40 p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-signal">
                      {typeLabel(a.type)} · {a.slug}
                    </p>
                    <h2 className="mt-1.5 text-lg font-bold">{a.titleAr}</h2>
                  </div>
                  <div className="font-mono text-[11px] text-paper-dim text-start shrink-0 space-y-0.5">
                    <p dir="ltr">
                      conf: {a.confidenceScore?.toFixed(2) ?? "—"}
                    </p>
                    <p dir="ltr">{isoDate(a.createdAt)}</p>
                    <p dir="ltr">v{a.version}</p>
                  </div>
                </div>

                {a.excerptAr && (
                  <p className="text-paper-dim text-sm mb-4 leading-relaxed">
                    {a.excerptAr}
                  </p>
                )}

                <details className="text-sm group">
                  <summary className="cursor-pointer text-signal select-none">
                    عرض النص الكامل
                  </summary>
                  <pre className="whitespace-pre-wrap font-sans text-paper-dim mt-4 leading-loose border-t border-ink-line pt-4">
                    {a.bodyMd}
                  </pre>
                </details>

                {active === "pending_review" && (
                  <ReviewActions articleId={a.id} />
                )}
              </li>
            ))}
          </ul>
        )}
      </Container>
    </main>
  );
}