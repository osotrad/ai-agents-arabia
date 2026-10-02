import { db, glossaryTerms, sources } from "@/db";
import { and, eq, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { Container, MetaRow } from "@/components/ui";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

type Params = { params: Promise<{ slug: string }> };

async function getTerm(slug: string) {
  try {
    const [term] = await db
      .select()
      .from(glossaryTerms)
      .where(and(eq(glossaryTerms.slug, slug), eq(glossaryTerms.published, true)))
      .limit(1);
    return term ?? null;
  } catch {
    return null;
  }
}

async function getSourceUrl(sourceId: string | null) {
  if (!sourceId) return null;
  try {
    const [s] = await db
      .select({ url: sources.url, domain: sources.domain })
      .from(sources)
      .where(eq(sources.id, sourceId))
      .limit(1);
    return s ?? null;
  } catch {
    return null;
  }
}

/** Sibling terms for on-page navigation. */
async function getAllPublished() {
  try {
    return await db
      .select({
        slug: glossaryTerms.slug,
        termAr: glossaryTerms.termAr,
        termEn: glossaryTerms.termEn,
      })
      .from(glossaryTerms)
      .where(eq(glossaryTerms.published, true))
      .orderBy(asc(glossaryTerms.termAr))
      .limit(60);
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const term = await getTerm(slug);
  if (!term) return {};
  return {
    title: term.termAr,
    description: term.definitionAr.slice(0, 160),
    alternates: { canonical: `/glossary/${term.slug}` },
  };
}

export default async function GlossaryTermPage({ params }: Params) {
  const { slug } = await params;
  const term = await getTerm(slug);
  if (!term) notFound();

  const [source, all] = await Promise.all([
    getSourceUrl(term.sourceId),
    getAllPublished(),
  ]);
  const others = all.filter((t) => t.slug !== term.slug).slice(0, 12);

  return (
    <main>
      <Container width="reading" className="pt-10 pb-16">
        <nav className="font-mono text-xs text-paper-dim mb-8">
          <Link href="/glossary" className="hover:text-signal transition-colors">
            المعجم
          </Link>
          <span className="mx-2">/</span>
          <span dir="ltr">{term.slug}</span>
        </nav>

        <article>
          <p className="font-mono text-xs text-signal" dir="ltr">
            {"// glossary term"}
          </p>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold">{term.termAr}</h1>
          <p className="mt-3 font-mono text-sm text-paper-dim" dir="ltr">
            {term.termEn}
          </p>

          <div className="mt-8 border-s-2 border-signal bg-ink-raise/50 p-6">
            <p className="text-lg leading-loose">{term.definitionAr}</p>
          </div>

          <MetaRow
            className="mt-6"
            items={[
              <span key="slug" dir="ltr">
                slug: {term.slug}
              </span>,
              ...(source
                ? [
                    <a
                      key="src"
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-signal hover:underline"
                      dir="ltr"
                    >
                      source: {source.domain} ↗
                    </a>,
                  ]
                : []),
            ]}
          />
        </article>

        {others.length > 0 && (
          <section className="mt-16">
            <div className="flex items-baseline justify-between border-b border-ink-line pb-3 mb-5">
              <h2 className="font-display text-lg font-bold">مصطلحات أخرى</h2>
              <Link href="/glossary" className="font-mono text-xs text-signal hover:underline">
                المعجم كاملًا ←
              </Link>
            </div>
            <ul className="grid gap-px bg-ink-line border border-ink-line sm:grid-cols-2">
              {others.map((t) => (
                <li key={t.slug} className="bg-ink p-4">
                  <Link
                    href={`/glossary/${t.slug}`}
                    className="font-medium hover:text-signal transition-colors"
                  >
                    {t.termAr}
                  </Link>
                  <span className="block font-mono text-[11px] text-paper-dim mt-0.5" dir="ltr">
                    {t.termEn}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Container>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "DefinedTerm",
            name: term.termAr,
            alternateName: term.termEn,
            description: term.definitionAr,
            inLanguage: "ar",
            url: `${process.env.SITE_URL ?? ""}/glossary/${term.slug}`,
            ...(source ? { sameAs: source.url } : {}),
          }),
        }}
      />
    </main>
  );
}