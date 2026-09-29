import Parser from "rss-parser";
import { createHash } from "node:crypto";
import { db, sources } from "@/db";
import { logger } from "../logger";
import { FEEDS } from "../worker";

const parser = new Parser({ timeout: 15_000 });

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = "";
    // strip common tracking params
    [...url.searchParams.keys()].forEach((k) => {
      if (k.startsWith("utm_") || k === "ref") url.searchParams.delete(k);
    });
    return url.toString();
  } catch {
    return u;
  }
}

export interface DiscoverOutput {
  inserted: number;
  skipped: number;
  candidates: { sourceId: string; title: string; url: string }[];
}

/**
 * discover: poll curated RSS feeds, store new items as `sources`,
 * emit candidate topics for the research step.
 */
export async function discover(_input: unknown): Promise<{ output: DiscoverOutput; confidence: number }> {
  let inserted = 0;
  let skipped = 0;
  const candidates: DiscoverOutput["candidates"] = [];

  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      for (const item of parsed.items.slice(0, 15)) {
        if (!item.link) continue;
        const url = normalizeUrl(item.link);
        const hash = sha256(url);
        const title = item.title?.trim() ?? "";

        const res = await db
          .insert(sources)
          .values({
            url,
            domain: feed.domain,
            title,
            rawExcerpt: item.contentSnippet?.slice(0, 2000) ?? item.content?.slice(0, 2000) ?? null,
            contentHash: hash,
          })
          .onConflictDoNothing({ target: sources.url })
          .returning({ id: sources.id });

        if (res.length > 0) {
          inserted++;
          candidates.push({ sourceId: res[0].id, title, url });
        } else {
          skipped++;
        }
      }
    } catch (err) {
      logger.warn({ feed: feed.url, err: String(err) }, "feed fetch failed");
    }
  }

  return { output: { inserted, skipped, candidates }, confidence: inserted > 0 ? 0.7 : 0.5 };
}
