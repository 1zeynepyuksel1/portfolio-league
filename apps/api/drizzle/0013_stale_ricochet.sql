DROP TABLE IF EXISTS "posts" CASCADE;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "allocation_visibility" text DEFAULT 'private' NOT NULL;--> statement-breakpoint
DROP TYPE IF EXISTS "public"."post_scope";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."post_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."post_visibility";