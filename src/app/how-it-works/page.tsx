import type { Metadata } from "next";

export const metadata: Metadata = { title: "كيف يعمل هذا الموقع" };

const STEPS = [
  { n: "01", t: "اكتشاف", d: "يرصد الوكيل المصادر الرسمية (مدونات الشركات، arXiv) على مدار الساعة." },
  { n: "02", t: "بحث", d: "يجمع مصدرَين مستقلَّين على الأقل لكل خبر قبل الكتابة." },
  { n: "03", t: "صياغة", d: "يكتب مسودة عربية أصيلة بزاوية تحليلية — لا ترجمة حرفية." },
  { n: "04", t: "تحقق", d: "كل معلومة ورقم يجب أن تتطابق مع مصدر محفوظ، وإلا تُحوَّل المسودة للمراجعة البشرية." },
  { n: "05", t: "نشر", d: "تنشر الأخبار القصيرة الموثقة تلقائيًا. الشروحات والمراجعات لا تنشر إلا بموافقة بشرية." },
];

export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold mb-4">كيف يعمل هذا الموقع</h1>
      <p className="text-paper-dim text-lg leading-relaxed mb-10">
        هذا الموقع يُدار بواسطة <strong className="text-paper">وكيل ذكاء اصطناعي</strong> يكتشف الأخبار
        ويكتبها ويتحقق منها وينشرها — بمراجعة بشرية دورية وشفافية كاملة.
      </p>
      <ol className="space-y-6">
        {STEPS.map((s) => (
          <li key={s.n} className="flex gap-5">
            <span className="font-mono text-signal text-sm pt-1" dir="ltr">{s.n}</span>
            <div>
              <h2 className="font-bold mb-1">{s.t}</h2>
              <p className="text-paper-dim leading-relaxed">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-12 border border-ink-line bg-ink-raise rounded-lg p-6">
        <h2 className="font-bold mb-2">حدود النشر التلقائي</h2>
        <ul className="text-paper-dim text-sm space-y-1 list-disc list-inside">
          <li>يُنشر تلقائيًا فقط: الأخبار القصيرة والمصطلحات والملخصات.</li>
          <li>لا يُنشر أي مقال بأقل من مصدرَين، ولا رقم بدون مصدر.</li>
          <li>الشروحات والمقارنات تنتظر موافقة المحرر البشري دائمًا.</li>
          <li>عينة عشوائية أسبوعية تُراجَع يدويًا لضمان الجودة.</li>
        </ul>
      </div>
    </main>
  );
}
