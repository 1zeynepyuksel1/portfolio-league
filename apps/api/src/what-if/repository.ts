import { and, desc, eq, lte } from 'drizzle-orm';
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
