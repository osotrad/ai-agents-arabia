import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, IBM_Plex_Mono, Sora } from "next/font/google";
import { SiteHeader, SiteFooter } from "@/components/site";
import { canonicalUrl, siteName } from "@/lib/env";
import "./globals.css";

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const sora = Sora({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  // CANONICAL_URL, not SITE_URL: on a multi-domain deployment the vanity
  // domain must win, or every absolute metadata URL (og:url, twitter:image,
  // canonical) resolves to the workers.dev host and splits SEO signals.
  metadataBase: new URL(canonicalUrl()),
  title: {
    default: "وكلاء — ذكاء اصطناعي بالعربية",
    template: "%s — وكلاء",
  },
  description:
    "موقع عربي متخصص في وكلاء الذكاء الاصطناعي: أخبار، مصطلحات، وشروحات بتحليل عربي أصيل — كل مادة بمصادرها.",
  applicationName: siteName(),
  openGraph: {
    type: "website",
    locale: "ar_AR",
    siteName: siteName(),
  },
  twitter: { card: "summary_large_image" },
  alternates: {
    types: {
      "application/rss+xml": [{ url: "/feed.xml", title: "وكلاء" }],
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${plexArabic.variable} ${sora.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink text-paper">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        {/*
          Vercel Web Analytics, script install. Chosen over @vercel/analytics
          deliberately: that package needs an npm dependency and injects
          useReportWebVitals, and this same layout is still built for Cloudflare
          by deploy.yml. This tag is build-target agnostic and costs one line.

          Analytics is a third-party request on every page load, so it goes on
          `defer` and stays off the critical path. No cookies, no cross-site
          tracking, no fingerprinting — pageviews and referrers only.
        */}
        <script defer src="https://va.vercel-scripts.com/v1/script.js" />
      </body>
    </html>
  );
}