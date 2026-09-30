import { db, articles } from "@/db";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = process.env.SITE_URL ?? "http://localhost:3000";
  let items = "";
  try {
    const arts = await db
      .select()
      .from(articles)
      .where(eq(articles.status, "published"))
      .orderBy(desc(articles.publishedAt))
      .limit(50);
    items = arts
      .map(
        (a) => `
    <item>
      <title>${escapeXml(a.titleAr)}</title>
      <link>${base}/news/${a.slug}</link>
      <guid isPermaLink="true">${base}/news/${a.slug}</guid>
      ${a.excerptAr ? `<description>${escapeXml(a.excerptAr)}</description>` : ""}
      <pubDate>${(a.publishedAt ?? a.createdAt).toUTCString()}</pubDate>
      <language>ar</language>
    </item>`,
      )
      .join("");
  } catch {
    // DB unreachable — serve empty feed
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>وكلاء — ذكاء اصطناعي بالعربية</title>
    <link>${base}</link>
    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>أخبار وشروحات وكلاء الذكاء الاصطناعي بالعربية</description>
    <language>ar</language>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
}
