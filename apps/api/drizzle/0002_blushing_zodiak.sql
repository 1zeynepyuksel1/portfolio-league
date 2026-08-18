CREATE TYPE "public"."asset_kind" AS ENUM('crypto', 'fx', 'metal', 'bist');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"kind" "asset_kind" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assets_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"asset_id" uuid NOT NULL,
	"ts" timestamp NOT NULL,
	"price_try" numeric(24, 8) NOT NULL,
	CONSTRAINT "price_history_asset_id_ts_pk" PRIMARY KEY("asset_id","ts")
);
--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;