import { PRICE_SCALE, formatScaled } from "../lib/money.js";
import { usdToTry } from "../lib/fx.js";
import { BinanceAdapter } from "./binance.js";
import { TcmbAdapter, type FxRateProvider } from "./tcmb.js";
import type { MarketDataProvider } from "./provider.js";
import { insertPrice, listActiveAssets } from "./repository.js";
import { syncAllLeagueEntriesAndRanks } from "../leagues/twr-engine.js";

/**
 * Fiyat çekme işi.
 *
 * NEDEN CRON, NEDEN İSTEK ANINDA DEĞİL?
 *
 * Dış sağlayıcı kullanıcı isteğinin içinde çağrılmaz (bkz. docs/01-plan.md).
 * Cron periyodik çeker, price_history'ye yazar, API oradan okur. Kazançları:
 *   - Kullanıcı Binance'in yanıt süresini beklemez (ağ isteği yerine tek SELECT)
 *   - Binance düşse bile uygulama çalışmaya devam eder, fiyat sadece eskir
 *   - Tüm kullanıcılar aynı fiyatı görür — lig adaleti bunu gerektiriyor
 *   - Rate limit yemeyiz: kullanıcı sayısından bağımsız, sabit sayıda istek
 */

/** Cron'un bir turunun sonucu — loglamak ve test etmek için. */
export type CronResult = {
  written: number;
  failed: string[];
};

/**
 * Parametre tipleri ARAYÜZ, varsayılan değerleri somut sınıf.
 *
 * `market = new BinanceAdapter()` yazıp tipi belirtmezsek TypeScript
 * parametreyi BinanceAdapter sanır ve başka bir uygulama kabul etmez —
 * arayüz yazmanın amacı boşa gider. Testte sahte bir sağlayıcı veremezdik.
 */
export async function fetchAndStorePrices(
  market: MarketDataProvider = new BinanceAdapter(),
  fx: FxRateProvider = new TcmbAdapter(),
): Promise<CronResult> {
  const assets = await listActiveAssets();
  const result: CronResult = { written: 0, failed: [] };

  if (assets.length === 0) return result;

  // Kur bir kez alınır, tüm varlıklar için kullanılır.
  // Bu çağrı hata verirse tur tamamen iptal olur — TL fiyatı kursuz
  // hesaplanamaz, yarım veri yazmaktansa hiç yazmamak doğru.
  const today = new Date().toISOString().slice(0, 10);
  const rate = await fx.getUsdTry(today);

  const ts = new Date();

  for (const asset of assets) {
    // try/catch DÖNGÜNÜN İÇİNDE, dışında değil.
    // BTC çekilemezse ETH yine yazılmalı. Dışarıda olsaydı ilk hata
    // kalan bütün varlıkları düşürürdü.
    try {
      const point = await market.getLatest(asset.symbol);
      const priceTry = usdToTry(point.price, rate.rate);

      await insertPrice(asset.id, ts, formatScaled(priceTry, PRICE_SCALE));
      result.written++;
    } catch (error) {
      result.failed.push(asset.symbol);
      console.error(
        `[price-cron] ${asset.symbol} alınamadı:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  // Fiyatlar güncellendiyse lig TWR oranlarını ve sıralamayı arka planda senkronize et
  if (result.written > 0) {
    try {
      await syncAllLeagueEntriesAndRanks();
    } catch (err) {
      console.error('[price-cron] TWR senkronizasyon hatası:', err);
    }
  }

  return result;
}
