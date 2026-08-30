CREATE TYPE "public"."post_scope" AS ENUM('single_asset', 'portfolio');--> statement-breakpoint
CREATE TYPE "public"."post_type" AS ENUM('pnl_share', 'wheel_share', 'horoscope_share');--> statement-breakpoint
CREATE TYPE "public"."post_visibility" AS ENUM('public', 'friends_only');--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "post_type" NOT NULL,
	"scope" "post_scope",
	"payload" jsonb NOT NULL,
	"caption" text,
	"visibility" "post_visibility" DEFAULT 'public' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;