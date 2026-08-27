/**
 * Fiyat geri doldurma — ELLE ÇALIŞTIRILAN BETİK.
 *
 *     npx tsx apps/api/src/market/price-backfill.ts
 *
 * NEDEN GEREKLİ:
 * `price-cron.ts` yalnızca ÇALIŞMAYA BAŞLADIĞI ANDAN itibaren yazıyor.
 * Veritabanında birkaç günlük veri var. "Ya alsaydın" 2020'yi sorduğunda
 * `price_history` boş dönüyor, fiyat grafiği de üç günlük bir çizgi.
 *
 * Bu betik geçmişi bir kerede dolduruyor. `getHistory` zaten yazılıydı
 * (sayfalama, 1000 mum sınırı, tarih dönüşümü) — onu çağıran yoktu.
 *
 * ÜÇ AŞAMA — ve sıra zorunlu:
 *   1. Döviz: USD/TRY günlük kur geçmişi -> belleğe Map (EVDS, yıl yıl ~10 istek)
 *   2. Kripto: Binance'ten günlük USD -> o günün kuruyla TL'ye çevir -> yaz
 *   3. Maden: LBMA'dan günlük USD/gram -> aynı kurla TL'ye çevir -> yaz
 *
 * Döviz ÖNCE olmak zorunda: kur haritası diğer iki aşamanın girdisi.
 *
 * ⚠️ KUR NEDEN ÖNCE VE TOPLU:
 * Her gün için ayrı TCMB XML isteği atmak ~3.300 istek demekti — dakikalar
 * sürer ve TCMB'yi gereksiz yorar. EVDS aynı veriyi yıl başına tek istekle
 * veriyor.
 *
 * ⚠️ `granularity` KOLONU HENÜZ YOK.
 * Plan bu satırları `granularity='daily'` olarak işaretlemeyi öngörüyordu
 * (docs/01-plan.md §5.1) ama migration gelmedi. Şimdilik günlük satırlar
 * UTC gece yarısına (00:00:00) yazılıyor; cron'un yazdığı anlık satırlar
 * neredeyse hiçbir zaman tam gece yarısına denk gelmiyor. Kolon eklenince
 * bu betik güncellenmeli — aksi hâlde temizlik işi ikisini ayırt edemez.
 */

import '../lib/env.js';
import { type Price, formatScaled, PRICE_SCALE } from '../lib/money.js';
import { usdToTry } from '../lib/fx.js';
import { BinanceAdapter } from './binance.js';
import { LbmaAdapter } from './lbma.js';
import { YahooAdapter } from './yahoo.js';
import { fetchFxHistory } from './evds.js';
import { insertPrices, listActiveAssets, type AssetRow } from './repository.js';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { priceHistory } from '../db/schema.js';
import { toPrice } from '../lib/money.js';

/**
 * Geri doldurmanın başlangıcı — HER ÜÇ KAYNAK İÇİN DE.
 *
 * ⚠️ Bu tarih Binance'in başlangıcı DEĞİL. Binance'in USDT çiftleri
 * 17 Ağustos 2017'de başlıyor; buraya 1 Ocak yazmamızın sebebi kur:
 * kripto çevrimi için USD kur haritasının, ilk mumdan ÖNCE başlaması
 * gerekiyor. Aksi hâlde ilk günler "kursuz" diye atlanırdı.
 *
 * Kaynağın kendi başlangıcı bizi ilgilendirmiyor — her sağlayıcı
 * elindekini veriyor, biz ne geldiyse onu yazıyoruz.
 */
const START_DATE = '2017-01-01';

/** Tek seferde kaç satır yazılacak. Çok büyük INSERT'ler belleği zorlar. */
const CHUNK_SIZE = 500;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Bir satırın damgasından ISO gününü çıkarır ("2020-03-12").
 *
 * ⚠️ NEDEN VAR: rapordaki "ilk -> son" aralığı ÇEKİLEN mumlardan değil,
 * YAZILAN satırlardan türetilmeli. Baştaki ya da sondaki günler kursuz
 * kalıp atlanmış olabilir; çekilen listenin uçlarını raporlarsak log
 * veritabanında bulunmayan bir tarihi "ilk" diye gösterir.
 */
function dayOf(row: { ts: Date } | undefined): string | undefined {
  return row?.ts.toISOString().slice(0, 10);
}

/**
 * Kur listesini "her gün için bir kur" tablosuna çevirir.
 *
 * ⚠️ FORWARD-FILL BURADA.
 * TCMB hafta sonu ve tatilde kur yayımlamıyor, ama kripto 7/24 işlem
 * görüyor. 15 Mart 2020 pazar günü BTC fiyatı var, kur yok. O günü
 * atlarsak veri delik olur; son iş gününün kuruyla dolduruyoruz.
 *
 * Bu kural `tcmb.ts`'te canlı fiyat için zaten vardı — burada geçmiş
 * için aynısını uyguluyoruz. Kuralın iki yerde olması hoş değil; ileride
 * tek bir yardımcıya taşınmalı.
 */
function buildRateMap(
  items: Array<{ date: string; rate: Price }>,
  fromDate: string,
  toDate: string,
): Map<string, Price> {
  const published = new Map<string, Price>();
  for (const item of items) {
    published.set(item.date, item.rate);
  }

  const filled = new Map<string, Price>();
  let lastKnown: Price | null = null;

  const cursor = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);

  while (cursor <= end) {
    const day = cursor.toISOString().slice(0, 10);
    const todaysRate = published.get(day);

    if (todaysRate !== undefined) {
      lastKnown = todaysRate;
    }

    // İlk yayımlanmış kurdan ÖNCEKİ günler boş kalır — doldurulacak
    // bir "önceki değer" yok. O günlerde zaten fiyat da istemiyoruz.
    if (lastKnown !== null) {
      filled.set(day, lastKnown);
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return filled;
}

/** Satırları parça parça yazar. Tek dev INSERT belleği ve sorgu boyutunu zorlar. */
async function writeInChunks(
  rows: Array<{ assetId: string; ts: Date; priceTry: string }>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    // onConflictDoNothing içeride: betik iki kez çalıştırılırsa zararsız.
    await insertPrices(rows.slice(i, i + CHUNK_SIZE));
  }
}

/**
 * Bir DÖVİZ varlığının geçmişini yazar.
 *
 * ⚠️ NEDEN FORWARD-FILL EDİLMİŞ HÂLİ YAZILIYOR (yalnızca yayımlanan günler
 * değil): kripto 7/24 işlem görüyor, TCMB hafta sonu kur yayımlamıyor.
 * Yalnızca iş günlerini yazsaydık, ilerideki "dolar cinsinden göster"
 * özelliği cumartesi günü `btcFiyatı ÷ usdFiyatı` hesabını yapamazdı —
 * bölen o gün yok. Doldurulmuş hâli yazmak bu özel durumu tamamen
 * ortadan kaldırıyor.
 *
 * Doldurma "son iş gününün kuru" demek, uydurma değil — piyasa gerçeği de
 * budur, hafta sonu kur değişmez.
 */
async function backfillFx(
  asset: AssetRow,
  rates: Map<string, Price>,
): Promise<number> {
  const rows = [];

  for (const [date, rate] of rates) {
    rows.push({
      assetId: asset.id,
      ts: new Date(`${date}T00:00:00Z`),
      priceTry: formatScaled(rate, PRICE_SCALE),
    });
  }

  await writeInChunks(rows);
  return rows.length;
}

/** Bir KRİPTO varlığının geçmişini yazar: Binance USD -> o günün kuruyla TL. */
/**
 * Maden geri doldurma — LBMA.
 *
 * ⚠️ KRİPTODAN TEK FARKI: LBMA yalnızca İŞ GÜNÜ yayımlıyor.
 *
 * Kripto 7/24 akıyor, her günün mumu var. LBMA'da hafta sonu ve tatil
 * günleri seride HİÇ YOK — Mart 2020 için 31 değil 22 kayıt geliyor
 * (ölçüldü). Bu bir eksiklik değil, piyasanın kendisi.
 *
 * Boşlukları burada doldurmuyoruz: grafik sorgusu (`getPriceSeries`) kova
 * mantığıyla çalışıyor ve boş kovayı zaten atlıyor. Hafta sonu için yapay
 * satır üretseydik "o gün fiyat vardı" demiş olurduk — olmadı.
 *
 * ⚠️ Kur eşleşmesi de aynı sebeple kaçabilir: LBMA'nın yayımladığı bir gün
 * TCMB'nin tatil olduğu bir güne denk gelebilir (farklı ülkeler, farklı
 * takvimler). O günler `missingRate` olarak sayılıp raporlanıyor.
 */
async function backfillMetal(
  asset: AssetRow,
  usdRates: Map<string, Price>,
  endDate: string,
): Promise<{
  written: number;
  missingRate: number;
  first?: string | undefined;
  last?: string | undefined;
}> {
  const lbma = new LbmaAdapter();
  const points = await lbma.getHistory(asset.symbol, START_DATE, endDate);

  if (points.length === 0) {
    return { written: 0, missingRate: 0 };
  }

  let missingRate = 0;
  const rows = [];

  for (const point of points) {
    const rate = usdRates.get(point.date);

    if (rate === undefined) {
      missingRate++;
      continue;
    }

    rows.push({
      assetId: asset.id,
      ts: new Date(`${point.date}T00:00:00Z`),
      // point.price zaten USD/GRAM — ons çevrimi lbma.ts'te yapıldı.
      priceTry: formatScaled(usdToTry(point.price, rate), PRICE_SCALE),
    });
  }

  await writeInChunks(rows);

  return {
    written: rows.length,
    missingRate,
    first: dayOf(rows[0]),
    last: dayOf(rows[rows.length - 1]),
  };
}

/**
 * ABD hissesi geri doldurma.
 *
 * ⚠️ MADEN AKIŞININ NEREDEYSE AYNISI — ve bu tesadüf değil. Üçü de
 * (kripto, maden, hisse) kaynaktan USD alıp o GÜNÜN kuruyla TL'ye
 * çeviriyor. Ortak fonksiyona indirmedim çünkü farkları küçük ama
 * gerçek: kripto sayfalama istiyor, maden ons çevrimi yapıyor, hisse
 * hiçbirini yapmıyor. Üçünü tek fonksiyona sıkıştırmak parametre
 * bayrakları doğururdu.
 *
 * ⚠️ SAYFALAMA YOK: Yahoo 2017-bugün aralığının 2.425 mumunu TEK yanıtta
 * veriyor (ölçüldü, 265 KB). Binance'te 1000 mum sınırı olduğu için
 * `backfillCrypto` döngü kuruyor; burada gereksiz olurdu.
 *
 * ⚠️ HAFTA SONU BOŞLUĞU BEKLENEN DAVRANIŞ. Hisse yılda ~251 gün işlem
 * görüyor, kripto 365. Yani hisse serisi kripto serisinden seyrek — bu
 * eksik veri değil, piyasanın kendisi.
 */
async function backfillStock(
  asset: AssetRow,
  usdRates: Map<string, Price>,
  endDate: string,
): Promise<{
  written: number;
  missingRate: number;
  first?: string | undefined;
  last?: string | undefined;
}> {
  const yahoo = new YahooAdapter();
  const points = await yahoo.getHistory(asset.symbol, START_DATE, endDate);

  if (points.length === 0) {
    return { written: 0, missingRate: 0 };
  }

  let missingRate = 0;
  const rows = [];

  for (const point of points) {
    const rate = usdRates.get(point.date);

    /**
     * ⚠️ KURSUZ GÜN ATLANIYOR, SIFIRLA DOLDURULMUYOR.
     *
     * `buildRateMap` hafta sonlarını son iş gününden forward-fill ettiği
     * için burası normalde hiç çalışmıyor. Devreye girdiği tek durum:
     * ABD borsasının açık, Türkiye'nin resmî tatilde olduğu bir gün.
     * O günü yazmamak, uydurma kurla yazmaktan doğru.
     */
    if (rate === undefined) {
      missingRate++;
      continue;
    }

    rows.push({
      assetId: asset.id,
      ts: new Date(`${point.date}T00:00:00Z`),
      priceTry: formatScaled(usdToTry(point.price, rate), PRICE_SCALE),
    });
  }

  await writeInChunks(rows);

  return {
    written: rows.length,
    missingRate,
    first: dayOf(rows[0]),
    last: dayOf(rows[rows.length - 1]),
  };
}

async function backfillCrypto(
  asset: AssetRow,
  usdRates: Map<string, Price>,
  endDate: string,
): Promise<{
  written: number;
  missingRate: number;
  // ⚠️ `first?: string` DEĞİL. tsconfig'de exactOptionalPropertyTypes açık:
  // o ayarla "alan hiç olmayabilir" ile "alanın değeri undefined olabilir"
  // farklı şeyler. points boş olduğunda açıkça undefined atıyoruz, o yüzden
  // ikincisi gerekiyor.
  first?: string | undefined;
  last?: string | undefined;
}> {
  const market = new BinanceAdapter();
  const points = await market.getHistory(asset.symbol, START_DATE, endDate);

  if (points.length === 0) {
    return { written: 0, missingRate: 0 };
  }

  let missingRate = 0;
  const rows = [];

  for (const point of points) {
    const rate = usdRates.get(point.date);

    if (rate === undefined) {
      // Kurun başlangıcından önceki günler. Sessizce atlamıyoruz —
      // sonunda sayısını raporluyoruz ki fark edilsin.
      missingRate++;
      continue;
    }

    rows.push({
      assetId: asset.id,
      ts: new Date(`${point.date}T00:00:00Z`),
      priceTry: formatScaled(usdToTry(point.price, rate), PRICE_SCALE),
    });
  }

  await writeInChunks(rows);

  return {
    written: rows.length,
    missingRate,
    first: dayOf(rows[0]),
    last: dayOf(rows[rows.length - 1]),
  };
}

/**
 * `--kind=stock` ile tek bir varlık sınıfını doldurmak.
 *
 * ⚠️ NEDEN GEREKLİ. Betik dört aşamayı da çalıştırınca 8 döviz EVDS'den,
 * 10 kripto Binance'ten sayfalama ile yeniden çekiliyor — dakikalar
 * sürüyor ve satırlar zaten yazılı olduğu için (`onConflictDoNothing`)
 * hiçbir işe yaramıyor.
 *
 * İki somut kullanımı var:
 *   1. Yeni bir varlık sınıfı eklendiğinde (bugün: hisseler)
 *   2. BÖLÜNME sonrası tek sınıfı baştan doldurmak — Yahoo geçmişi
 *      bugünkü hisse adedine göre düzelttiği için yeni bir split
 *      kayıtlı geçmişi geçersiz kılıyor (yahoo.ts'te yazılı).
 *
 * Bayrak verilmezse davranış eskisi gibi: hepsi.
 */
const ONLY_KIND =
  process.argv.find((a) => a.startsWith('--kind='))?.slice('--kind='.length) ??
  null;

function wants(kind: string): boolean {
  return ONLY_KIND === null || ONLY_KIND === kind;
}

async function main(): Promise<void> {
  console.log('Fiyat geri doldurma');
  if (ONLY_KIND !== null) console.log(`Yalnizca: ${ONLY_KIND}`);
  console.log('='.repeat(50));

  const endDate = todayIso();
  const startYear = Number(START_DATE.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));

  const assets = await listActiveAssets();
  const fxAssets = assets.filter((a) => a.kind === 'fx');
  const cryptoAssets = assets.filter((a) => a.kind === 'crypto');
  const metalAssets = assets.filter((a) => a.kind === 'metal');
  const stockAssets = assets.filter((a) => a.kind === 'stock');
  /**
   * Kaynağı olmayan varlıklar.
   *
   * ⚠️ `stock` BU LİSTEYE GİRMEMELİ — 4. aşamada dolduruluyor. Hisseler
   * eklendiğinde filtre güncellenmeseydi betik 30 hisseyi "kaynağı yok"
   * diye raporlardı; hem de doldurduktan HEMEN SONRA. Yanlış rapor,
   * yanlış davranıştan daha uzun yaşar — kimse şüphelenmez.
   */
  const KNOWN_KINDS = new Set(['fx', 'crypto', 'metal', 'stock']);
  const skipped = assets.filter((a) => !KNOWN_KINDS.has(a.kind));

  // --- 1. AŞAMA: döviz ---
  //
  // Döviz ÖNCE geliyor çünkü USD kur haritası kripto çevrimi için gerekli.
  // Aynı veri iki işe yarıyor: hem USD varlığının kendi fiyat geçmişi,
  // hem de bütün kriptoların TL'ye çevrilmesinde kullanılan kur.
  console.log(`\n[1/4] ${fxAssets.length} döviz (EVDS, ${startYear}-${endYear})...`);

  let usdRates: Map<string, Price> | null = null;

  for (const asset of fxAssets) {
    /**
     * ⚠️ USD DAİMA İŞLENİR, `--kind` ne olursa olsun.
     *
     * Kur haritası kripto, maden ve hisse çevriminin tamamının girdisi.
     * `--kind=stock` derken USD'yi atlasaydık harita boş kalır, 30
     * hissenin hepsi "kursuz gün" sayılıp sessizce atlanırdı — betik
     * "0 gün yazıldı" der, sebebi hiçbir yerde görünmezdi.
     *
     * Yalnızca YAZMA atlanıyor (aşağıda), çekme değil.
     */
    if (!wants('fx') && asset.symbol !== 'USD') continue;

    try {
      let items: Array<{ date: string; rate: Price }>;
      if (asset.symbol === 'USD' && !process.env.EVDS_API_KEY) {
        console.log(`  [BACKFILL FALLBACK] EVDS_API_KEY bulunamadı, USD kurları veritabanından okunuyor...`);
        const dbRows = await db
          .select({
            ts: priceHistory.ts,
            priceTry: priceHistory.priceTry,
          })
          .from(priceHistory)
          .where(eq(priceHistory.assetId, asset.id))
          .orderBy(asc(priceHistory.ts));

        items = dbRows.map(r => ({
          date: r.ts.toISOString().slice(0, 10),
          rate: toPrice(r.priceTry),
        }));
      } else {
        items = await fetchFxHistory(asset.symbol, startYear, endYear);
      }

      if (items.length === 0) {
        console.warn(`  ${asset.symbol}: veri bulunamadı, atlandı`);
        continue;
      }

      const filled = buildRateMap(items, START_DATE, endDate);

      if (asset.symbol === 'USD') usdRates = filled;

      // Sadece kur haritasi icin cekildiyse yazma.
      if (!wants('fx')) {
        console.log(`  ${asset.symbol}: kur haritasi icin okundu (yazilmadi)`);
        continue;
      }

      const written = await backfillFx(asset, filled);

      console.log(
        `  ${asset.symbol}: ${items.length} yayımlanmış -> ${written} güne dolduruldu ` +
          `(${items[0]?.date} -> ${items[items.length - 1]?.date})`,
      );
    } catch (error) {
      console.error(
        `  ${asset.symbol}: BAŞARISIZ —`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Kripto TL fiyatı kursuz hesaplanamaz. Yarım veri yazmaktansa durmak doğru.
  if (usdRates === null) {
    console.error('\n❌ USD kuru alınamadı — kripto çevrimi yapılamaz.');
    console.error('   USD varlığının aktif olduğundan ve EVDS anahtarından emin ol.');
    process.exit(1);
  }

  // --- 2. AŞAMA: kripto ---
  console.log(`\n[2/4] ${cryptoAssets.length} kripto (Binance)...`);

  if (wants('crypto')) {
  for (const asset of cryptoAssets) {
    try {
      const r = await backfillCrypto(asset, usdRates, endDate);

      if (r.written === 0 && r.missingRate === 0) {
        console.warn(`  ${asset.symbol}: veri gelmedi, atlandı`);
        continue;
      }

      console.log(
        `  ${asset.symbol}: ${r.written} gün yazıldı (${r.first} -> ${r.last})` +
          (r.missingRate > 0 ? `, ${r.missingRate} gün kursuz atlandı` : ''),
      );
    } catch (error) {
      console.error(
        `  ${asset.symbol}: BAŞARISIZ —`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // --- 3. AŞAMA: maden ---
  }

  if (wants('metal') && metalAssets.length > 0) {
    console.log(`
[3/4] ${metalAssets.length} maden (LBMA)...`);

    for (const asset of metalAssets) {
      try {
        const r = await backfillMetal(asset, usdRates, endDate);

        if (r.written === 0) {
          console.warn(`  ${asset.symbol}: veri gelmedi, atlandı`);
          continue;
        }

        console.log(
          `  ${asset.symbol}: ${r.written} gün yazıldı (${r.first} -> ${r.last})` +
            (r.missingRate > 0 ? `, ${r.missingRate} gün kursuz atlandı` : ''),
        );
      } catch (error) {
        console.error(
          `  ${asset.symbol}: BAŞARISIZ —`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  // --- 4. AŞAMA: ABD hisseleri ---
  if (wants('stock') && stockAssets.length > 0) {
    console.log(`
[4/4] ${stockAssets.length} ABD hissesi (Yahoo)...`);

    for (const asset of stockAssets) {
      try {
        const r = await backfillStock(asset, usdRates, endDate);

        if (r.written === 0) {
          console.warn(`  ${asset.symbol}: veri gelmedi, atlandı`);
          continue;
        }

        console.log(
          `  ${asset.symbol}: ${r.written} gün yazıldı (${r.first} -> ${r.last})` +
            (r.missingRate > 0 ? `, ${r.missingRate} gün kursuz atlandı` : ''),
        );
      } catch (error) {
        console.error(
          `  ${asset.symbol}: BAŞARISIZ —`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  if (skipped.length > 0) {
    console.log(
      `\nAtlanan (kaynağı yok): ${skipped.map((a) => a.symbol).join(', ')}`,
    );
  }

  console.log('\n✅ Geri doldurma bitti.');
  process.exit(0);
}

main().catch((error) => {
  console.error('Betik çöktü:', error instanceof Error ? error.message : error);
  process.exit(1);
});
