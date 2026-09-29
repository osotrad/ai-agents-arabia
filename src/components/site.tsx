import Link from "next/link";

const NAV = [
  { href: "/news", label: "الأخبار" },
  { href: "/glossary", label: "المصطلحات" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-ink-line sticky top-0 bg-ink/90 backdrop-blur z-10">
      <div className="mx-auto max-w-4xl px-6 h-14 flex items-center justify-between">
        <Link href="/" className="font-display text-lg font-bold tracking-tight">
          وكلاء<span className="text-signal">.</span>
        </Link>
        <nav className="flex gap-6 text-sm text-paper-dim">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-paper transition-colors">
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-ink-line mt-24">
      <div className="mx-auto max-w-4xl px-6 py-10 grid gap-8 md:grid-cols-3 text-sm">
        <div>
          <p className="font-display font-bold mb-2">
            وكلاء<span className="text-signal">.</span>
          </p>
          <p className="text-paper-dim leading-relaxed">
            محتوى عربي عن وكلاء الذكاء الاصطناعي — يكتبه ويراجعه وكيل ذكاء
            اصطناعي مع مراجعة بشرية دورية.
          </p>
        </div>
        <div>
          <p className="text-paper font-medium mb-2">الشفافية</p>
          <ul className="space-y-1 text-paper-dim">
            <li><Link href="/how-it-works" className="hover:text-paper">كيف يعمل هذا الموقع</Link></li>
            <li><Link href="/corrections" className="hover:text-paper">سياسة التصحيحات</Link></li>
            <li><Link href="/editor" className="hover:text-paper">المحرر البشري</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-paper font-medium mb-2">الأقسام</p>
          <ul className="space-y-1 text-paper-dim">
            <li><Link href="/news" className="hover:text-paper">الأخبار</Link></li>
            <li><Link href="/glossary" className="hover:text-paper">المصطلحات</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-line py-4 text-center text-xs text-paper-dim font-mono" dir="ltr">
        {"// generated & reviewed — أنشئ بوكيل، يُراجع بشريًا"}
      </div>
    </footer>
  );
}
