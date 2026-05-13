CREATE TABLE "rate_limit_bucket" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"endpoint" text NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rate_limit_key_endpoint_idx" ON "rate_limit_bucket" USING btree ("key","endpoint","erstellt_am");