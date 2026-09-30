import { db } from "@/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const DAILY_CAP = Number(process.env.DAILY_PUBLISH_CAP ?? 5);

/**
 * Hard rate limit: refuse to publish more than DAILY_CAP articles/day.
 * Called from publish() — throws when cap reached.
 */
export async function assertPublishCap(): Promise<void> {
  const res = await db.execute(
    sql`SELECT count(*)::int AS n FROM articles WHERE status='published' AND published_at > now() - interval '24 hours'`,
  );
  const rows = ((res as unknown) as { rows?: unknown[] }).rows
    ?? ((res as unknown) as unknown[]);
  const n = (rows[0] as { n?: number } | undefined)?.n ?? 0;
  if (n >= DAILY_CAP) {
    logger.warn({ n, cap: DAILY_CAP }, "daily publish cap reached");
    throw new Error(`daily publish cap reached (${DAILY_CAP})`);
  }
}

/** Telegram alert (soft dependency). No-op if TELEGRAM_BOT_TOKEN missing. */
export async function notify(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "Markdown" }),
    });
  } catch (err) {
    logger.warn({ err: String(err) }, "telegram notify failed");
  }
}
