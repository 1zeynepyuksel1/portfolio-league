CREATE TABLE "inflation_index" (
	"month" text PRIMARY KEY NOT NULL,
	"tufe_index" numeric(12, 4) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
