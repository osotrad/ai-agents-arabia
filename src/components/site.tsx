import Link from "next/link";

const NAV = [
  { href: "/news", label: "الأخبار" },
  { href: "/glossary", label: "المصطلحات" },
  { href: "/sources", label: "المصادر" },
  { href: "/standards", label: "المعايير" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-ink-line bg-ink/85 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-6">
          <Link href="/" className="group flex items-baseline gap-2 shrink-0">
            <span className="font-display text-xl font-extrabold tracking-tight">
              وكلاء
              <span className="text-signal transition-colors group-hover:text-paper">
                .
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-6">
            {/* Plain GET form: site search works with zero JavaScript. */}
            <form action="/search" className="hidden md:block">
              <label htmlFor="nav-search" className="sr-only">
                ابحث في الموقع
              </label>
              <input
                id="nav-search"
                name="q"
                type="search"
                placeholder="ابحث…"
                className="w-32 border border-ink-line bg-ink-raise px-3 py-1.5 text-sm text-paper placeholder:text-paper-dim focus:w-48 transition-all focus:border-signal focus:outline-none"
              />
            </form>

            <nav className="flex items-center gap-5 text-sm text-paper-dim">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="hover:text-paper transition-colors"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}

const COLUMNS = [
  {
    title: "الأقسام",
    links: [
      { href: "/news", label: "الأخبار" },
      { href: "/glossary", label: "المصطلحات" },
      { href: "/sources", label: "المصادر" },
      { href: "/search", label: "البحث" },
    ],
  },
  {
    title: "عن المنصة",
    links: [
      { href: "/standards", label: "معايير النشر" },
      { href: "/corrections", label: "سياسة التصحيحات" },
      { href: "/about", label: "عن الموقع" },
    ],
  },
  {
    title: "أدوات",
    links: [
      { href: "/feed.xml", label: "خلاصة RSS" },
      { href: "/llms.txt", label: "دليل الموقع" },
      { href: "/sitemap.xml", label: "خريطة الموقع" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-ink-line">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <p className="font-display text-lg font-bold">
              وكلاء<span className="text-signal">.</span>
            </p>
            <p className="mt-3 text-sm text-paper-dim leading-relaxed max-w-xs">
              منصة عربية متخصصة في وكلاء الذكاء الاصطناعي: أخبار موثّقة، شروح،
              ومصطلحات معرّفة — كل مادة بمصادرها.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="font-mono text-xs text-paper mb-3">{col.title}</p>
              <ul className="space-y-2 text-sm text-paper-dim">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="hover:text-paper transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}