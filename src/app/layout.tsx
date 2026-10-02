import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, IBM_Plex_Mono, Sora } from "next/font/google";
import { SiteHeader, SiteFooter } from "@/components/site";
import { siteName, siteUrl } from "@/lib/env";
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
  metadataBase: new URL(siteUrl()),
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
      </body>
    </html>
  );
}