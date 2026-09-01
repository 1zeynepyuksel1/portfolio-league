DROP TABLE "posts" CASCADE;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "allocation_visibility" text DEFAULT 'private' NOT NULL;--> statement-breakpoint
DROP TYPE "public"."post_scope";--> statement-breakpoint
DROP TYPE "public"."post_type";--> statement-breakpoint
DROP TYPE "public"."post_visibility";