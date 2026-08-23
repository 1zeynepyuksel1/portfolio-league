/**
 * Saatlik fiyat geri doldurma — ELLE ÇALIŞTIRILAN BETİK.
 *
 *     npx tsx apps/api/src/market/hourly-backfill.ts
 *     npx tsx apps/api/src/market/hourly-backfill.ts 180   (gün sayısı)
 *
 * ⚠️ NEDEN GEREKLİ — GRAFİK "BOZUK" GÖRÜNÜYORDU, AMA DEĞİLDİ.
 *
 * `price-backfill.ts` GÜNLÜK mum çekiyor: bir gün = bir nokta. Cron ise
 * 15 saniyede bir yazıyor ama yalnızca çalıştığı sürece.
 *
 * Sonuç, ölçüldü (22 Ağu 2026, BTC):
 *
 *     1A aralığı  ->   35 nokta   (olması gereken 120)
 *     1H aralığı  ->   29 nokta   (olması gereken 168)
 *
 * Yani kısa aralıklarda çizgi kırık kırık çıkıyordu. Bu bir çizim hatası
 * değil; elimizde gerçekten o kadar veri vardı. Kozmetik düzeltmeyle
 * geçmez — eksik olan şey nokta.
 *
 * Bu betik son N günün SAATLİK mumlarını çekiyor. 90 günde varlık başına
 * ~2.160 satır; 1A aralığı 120 noktaya, 1H 168'e çıkıyor.
 *
 * ⚠️ YALNIZCA KRİPTO. TCMB ve EVDS günlük kur yayımlıyor, saatlik döviz
 * kuru diye bir şey yok. Dövizin grafiği günlük çözünürlükte kalacak ve
 * bu doğru — kur gün içinde gerçekten değişmiyor.
 */

import '../lib/env.js';
import { type Price, formatScaled, PRICE_SCALE } from '../lib/money.js';
import { usdToTry } from '../lib/fx.js';
import { BinanceAdapter } from './binance.js';
import { fetchFxHistory } from './evds.js';
import { insertPrices, listActiveAssets } from './repository.js';

/** Varsayılan derinlik. 90 gün "3A" aralığını da tam kapsıyor. */
const DEFAULT_DAYS = 90;

const CHUNK_SIZE = 500;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Bitiş tarihi olarak YARIN kullanılıyor.
 *
 * ⚠️ BU BİR HATANIN DÜZELTMESİ — VE ÖLÇÜLDÜ.
 *
 * `getHistory` tarihi "YYYY-MM-DD" alıyor ve içeride `T00:00:00Z` ekliyor.
 * Bitiş olarak BUGÜNÜ verirsek üst sınır bugün gece yarısı olur, yani
 * bugünün saatleri HİÇ çekilmez.
 *
 * İlk çalıştırmada tam bu oldu: "1G" aralığı 67 noktadan 13'e DÜŞTÜ,
 * çünkü elimizdeki en yeni saatlik mum dünkü gece yarısıydı.
 *
 * Yarını vermek zararsız: Binance gelecekteki mumu zaten döndürmüyor.
 */
function endBoundary(now: Date): string {
  return isoDay(new Date(now.getTime() + 24 * 3600 * 1000));
}

/** Kaç gün geriye 5 dakikalık mum çekilecek. */
const FINE_DAYS = 3;

async function main(): Promise<void> {
  const days = Number(process.argv[2] ?? DEFAULT_DAYS);

  if (!Number.isFinite(days) || days <= 0) {
    console.error('Gün sayısı pozitif bir sayı olmalı.');
    process.exit(1);
  }

  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 3600 * 1000);

  console.log(`Saatlik geri doldurma — son ${days} gün`);
  console.log('='.repeat(50));
  console.log(`${isoDay(start)} -> ${isoDay(end)}`);

  // --- Kur haritası ---
  //
  // Saatlik kripto fiyatı USD geliyor; TL'ye çevirmek için o GÜNÜN kuru
  // gerekiyor. Kur günlük olduğu için aynı günün 24 mumu aynı kurla
  // çevriliyor — bu bir yaklaşım değil, kurun gerçek çözünürlüğü.
  console.log('\n[1/2] USD/TRY kuru çekiliyor...');

  const rateItems = await fetchFxHistory(
    'USD',
    start.getUTCFullYear(),
    end.getUTCFullYear(),
  );

  if (rateItems.length === 0) {
    console.error('❌ EVDS kur verisi döndürmedi.');
    process.exit(1);
  }

  // Forward-fill: hafta sonu ve tatilde kur yayımlanmıyor ama kripto
  // 7/24 işlem görüyor. Son iş gününün kuru kullanılıyor.
  const rates = new Map<string, Price>();
  let lastKnown: Price | null = null;

  const published = new Map(rateItems.map((i) => [i.date, i.rate]));
  const cursor = new Date(start);

  while (cursor <= end) {
    const day = isoDay(cursor);
    const todays = published.get(day);

    if (todays !== undefined) lastKnown = todays;
    if (lastKnown !== null) rates.set(day, lastKnown);

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  console.log(`  ${rateItems.length} yayımlanmış -> ${rates.size} güne dolduruldu`);

  // --- Saatlik mumlar ---
  const assets = await listActiveAssets();
  const crypto = assets.filter((a) => a.kind === 'crypto');

  console.log(`\n[2/2] ${crypto.length} kripto (Binance, saatlik)...`);

  const market = new BinanceAdapter();

  for (const asset of crypto) {
    // try/catch DÖNGÜNÜN İÇİNDE — bir varlık patlarsa diğerleri yazılsın.
    try {
      /**
       * İKİ ÇÖZÜNÜRLÜK BİRDEN.
       *
       * Saatlik mumlar 1H/1A/3A aralıklarını besliyor. Ama "1G" aralığının
       * kovası 5 dakika: saatlik veriyle günde yalnızca 24 nokta çıkar,
       * hedef 288.
       *
       * Son üç gün için 5 dakikalık mum da çekiyoruz — kova boyutuyla
       * birebir örtüşen çözünürlük. Daha ince çekmek boşuna olurdu,
       * seyreltme zaten aynı sayıya indirirdi.
       */
      const fineStart = new Date(end.getTime() - FINE_DAYS * 24 * 3600 * 1000);

      const [hourly, fine] = await Promise.all([
        market.getHistory(asset.symbol, isoDay(start), endBoundary(end), '1h'),
        market.getHistory(asset.symbol, isoDay(fineStart), endBoundary(end), '5m'),
      ]);

      const points = [...hourly, ...fine];

      if (points.length === 0) {
        console.warn(`  ${asset.symbol}: veri gelmedi, atlandı`);
        continue;
      }

      let missingRate = 0;
      const rows = [];

      for (const point of points) {
        const rate = rates.get(point.date);

        if (rate === undefined) {
          missingRate++;
          continue;
        }

        rows.push({
          assetId: asset.id,
          /**
           * ⚠️ `point.date` DEĞİL `point.openTime`.
           *
           * `date` yalnızca "YYYY-MM-DD" — saati kırpıyor. Onu kullansaydık
           * bir günün 24 mumu aynı damgaya düşer, birincil anahtar
           * (asset_id, ts) çakışır ve `onConflictDoNothing` yüzünden 23'ü
           * SESSİZCE atılırdı. Hata da alınmazdı; sadece veri gelmezdi.
           */
          ts: new Date(point.openTime),
          priceTry: formatScaled(usdToTry(point.price, rate), PRICE_SCALE),
        });
      }

      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        await insertPrices(rows.slice(i, i + CHUNK_SIZE));
      }

      console.log(
        `  ${asset.symbol}: ${hourly.length} saatlik + ${fine.length} × 5dk` +
          ` = ${rows.length} satır` +
          (missingRate > 0 ? `, ${missingRate} kursuz atlandı` : ''),
      );
    } catch (error) {
      console.error(
        `  ${asset.symbol}: BAŞARISIZ —`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log('\n✅ Saatlik doldurma bitti.');
  console.log('Not: döviz günlük kalıyor — saatlik kur diye bir veri yok.');
  process.exit(0);
}

main().catch((error) => {
  console.error('Betik çöktü:', error instanceof Error ? error.message : error);
  process.exit(1);
});
