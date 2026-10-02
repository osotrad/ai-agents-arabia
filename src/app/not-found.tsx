import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="font-mono text-xs text-signal mb-3" dir="ltr">
        {"// 404"}
      </p>
      <h1 className="text-2xl font-bold mb-4">الصفحة غير موجودة</h1>
      <p className="text-paper-dim mb-8">
        قد يكون الرابط قديمًا أو حُذف المحتوى.
      </p>
      <Link
        href="/news"
        className="text-signal hover:underline font-medium"
      >
        تصفّح الأخبار ←
      </Link>
    </main>
  );
}
