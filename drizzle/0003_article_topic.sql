ALTER TABLE "articles" ADD COLUMN "topic" varchar(64);--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "topic_order" integer;--> statement-breakpoint
CREATE INDEX "articles_topic_idx" ON "articles" ("topic");