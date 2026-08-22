/**
 * TÜFE geri doldurma — ELLE ÇALIŞTIRILAN BETİK.
 *
 *     npx tsx apps/api/src/market/tufe-backfill.ts
 *
 * NEDEN GEREKLİ:
 * `tufe-cron.ts` her ayın 3'ünde çalışıp SADECE O AYI yazıyor. Doğru bir
 * davranış — ama geçmişi doldurmuyor. "Ya alsaydın" özelliği 2020'yi
 * sorduğunda 2020'nin TÜFE endeksine ihtiyaç duyuyor ve tablo boş.
 *
 * Bu betik boşluğu bir kerede kapatıyor: EVDS'den tüm seriyi çekip
 * `inflation_index`'e yazıyor. Sonrasında aylık cron devam ettiriyor.
 *
 * NEDEN VİTEST DEĞİL: gerçek EVDS isteği atıyor ve veritabanına yazıyor.
 * Testlerin dış servise bağımlı olmaması gerekiyor.
 *
 * ⚠️ `EVDS_API_KEY` .env'de tanımlı olmalı. Anahtar bir sırdır:
 * .env gitignore'da, koda gömülmeyecek.
 */

import '../lib/env.js';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { inflationIndex } from '../db/schema.js';
import { fetchTufeFromEvds } from './evds.js';

/**
 * Serinin başlangıcı. TÜFE 2003=100 endeksi 2003'te başlıyor.
 *
 * Neden 2003'ten alıyoruz: "ya alsaydın" en eskiye Binance'in başladığı
 * 2017'ye gidebiliyor, ama seriyi tam almanın maliyeti yok (aylık veri,
 * ~280 gözlem, 1000 sınırının çok altında). Eksik veriyle uğraşmaktansa
 * fazlasını almak daha güvenli.
 */
const START_DATE = '01-01-2003';

function todayAsEvdsDate(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${now.getFullYear()}`;
}

async function main(): Promise<void> {
  console.log('TÜFE geri doldurma');
  console.log('='.repeat(50));

  const endDate = todayAsEvdsDate();
  console.log(`Aralık: ${START_DATE} -> ${endDate}`);

  const items = await fetchTufeFromEvds(START_DATE, endDate);

  if (items.length === 0) {
    console.error('❌ EVDS boş liste döndürdü. Seri kodu ya da tarih aralığı hatalı olabilir.');
    process.exit(1);
  }

  console.log(`EVDS'den ${items.length} aylık gözlem geldi.`);
  console.log(`İlk: ${items[0]?.month} = ${items[0]?.tufeIndex}`);
  console.log(`Son: ${items[items.length - 1]?.month} = ${items[items.length - 1]?.tufeIndex}`);

  const records = items.map((item) => ({
    month: item.month,
    // numeric(12,4) -> string. toFixed(4) ölçeği sabitliyor.
    tufeIndex: item.tufeIndex.toFixed(4),
  }));

  /**
   * `onConflictDoUpdate`, `DoNothing` değil.
   *
   * Sebep: `seed.ts` içinde elle yazılmış bir TÜFE tablosu var ve 2025-2026
   * değerleri UYDURMA (yuvarlak, eşit aralıklı sayılar). DoNothing deseydik
   * o uydurma satırlar yerinde kalır, gerçek veri yazılamazdı — ve reel
   * getiri sessizce yanlış hesaplanmaya devam ederdi.
   *
   * EVDS resmî kaynak; çakışmada o kazanır.
   */
  await db
    .insert(inflationIndex)
    .values(records)
    .onConflictDoUpdate({
      target: inflationIndex.month,
      // `excluded` = PostgreSQL'in "eklenmeye çalışılan satır" için
      // kullandığı özel ad. Çakışmada yeni gelen değeri yaz demek.
      set: { tufeIndex: sql`excluded.tufe_index` },
    });

  console.log(`✅ ${records.length} satır yazıldı (mevcut kayıtlar güncellendi).`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Betik çöktü:', error instanceof Error ? error.message : error);
  process.exit(1);
});
