import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "عن الموقع",
  description:
    "ما الذي ينشره هذا الموقع، ولماذا، وكيف يمكن التواصل معنا أو الإبلاغ عن خطأ.",
};

const SCOPE = [
  {
    t: "ننشر",
    d: "أخبار الوكلاء ونماذجهم وأطر عملهم وإطلاقاتهم، وشروحًا للمفاهيم التي يكثر الخلط فيها، ومصطلحات معرّفة، ومراجعات لأدوات العمل بالوكلاء.",
  },
  {
    t: "لا ننشر",
    d: "إشهارًا مدفوعًا تحت غطاء خبر، ولا أرقامًا بلا مصدر، ولا محتوى يُنقل حرفيًا عن مصدره دون معالجة تحليلية.",
  },
  {
    t: "نغطي",
    d: "ما يهمّ مطوّرًا عربيًا يبني على وكلاء: النماذج، وأدوات التنفيذ، والتقييم، والسلامة، والتفويض، وتكلفة التشغيل.",
  },
];

export default function AboutPage() {
  return (
    <main>
      <PageHeader
        eyebrow="about"
        title="عن الموقع"
        lede="منصة عربية متخصصة في وكلاء الذكاء الاصطناعي. نحاول أن تكون مفيدة للقارئ العربي تحديدًا: ما الذي تغيّر، ولماذا يهمّه، وأين يجد الدليل."
      />

      <Container width="narrow" className="pb-16">
        <section className="space-y-8 border-b border-ink-line pb-12">
          {SCOPE.map((s) => (
            <div key={s.t}>
              <h2 className="font-display text-lg font-bold">{s.t}</h2>
              <p className="mt-2 text-paper-dim leading-relaxed">{s.d}</p>
            </div>
          ))}
        </section>

        <section className="mt-12">
          <h2 className="font-display text-xl font-bold mb-3">للمسؤولية</h2>
          <p className="text-paper-dim leading-relaxed">
            كل مادة على هذا الموقع تمرّ على{" "}
            <Link href="/standards" className="text-signal hover:underline">
              معايير النشر
            </Link>{" "}
            المعلنة، ومسؤولية تحريرها مشتركة بين من يجمع المادة ويتحقق منها ومن
            يعتمدها. أي خطأ يُصحَّح علنًا في سجل التصحيحات ولا يُحذف.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-bold mb-3">للتواصل</h2>
          <p className="text-paper-dim leading-relaxed">
            الأخطاء والتصحيحات والملاحظات — كلها موضع ترحيب. أسرع طريق هو فتح issue
            على المستودع العام للمشروع:
          </p>
          <a
            href="https://github.com/osotrad/ai-agents-arabia/issues"
            className="mt-4 inline-block px-5 py-2.5 border border-ink-line font-mono text-sm text-signal hover:border-signal transition-colors"
            target="_blank"
            rel="noopener noreferrer"
            dir="ltr"
          >
            github.com/osotrad/ai-agents-arabia/issues ↗
          </a>
        </section>
      </Container>
    </main>
  );
}
