-- 1. Tüm bağımlı tabloları ve kullanıcı verilerini sıfırla
TRUNCATE TABLE "refresh_tokens" CASCADE;
TRUNCATE TABLE "cash_movements" CASCADE;
TRUNCATE TABLE "orders" CASCADE;
TRUNCATE TABLE "holdings" CASCADE;
TRUNCATE TABLE "portfolio_snapshots" CASCADE;
TRUNCATE TABLE "friendships" CASCADE;
TRUNCATE TABLE "league_entries" CASCADE;
TRUNCATE TABLE "users" CASCADE;

-- 2. Şema kolon değişikliklerini uygula
ALTER TABLE "users" DROP COLUMN IF EXISTS "display_name";
ALTER TABLE "users" ADD COLUMN "first_name" text NOT NULL;
ALTER TABLE "users" ADD COLUMN "last_name" text NOT NULL;
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");
