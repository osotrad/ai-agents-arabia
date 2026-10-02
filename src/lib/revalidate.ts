import { revalidatePath, revalidateTag } from "next/cache";

/** Invalidate a published article plus the listing pages that show it. */
export function revalidateArticle(slug: string): void {
  try {
    revalidatePath(`/news/${slug}`);
    revalidatePath("/news");
    revalidatePath("/");
    revalidateTag("articles", "max");
  } catch (err) {
    // Revalidation is best-effort; a failure must not fail the write.
    console.warn("[revalidate] failed for", slug, err);
  }
}

export function revalidateGlossary(): void {
  try {
    revalidatePath("/glossary");
    revalidateTag("glossary", "max");
  } catch (err) {
    console.warn("[revalidate] glossary failed", err);
  }
}
