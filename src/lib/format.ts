/** Presentation helpers shared by every page — dates, type labels, badges. */

const AR_LONG = new Intl.DateTimeFormat("ar", {
  year: "numeric",
  month: "long",
  day: "numeric",
  numberingSystem: "latn",
});

const AR_MONTH_YEAR = new Intl.DateTimeFormat("ar", {
  year: "numeric",
  month: "long",
  numberingSystem: "latn",
});

const ISO_DATE = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return AR_LONG.format(date);
}

export function formatMonthYear(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return AR_MONTH_YEAR.format(date);
}

/** `YYYY-MM-DD` for the mono eyebrows — the engineering-drawing voice. */
export function isoDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return ISO_DATE.format(date);
}

const RELATIVE: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600 * 1000],
  ["month", 30 * 24 * 3600 * 1000],
  ["day", 24 * 3600 * 1000],
  ["hour", 3600 * 1000],
  ["minute", 60 * 1000],
];

/** Latin-digit Arabic relative time — "قبل ٣ أيام" as "قبل 3 أيام". */
const AR_RELATIVE = new Intl.RelativeTimeFormat("ar-u-nu-latn", {
  numeric: "auto",
});

/** "قبل ٣ أيام" — falls back to an absolute date beyond a year. */
export function timeAgo(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  for (const [unit, ms] of RELATIVE) {
    if (abs >= ms) return AR_RELATIVE.format(Math.round(diff / ms), unit);
  }
  return "قبل لحظات";
}

export const TYPE_LABELS: Record<string, string> = {
  news: "خبر",
  summary: "ملخّص",
  explainer: "شرح",
  review: "مراجعة",
  glossary: "مصطلح",
};

export const TYPE_LABELS_PLURAL: Record<string, string> = {
  news: "الأخبار",
  summary: "الملخصات",
  explainer: "الشرح",
  review: "المراجعات",
  glossary: "المصطلحات",
};

export const ARTICLE_TYPES = ["news", "summary", "explainer", "review"] as const;

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

/** Badge palette per content type — keeps lists scannable. */
const TYPE_ACCENT: Record<string, string> = {
  news: "text-signal border-signal/40",
  summary: "text-sky-300 border-sky-300/40",
  explainer: "text-emerald-300 border-emerald-300/40",
  review: "text-warn border-warn/40",
  glossary: "text-fuchsia-300 border-fuchsia-300/40",
};

export function typeAccent(type: string): string {
  return TYPE_ACCENT[type] ?? "text-paper-dim border-ink-line";
}

/** Latin-script slug of a term/URL rendered inside RTL text. */
export function confidenceLabel(score: number | null | undefined): string {
  if (score === null || score === undefined) return "—";
  return score.toFixed(2);
}

export function pluralize(n: number, one: string, two: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  return many;
}