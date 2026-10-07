import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "التواصل",
  description:
    "نصمّم ونبني أنظمة وكلاء للشركات والأفراد فوق لانغ تشين ولانغ غراف — من إثبات المفهوم إلى نظام إنتاجي يعمل يومياً.",
};

const KINDS = [
  { value: "agent", label: "بناء وكيل" },
  { value: "correction", label: "تصحيح مقال" },
  { value: "collab", label: "تعاون أو ضيف" },
  { value: "other", label: "شيء آخر" },
] as const;

const inputCls =
  "w-full bg-ink-raise border border-ink-line px-3 py-2.5 text-paper placeholder:text-paper-dim/60 focus:border-signal focus:outline-none";
const labelCls = "block mb-1.5 text-xs font-mono text-paper-dim";

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; from?: string }>;
}) {
  const { sent, error, from } = await searchParams;

  if (sent === "1") {
    return (
      <main>
        <PageHeader
          eyebrow="تمّ الاستلام"
          title="وصلنا طلبك"
          lede="سنقرأ طلبك ونردّ عليك على البريد الذي كتبته. إن كان الأمر عاجلاً، اذكر ذلك في الرسالة."
        >
          <Link
            href="/contact"
            className="mt-6 inline-block px-5 py-2.5 border border-ink-line font-mono text-sm text-signal hover:border-signal transition-colors"
          >
            إرسال طلب آخر
          </Link>
        </PageHeader>
      </main>
    );
  }

  const ERROR_TEXT: Record<string, string> = {
    invalid: "البيانات ناقصة أو غير صالحة. راجع الحقول وحاول مرة أخرى.",
    too_many: "تجاوزت الحد المسموح من هذا الجهاز. حاول بعد قليل.",
    failed: "تعذّر إرسال الطلب الآن. حاول مرة أخرى بعد قليل.",
  };

  return (
    <main>
      <PageHeader
        eyebrow="التواصل"
        title="ابنِ وكيلاً يعمل لفريقك"
        lede="نصمّم ونبني أنظمة وكلاء للشركات والأفراد فوق لانغ تشين (LangChain) ولانغ غراف (LangGraph) — من إثبات المفهوم في أسبوع إلى نظام إنتاجي يُشغَّل يومياً. اكتب لنا وضعك، وسنردّ بما يناسبه."
      />

      <Container width="narrow" className="pb-20">
        {/*
          Posts to a route handler that redirects back here with ?sent=1, so
          the whole flow works with JS disabled and needs no client bundle.
          The thank-you view lives in the URL rather than a cookie, which
          means it survives a hard refresh and needs no client state.
        */}
        <form action="/api/v1/contact" method="post" className="space-y-5 max-w-xl">
          {/* Attribution: CTAs link here as /contact?from=<article-slug>. */}
          <input type="hidden" name="from" value={from?.slice(0, 255) ?? ""} />

          {error ? (
            <p className="border border-signal/60 bg-signal/10 px-4 py-3 text-sm text-signal">
              {ERROR_TEXT[error] ?? ERROR_TEXT.failed}
            </p>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className={labelCls}>
                الاسم
              </label>
              <input
                id="name"
                name="name"
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                className={inputCls}
                placeholder="اسمك"
              />
            </div>
            <div>
              <label htmlFor="email" className={labelCls}>
                البريد الإلكتروني
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                className={inputCls}
                placeholder="you@company.com"
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label htmlFor="kind" className={labelCls}>
              نوع الطلب
            </label>
            <select
              id="kind"
              name="kind"
              className={inputCls}
              defaultValue="agent"
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="message" className={labelCls}>
              ما الذي تحتاجه؟
            </label>
            <textarea
              id="message"
              name="message"
              required
              minLength={10}
              maxLength={4000}
              rows={6}
              className={inputCls}
              placeholder="صف المشكلة التي يحلّها الوكيل، ومن سيستخدمه، وما لديكم من أنظمة قائمة."
            />
          </div>

          {/*
            Honeypot. Hidden from humans and assistive tech; bots that fill
            every input they find get redirected as though it succeeded.
            tabIndex={-1} + aria-hidden keep it out of the tab order and the
            accessibility tree — otherwise a screen-reader user lands on an
            empty box whose label means nothing to them.
          */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
            />
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 border border-signal text-signal hover:bg-signal hover:text-ink transition-colors font-mono text-sm"
          >
            أرسل الطلب
          </button>

          <p className="text-paper-dim text-xs leading-relaxed">
            نستعمل بريدك للردّ على هذا الطلب فقط. لا نضيفك إلى قائمة بريدية ولا
            نشارك بياناتك. إن كان طلبك تصحيحاً لمقال، الضبط الأدق هو{" "}
            <Link href="/corrections" className="text-signal hover:underline">
              سجل التصحيحات
            </Link>{" "}
            لأنه يُنشر علناً.
          </p>
        </form>
      </Container>
    </main>
  );
}
