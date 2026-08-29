DO $$ BEGIN
  CREATE TYPE "public"."fortune_category" AS ENUM('main', 'cautious', 'playful', 'asset_specific', 'closing');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."reward_type" AS ENUM('cash', 'bonus_multiplier', 'fee_discount', 'early_unlock', 'fee_free_period', 'avatar_frame', 'badge', 'none');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE "daily_fortunes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"fortune_date" date NOT NULL,
	"asset_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_fortune_user_date_idx" UNIQUE("user_id","fortune_date")
);
--> statement-breakpoint
CREATE TABLE "fortune_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "fortune_category" NOT NULL,
	"text" text NOT NULL,
	"asset_key" text,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "fortune_line_asset_category_check" CHECK (("fortune_lines"."category" = 'asset_specific' AND "fortune_lines"."asset_key" IS NOT NULL)
        OR ("fortune_lines"."category" <> 'asset_specific' AND "fortune_lines"."asset_key" IS NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wheel_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text NOT NULL,
	"reward_type" "reward_type" NOT NULL,
	"reward_value" jsonb,
	"weight" numeric(5, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "wheel_rewards_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wheel_spins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"reward_id" uuid NOT NULL,
	"won_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_fortunes" ADD CONSTRAINT "daily_fortunes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_fortunes" ADD CONSTRAINT "daily_fortunes_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fortune_lines" ADD CONSTRAINT "fortune_lines_asset_key_assets_symbol_fk" FOREIGN KEY ("asset_key") REFERENCES "public"."assets"("symbol") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "wheel_spins" ADD CONSTRAINT "wheel_spins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "wheel_spins" ADD CONSTRAINT "wheel_spins_reward_id_wheel_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."wheel_rewards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX "daily_fortune_user_date_lookup_idx" ON "daily_fortunes" USING btree ("user_id","fortune_date");
