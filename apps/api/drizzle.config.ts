import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  /*
    ⚠️ BU TEK SATIR YÜZÜNDEN `posts` TABLOSU SİLİNDİ — GERÇEKTEN OLDU.

    drizzle-kit migration üretirken şu farkı alıyor:

        (buradan ulaşılabilen şema)  ile  (veritabanının o anki hâli)

    `posts` tablosu `src/posts/schema.ts` içinde tanımlıydı ve o dosyaya
    buradan ULAŞILAMIYORDU. drizzle-kit tabloyu hiç görmedi, veritabanında
    "şemada karşılığı olmayan bir tablo" buldu ve doğru davranışı yaptı:

        DROP TABLE IF EXISTS "posts" CASCADE;   -- 0013_stale_ricochet.sql

    Tablo ve üç enum gitti, `/posts` altındaki her uç 400 döndü, paylaşım
    özelliği tamamen öldü. `0014_recreate_posts` geri getirdi.

    ⚠️ BURASI BİR "OKUMA AYARI" DEĞİL, SİLME YETKİSİ. Buradan görünmeyen
    her tablo, bir sonraki `db:generate`'te silinecek aday demektir.

    ⚠️ ÇÖZÜM BURADA DEĞİL, `db/schema.ts`'İN SONUNDA. Orası artık dış şema
    dosyalarını yeniden dışa aktarıyor (`export * from '../posts/schema.js'`),
    yani drizzle-kit onlara bu tek giriş noktasından ulaşıyor.

    Buraya dosya listesi yazmak da işe yarardı ama İKİ ayrı yer güncel
    tutulurdu. Tek giriş noktası seçildi: yeni bir `pgTable` dosyası açan
    kişi yalnızca `db/schema.ts`'e bir `export *` satırı ekliyor.
  */
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@127.0.0.1:5433/portfolio_league',
  },
});
