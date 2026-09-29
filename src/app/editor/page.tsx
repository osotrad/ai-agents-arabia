import type { Metadata } from "next";

export const metadata: Metadata = { title: "المحرر البشري" };

export default function EditorPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold mb-4">المحرر البشري</h1>
      <p className="text-paper-dim leading-relaxed mb-6">
        رغم أن المحتوى يُنتَج بوكيل ذكاء اصطناعي، يقف خلف هذا الموقع محرر
        بشري يتحمل المسؤولية النهائية عن كل ما يُنشر.
      </p>
      <div className="border border-ink-line bg-ink-raise rounded-lg p-6">
        <h2 className="font-bold mb-2">عثمان — المؤسس والمحرر</h2>
        <p className="text-paper-dim text-sm leading-relaxed">
          مهندس برمجيات مهتم بأنظمة الوكلاء والذكاء الاصطناعي. يُراجع عينة
          أسبوعية من المقالات المنشورة، ويوافق شخصيًا على كل الشرح والمقارنات
          والمراجعات قبل نشرها.
        </p>
        <p className="text-paper-dim text-sm mt-4">
          للتواصل بشأن خطأ أو تصحيح: افتح issue على{" "}
          <a
            href="https://github.com/osotrad/ai-agents-arabia/issues"
            className="text-signal hover:underline"
            target="_blank"
            rel="noopener noreferrer"
            dir="ltr"
          >
            GitHub
          </a>
          .
        </p>
      </div>
    </main>
  );
}
