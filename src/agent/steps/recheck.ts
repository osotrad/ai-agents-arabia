import { db, articles } from "@/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../logger";

/**
 * PR-012: daily freshness sweep — articles past their recheck_after go to
 * needs_recheck. Runs from the worker cron.
 */
export async function recheckSweep(_input?: unknown): Promise<{ output: { swept: number }; confidence: number }> {
  const now = new Date();
  const stale = await db
    .select({ id: articles.id })
    .from(articles)
    .where(
      sql`${articles.status} = 'published' AND ${articles.recheckAfter} IS NOT NULL AND ${articles.recheckAfter} < ${now.toISOString()}`,
    );

  for (const row of stale) {
    await db.update(articles).set({ status: "needs_recheck" }).where(eq(articles.id, row.id));
  }
  logger.info({ swept: stale.length }, "recheck sweep");
  return { output: { swept: stale.length }, confidence: 1 };
}
