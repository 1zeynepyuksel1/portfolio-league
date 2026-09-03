-- Ya Alsaydın paylaşımı. TypeScript şemasına `what_if_share` yazılmıştı,
-- PostgreSQL enum'una eklenmemişti. INSERT enum dışı değerde patlıyor.
--
-- IF NOT EXISTS: geliştirme DB'sine değer elle eklenmiş olabilir.
ALTER TYPE "public"."post_type" ADD VALUE IF NOT EXISTS 'what_if_share';
