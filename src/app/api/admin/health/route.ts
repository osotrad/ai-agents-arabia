import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

/** GET /api/admin/health — agent health dashboard data. */
export async function GET(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (!process.env.ADMIN_API_KEY || key !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  async function q(sqlStr: ReturnType<typeof sql>): Promise<Record<string, unknown>[]> {
    const r = await db.execute(sqlStr);
    return (((r as unknown) as { rows?: Record<string, unknown>[] }).rows
      ?? ((r as unknown) as Record<string, unknown>[]));
  }

  const [published] = await q(sql`SELECT count(*)::int AS n FROM articles WHERE status='published'`);
  const [pending] = await q(sql`SELECT count(*)::int AS n FROM articles WHERE status='pending_review'`);
  const [needsRecheck] = await q(sql`SELECT count(*)::int AS n FROM articles WHERE status='needs_recheck'`);
  const [todayPublished] = await q(sql`SELECT count(*)::int AS n FROM articles WHERE status='published' AND published_at > now() - interval '24 hours'`);
  const [failedTasks] = await q(sql`SELECT count(*)::int AS n FROM tasks WHERE status='failed'`);
  const recentRuns = await q(sql`SELECT pipeline_step AS step, status, confidence, started_at FROM agent_runs ORDER BY started_at DESC LIMIT 20`);

  return NextResponse.json({
    articles: {
      published: published?.n ?? 0,
      pendingReview: pending?.n ?? 0,
      needsRecheck: needsRecheck?.n ?? 0,
      last24h: todayPublished?.n ?? 0,
    },
    tasks: { failed: failedTasks?.n ?? 0 },
    recentRuns,
  });
}
