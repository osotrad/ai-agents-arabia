--> Enable pgvector before any vector(1536) column is declared.
CREATE EXTENSION IF NOT EXISTS "vector";--> statement-breakpoint
CREATE TYPE "public"."article_status" AS ENUM('draft', 'pending_review', 'published', 'needs_recheck', 'archived');--> statement-breakpoint
CREATE TYPE "public"."article_type" AS ENUM('news', 'glossary', 'summary', 'explainer', 'review');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('running', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'locked', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_step" varchar(64) NOT NULL,
	"input_refs" jsonb,
	"output_refs" jsonb,
	"model" varchar(128),
	"confidence" real,
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "article_sources" (
	"article_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"claim" text NOT NULL,
	CONSTRAINT "article_sources_article_id_source_id_claim_pk" PRIMARY KEY("article_id","source_id","claim")
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(255) NOT NULL,
	"title_ar" text NOT NULL,
	"excerpt_ar" text,
	"body_md" text NOT NULL,
	"body_html" text,
	"type" "article_type" NOT NULL,
	"status" "article_status" DEFAULT 'draft' NOT NULL,
	"confidence_score" real,
	"published_at" timestamp with time zone,
	"recheck_after" timestamp with time zone,
	"embedding" vector(1536),
	"created_by" varchar(16) DEFAULT 'agent' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"what_changed" text NOT NULL,
	"published_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "glossary_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term_ar" varchar(255) NOT NULL,
	"term_en" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"definition_ar" text NOT NULL,
	"source_id" uuid,
	"embedding" vector(1536),
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"body_md" text NOT NULL,
	"changed_by" varchar(16) NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"domain" varchar(255) NOT NULL,
	"title" text,
	"raw_excerpt" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content_hash" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(64) NOT NULL,
	"payload" jsonb,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "article_sources" ADD CONSTRAINT "article_sources_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_sources" ADD CONSTRAINT "article_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corrections" ADD CONSTRAINT "corrections_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "glossary_terms" ADD CONSTRAINT "glossary_terms_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_runs_step_idx" ON "agent_runs" USING btree ("pipeline_step","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "articles_slug_uidx" ON "articles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "articles_status_published_idx" ON "articles" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "corrections_article_idx" ON "corrections" USING btree ("article_id");--> statement-breakpoint
CREATE UNIQUE INDEX "glossary_slug_uidx" ON "glossary_terms" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "revisions_article_idx" ON "revisions" USING btree ("article_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_url_uidx" ON "sources" USING btree ("url");--> statement-breakpoint
CREATE INDEX "sources_domain_idx" ON "sources" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "tasks_pick_idx" ON "tasks" USING btree ("status","run_at");