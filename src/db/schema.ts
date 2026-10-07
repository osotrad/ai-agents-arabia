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
    /**
     * Optional header image for the article, held in Neon Object Storage.
     * Rendered by the page component — never injected into `bodyMd`, so the
     * markdown sanitizer never sees it.
     */
    imageUrl: text("image_url"),
    /** Arabic alt text. Required in practice: the site is RTL prose. */
    imageAlt: text("image_alt"),
    /**
     * Optional editorial series slug (e.g. "langchain"). Powers the
     * /topics/[topic] hub pages, which list their members in reading order
     * via `topicOrder`. Null means the article belongs to no series.
     */
    topic: varchar("topic", { length: 64 }),
    /** Position within the series. Null = use publishedAt order. */
    topicOrder: integer("topic_order"),
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

/**
 * Append-only audit trail for every content mutation, from any actor
 * (external agent via the Content API / MCP, or a human reviewer).
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Who performed the action: "agent" | "human" | "system". */
    actor: varchar("actor", { length: 32 }).notNull().default("agent"),
    /** Verb, e.g. "article.create", "article.publish", "glossary.upsert". */
    action: varchar("action", { length: 64 }).notNull(),
    /** Kind of target, e.g. "article" | "glossary_term" | "correction". */
    targetType: varchar("target_type", { length: 32 }),
    targetId: uuid("target_id"),
    /** Free-form structured context (request summary, diff, reasons). */
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("audit_log_action_idx").on(t.action, t.createdAt),
    index("audit_log_target_idx").on(t.targetType, t.targetId),
  ],
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

/**
 * Leads from the public /contact page.
 *
 * This is the site's only unauthenticated *write* path, so it is also the
 * only spam surface. Defences live in `POST /api/v1/contact`: a honeypot
 * field, a per-IP rate limit, and a length cap. Captcha is deliberately
 * absent — it adds a third-party dependency and a key to rotate for a form
 * that should receive a handful of legitimate leads, not scale.
 *
 * `status` is read only from the admin surface; nothing here auto-publishes.
 */
export const contactRequests = pgTable(
  "contact_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 254 }).notNull(),
    /** Which article's CTA brought them in, for attribution. */
    sourceSlug: varchar("source_slug", { length: 255 }),
    kind: varchar("kind", { length: 32 }).notNull().default("agent"),
    message: text("message").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("new"),
    /**
     * Salted SHA-256 of the submitter's IP, used only to count submissions
     * per hour. Nullable and never rendered: a marked row carries no message.
     */
    ipHash: varchar("ip_hash", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("contact_requests_created_idx").on(t.createdAt),
    index("contact_requests_status_idx").on(t.status),
    index("contact_requests_ip_idx").on(t.ipHash),
  ],
);
