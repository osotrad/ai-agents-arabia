import { db, auditLog } from "@/db";

export type AuditActor = "agent" | "human" | "system";

/**
 * Append one row to the audit trail. Never throws: a failed audit write must
 * not abort the content mutation it is describing.
 */
export async function recordAudit(input: {
  actor: AuditActor;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: unknown;
}): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actor: input.actor,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: (input.metadata ?? null) as never,
    });
  } catch (err) {
    console.error("[audit] failed to record", input.action, err);
  }
}
