import { NextRequest, NextResponse } from "next/server";
import { db, articles, agentRuns } from "@/db";
import { desc, eq, sql } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";

function authorized(req: NextRequest) {
  const key = req.headers.get("x-admin-key") ?? new URL(req.url).searchParams.get("key");
  return process.env.ADMIN_API_KEY && key === process.env.ADMIN_API_KEY;
}

/**
 * POST /api/admin/review
 * { articleId, action: "approve" | "reject", reason?: string, edits?: {titleAr?, excerptAr?, bodyMd?} }
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json()) as {
    articleId?: string;
    action?: "approve" | "reject";
    reason?: string;
    edits?: { titleAr?: string; excerptAr?: string; bodyMd?: string };
  };
  if (!body.articleId || !body.action) {
    return NextResponse.json({ error: "articleId and action required" }, { status: 400 });
  }

  const [a] = await db.select().from(articles).where(eq(articles.id, body.articleId)).limit(1);
  if (!a) return NextResponse.json({ error: "article not found" }, { status: 404 });

  if (body.action === "reject") {
    await db.update(articles).set({ status: "archived" }).where(eq(articles.id, a.id));
    await db.insert(agentRuns).values({
      pipelineStep: "human_review",
      inputRefs: { articleId: a.id } as never,
      outputRefs: { action: "reject", reason: body.reason ?? null } as never,
      status: "success",
    });
    return NextResponse.json({ ok: true, status: "archived" });
  }

  // approve (+ optional edits)
  const updates: Record<string, unknown> = {
    status: "published",
    publishedAt: new Date(),
    recheckAfter: new Date(Date.now() + 75 * 24 * 3600 * 1000),
  };
  if (body.edits?.titleAr) updates.titleAr = body.edits.titleAr;
  if (body.edits?.excerptAr) updates.excerptAr = body.edits.excerptAr;
  if (body.edits?.bodyMd) {
    const { marked } = await import("marked");
    updates.bodyMd = body.edits.bodyMd;
    updates.bodyHtml = await marked.parse(body.edits.bodyMd);
    updates.version = a.version + 1;
    await db.insert((await import("@/db/schema")).revisions).values({
      articleId: a.id,
      version: a.version + 1,
      bodyMd: body.edits.bodyMd,
      changedBy: "human",
      reason: body.reason ?? "edit on approval",
    });
  }

  await db.update(articles).set(updates as never).where(eq(articles.id, a.id));
  revalidatePath(`/news/${a.slug}`);
  revalidateTag("articles", "max");
  return NextResponse.json({ ok: true, status: "published", slug: a.slug });
}

/** GET /api/admin/review?status=pending_review — review queue. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const status = new URL(req.url).searchParams.get("status") ?? "pending_review";
  const list = await db
    .select()
    .from(articles)
    .where(eq(articles.status, status as never))
    .orderBy(desc(articles.createdAt))
    .limit(50);

  // lowest-confidence published (for stratified weekly review)
  const lowConf = await db
    .select({ id: articles.id, slug: articles.slug, confidenceScore: articles.confidenceScore })
    .from(articles)
    .where(eq(articles.status, "published"))
    .orderBy(sql`${articles.confidenceScore} ASC NULLS FIRST`)
    .limit(5);

  return NextResponse.json({ queue: list, lowestConfidence: lowConf });
}
