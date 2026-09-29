import { db, agentRuns } from "@/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export interface StepResult<T = unknown> {
  output?: T;
  confidence?: number;
}

/**
 * Runs one pipeline step with an audit row in `agent_runs`.
 * Throws on failure after recording it.
 */
export async function runStep<I, O>(
  step: string,
  input: I,
  fn: (input: I) => Promise<StepResult<O>>,
  model?: string,
): Promise<O> {
  const [run] = await db
    .insert(agentRuns)
    .values({
      pipelineStep: step,
      inputRefs: input as never,
      model,
      status: "running",
    })
    .returning();

  const t0 = Date.now();
  try {
    const { output, confidence } = await fn(input);
    await db
      .update(agentRuns)
      .set({
        outputRefs: output as never,
        confidence,
        status: "success",
        finishedAt: new Date(),
      })
      .where(eq(agentRuns.id, run.id));
    logger.info({ step, ms: Date.now() - t0, confidence }, "step ok");
    return output as O;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(agentRuns)
      .set({ error: message, status: "failed", finishedAt: new Date() })
      .where(eq(agentRuns.id, run.id));
    logger.error({ step, ms: Date.now() - t0, err: message }, "step failed");
    throw err;
  }
}
