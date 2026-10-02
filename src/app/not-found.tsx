import Link from "next/link";
import { Container, Eyebrow } from "@/components/ui";

const LINKS = [
  { href: "/news", label: "الأخبار" },
  { href: "/glossary", label: "المعجم" },
  { href: "/search", label: "البحث" },
  { href: "/sources", label: "المصادر" },
];

export default function NotFound() {
  return (
    <main>
      <Container width="reading" className="py-24 text-center">
        <div className="flex justify-center">
          <Eyebrow>404</Eyebrow>
        </div>
        <h1 className="mt-4 text-3xl font-bold mb-4">الصفحة غير موجودة</h1>
        <p className="text-paper-dim mb-10 leading-relaxed">
          قد يكون الرابط قديماً، أو أن المادة لم تُنشر بعد. جرّب أحد المسارات أدناه.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="px-4 py-2 border border-ink-line text-sm text-paper-dim hover:border-signal hover:text-signal transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>
        <p className="mt-10 font-mono text-xs text-paper-dim" dir="ltr">
          {"// rss: /feed.xml · api: /api/v1/context"}
        </p>
      </Container>
    </main>
  );
}