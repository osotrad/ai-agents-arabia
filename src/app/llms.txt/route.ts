import { canonicalUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * GET /llms.txt — machine-readable index for LLMs / agents.
 * Public: a discovery aid, so it is intentionally unauthenticated.
 *
 * Shape follows the spec at llmstxt.org:
 *
 *   - exactly one H1 (the site name)
 *   - one blockquote summary
 *   - non-H2 prose for narrative context
 *   - H2 sections that are *file lists*, each entry a `[name](absolute url)`
 *     optionally followed by `: notes`
 *
 * Three things this file previously got wrong, and why they matter:
 *
 *  1. **The editorial policy was pasted in raw**, so its own `# سياسة النشر`
 *     became a second H1. The spec allows exactly one.
 *  2. **Sections were not file lists.** Entries were `- https://…/ — note`,
 *     i.e. bare URLs, and the REST table used relative paths like
 *     `/context`. Every entry must be a markdown link to an absolute URL.
 *  3. **The policy's own `##` headings** would have been parsed as top-level
 *     sections, so the policy is now rendered as one linked entry instead.
 */
export async function GET() {
  const base = canonicalUrl();
  const api = `${base}/api/v1`;

  const body = `# وكلاء

> موقع عربي متخصص في وكلاء الذكاء الاصطناعي. ينشر أخباراً موثّقة بمصدرين على الأقل، وشروحاً تحليلية، ومصطلحات معرّفة. كل مقال يذكر مصادره، وأي خطأ يُصحَّح علناً في سجل التصحيحات.

هذا الملف فهرس للوكالات الآلية: يوضّح أين يجد القارئ ما يبحث عنه، ومنه تُقرأ واجهة المحتوى الآلية. الفقرات التالية تشرح ما تعنيه الأقسام، والروابط تحتها مفصّلة.

## الصفحات العامة

- [الصفحة الرئيسية](${base}/): أحدث المقالات، وأول سلسلة، وأحدث الإصدارات.
- [الأخبار](${base}/news): كل المقالات المنشورة مرتبة زمنياً، مع فلتر بالنوع عبر ?type=news أو summary أو explainer أو review.
- [مقالة واحدة](${base}/news/{slug}): نص المقال مع مصادره وادعاءاته الموثّقة. ضع slug المسار بعد الكلمات المفتاحية.
- [السلاسل](${base}/topics): سلاسل المقالات المرتّبة ترتيب قراءة.
- [المصطلحات](${base}/glossary): مصطلحات معرّفة.
- [مصطلح واحد](${base}/glossary/{slug}): تعريف المصطلح ومصادره.
- [المصادر](${base}/sources): كل نطاق مُستشهَد به وعدد مرات استخدامه.
- [البحث](${base}/search?q=): بحث بالكلمة المفتاحية عبر ?q=.
- [معايير النشر](${base}/standards): قواعد التحرير والمراجعة.
- [سجل التصحيحات](${base}/corrections): سياسة التصحيح والسجل العلني.
- [عن الموقع](${base}/about): من نحن وكيف تتواصل معنا.
- [خلاصة RSS](${base}/feed.xml): آخر المقالات.

## واجهة المحتوى

الواجهة البرمجية تعمل على نفس قاعدة البيانات التي يقرأ منها الموقع، فأي مقال تنشئه يظهر هنا مباشرة. تحتاج كل الطلبات ترويسة \`Authorization: Bearer <AGENT_API_KEY>\`.

- [التهيئة](${api}/context): نقطة البداية — السياسة والأعداد وعناوين آخر المقالات.
- [سياسة التحرير](${api}/guidelines): السياسة كاملة بصيغة markdown.
- [التحقق قبل النشر](${api}/articles/validate): فحص جاف للمقترح قبل إنشائه.
- [إنشاء مقال](${api}/articles): أنشئ بحالة draft أو pending_review أو published.
- [تعديل مقال](${api}/articles/{id}): تعديل النص ينشئ نسخة سابقة.
- [نشر مقال](${api}/articles/{id}/publish): ينقل المقال من المراجعة إلى النشر.
- [قائمة المقالات](${api}/articles): مع ?status= و?type= و?limit=.
- [بحث دلالي عن تكرار](${api}/articles/similar): يقبل { embedding: number[1536], limit?, threshold? } لاكتشاف المقالات المكتملة.
- [إضافة مصطلح](${api}/glossary): إنشاء أو تحديث مصطلح.
- [تسجيل تصحيح](${api}/corrections): تصحيح علني يُنشر في السجل.
- [الحالة](${api}/health): الأعداد ومشاكل الإعداد وآخر أحداث التدقيق.
- [خادم MCP](${base}/api/mcp): نفس العمليات كأدوات MCP عبر Streamable HTTP.

## سياسة التحرير

المقالات تُنشر بمصدرين مستقلين على الأقل للأخبار. كل رقم أو تاريخ أو اسم منتج في النص يجب أن يوجد حرفياً في أحد المصادر المرفقة، وكل ادعاء يُربط بمصدره. حدود النشر اليومية مفروضة من الخادم على كل مسار نشر، بما فيه موافقة المحرر البشري.

- [سياسة النشر الكاملة](${api}/guidelines): النص الكامل، بما فيه قواعد الصياغة وسير العمل الإلزامي.
`;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=300",
    },
  });
}
