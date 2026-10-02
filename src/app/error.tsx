"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="font-mono text-xs text-warn mb-3" dir="ltr">
        {"// 500"}
      </p>
      <h1 className="text-2xl font-bold mb-4">حدث خطأ غير متوقع</h1>
      <p className="text-paper-dim mb-8">
        تعذّر تحميل هذا القسم. يمكنك المحاولة مرة أخرى.
      </p>
      <button
        type="button"
        onClick={reset}
        className="px-4 py-2 bg-signal text-ink font-semibold rounded hover:opacity-90"
      >
        إعادة المحاولة
      </button>
      {error.digest && (
        <p className="font-mono text-xs text-paper-dim mt-6" dir="ltr">
          ref: {error.digest}
        </p>
      )}
    </main>
  );
}
