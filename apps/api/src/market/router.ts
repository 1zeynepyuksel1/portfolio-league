import { Router } from "express";
import {
  findAssetIdBySymbol,
  getPriceSeries,
  latestUsdTryRate,
  listAssetsWithLatestPrice,
} from "./repository.js";
import { parseCurrency, tryToUsd } from "../lib/fx.js";
import { PRICE_SCALE, formatScaled, toPrice } from "../lib/money.js";
import {
  isRange,
  parseWindow,
  RANGES,
  specOf,
  startOf,
} from "./ranges.js";

export const marketRouter = Router();

/**
 * GET /assets — işlem görebilir varlıklar ve güncel fiyatları.
 *
 * KARAR: fiyat JSON'a STRING olarak yazılıyor, sayı olarak değil.
 *
 * JSON'da sayı yazarsak JavaScript tarafında `number` olarak okunur ve
 * float'a düşer — money.ts'te kurduğumuz bütün bigint disiplini ağın
 * öbür ucunda çöker. 3069559.70478100 gibi 8 ondalıklı bir değer
 * `number`'a girdiğinde son basamakları sessizce kaybeder.
 *
 * String olarak gönderirsek mobil taraf onu kendi money.ts'ine verip
 * yine bigint olarak işler. Zincir uçtan uca korunur.
 *
 * Zeynep de aynı deseni kullanıyor (bonus/router.ts: amountCents string).
 *
 * KARAR: `asOf` alanı zorunlu.
 *
 * Kullanıcı fiyatın ne kadar taze olduğunu bilmeli. Emir motoru da bu
 * bilgiyi kullanacak: 120 saniyeden eski fiyatla emir kabul edilmeyecek
 * (docs/01-plan.md). Fiyatı gösterip zamanını göstermemek, kullanıcıya
 * eski veriyi güncelmiş gibi sunmak olur.
 */
marketRouter.get("/", async (request, response) => {
  const currency = parseCurrency(request.query.currency);

  if (currency === null) {
    return response.status(400).json({
      error: {
        code: "INVALID_CURRENCY",
        message: "Geçersiz para birimi. Beklenen: try, usd",
      },
    });
  }

  try {
    const assets = await listAssetsWithLatestPrice();

    /**
     * Kur YALNIZCA dolar istendiğinde okunuyor.
     *
     * Her istekte okusaydık TL görünümü — yani varsayılan ve en sık
     * kullanılan yol — bedava bir sorgu daha öderdi.
     */
    const fx = currency === "usd" ? await latestUsdTryRate() : null;

    // ⚠️ Kur yoksa dolar görünümü HESAPLANAMAZ. "1 varsay" demek
    // kullanıcıya TL tutarını dolar diye göstermek olurdu.
    if (currency === "usd" && fx === null) {
      return response.status(503).json({
        error: {
          code: "FX_RATE_UNAVAILABLE",
          message: "Dolar kuru şu an okunamıyor, TL görünümünü kullanın.",
        },
      });
    }

    const rate = fx === null ? null : toPrice(fx.rate);

    return response.json({
      currency,
      // Hangi kurla çevrildiği ve kurun ne kadar taze olduğu görünür olmalı.
      // Fiyatın yanında zamanı göstermeyip "güncel" demek yanıltıcı olur.
      usdTryRate: fx?.rate ?? null,
      rateAsOf: fx?.asOf.toISOString() ?? null,

      assets: assets.map((asset) => ({
        symbol: asset.symbol,
        name: asset.name,
        // Fiyatı hiç çekilmemiş varlık olabilir — null geçilir, uydurulmaz.
        priceTry: asset.priceTry,
        /**
         * ⚠️ AYRI ALAN, AYNI ALANIN ÜZERİNE YAZILMIYOR.
         *
         * `priceTry` alanına dolar yazsaydık alan adı yalan söylerdi ve
         * bu ekranda fark edilmezdi — sayı yine makul görünür. Ayrı alan
         * olunca "hangi para birimi" sorusunun cevabı kodda duruyor.
         */
        priceUsd:
          rate === null || asset.priceTry === null
            ? null
            : formatScaled(tryToUsd(toPrice(asset.priceTry), rate), PRICE_SCALE),
        asOf: asset.asOf?.toISOString() ?? null,
        // Her varlık aynı tarihe gitmiyor: BTC 2017, SOL 2020.
        // Ekran tarih seçicisini buradan sınırlıyor.
        firstAvailable: asset.firstAvailable?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.error("[GET /assets] başarısız:", error);
    return response.status(500).json({ error: "Varlıklar okunamadı" });
  }
});

/**
 * GET /assets/:symbol/prices?range=1d|1w|1m|3m|1y|max — grafik serisi.
 *
 * KARAR: SEYRELTMEYİ SUNUCU YAPIYOR, İSTEMCİ DEĞİL.
 *
 * Ham veriyi gönderip istemcide seyreltmek de mümkündü. Yapmadık çünkü
 * bir aylık aralık ~170.000 satır demek: sorgu, ağ ve telefonun belleği
 * sırayla zorlanır — hem de sonunda 120 nokta çizmek için. Kova mantığı
 * veritabanında, indeksin üstünde çalışıyor.
 *
 * KARAR: İKİ KULLANIM BİÇİMİ — VE İKİNCİSİ SONRADAN EKLENDİ.
 *
 * Başlangıçta `range` bilerek KAPALI bir listeydi: altı sabit aralık
 * ekrandaki altı düğmeye birebir karşılık geliyor ve önbelleklenebilir.
 * Serbest tarih aralığı her istekte farklı olduğu için önbelleklenemez.
 *
 * Yakınlaştırma bu kararı geri aldırdı — kullanıcının seçebileceği
 * pencere sayısı sonsuz, sabit listeyle karşılanamaz. Karşılığında iki
 * koruma kondu (ranges.ts): pencere en az 15 dakika, nokta sayısı en
 * fazla 500. Sınırsız bir uç tek istekle milyonlarca satır okutabilirdi.
 */
marketRouter.get("/:symbol/prices", async (request, response) => {
  const { symbol } = request.params;

  /**
   * İKİ KULLANIM BİÇİMİ, TEK UÇ.
   *
   *   ?range=1m           -> sabit aralık, ekrandaki altı düğme
   *   ?from=...&to=...    -> serbest pencere, YAKINLAŞTIRMA
   *
   * `from`/`to` verilmişse `range` yok sayılıyor. İkisini birden kabul
   * edip birleştirmeye çalışsaydık "hangisi kazanır" sorusu her çağıranda
   * yeniden sorulurdu.
   */
  const zooming =
    request.query.from !== undefined && request.query.to !== undefined;

  const range = request.query.range ?? "1m";

  if (!zooming && !isRange(range)) {
    return response.status(400).json({
      error: {
        code: "INVALID_RANGE",
        message: `Geçersiz aralık. Beklenen: ${RANGES.join(", ")}`,
      },
    });
  }

  const window = zooming
    ? parseWindow(request.query.from, request.query.to)
    : null;

  if (window !== null && !window.ok) {
    return response.status(400).json({
      error: { code: "INVALID_WINDOW", message: window.message },
    });
  }

  try {
    const asset = await findAssetIdBySymbol(symbol);

    if (asset === null) {
      return response.status(404).json({
        error: { code: "ASSET_NOT_FOUND", message: "Varlık bulunamadı." },
      });
    }

    // Kova: serbest pencerede genişlikten hesaplanıyor, sabit aralıkta
    // tablodan geliyor.
    const bucketSeconds =
      window?.ok === true
        ? window.bucketSeconds
        : specOf(range as never).bucketSeconds;

    const since = window?.ok === true ? window.from : startOf(range as never, new Date());
    const until = window?.ok === true ? window.to : null;

    const points = await getPriceSeries(asset.id, bucketSeconds, since, until);

    return response.json({
      symbol: symbol.toUpperCase(),
      name: asset.name,
      range: window?.ok === true ? "custom" : range,
      bucketSeconds,
      // ⚠️ Fiyat STRING. Sayı olarak gönderseydik istemcide float'a düşerdi
      // ve money.ts'ten beri taşıdığımız bigint zinciri son adımda kırılırdı.
      points: points.map((p) => ({
        ts: p.ts.toISOString(),
        priceTry: p.priceTry,
      })),
    });
  } catch (error) {
    console.error(`[GET /assets/${symbol}/prices] başarısız:`, error);
    return response.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Fiyat geçmişi okunamadı." },
    });
  }
});
