CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" varchar(32) DEFAULT 'agent' NOT NULL,
	"action" varchar(64) NOT NULL,
	"target_type" varchar(32),
	"target_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "agent_runs" CASCADE;--> statement-breakpoint
DROP TABLE "tasks" CASCADE;--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
DROP TYPE "public"."run_status";--> statement-breakpoint
DROP TYPE "public"."task_status";--> statement-breakpoint
--> Ensure pgvector exists on databases created before this migration, then
--> add an HNSW index so semantic dedupe/search is not a full table scan.
CREATE EXTENSION IF NOT EXISTS "vector";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "articles_embedding_hnsw_idx" ON "articles" USING hnsw ("embedding" vector_cosine_ops);