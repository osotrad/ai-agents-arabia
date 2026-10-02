"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export interface GlossaryEntry {
  slug: string;
  termAr: string;
  termEn: string;
  definitionAr: string;
}

/**
 * Client-side glossary filter — the whole term list is small enough to ship,
 * so filtering stays instant and the page still renders fully server-side.
 */
export function GlossaryFilter({ terms }: { terms: GlossaryEntry[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return terms;
    return terms.filter(
      (t) =>
        t.termAr.includes(needle) ||
        t.termEn.toLowerCase().includes(needle) ||
        t.definitionAr.includes(needle),
    );
  }, [q, terms]);

  // Bucket by the first Arabic letter so long lists stay navigable.
  const groups = useMemo(() => {
    const map = new Map<string, GlossaryEntry[]>();
    for (const t of filtered) {
      const key = t.termAr.trim().charAt(0) || "—";
      const bucket = map.get(key);
      if (bucket) bucket.push(t);
      else map.set(key, [t]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "ar"));
  }, [filtered]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6">
        <div className="flex-1 min-w-56 max-w-md">
          <label htmlFor="term-filter" className="sr-only">
            ابحث في المعجم
          </label>
          <input
            id="term-filter"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالعربية أو بالإنجليزية…"
            className="w-full border border-ink-line bg-ink-raise px-4 py-2.5 text-sm placeholder:text-paper-dim focus:border-signal focus:outline-none transition-colors"
          />
        </div>
        <p className="font-mono text-xs text-paper-dim" dir="ltr">
          {filtered.length} / {terms.length} terms
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="border border-dashed border-ink-line p-10 text-center text-paper-dim">
          لا يوجد مصطلح يطابق بحثك.
        </p>
      ) : (
        <div className="space-y-10">
          {groups.map(([letter, items]) => (
            <section key={letter}>
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="font-display text-2xl font-bold text-signal"
                  aria-hidden="true"
                >
                  {letter}
                </span>
                <span className="flex-1 h-px bg-ink-line" />
                <span className="font-mono text-[11px] text-paper-dim" dir="ltr">
                  {items.length}
                </span>
              </div>
              <dl className="grid gap-px bg-ink-line border border-ink-line md:grid-cols-2">
                {items.map((t) => (
                  <div key={t.slug} className="bg-ink p-5">
                    <dt className="flex items-baseline justify-between gap-3">
                      <Link
                        href={`/glossary/${t.slug}`}
                        className="font-bold hover:text-signal transition-colors"
                      >
                        {t.termAr}
                      </Link>
                      <span
                        className="font-mono text-[11px] text-paper-dim truncate"
                        dir="ltr"
                      >
                        {t.termEn}
                      </span>
                    </dt>
                    <dd className="mt-2 text-sm text-paper-dim leading-relaxed">
                      {t.definitionAr}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}