/**
 * Editorial series registry — the single source of truth.
 *
 * A series is a *curated, ordered reading path* written by an editor. It is not
 * a tag. The distinction matters because `articles.topic` is free-ish text: an
 * agent can set it to "AI Agents & Commerce" on a single news article, and that
 * value is not a series with one member, it is a label on one page.
 *
 * Anything not listed here is treated as an unregistered label. It still shows
 * up in the article's own page, but it never gets a hub, never appears on
 * /topics, and /topics/[topic] redirects rather than rendering an empty shell.
 *
 * Keeping this here rather than inside the two route files removes the bug
 * where /topics and /topics/[topic] carried two divergent copies of the same
 * metadata and drifted apart.
 */
export interface Series {
  /** Slug stored in `articles.topic`. Matches ^[a-z0-9-]+$. */
  slug: string;
  /** Human title, Arabic. */
  title: string;
  /** One or two sentences for the index card and the hub header. */
  lede: string;
  /**
   * Minimum published articles before a series is worth listing. A single
   * tagged article is not a reading path, so the index stays silent on it.
   */
  minArticles: number;
}

export const SERIES: Series[] = [
  {
    slug: "langchain",
    title: "لانغ تشين ولانغ غراف",
    lede: "من السؤال الأول — ما هو الوكيل؟ — إلى وكيل حقيقي تحفظ حالته، وتطلب موافقة بشرية قبل أي إجراء حسّاس. كل مقال يبني على سابقه ويخبرك بماذا ستبني بعده.",
    minArticles: 2,
  },
  {
    slug: "n8n",
    title: "n8n — أتمتة سير العمل",
    lede: "من السؤال الأول — ما هو n8n ولماذا يختلف عن كتابة الكود؟ — إلى أتمتة تعمل في الإنتاج، بسرعات متدرّجة لا تفترض خبرة برمجية.",
    minArticles: 2,
  },
];

const BY_SLUG = new Map(SERIES.map((s) => [s.slug, s]));

/** The registered series, or undefined for a free-text label. */
export function seriesFor(slug: string): Series | undefined {
  return BY_SLUG.get(slug);
}

export function isSeries(slug: string): boolean {
  return BY_SLUG.has(slug);
}
