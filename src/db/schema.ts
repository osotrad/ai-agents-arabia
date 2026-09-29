import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  real,
  primaryKey,
  uniqueIndex,
  index,
  customType,
  jsonb,
} from "drizzle-orm/pg-core";

// pgvector column type
export const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`;
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});

// ---------- Enums ----------
export const articleTypeEnum = pgEnum("article_type", [
  "news",
  "glossary",
  "summary",
  "explainer",
  "review",
]);

export const articleStatusEnum = pgEnum("article_status", [
  "draft",
  "pending_review",
  "published",
  "needs_recheck",
  "archived",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "pending",
  "locked",
  "done",
  "failed",
]);

export const runStatusEnum = pgEnum("run_status", [
  "running",
  "success",
  "failed",
]);

// ---------- Tables ----------

/** External sources the agent reads (feeds, official blogs, papers). */
export const sources = pgTable(
  "sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    url: text("url").notNull(),
    domain: varchar("domain", { length: 255 }).notNull(),
    title: text("title"),
    rawExcerpt: text("raw_excerpt"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    /** Cheap pre-dedupe: sha256 of normalized url. */
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
  },
  (t) => [
    uniqueIndex("sources_url_uidx").on(t.url),
    index("sources_domain_idx").on(t.domain),
  ],
);

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** English slug (transliteration / short translation). */
    slug: varchar("slug", { length: 255 }).notNull(),
    titleAr: text("title_ar").notNull(),
    excerptAr: text("excerpt_ar"),
    bodyMd: text("body_md").notNull(),
    bodyHtml: text("body_html"),
    type: articleTypeEnum("type").notNull(),
    status: articleStatusEnum("status").default("draft").notNull(),
    confidenceScore: real("confidence_score"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** Next automatic freshness recheck date (60–90 days by type). */
    recheckAfter: timestamp("recheck_after", { withTimezone: true }),
    embedding: vector("embedding", { dimensions: 1536 }),
    createdBy: varchar("created_by", { length: 16 })
      .default("agent")
      .notNull(), // agent | human
    version: integer("version").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("articles_slug_uidx").on(t.slug),
    index("articles_status_published_idx").on(t.status, t.publishedAt),
  ],
);

/** Maps each article claim to the source that supports it. Hard gate. */
export const articleSources = pgTable(
  "article_sources",
  {
    articleId: uuid("article_id")
      .references(() => articles.id, { onDelete: "cascade" })
      .notNull(),
    sourceId: uuid("source_id")
      .references(() => sources.id, { onDelete: "cascade" })
      .notNull(),
    /** The specific statement this source supports. */
    claim: text("claim").notNull(),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.sourceId, t.claim] })],
);

/** Audit trail for every agent pipeline step. */
export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pipelineStep: varchar("pipeline_step", { length: 64 }).notNull(),
    inputRefs: jsonb("input_refs"),
    outputRefs: jsonb("output_refs"),
    model: varchar("model", { length: 128 }),
    /** Structured numeric scoring used by gates (0..1). */
    confidence: real("confidence"),
    status: runStatusEnum("status").default("running").notNull(),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("agent_runs_step_idx").on(t.pipelineStep, t.startedAt)],
);

/** Every change to an article is snapshotted — full history. */
export const revisions = pgTable(
  "revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id")
      .references(() => articles.id, { onDelete: "cascade" })
      .notNull(),
    version: integer("version").notNull(),
    bodyMd: text("body_md").notNull(),
    changedBy: varchar("changed_by", { length: 16 }).notNull(), // agent | human
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("revisions_article_idx").on(t.articleId, t.version)],
);

/** Lightweight Postgres job queue (SELECT … FOR UPDATE SKIP LOCKED). */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: varchar("kind", { length: 64 }).notNull(),
    payload: jsonb("payload"),
    status: taskStatusEnum("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    runAt: timestamp("run_at", { withTimezone: true }).defaultNow().notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("tasks_pick_idx").on(t.status, t.runAt)],
);

export const glossaryTerms = pgTable(
  "glossary_terms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    termAr: varchar("term_ar", { length: 255 }).notNull(),
    termEn: varchar("term_en", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    definitionAr: text("definition_ar").notNull(),
    sourceId: uuid("source_id").references(() => sources.id),
    embedding: vector("embedding", { dimensions: 1536 }),
    published: boolean("published").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("glossary_slug_uidx").on(t.slug)],
);

/** Public corrections log — drives article notes + /corrections page. */
export const corrections = pgTable(
  "corrections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    articleId: uuid("article_id")
      .references(() => articles.id, { onDelete: "cascade" })
      .notNull(),
    whatChanged: text("what_changed").notNull(),
    publishedNote: text("published_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("corrections_article_idx").on(t.articleId)],
);
