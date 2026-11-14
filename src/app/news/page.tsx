import { db, articles } from "@/db";
import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArticleRow,
  Container,
  EmptyState,
  PageHeader,
  type ArticleSummary,
} from "@/components/ui";
import { ARTICLE_TYPES, TYPE_LABELS_PLURAL } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 300;

type SP = { type?: string };

/**
 * /news is the canonical listing. Every `?type=` variant is a filtered subset of
 * the same list: thin, near-duplicate, and already reachable from /news, so it
 * is kept out of the index with `noindex, follow` (links still pass signals).
 *
 * The filtered view deliberately sets NO canonical: noindex + a canonical that
 * points at a different URL is a mixed signal. `alternates` is replaced, not
 * merged, so the RSS link from the root layout is repeated here.
 *
 * This page stays crawlable (not in robots.txt) so the noindex is actually seen.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SP>;
}): Promise<Metadata> {
  const { type } = await searchParams;
  const base: Metadata = {
    title: "الأخبار",
    description:
      "كل ما نُشر عن وكلاء الذكاء الاصطناعي، مرتبًا زمنيًا، مع رابط كل مصدر.",
  };
  if (!type) return base; // inherits the layout's self-referencing canonical → /news
  return {
    ...base,
    robots: { index: false, follow: true },
    alternates: {
      types: {
        "application/rss+xml": [{ url: "/feed.xml", title: "وكلاء" }],
      },
    },
  };
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const { type } = await searchParams;
  const active = ARTICLE_TYPES.includes(type as never) ? type : undefined;

  let list: ArticleSummary[] = [];
  try {
    list = (await db
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
      .where(
        active
          ? sql`status = 'published' AND type = ${active}::article_type`
          : eq(articles.status, "published" as never),
      )
      .orderBy(desc(articles.publishedAt))
      .limit(60)) as ArticleSummary[];
  } catch {
    // DB not configured yet
  }

  return (
    <main>
      <PageHeader
        eyebrow="news"
        title="الأخبار"
        lede="كل مادة منشورة عن وكلاء الذكاء الاصطناعي، الأحدث أولًا. كل خبر مبنيّ على مصدرَين مستقلَّين على الأقل، ومصادره مذكورة داخل المقال."
      />

      {/* Type filter — plain links, so it works without JavaScript. */}
      <div className="border-y border-ink-line bg-ink-raise/30">
        <Container className="py-3 flex flex-wrap items-center gap-2">
          <Link
            href="/news"
            className={`px-3 py-1.5 font-mono text-xs border transition-colors ${
              !active
                ? "border-signal text-signal"
                : "border-ink-line text-paper-dim hover:text-paper"
            }`}
          >
            الكل
          </Link>
          {ARTICLE_TYPES.map((t) => (
            <Link
              key={t}
              href={`/news?type=${t}`}
              className={`px-3 py-1.5 font-mono text-xs border transition-colors ${
                active === t
                  ? "border-signal text-signal"
                  : "border-ink-line text-paper-dim hover:text-paper"
              }`}
            >
              {TYPE_LABELS_PLURAL[t]}
            </Link>
          ))}
          <span className="ms-auto font-mono text-xs text-paper-dim" dir="ltr">
            {list.length} items
          </span>
        </Container>
      </div>

      <Container className="py-12">
        {list.length === 0 ? (
          <EmptyState
            title="قسم فارغ حاليًا"
            body="لا توجد مواد في هذا القسم بعد — تابع خلاصة RSS أو تصفّح قسماً آخر."
            href="/feed.xml"
            linkLabel="/feed.xml"
          />
        ) : (
          <ul className="divide-y divide-ink-line border-y border-ink-line">
            {list.map((a) => (
              <ArticleRow key={a.id} article={a} />
            ))}
          </ul>
        )}

        <div className="mt-10 flex flex-wrap gap-4 text-xs text-paper-dim">
          <span>
            تبحث عن مصطلح بعينه؟{" "}
            <Link href="/glossary" className="text-signal hover:underline">
              المعجم العربي
            </Link>
          </span>
          <span>
            أو ابحث في النص{" "}
            <Link href="/search" className="text-signal hover:underline">
              البحث الكامل
            </Link>
          </span>
        </div>
      </Container>
    </main>
  );
}
