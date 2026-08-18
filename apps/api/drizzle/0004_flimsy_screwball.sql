CREATE TYPE "public"."order_side" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TABLE "holdings" (
	"user_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"quantity" numeric(28, 10) NOT NULL,
	CONSTRAINT "holdings_user_id_asset_id_pk" PRIMARY KEY("user_id","asset_id"),
	CONSTRAINT "quantity_non_negative" CHECK ("holdings"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"side" "order_side" NOT NULL,
	"quantity" numeric(28, 10) NOT NULL,
	"price_try" numeric(24, 8) NOT NULL,
	"gross_cents" bigint NOT NULL,
	"fee_cents" bigint NOT NULL,
	"net_cents" bigint NOT NULL,
	"note" text,
	"idempotency_key" text NOT NULL,
	"executed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_idempotency_idx" UNIQUE("user_id","idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "cash_cents_non_negative" CHECK ("accounts"."cash_cents" >= 0);