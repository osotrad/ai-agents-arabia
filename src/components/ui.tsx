import Link from "next/link";
import type { ReactNode } from "react";
import {
  confidenceLabel,
  isoDate,
  typeAccent,
  typeLabel,
} from "@/lib/format";

/** Page-width shell. Wide for the home page, narrow for reading pages. */
export function Container({
  children,
  width = "wide",
  className = "",
}: {
  children: ReactNode;
  width?: "wide" | "narrow" | "reading";
  className?: string;
}) {
  const max =
    width === "narrow"
      ? "max-w-3xl"
      : width === "reading"
        ? "max-w-2xl"
        : "max-w-6xl";
  return <div className={`mx-auto ${max} px-5 sm:px-6 ${className}`}>{children}</div>;
}

/** The mono `// …` eyebrow that carries the engineering voice. */
export function Eyebrow({
  children,
  tone = "signal",
  className = "",
}: {
  children: ReactNode;
  tone?: "signal" | "dim" | "warn";
  className?: string;
}) {
  const color =
    tone === "warn" ? "text-warn" : tone === "dim" ? "text-paper-dim" : "text-signal";
  return (
    <p className={`font-mono text-xs tracking-wide ${color} ${className}`} dir="ltr">
      {"// "}
      {children}
    </p>
  );
}

/** Consistent header block for every inner page. */
export function PageHeader({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  lede?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Container width="narrow" className="pt-14 pb-10">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-3 text-3xl sm:text-4xl font-bold leading-tight">
        {title}
      </h1>
      {lede && (
        <p className="mt-4 text-lg text-paper-dim leading-relaxed">{lede}</p>
      )}
      {children}
    </Container>
  );
}

/** Section title with an optional "see all" affordance. */
export function SectionHeading({
  title,
  href,
  linkLabel = "الكل",
  count,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  count?: number;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ink-line pb-3 mb-8">
      <h2 className="font-display text-xl font-bold tracking-tight">
        {title}
        {count !== undefined && (
          <span className="font-mono text-xs text-paper-dim ms-3" dir="ltr">
            {count}
          </span>
        )}
      </h2>
      {href && (
        <Link
          href={href}
          className="font-mono text-xs text-signal hover:underline shrink-0"
        >
          {linkLabel} ←
        </Link>
      )}
    </div>
  );
}

export function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={`inline-block border px-2 py-0.5 font-mono text-[11px] leading-5 ${typeAccent(type)}`}
    >
      {typeLabel(type)}
    </span>
  );
}

export function MetaRow({
  items,
  className = "",
}: {
  items: ReactNode[];
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-paper-dim ${className}`}
    >
      {items.map((item, i) => (
        <span key={i}>{item}</span>
      ))}
    </div>
  );
}

export interface ArticleSummary {
  id: string;
  slug: string;
  titleAr: string;
  excerptAr?: string | null;
  type: string;
  publishedAt?: Date | string | null;
  confidenceScore?: number | null;
}

/** Row used in list pages — type, date, title, excerpt, confidence. */
export function ArticleRow({ article }: { article: ArticleSummary }) {
  return (
    <li className="group relative">
      <Link href={`/news/${article.slug}`} className="block py-6">
        <MetaRow
          className="mb-2"
          items={[
            <TypeBadge key="t" type={article.type} />,
            <span key="d">{isoDate(article.publishedAt)}</span>,
            <span key="c">
              {"conf "}
              {confidenceLabel(article.confidenceScore)}
            </span>,
          ]}
        />
        <h3 className="text-lg font-semibold leading-snug transition-colors group-hover:text-signal">
          {article.titleAr}
        </h3>
        {article.excerptAr && (
          <p className="mt-2 text-sm text-paper-dim leading-relaxed line-clamp-2">
            {article.excerptAr}
          </p>
        )}
      </Link>
    </li>
  );
}

/** Card used in grids — the article's own "front page". */
export function ArticleCard({
  article,
  featured = false,
}: {
  article: ArticleSummary;
  featured?: boolean;
}) {
  return (
    <article
      className={`group relative border border-ink-line bg-ink-raise/60 transition-colors hover:border-signal/50 ${
        featured ? "p-7" : "p-5"
      }`}
    >
      <MetaRow
        className="mb-3"
        items={[
          <TypeBadge key="t" type={article.type} />,
          <span key="d">{isoDate(article.publishedAt)}</span>,
        ]}
      />
      <h3
        className={`font-semibold leading-snug transition-colors group-hover:text-signal ${
          featured ? "text-2xl" : "text-base"
        }`}
      >
        <Link href={`/news/${article.slug}`}>
          <span className="absolute inset-0" aria-hidden="true" />
          {article.titleAr}
        </Link>
      </h3>
      {article.excerptAr && (
        <p
          className={`mt-3 text-paper-dim leading-relaxed line-clamp-3 ${
            featured ? "text-base" : "text-sm"
          }`}
        >
          {article.excerptAr}
        </p>
      )}
    </article>
  );
}

/** Hairline divider in the site's voice. */
export function Rule({ className = "" }: { className?: string }) {
  return (
    <div
      className={`font-mono text-[11px] text-paper-dim/70 leading-none ${className}`}
      dir="ltr"
    >
      {"// "}
      {"─".repeat(40)}
    </div>
  );
}

export function Stat({
  value,
  label,
  hint,
}: {
  value: ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <div className="border border-ink-line bg-ink-raise/40 p-5">
      <p className="font-display text-3xl font-bold text-signal tabular-nums">
        {value}
      </p>
      <p className="mt-1 text-sm font-medium">{label}</p>
      {hint && <p className="mt-1 text-xs text-paper-dim">{hint}</p>}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  href,
  linkLabel,
}: {
  title: string;
  body: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="border border-dashed border-ink-line p-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-2 text-sm text-paper-dim">{body}</p>
      {href && linkLabel && (
        <Link
          href={href}
          className="mt-5 inline-block font-mono text-xs text-signal hover:underline"
        >
          {linkLabel} ←
        </Link>
      )}
    </div>
  );
}