import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  /*
    ⚠️ BURASI TEK DOSYAYKEN `posts` TABLOSU SİLİNDİ — GERÇEKTEN OLDU.

    drizzle-kit migration üretirken şu farkı alıyor:

        (bu listede tanımlı şema)  ile  (veritabanının o anki hâli)

    `posts` tablosu `src/posts/schema.ts` içinde tanımlıydı ama bu liste
    yalnızca `src/db/schema.ts`'i gösteriyordu. drizzle-kit tabloyu HİÇ
    GÖRMEDİ, dolayısıyla veritabanında "şemada karşılığı olmayan bir tablo"
    buldu ve doğru davranışı yaptı: `DROP TABLE "posts" CASCADE`.

    Sonuç `0013_stale_ricochet.sql`'in ilk satırında duruyor. Tablo ve üç
    enum gitti, `/posts` altındaki her uç 400 dönmeye başladı, paylaşım
    özelliği tamamen öldü.

    ⚠️ DERS: BU LİSTE BİR "OKUMA AYARI" DEĞİL, SİLME YETKİSİ.
    Buraya eklenmeyen her tablo, bir sonraki `db:generate`'te silinecek
    aday demektir. Yeni bir `pgTable` dosyası açan herkes aynı anda
    burayı da güncellemek zorunda.

    Alternatif: tüm tabloları `src/db/schema.ts`'te toplamak. O zaman bu
    liste tek elemanlı kalır ve unutma riski ortadan kalkar. Dosyayı
    bölmeyi seçtiysek, bedeli bu listeyi güncel tutmak.
  */
  schema: ['./src/db/schema.ts', './src/posts/schema.ts'],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@127.0.0.1:5433/portfolio_league',
  },
});
