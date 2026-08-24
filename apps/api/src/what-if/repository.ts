import { and, desc, eq, lte, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { assets, inflationIndex, priceHistory } from '../db/schema.js';

// Varlığı sembolüne göre bul
export async function findAssetBySymbol(symbol: string) {
  const [asset] = await db
    .select()
    .from(assets)
    .where(eq(assets.symbol, symbol.toUpperCase()))
    .limit(1);

  return asset;
}

// Belirtilen tarihteki (veya o tarihe en yakın önceki) fiyatı bul
export async function findHistoricalPrice(assetId: string, targetDateStr: string) {
  const endOfDay = new Date(`${targetDateStr}T23:59:59.999Z`);

  const [price] = await db
    .select({
      ts: priceHistory.ts,
      priceTry: priceHistory.priceTry,
    })
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.assetId, assetId),
        lte(priceHistory.ts, endOfDay),
      ),
    )
    .orderBy(desc(priceHistory.ts))
    .limit(1);

  return price;
}

// Varlığın en son canlı fiyatını bul
export async function findLatestPrice(assetId: string) {
  const [price] = await db
    .select({
      ts: priceHistory.ts,
      priceTry: priceHistory.priceTry,
    })
    .from(priceHistory)
    .where(eq(priceHistory.assetId, assetId))
    .orderBy(desc(priceHistory.ts))
    .limit(1);

  return price;
}

// Belirtilen ayın TÜFE endeksini bul (Örn: "2020-03")
export async function findTufeIndex(month: string) {
  const [record] = await db
    .select({
      month: inflationIndex.month,
      tufeIndex: inflationIndex.tufeIndex,
    })
    .from(inflationIndex)
    .where(eq(inflationIndex.month, month))
    .limit(1);

  return record;
}

/**
 * Verilen ay YA DA ondan önceki en yakın ayın TÜFE endeksi.
 *
 * ⚠️ NEDEN GEREKLİ — enflasyon verisi HER ZAMAN GECİKMELİ.
 * TÜİK bir ayın endeksini ertesi ayın 3'ünde açıklıyor. Yani içinde
 * bulunduğun ayın TÜFE'si hiçbir zaman mevcut olmaz; ayın 1'i ile 3'ü
 * arasında bir önceki ayınki de yoktur.
 *
 * Tam eşleşme arasaydık "ya alsaydın" özelliği HER ZAMAN hata verirdi —
 * nitekim veriyordu.
 *
 * `month` metni "YYYY-MM" biçiminde olduğu için sözlük sıralaması takvim
 * sıralamasıyla aynı; `<=` doğru çalışıyor.
 *
 * Aynı desen `findHistoricalPrice`'ta da var: hafta sonu seçilirse en yakın
 * önceki iş gününün fiyatı kullanılıyor.
 */
export async function findTufeIndexOnOrBefore(month: string) {
  const [record] = await db
    .select({
      month: inflationIndex.month,
      tufeIndex: inflationIndex.tufeIndex,
    })
    .from(inflationIndex)
    .where(lte(inflationIndex.month, month))
    .orderBy(desc(inflationIndex.month))
    .limit(1);

  return record;
}

/**
 * TÜM varlıklar için "o günden bugüne kaç kat" — TEK SORGUDA.
 *
 * ⚠️ NEDEN TEK SORGU: ekran 20 varlığın katını aynı anda gösteriyor.
 * Her biri için ayrı `findHistoricalPrice` + `findLatestPrice` çağırsaydık
 * 40 sorgu olurdu (N+1 problemi) ve kullanıcı tarihi her değiştirdiğinde
 * tekrarlanırdı. LATERAL ile hepsi tek turda geliyor.
 *
 * ⚠️ "O TARİH YA DA ÖNCESİ" ARANIYOR, tam eşleşme değil. TCMB hafta sonu
 * kur yayımlamıyor, LBMA da öyle. 14 Mart 2020 (cumartesi) sorulduğunda
 * 13 Mart'ın fiyatı dönüyor — bu forward-fill kuralının aynısı.
 */
export async function findMultiplesForDate(targetDateStr: string): Promise<
  Array<{
    symbol: string;
    name: string;
    kind: string;
    startPriceTry: string;
    currentPriceTry: string;
  }>
> {
  const endOfDay = `${targetDateStr}T23:59:59.999Z`;

  const rows = await db.execute<{
    symbol: string;
    name: string;
    kind: string;
    start_price: string | null;
    current_price: string | null;
  }>(sql`
    SELECT a.symbol, a.name, a.kind, s.start_price, c.current_price
    FROM assets a
    LEFT JOIN LATERAL (
      SELECT price_try AS start_price
      FROM price_history
      WHERE asset_id = a.id AND ts <= ${endOfDay}::timestamp
      ORDER BY ts DESC
      LIMIT 1
    ) s ON true
    LEFT JOIN LATERAL (
      SELECT price_try AS current_price
      FROM price_history
      WHERE asset_id = a.id
      ORDER BY ts DESC
      LIMIT 1
    ) c ON true
    WHERE a.is_active = true
    ORDER BY a.sort_order
  `);

  // Fiyatı eksik olan varlık listeden DÜŞÜYOR, sıfırla doldurulmuyor.
  // "0 kat" diye bir şey yok; bilmiyorsak göstermemeliyiz.
  return rows
    .filter((r) => r.start_price !== null && r.current_price !== null)
    .map((r) => ({
      symbol: r.symbol,
      name: r.name,
      kind: r.kind,
      startPriceTry: r.start_price as string,
      currentPriceTry: r.current_price as string,
    }));
}
