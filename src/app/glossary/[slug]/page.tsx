import { db, glossaryTerms } from "@/db";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

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

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const term = await getTerm(slug);
  if (!term) return {};
  return {
    title: term.termAr,
    description: term.definitionAr.slice(0, 160),
  };
}

export default async function GlossaryTermPage({ params }: Params) {
  const { slug } = await params;
  const term = await getTerm(slug);
  if (!term) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="font-mono text-xs text-signal mb-3" dir="ltr">
        {"// glossary"}
      </p>
      <h1 className="text-3xl font-bold mb-2">{term.termAr}</h1>
      <p className="font-mono text-sm text-paper-dim mb-8" dir="ltr">
        {term.termEn}
      </p>
      <p className="text-lg leading-loose text-paper">{term.definitionAr}</p>
    </main>
  );
}
