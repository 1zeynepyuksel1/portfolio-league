import { Router } from "express";
import {
  findAssetIdBySymbol,
  getPriceSeries,
  listAssetsWithLatestPrice,
} from "./repository.js";
import { isRange, RANGES, specOf, startOf } from "./ranges.js";

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
marketRouter.get("/", async (_request, response) => {
  try {
    const assets = await listAssetsWithLatestPrice();

    return response.json(
      assets.map((asset) => ({
        symbol: asset.symbol,
        name: asset.name,
        // Fiyatı hiç çekilmemiş varlık olabilir — null geçilir, uydurulmaz.
        priceTry: asset.priceTry,
        asOf: asset.asOf?.toISOString() ?? null,
        // Her varlık aynı tarihe gitmiyor: BTC 2017, SOL 2020.
        // Ekran tarih seçicisini buradan sınırlıyor.
        firstAvailable: asset.firstAvailable?.toISOString() ?? null,
      })),
    );
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
 * KARAR: `range` KAPALI BİR LİSTE, serbest tarih aralığı değil.
 *
 * `?from=...&to=...` daha esnek olurdu ama her istek farklı bir kova
 * boyutu gerektirir ve önbelleklemesi imkânsızdır. Altı sabit aralık
 * hem ekrandaki altı düğmeye birebir karşılık geliyor hem de ileride
 * önbelleğe alınabilir.
 */
marketRouter.get("/:symbol/prices", async (request, response) => {
  const { symbol } = request.params;
  const range = request.query.range ?? "1m";

  if (!isRange(range)) {
    return response.status(400).json({
      error: {
        code: "INVALID_RANGE",
        message: `Geçersiz aralık. Beklenen: ${RANGES.join(", ")}`,
      },
    });
  }

  try {
    const asset = await findAssetIdBySymbol(symbol);

    if (asset === null) {
      return response.status(404).json({
        error: { code: "ASSET_NOT_FOUND", message: "Varlık bulunamadı." },
      });
    }

    const { bucketSeconds } = specOf(range);
    const since = startOf(range, new Date());

    const points = await getPriceSeries(asset.id, bucketSeconds, since);

    return response.json({
      symbol: symbol.toUpperCase(),
      name: asset.name,
      range,
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
