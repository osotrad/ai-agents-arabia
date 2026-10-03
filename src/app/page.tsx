import { db, articles, glossaryTerms } from "@/db";
import { desc, eq, asc, sql } from "drizzle-orm";
import Link from "next/link";
import {
  ArticleCard,
  ArticleThumbnail,
  Container,
  Eyebrow,
  SectionHeading,
  Stat,
  type ArticleSummary,
} from "@/components/ui";
import { isoDate, timeAgo, typeLabel } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 300; // ISR: revalidate every 5 min

interface HomeData {
  latest: ArticleSummary[];
  terms: { slug: string; termAr: string; termEn: string; definitionAr: string }[];
  stats: {
    published: number;
    last24h: number;
    terms: number;
    sources: number;
  } | null;
}

async function load(): Promise<HomeData> {
  try {
    const [latest, terms, counts] = await Promise.all([
      db
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
        .where(eq(articles.status, "published"))
        .orderBy(desc(articles.publishedAt))
        .limit(7),
      db
        .select({
          slug: glossaryTerms.slug,
          termAr: glossaryTerms.termAr,
          termEn: glossaryTerms.termEn,
          definitionAr: glossaryTerms.definitionAr,
        })
        .from(glossaryTerms)
        .where(eq(glossaryTerms.published, true))
        .orderBy(asc(glossaryTerms.termAr))
        .limit(6),
      db.execute(sql`
        SELECT
          (SELECT count(*)::int FROM articles WHERE status = 'published') AS published,
          (SELECT count(*)::int FROM articles
             WHERE status = 'published' AND published_at > now() - interval '24 hours') AS last24h,
          (SELECT count(*)::int FROM glossary_terms WHERE published) AS terms,
          (SELECT count(DISTINCT source_id)::int FROM article_sources) AS sources
      `),
    ]);

    const row = (counts.rows?.[0] ?? {}) as Record<string, number>;
    return {
      latest: latest as ArticleSummary[],
      terms,
      stats: {
        published: row.published ?? 0,
        last24h: row.last24h ?? 0,
        terms: row.terms ?? 0,
        sources: row.sources ?? 0,
      },
    };
  } catch {
    // DB not configured yet — render the editorial shell without live data
    return { latest: [], terms: [], stats: null };
  }
}

const SECTIONS = [
  {
    href: "/news",
    eyebrow: "news",
    title: "الأخبار",
    body: "ما الجديد في نماذج الوكلاء وأطر عملهم وإطلاقاتهم — بترتيب زمني.",
  },
  {
    href: "/glossary",
    eyebrow: "glossary",
    title: "المصطلحات",
    body: "معجم عربي‑إنجليزي لأهم المصطلحات: تعريف موجز، ومقابل إنجليزي.",
  },
  {
    href: "/standards",
    eyebrow: "standards",
    title: "معايير النشر",
    body: "كيف نجمع المصادر، ونتحقق من كل رقم، ونصحّح ما يتقادم.",
  },
  {
    href: "/sources",
    eyebrow: "sources",
    title: "المصادر",
    body: "كل نطاق استُشهد به في مادة منشورة، وعدد المواد التي استندت إليه.",
  },
];

const PRINCIPLES = [
  {
    n: "01",
    t: "مصدران على الأقل",
    d: "لا يُنشر خبر قبل أن يقف على مصدرَين مستقلَّين، ويُسجَّل كل مصدر برابطه ومقتطفه.",
  },
  {
    n: "02",
    t: "كل رقم من مصدره",
    d: "كل رقم أو تاريخ أو اسم منتج في النص يجب أن يوجد حرفيًا في أحد المصادر المرفقة قبل نشره.",
  },
  {
    n: "03",
    t: "تحليل لا ترجمة",
    d: "المحتوى يُكتب بالعربية من زاوية القارئ العربي، لا نقلًا حرفيًا عن الأصل.",
  },
  {
    n: "04",
    t: "تحديث دوري",
    d: "لكل مادة تاريخ إعادة مراجعة؛ ما يتقادم يُصحَّح علنًا في سجل التصحيحات ولا يُحذف.",
  },
];

export default async function Home() {
  const { latest, terms, stats } = await load();
  const [lead, ...rest] = latest;

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-ink-line">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(var(--signal) 1px, transparent 1px), linear-gradient(90deg, var(--signal) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <Container className="relative pt-16 pb-16 sm:pt-24 sm:pb-20">
          <Eyebrow>منصة عربية عن وكلاء الذكاء الاصطناعي</Eyebrow>
          <h1 className="mt-5 max-w-4xl text-4xl sm:text-6xl font-bold leading-[1.15]">
            ذكاء اصطناعي،
            <br />
            <span className="text-paper-dim">بعينٍ عربية.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-paper-dim leading-relaxed">
            أخبار وشروحات ومصطلحات وكلاء الذكاء الاصطناعي — تحليل عربي أصيل مبنيّ
            على مصادر موثّقة، وكل رقم فيها قابل للتحقق.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/news"
              className="px-5 py-2.5 bg-signal text-ink font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              تصفّح الأخبار
            </Link>
            <Link
              href="/standards"
              className="px-5 py-2.5 border border-ink-line text-sm text-paper hover:border-signal hover:text-signal transition-colors"
            >
              معايير النشر
            </Link>
            <Link
              href="/feed.xml"
              className="font-mono text-xs text-paper-dim hover:text-signal transition-colors"
              dir="ltr"
            >
              subscribe: /feed.xml ↗
            </Link>
          </div>
        </Container>
      </section>

      {/* ── Live numbers ─────────────────────────────────────────────── */}
      {stats && (
        <section className="border-b border-ink-line bg-ink-raise/30">
          <Container className="py-8">
            <div className="grid grid-cols-2 gap-px bg-ink-line border border-ink-line md:grid-cols-4">
              <Stat
                value={stats.published}
                label="مادة منشورة"
                hint="أخبار وشرح ومصطلحات"
              />
              <Stat
                value={stats.last24h}
                label="خلال ٢٤ ساعة"
                hint="ضمن حد النشر اليومي"
              />
              <Stat value={stats.terms} label="مصطلح معرّف" hint="معجم عربي‑إنجليزي" />
              <Stat
                value={stats.sources}
                label="مصدر موثّق"
                hint="نطاق استُشهد به فعليًا"
              />
            </div>
          </Container>
        </section>
      )}

      {/* ── Latest ───────────────────────────────────────────────────── */}
      {lead && (
        <section className="py-16">
          <Container>
            <SectionHeading
              title="أحدث المواد"
              href="/news"
              linkLabel="كل الأخبار"
              count={stats?.published}
            />
            <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
              <ArticleCard article={lead} featured />
              <ul className="divide-y divide-ink-line border-t border-ink-line">
                {rest.slice(0, 5).map((a) => (
                  <li key={a.id} className="group py-4 first:pt-0">
                    <Link href={`/news/${a.slug}`} className="flex items-start gap-4">
                      <ArticleThumbnail article={a} />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[11px] text-paper-dim" dir="ltr">
                          {isoDate(a.publishedAt)} · {typeLabel(a.type)}
                        </p>
                        <h3 className="mt-1 font-semibold leading-snug group-hover:text-signal transition-colors">
                          {a.titleAr}
                        </h3>
                        {a.excerptAr && (
                          <p className="mt-1 text-xs text-paper-dim line-clamp-2 leading-relaxed">
                            {a.excerptAr}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </section>
      )}

      {/* ── Sections ─────────────────────────────────────────────────── */}
      <section className="border-t border-ink-line py-16">
        <Container>
          <SectionHeading title="أقسام الموقع" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {SECTIONS.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="group border border-ink-line bg-ink-raise/40 p-6 hover:border-signal/50 transition-colors"
              >
                <p className="font-mono text-[11px] text-signal" dir="ltr">
                  {"// "}
                  {s.eyebrow}
                </p>
                <h3 className="mt-3 font-display text-lg font-bold group-hover:text-signal transition-colors">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm text-paper-dim leading-relaxed">
                  {s.body}
                </p>
                <span className="mt-4 inline-block font-mono text-xs text-paper-dim group-hover:text-signal transition-colors">
                  افتح ←
                </span>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Editorial guarantees ─────────────────────────────────────── */}
      <section className="border-t border-ink-line py-16 bg-ink-raise/30">
        <Container>
          <SectionHeading
            title="ما الذي يضمن الجودة"
            href="/standards"
            linkLabel="التفاصيل"
          />
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map((p) => (
              <div key={p.n}>
                <p className="font-mono text-xs text-signal" dir="ltr">
                  {p.n}
                </p>
                <h3 className="mt-2 font-bold">{p.t}</h3>
                <p className="mt-2 text-sm text-paper-dim leading-relaxed">
                  {p.d}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Glossary teaser ──────────────────────────────────────────── */}
      {terms.length > 0 && (
        <section className="border-t border-ink-line py-16">
          <Container>
            <SectionHeading
              title="من ركن المصطلحات"
              href="/glossary"
              linkLabel="المعجم كاملًا"
              count={stats?.terms}
            />
            <dl className="grid gap-px bg-ink-line border border-ink-line md:grid-cols-2 lg:grid-cols-3">
              {terms.map((t) => (
                <div key={t.slug} className="bg-ink p-5">
                  <dt className="flex items-baseline justify-between gap-3">
                    <Link
                      href={`/glossary/${t.slug}`}
                      className="font-bold hover:text-signal transition-colors"
                    >
                      {t.termAr}
                    </Link>
                    <span
                      className="font-mono text-[11px] text-paper-dim truncate"
                      dir="ltr"
                    >
                      {t.termEn}
                    </span>
                  </dt>
                  <dd className="mt-2 text-sm text-paper-dim leading-relaxed line-clamp-2">
                    {t.definitionAr}
                  </dd>
                </div>
              ))}
            </dl>
          </Container>
        </section>
      )}

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="border-t border-ink-line">
        <Container className="py-14">
          <div className="border border-ink-line bg-ink-raise/50 p-8 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <Eyebrow>لديك خطأ أو ملاحظة؟</Eyebrow>
              <p className="mt-3 text-lg font-medium max-w-lg">
                التصحيح علنية في هذا الموقع: يُصحَّح داخل المقال، ويُوثَّق في سجل
                التصحيحات، ولا يُحذف شيء.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <Link
                href="/corrections"
                className="px-5 py-2.5 border border-ink-line text-sm hover:border-signal hover:text-signal transition-colors"
              >
                سياسة التصحيحات
              </Link>
              <Link
                href="/about"
                className="px-5 py-2.5 bg-signal text-ink text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                عن الموقع
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Machine-readable footer ──────────────────────────────────── */}
      {lead && (
        <section className="border-t border-ink-line py-8">
          <Container>
            <p className="font-mono text-[11px] text-paper-dim leading-relaxed" dir="ltr">
              {`// last published: ${isoDate(lead.publishedAt)} · ${timeAgo(
                lead.publishedAt,
              )} · rss: /feed.xml`}
            </p>
          </Container>
        </section>
      )}
    </main>
  );
}