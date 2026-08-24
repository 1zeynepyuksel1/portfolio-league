/**
 * Uydurma tohum fiyatlarını temizler — ELLE ÇALIŞTIRILAN, TEK SEFERLİK BETİK.
 *
 *     npx tsx apps/api/src/market/clean-seed-prices.ts          (sadece sayar)
 *     npx tsx apps/api/src/market/clean-seed-prices.ts --apply  (siler)
 *
 * ⚠️ NEDEN GEREKLİ — SESSİZ BİR VERİ HATASI.
 *
 * seed.ts eskiden BTC/ETH/GRAM_ALTIN/USD için elle yazılmış fiyatları
 * veritabanına koyuyordu. Damgaları `12:00:00Z` idi. Geri doldurma ise
 * gerçek fiyatları `00:00:00Z` ile yazıyor.
 *
 * what-if/repository.ts şunu yapıyor:
 *
 *     WHERE ts <= günSonu  ORDER BY ts DESC  LIMIT 1
 *
 * Aynı günde iki satır varsa 12:00 olan 00:00 olanı YENİYOR. Yani uydurma
 * fiyat gerçeğini eziyordu:
 *
 *     12 Mart 2020 BTC — tohum: 45.200 TL
 *                        gerçek: ~4.970 USD × ~6,28 kur ≈ 31.200 TL
 *
 * "Ya alsaydın" ekranındaki üç hazır düğmenin (2020 Pandemi / 2021 Zirve /
 * 2023 Dip) üçü de bu üç uydurma tarihe denk geliyordu. Yani özelliğin
 * gösterdiği bütün sayılar yanlıştı — ama makul göründükleri için kimse
 * fark etmedi. Para sistemlerinde en tehlikeli hata sınıfı bu.
 *
 * NEDEN AYRI BETİK: seed.ts'ten satırları silmek yeni veritabanlarını
 * korur ama MEVCUT veritabanındaki satırları temizlemez. Bu betik onun için.
 * Bir kez çalıştırılıp silinebilir.
 */

import '../lib/env.js';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { assets, priceHistory } from '../db/schema.js';

/**
 * Tohumun kullandığı üç tarih. Damga her zaman 12:00:00Z idi.
 *
 * ⚠️ ÖLÇÜT SAATE GÖRE, TARİHE GÖRE DEĞİL. Yalnızca tarihe baksaydık aynı
 * günün gerçek 00:00 satırını da silerdik — yani düzeltmek istediğimiz
 * veriyi yok ederdik.
 */
const SEED_TIMESTAMPS = [
  '2020-03-12T12:00:00Z',
  '2021-11-10T12:00:00Z',
  '2023-01-01T12:00:00Z',
];

/** Tohumun dokunduğu varlıklar. Başkasının verisine karışmıyoruz. */
const SEED_SYMBOLS = ['BTC', 'ETH', 'GRAM_ALTIN', 'USD'];

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');

  console.log('Uydurma tohum fiyatlarını temizleme');
  console.log('='.repeat(50));
  console.log(apply ? 'MOD: SİLME' : 'MOD: sadece rapor (silmek için --apply)');

  const rows = await db
    .select({ id: assets.id, symbol: assets.symbol })
    .from(assets)
    .where(inArray(assets.symbol, SEED_SYMBOLS));

  if (rows.length === 0) {
    console.log('\nTohumun dokunduğu varlık bulunamadı — yapacak iş yok.');
    process.exit(0);
  }

  const assetIds = rows.map((r) => r.id);
  const stamps = SEED_TIMESTAMPS.map((t) => new Date(t));

  // --- 1. Sabit tarihli üç uydurma satır ---
  const fixed = and(
    inArray(priceHistory.assetId, assetIds),
    inArray(priceHistory.ts, stamps),
  );

  const fixedRows = await db
    .select({
      symbol: assets.symbol,
      ts: priceHistory.ts,
      priceTry: priceHistory.priceTry,
    })
    .from(priceHistory)
    .innerJoin(assets, eq(assets.id, priceHistory.assetId))
    .where(fixed)
    .orderBy(assets.symbol, priceHistory.ts);

  console.log(`\n[1/2] Sabit tarihli tohum satırları: ${fixedRows.length}`);
  for (const r of fixedRows) {
    console.log(
      `  ${r.symbol.padEnd(11)} ${r.ts.toISOString()}  ${r.priceTry}`,
    );
  }

  // --- 2. `new Date()` ile yazılmış "şu anki" uydurma fiyat ---
  //
  // Bunların damgası tohumun çalıştığı an — sabit değil, bilinmiyor.
  // Ölçüt: gece yarısı OLMAYAN ve cron'un yazmadığı satırlar.
  //
  // ⚠️ Cron da gece yarısı olmayan satırlar yazıyor, onları silemeyiz.
  // Ayırt edici işaret: GRAM_ALTIN ve EUR için cron hiç yazmadı (Binance'te
  // pariteleri yoktu, her turda hata veriyordu). Yani o varlıklarda gece
  // yarısı olmayan HER satır tohumdandır.
  const orphanAssets = rows.filter((r) => r.symbol === 'GRAM_ALTIN');

  let orphanCount = 0;

  if (orphanAssets.length > 0) {
    const orphanIds = orphanAssets.map((r) => r.id);

    const orphanRows = await db
      .select({
        symbol: assets.symbol,
        ts: priceHistory.ts,
        priceTry: priceHistory.priceTry,
      })
      .from(priceHistory)
      .innerJoin(assets, eq(assets.id, priceHistory.assetId))
      .where(
        and(
          inArray(priceHistory.assetId, orphanIds),
          sql`${priceHistory.ts}::time <> '00:00:00'`,
        ),
      );

    orphanCount = orphanRows.length;

    console.log(`\n[2/2] Kaynaksız varlıkların tohum satırları: ${orphanCount}`);
    for (const r of orphanRows) {
      console.log(
        `  ${r.symbol.padEnd(11)} ${r.ts.toISOString()}  ${r.priceTry}`,
      );
    }
  }

  const total = fixedRows.length + orphanCount;

  if (total === 0) {
    console.log('\n✅ Silinecek uydurma satır yok — veritabanı zaten temiz.');
    process.exit(0);
  }

  if (!apply) {
    console.log(`\n${total} satır silinecek. Onaylamak için:`);
    console.log('  npx tsx apps/api/src/market/clean-seed-prices.ts --apply');
    process.exit(0);
  }

  await db.delete(priceHistory).where(fixed);

  if (orphanAssets.length > 0) {
    await db.delete(priceHistory).where(
      and(
        inArray(
          priceHistory.assetId,
          orphanAssets.map((r) => r.id),
        ),
        sql`${priceHistory.ts}::time <> '00:00:00'`,
      ),
    );
  }

  console.log(`\n✅ ${total} uydurma satır silindi.`);
  console.log('Gerçek fiyatlar için: npx tsx apps/api/src/market/price-backfill.ts');
  process.exit(0);
}

main().catch((error) => {
  console.error('Betik çöktü:', error instanceof Error ? error.message : error);
  process.exit(1);
});
