import { PRICE_SCALE, formatScaled } from "../lib/money.js";
import { usdToTry } from "../lib/fx.js";
import { BinanceAdapter } from "./binance.js";
import { LbmaAdapter } from "./lbma.js";
import { TcmbAdapter, type FxRateProvider } from "./tcmb.js";
import { YahooAdapter } from "./yahoo.js";
import { isRegularSessionOpen } from "./market-hours.js";
import type { MarketDataProvider } from "./provider.js";
import { insertPrice, listActiveAssets } from "./repository.js";

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
  /**
   * Bilerek atlanan varlık sayısı — HATA DEĞİL.
   *
   * `failed` ile karıştırılmamalı: orası "denedik, olmadı" demek ve
   * log'a uyarı basılıyor. Burası "hiç denemedik, gerek yoktu" demek.
   * Tek kaynağı şu an hisseler: piyasa kapalıyken ya da 60 saniyelik
   * kadans dolmadan Yahoo'ya sorulmuyor.
   *
   * Ayrı sayılmasa hisseler ya sahte hata üretirdi ya da hiç görünmezdi.
   */
  skipped: number;
};

/**
 * Hisselerin kendi kadansı: 60 saniye.
 *
 * ⚠️ NEDEN 15 SANİYELİK TURA GİRMİYORLAR.
 *
 * Yahoo çoklu sembol ucunu kapatmış (401), yani sembol başına bir istek.
 * 30 hisse × dakikada 4 tur = dakikada 120 istek, seans boyunca günde
 * ~47.000. Resmi API olmadığı için yayımlanmış limit yok — o hacim
 * engellenme riski demek.
 *
 * 60 saniyede: günde ~11.700 istek. Tazelik açısından kayıp yok, çünkü
 * emir motorundaki hisse bayatlık sınırı 300 saniye (5 tur pay).
 */
const STOCK_INTERVAL_MS = 60_000;

/**
 * Son hisse turunun zamanı.
 *
 * ⚠️ MODÜL DÜZEYİNDE DEĞİŞKEN — `scheduler.ts`'teki `running` bayrağıyla
 * aynı desen. Alternatifi her turda veritabanına "bu varlığın son fiyatı
 * ne zaman yazıldı" diye sormaktı: 30 hisse için 30 fazla sorgu, hem de
 * sadece atlayıp atlamayacağımıza karar vermek için.
 */
let lastStockRoundAt = 0;

/** Test için: hisse kadans sayacını sıfırlar. */
export function resetStockSchedule(): void {
  lastStockRoundAt = 0;
}

/**
 * Parametre tipleri ARAYÜZ, varsayılan değerleri somut sınıf.
 *
 * `market = new BinanceAdapter()` yazıp tipi belirtmezsek TypeScript
 * parametreyi BinanceAdapter sanır ve başka bir uygulama kabul etmez —
 * arayüz yazmanın amacı boşa gider. Testte sahte bir sağlayıcı veremezdik.
 */
/**
 * Kaynağın kendi yayın tarihi en fazla kaç gün geride olabilir.
 *
 * ⚠️ BU, `MAX_PRICE_AGE_MS` (120 sn) İLE AYNI ŞEY DEĞİL — VE FARK ÖNEMLİ.
 *
 * `MAX_PRICE_AGE_MS` satırın `ts` alanına bakıyor: "bu kaydı ne zaman
 * YAZDIK". Cron her 15 saniyede bir taze damgayla yazdığı için o kontrol
 * madenlerde ve dövizde her zaman geçer — değer cumadan kalma olsa bile.
 *
 * Yani tazelik kontrolü doğru soruyu sormuyor. Doğru soru: "kaynak bu
 * fiyatı ne zaman YAYIMLADI". LBMA cuma yayımlayıp pazartesi susarsa,
 * bu kontrol olmadan cron cumanın fiyatını sonsuza kadar taze damgayla
 * yazmaya devam eder ve kimse fark etmez.
 *
 * 10 gün: TCMB tarafındaki `MAX_LOOKBACK_DAYS` ile aynı sayı, aynı
 * gerekçe — hafta sonu 2 gün, dini bayram arifeyle 9 güne çıkabiliyor.
 */
const MAX_SOURCE_AGE_DAYS = 10;

function daysBetween(fromIso: string, toIso: string): number {
  const ms = Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export async function fetchAndStorePrices(
  market: MarketDataProvider = new BinanceAdapter(),
  fx: FxRateProvider = new TcmbAdapter(),
  metal: MarketDataProvider = new LbmaAdapter(),
  stock: MarketDataProvider = new YahooAdapter(),
): Promise<CronResult> {
  const assets = await listActiveAssets();
  const result: CronResult = { written: 0, failed: [], skipped: 0 };

  if (assets.length === 0) return result;

  // USD kuru bir kez alınır, tüm KRİPTO varlıklar için kullanılır.
  // Bu çağrı hata verirse tur tamamen iptal olur — TL fiyatı kursuz
  // hesaplanamaz, yarım veri yazmaktansa hiç yazmamak doğru.
  const today = new Date().toISOString().slice(0, 10);
  const usdRate = await fx.getUsdTry(today);

  const ts = new Date();

  /**
   * Hisse turu bu turda çalışacak mı — DÖNGÜDEN ÖNCE, BİR KEZ.
   *
   * ⚠️ Kararı döngü içinde verseydik 30 hissenin her biri için ayrı
   * `Date.now()` okunur ve kadans penceresi hisseler arasında kayardı:
   * ilk hisse turu başlatır, sonrakiler "daha 60 saniye olmadı" der ve
   * her turda sadece bir hisse güncellenirdi. Sessiz ve bulunması zor.
   */
  const stocksDue =
    isRegularSessionOpen() && Date.now() - lastStockRoundAt >= STOCK_INTERVAL_MS;

  if (stocksDue) lastStockRoundAt = Date.now();

  for (const asset of assets) {
    // try/catch DÖNGÜNÜN İÇİNDE, dışında değil.
    // BTC çekilemezse ETH yine yazılmalı. Dışarıda olsaydı ilk hata
    // kalan bütün varlıkları düşürürdü.
    try {
      // ⚠️ VARLIK TÜRÜ KAYNAĞI BELİRLER.
      // Eskiden her varlık Binance'e soruluyordu; USD ve EUR'un Binance'te
      // paritesi olmadığı için üç varlık her turda hata basıyordu.
      let priceTry;

      if (asset.kind === 'fx') {
        // Döviz zaten TL cinsinden geliyor, çevrim gerekmiyor.
        priceTry = (await fx.getRate(asset.symbol, today)).rate;
      } else if (asset.kind === 'metal') {
        /**
         * Maden LBMA'dan USD/gram geliyor — kripto ile aynı boru hattı,
         * aynı kurla TL'ye çevriliyor.
         *
         * ⚠️ Farkı: LBMA günde BİR kez ve yalnızca iş günü yayımlıyor.
         * Kripto 7/24 akıyor. Bu yüzden aşağıdaki tarih kontrolü var,
         * kriptoda yok — kriptoda gerekmiyor.
         */
        const point = await metal.getLatest(asset.symbol);
        const age = daysBetween(point.date, today);

        if (age > MAX_SOURCE_AGE_DAYS) {
          throw new Error(
            `${asset.symbol}: kaynağın son yayını ${point.date}, ${age} gün eski`,
          );
        }

        priceTry = usdToTry(point.price, usdRate.rate);
      } else if (asset.kind === 'stock') {
        /**
         * ⚠️ PİYASA KAPALIYKEN HİÇ SORULMUYOR — ve bu sadece istek
         * tasarrufu değil, DEPOLAMA kararı.
         *
         * Yahoo kapalıyken son kapanışı döndürüyor. Yazsaydık her tur
         * AYNI fiyatı yeni bir damgayla kaydederdik: hafta sonu 30 hisse
         * × 2 gün × dakikada bir = ~86.000 satır, hepsi aynı bilgiyi
         * taşıyan kopya. Grafik de bozulurdu — düz bir çizgi, sanki
         * fiyat gerçekten sabit kalmış gibi.
         *
         * Yazmayınca son satır cuma kapanışı olarak kalıyor; portföy
         * değeri ondan hesaplanıyor (doğru), emir ise `MARKET_CLOSED`
         * ile reddediliyor (orders/repository.ts).
         */
        if (!stocksDue) {
          result.skipped++;
          continue;
        }

        // Hisse de USD geliyor — kripto ile birebir aynı boru hattı.
        priceTry = usdToTry((await stock.getLatest(asset.symbol)).price, usdRate.rate);
      } else {
        // Kripto USD geliyor, o günün kuruyla TL'ye çevriliyor.
        priceTry = usdToTry((await market.getLatest(asset.symbol)).price, usdRate.rate);
      }

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

  return result;
}
