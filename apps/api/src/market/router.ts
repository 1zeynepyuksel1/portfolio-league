import { Router } from "express";
import { listAssetsWithLatestPrice } from "./repository.js";

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
      })),
    );
  } catch (error) {
    console.error("[GET /assets] başarısız:", error);
    return response.status(500).json({ error: "Varlıklar okunamadı" });
  }
});
