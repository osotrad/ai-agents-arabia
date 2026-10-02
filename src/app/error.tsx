"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ui] route error", error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="font-mono text-xs text-warn mb-3" dir="ltr">
        {"// 500"}
      </p>
      <h1 className="text-2xl font-bold mb-4">حدث خطأ غير متوقع</h1>
      <p className="text-paper-dim mb-8 leading-relaxed">
        تعذّر تحميل هذا القسم. يمكنك إعادة المحاولة، أو الانتقال إلى قسم آخر من
        الموقع.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 bg-signal text-ink text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          إعادة المحاولة
        </button>
        <Link
          href="/news"
          className="px-4 py-2 border border-ink-line text-sm text-paper-dim hover:border-signal hover:text-signal transition-colors"
        >
          تصفّح الأخبار
        </Link>
      </div>
      {error.digest && (
        <p className="font-mono text-xs text-paper-dim mt-8" dir="ltr">
          ref: {error.digest}
        </p>
      )}
    </main>
  );
}