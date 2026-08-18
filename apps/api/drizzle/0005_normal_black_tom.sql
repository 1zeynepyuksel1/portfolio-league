CREATE TYPE "public"."league_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."portfolio_snapshot_reason" AS ENUM('daily', 'pre_flow', 'post_flow', 'league');--> statement-breakpoint
CREATE TABLE "league_entries" (
	"period_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"start_value_cents" bigint NOT NULL,
	"end_value_cents" bigint NOT NULL,
	"twr_pct" numeric(10, 4) DEFAULT '0.0000' NOT NULL,
	"rank" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "league_entries_period_id_user_id_pk" PRIMARY KEY("period_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "league_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"status" "league_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ts" timestamp DEFAULT now() NOT NULL,
	"total_value_cents" bigint NOT NULL,
	"reason" "portfolio_snapshot_reason" DEFAULT 'daily' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "league_entries" ADD CONSTRAINT "league_entries_period_id_league_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."league_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "league_entries" ADD CONSTRAINT "league_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "snapshot_user_ts_idx" ON "portfolio_snapshots" USING btree ("user_id","ts");