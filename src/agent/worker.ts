import { db, tasks } from "@/db";
import { and, eq, lte, sql } from "drizzle-orm";
import { runStep } from "./run-step";
import { logger } from "./logger";

/** Curated AI-agents sources (RSS/Atom). Config-driven. */
export const FEEDS: { url: string; domain: string }[] = [
  { url: "https://openai.com/news/rss.xml", domain: "openai.com" },
  { url: "https://www.anthropic.com/news/rss.xml", domain: "anthropic.com" },
  { url: "https://deepmind.google/blog/rss.xml", domain: "deepmind.google" },
  { url: "https://ai.meta.com/blog/rss/", domain: "ai.meta.com" },
  { url: "https://mistral.ai/news/rss.xml", domain: "mistral.ai" },
  { url: "https://arxiv.org/rss/cs.AI", domain: "arxiv.org" },
  { url: "https://arxiv.org/rss/cs.MA", domain: "arxiv.org" },
];

/**
 * Task worker loop: claims pending tasks with SKIP LOCKED and dispatches them.
 */
export async function workerLoop(opts: { once?: boolean } = {}) {
  if (process.env.AGENT_ENABLED !== "true") {
    logger.warn("AGENT_ENABLED=false — exiting");
    return;
  }
  logger.info({ once: opts.once }, "worker start");

  do {
    const task = await claimTask();
    if (!task) {
      if (opts.once) break;
      await sleep(30_000);
      continue;
    }
    try {
      await dispatch(task);
      await db.update(tasks).set({ status: "done" }).where(eq(tasks.id, task.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ taskId: task.id, kind: task.kind, err: message }, "task failed");
      await db
        .update(tasks)
        .set({ status: task.attempts >= 3 ? "failed" : "pending", attempts: task.attempts + 1 })
        .where(eq(tasks.id, task.id));
    }
  } while (!opts.once);
}

async function claimTask() {
  const res = await db.execute(
    sql`
      UPDATE tasks
      SET status = 'locked', locked_at = now()
      WHERE id = (
        SELECT id FROM tasks
        WHERE status = 'pending' AND run_at <= now()
        ORDER BY run_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, kind, payload, attempts
    `,
  );
  const rows = (res as { rows?: unknown[] }).rows ?? (res as unknown as unknown[]);
  return rows[0] as
    | { id: string; kind: string; payload: unknown; attempts: number }
    | undefined;
}

async function dispatch(task: { id: string; kind: string; payload: unknown }) {
  switch (task.kind) {
    case "discover": {
      const { discover } = await import("./steps/discover");
      return runStep("discover", task.payload ?? {}, discover);
    }
    default:
      throw new Error(`unknown task kind: ${task.kind}`);
  }
}

export async function enqueue(kind: string, payload?: unknown, runAt?: Date) {
  await db.insert(tasks).values({
    kind,
    payload: (payload ?? {}) as never,
    runAt: runAt ?? new Date(),
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
