import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "معايير النشر",
  description:
    "كيف نجمع المصادر، ونتحقق من كل رقم واسم، ونحدّث ما يتقادم — معايير تحريرية معلنة.",
};

const RULES = [
  {
    n: "01",
    t: "مصدران مستقلّان لكل خبر",
    d: "لا يُنشر خبر قبل أن يقف على مصدرَين مستقلَّين لا يتبادلان المحتوى نفسه. يُحفظ كل مصدر برابطه ومقتطفه، ويُربط بكل ادعاء يدعمه.",
  },
  {
    n: "02",
    t: "كل رقم من مصدره",
    d: "كل رقم أو تاريخ أو اسم منتج في النص يجب أن يوجد حرفيًا في مقتطف أحد المصادر المرفقة. ما لا يجد مصدره لا يُنشر.",
  },
  {
    n: "03",
    t: "تحليل لا ترجمة",
    d: "المادة تُكتب بالعربية من زاوية القارئ العربي: لماذا يهمّه الخبر، وما الذي يتغير عنده — لا نقلًا حرفيًا عن النص الأصلي.",
  },
  {
    n: "04",
    t: "الشرح قبل الخبر",
    d: "الأخبار تُنشر أولًا لأنها وقائع. أما الشروح والمراجعات والمقارنات فتمرّ على مراجعة تحريرية قبل النشر لأن موقفًا فيها أكثر عرضة للخطأ.",
  },
  {
    n: "05",
    t: "حدّ لعدد المواد",
    d: "عدد المواد المنشورة يوميًا محدود عمدًا. التوسّع السريع في عدد الصفحات أقل قيمة من ثقة القارئ في ما هو منشور.",
  },
  {
    n: "06",
    t: "تحديث دوري معلن",
    d: "لكل مادة تاريخ إعادة مراجعة يُحدَّد من نوعها. ما يتقادم يُصحَّح فورًا ويُوثَّق في سجل التصحيحات.",
  },
];

const LIMITS = [
  "لا يُنشر خبر بأقل من مصدرَين مستقلَّين، ولا رقم أو اسم منتج بلا مقتطف مصدر يحمله حرفيًا.",
  "حدّ المواد اليومية مفروض في النظام نفسه — كل مسار نشر يخضع له، وعند بلوغه يتوقف النشر حتى انقضاء المدة.",
  "الشرح والمراجعة والمقارنة لا تُنشر قبل مراجعة تحريرية.",
  "عينة من المواد المنشورة تُراجَع يدويًا على فترات.",
  "كل تعديل على نص منشور يحفظ النسخة السابقة، والتصحيح يُوثَّق علنًا بتاريخه.",
];

export default function StandardsPage() {
  return (
    <main>
      <PageHeader
        eyebrow="standards"
        title="معايير النشر"
        lede="ما نلتزم به قبل أن تظهر أي مادة على هذا الموقع. المعايير مكتوبة ومعلنة، وأي انحراف عنها يُصحَّح علنًا كأي خطأ آخر."
      />

      <Container width="narrow" className="pb-16">
        <ol className="space-y-8 border-b border-ink-line pb-12">
          {RULES.map((r) => (
            <li key={r.n} className="flex gap-5">
              <span className="font-mono text-xs text-signal pt-2 shrink-0" dir="ltr">
                {r.n}
              </span>
              <div>
                <h2 className="font-display text-lg font-bold">{r.t}</h2>
                <p className="mt-2 text-paper-dim leading-relaxed">{r.d}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-12">
          <h2 className="font-display text-xl font-bold mb-4">حدود النشر</h2>
          <ul className="space-y-3 text-paper-dim leading-relaxed">
            {LIMITS.map((l) => (
              <li key={l} className="flex gap-3">
                <span className="text-signal shrink-0" aria-hidden="true">
                  ▸
                </span>
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-xl font-bold mb-2">إن رأيت خطأ</h2>
          <p className="text-paper-dim leading-relaxed">
            التصحيح جزء من المعايير لا استثناء عليها. نصحّح داخل المقال، ونوثّق ما
            تغيّر في{" "}
            <Link href="/corrections" className="text-signal hover:underline">
              سجل التصحيحات
            </Link>
            ، ولا نحذف مادة نُشرت.
          </p>
        </section>
      </Container>
    </main>
  );
}
