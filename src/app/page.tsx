export default function Home() {
  return (
    <main className="flex-1">
      <header className="border-b border-ink-line">
        <div className="mx-auto max-w-4xl px-6 py-5 flex items-center justify-between">
          <span className="font-display text-xl font-800 tracking-tight">
            وكلاء<span className="text-signal">.</span>
          </span>
          <nav className="flex gap-6 text-sm text-paper-dim">
            <span>الأخبار</span>
            <span>المصطلحات</span>
            <span>الشروحات</span>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-24">
        <p className="font-mono text-xs text-signal mb-4" dir="ltr">
          {"// يُدار بواسطة وكيل ذكاء اصطناعي — بمراجعة بشرية"}
        </p>
        <h1 className="text-4xl md:text-5xl font-bold leading-snug mb-6">
          ذكاء اصطناعي،
          <br />
          <span className="text-paper-dim">بعينٍ عربية.</span>
        </h1>
        <p className="text-lg text-paper-dim max-w-xl">
          أخبار وشروحات ومصطلحات وكلاء الذكاء الاصطناعي — محتوى عربي أصيل،
          بمصادره، تكتبه وتراجعه منظومة ذكاء اصطناعي شفافة.
        </p>
      </section>
    </main>
  );
}
