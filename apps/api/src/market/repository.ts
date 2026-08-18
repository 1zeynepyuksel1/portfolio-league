import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { assets, priceHistory } from "../db/schema.js";

export type AssetRow = {
  id: string;
  symbol: string;
  name: string;
};

/** İşlem görebilir durumdaki varlıklar. */
export async function listActiveAssets(): Promise<AssetRow[]> {
  const rows = await db
    .select({
      id: assets.id,
      symbol: assets.symbol,
      name: assets.name,
    })
    .from(assets)
    .where(eq(assets.isActive, true))
    .orderBy(assets.sortOrder);

  return rows;
}

/**
 * Bir fiyat kaydı yazar.
 *
 * `priceTry` NEDEN STRING?
 *
 * Kolon tipi numeric(24,8). Drizzle bu tipi string olarak alıp verir — ve bu
 * tam olarak istediğimiz şey. Zincir hiçbir yerde kırılmıyor:
 *
 *   Binance "63718.01" (string)
 *     -> toPrice()     -> bigint (1e8 ölçekli)
 *     -> usdToTry()    -> bigint
 *     -> formatScaled() -> "3058462.79489100" (string)
 *     -> numeric(24,8)  (veritabanı)
 *
 * Hiçbir adımda `number` kullanılmıyor, dolayısıyla float hatası giremiyor.
 *
 * `onConflictDoNothing`: PK(asset_id, ts) aynı anı iki kez yazmayı engelliyor.
 * Cron iki kez tetiklenirse ikinci yazma sessizce atlanır, hata fırlatmaz.
 * Idempotency'nin veritabanı tarafındaki hâli.
 */
export async function insertPrice(
  assetId: string,
  ts: Date,
  priceTry: string,
): Promise<void> {
  await db
    .insert(priceHistory)
    .values({ assetId, ts, priceTry })
    .onConflictDoNothing();
}

/** Bir varlığın en son yazılmış fiyatı. */
export async function latestPrice(assetId: string) {
  const rows = await db
    .select({ ts: priceHistory.ts, priceTry: priceHistory.priceTry })
    .from(priceHistory)
    .where(eq(priceHistory.assetId, assetId))
    .orderBy(priceHistory.ts)
    .limit(1);

  return rows.at(-1) ?? null;
}
