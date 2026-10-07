CREATE TABLE "contact_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(120) NOT NULL,
  "email" varchar(254) NOT NULL,
  "source_slug" varchar(255),
  "kind" varchar(32) DEFAULT 'agent' NOT NULL,
  "message" text NOT NULL,
  "status" varchar(32) DEFAULT 'new' NOT NULL,
  "ip_hash" varchar(32),
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "contact_requests_created_idx" ON "contact_requests" ("created_at");--> statement-breakpoint
CREATE INDEX "contact_requests_status_idx" ON "contact_requests" ("status");--> statement-breakpoint
CREATE INDEX "contact_requests_ip_idx" ON "contact_requests" ("ip_hash");