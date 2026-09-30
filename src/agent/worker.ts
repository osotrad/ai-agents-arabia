import { db, tasks } from "@/db";
import { eq, sql } from "drizzle-orm";
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
    case "pipeline": {
      return runPipeline(task.payload as { sourceIds?: string[] });
    }
    case "recheck": {
      const { recheckSweep } = await import("./steps/recheck");
      return runStep("recheck", task.payload ?? {}, recheckSweep);
    }
    case "glossary": {
      const { glossaryStep } = await import("./steps/glossary");
      const payload = task.payload as { term?: string; sourceId?: string };
      if (!payload.term) throw new Error("glossary task requires payload.term");
      return runStep("glossary", payload as { term: string; sourceId?: string }, glossaryStep);
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

async function runPipeline(payload: { sourceIds?: string[] }) {
  const { dedupe, draft, verify, publish } = await import("./steps/draft");
  const { runStep } = await import("./run-step");

  // If no sourceIds provided, take latest unseen candidates
  let sourceIds = payload.sourceIds;
  if (!sourceIds || sourceIds.length === 0) {
    const { sources } = await import("@/db/schema");
    const { desc } = await import("drizzle-orm");
    const rows = await db.select({ id: sources.id }).from(sources).orderBy(desc(sources.fetchedAt)).limit(3);
    sourceIds = rows.map((r) => r.id);
  }
  if (sourceIds.length < 2) throw new Error("pipeline needs ≥2 sources");

  // 1) dedupe against published embeddings on the candidate title area
  const titleProbe = sourceIds.join("|");
  const dd = await runStep("dedupe", { sourceIds }, async () => {
    const r = await dedupe(titleProbe);
    return { output: r, confidence: r.duplicate ? 0.2 : 0.8 };
  });
  if (dd.duplicate) {
    logger.info({ similarity: dd.similarity }, "skipping duplicate topic");
    return { skipped: true, reason: "duplicate" };
  }

  // 2) draft
  const d = await runStep("draft", { sourceIds }, () => draft(sourceIds!));

  // 3) verify
  const v = await runStep("verify", { sourceIds }, () => verify(d, sourceIds!));
  if (!v.pass) {
    throw new Error(`verify failed: ${v.reasons.join("; ")}`);
  }

  // 4) publish
  const p = await runStep("publish", { sourceIds }, async () => {
    const out = await publish(d, sourceIds!);
    return { output: out, confidence: 0.9 };
  });
  return { skipped: false, articleId: p.articleId, slug: p.slug };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
