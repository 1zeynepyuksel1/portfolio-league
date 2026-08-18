import { desc, eq, sql } from "drizzle-orm";
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
    // desc() ŞART: artan sıralamada limit(1) en ESKİ kaydı verir.
    .orderBy(desc(priceHistory.ts))
    .limit(1);

  return rows[0] ?? null;
}

export type AssetWithPrice = {
  symbol: string;
  name: string;
  priceTry: string | null;
  asOf: Date | null;
};

/**
 * Aktif varlıklar ve her birinin EN GÜNCEL fiyatı — tek sorguda.
 *
 * NEDEN TEK SORGU?
 *
 * Kolay yol şu olurdu: varlıkları çek, sonra her biri için latestPrice çağır.
 * 2 varlıkta 3 sorgu, 50 varlıkta 51 sorgu. Buna N+1 problemi denir ve veri
 * büyüdükçe sessizce yavaşlar — kod doğru görünür, sadece yavaştır.
 *
 * LATERAL JOIN her varlık için "en son fiyat" alt sorgusunu bir kez çalıştırır
 * ve hepsini tek sonuçta döndürür. Fiyatı hiç yazılmamış varlıklar da listede
 * kalır (LEFT JOIN), sadece price_try NULL gelir.
 */
export async function listAssetsWithLatestPrice(): Promise<AssetWithPrice[]> {
  const result = await db.execute<{
    symbol: string;
    name: string;
    price_try: string | null;
    // Ham SQL sonucunda sürücü timestamp'i STRING olarak veriyor
    // ("2026-08-18 09:19:00.17"), Date olarak değil.
    ts: string | Date | null;
  }>(sql`
    SELECT a.symbol, a.name, p.price_try, p.ts
    FROM assets a
    LEFT JOIN LATERAL (
      SELECT price_try, ts
      FROM price_history
      WHERE asset_id = a.id
      ORDER BY ts DESC
      LIMIT 1
    ) p ON true
    WHERE a.is_active = true
    ORDER BY a.sort_order
  `);

  return result.map((row) => ({
    symbol: row.symbol,
    name: row.name,
    priceTry: row.price_try,
    asOf: toUtcDate(row.ts),
  }));
}

/**
 * PostgreSQL timestamp değerini Date'e çevirir.
 *
 * ⚠️ BURASI `timestamp` (timezone'suz) SEÇİMİNİN BEDELİ.
 *
 * Sürücü ham SQL sonucunda "2026-08-18 09:19:00.17" gibi bir string veriyor —
 * içinde saat dilimi bilgisi YOK. `new Date(...)` bunu doğrudan alırsa
 * YEREL saat sanar ve Türkiye'de 3 saat kaydırır. Cron UTC yazdığı için
 * sonda "Z" ekleyerek "bu UTC" demek zorundayız.
 *
 * Kolon `timestamptz` olsaydı bu fonksiyona hiç gerek kalmazdı; sürücü
 * saat dilimini kendisi taşırdı. Öneri Zeynep'e iletildi.
 */
export function toUtcDate(value: string | Date | null): Date | null {
  if (value === null) return null;
  if (value instanceof Date) return value;

  const iso = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
}
