import { db, glossaryTerms } from "@/db";
import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Container, EmptyState, PageHeader } from "@/components/ui";
import {
  GlossaryFilter,
  type GlossaryEntry,
} from "@/components/glossary-filter";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "المصطلحات",
  description:
    "معجم عربي‑إنجليزي لمصطلحات وكلاء الذكاء الاصطناعي: تعريف موجز لكل مصطلح ومقابله الإنجليزي.",
};

export default async function GlossaryPage() {
  let terms: GlossaryEntry[] = [];
  try {
    terms = await db
      .select({
        slug: glossaryTerms.slug,
        termAr: glossaryTerms.termAr,
        termEn: glossaryTerms.termEn,
        definitionAr: glossaryTerms.definitionAr,
      })
      .from(glossaryTerms)
      .where(eq(glossaryTerms.published, true))
      .orderBy(asc(glossaryTerms.termAr))
      .limit(500);
  } catch {
    // DB not configured yet
  }

  return (
    <main>
      <PageHeader
        eyebrow="glossary"
        title="المعجم"
        lede="مصطلحات وكلاء الذكاء الاصطناعي بتعريف عربي موجز ومقابل إنجليزي، مرتّبة أبجديًا وقابلة للبحث بالعربية والإنجليزية."
      />

      <Container className="pb-16">
        {terms.length === 0 ? (
          <EmptyState
            title="لا مصطلحات منشورة بعد"
            body="المعجم يُبنى من المواد المنشورة — وكل مصطلح يُضاف يحمل تعريفه ومقابله الإنجليزي."
            href="/news"
            linkLabel="تصفّح الأخبار"
          />
        ) : (
          <GlossaryFilter terms={terms} />
        )}
      </Container>
    </main>
  );
}