import { Router } from "express";
import {
  findAssetIdBySymbol,
  getDailyStats,
  getPriceSeries,
  latestUsdTryRate,
  listAssetsWithLatestPrice,
} from "./repository.js";
import { parseCurrency, tryToUsd } from "../lib/fx.js";
import { isTradableNow } from "./market-hours.js";
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
 * Yüzde değişim: (yeni − eski) ÷ eski × 100.
 *
 * ⚠️ BURADA `Number` SERBEST — VE SINIRI BİLİNMELİ.
 *
 * Projenin kuralı "para bigint, float yasak". Bu kural PARA için: tutar,
 * bakiye, fiyat. Yüzde para değil, bir ORAN — ve zaten iki ondalığa
 * yuvarlanıp ekranda gösteriliyor. Float'ın 15 anlamlı basamağı bunun
 * için fazlasıyla yeterli.
 *
 * Sınır şurada: bu sayıyla asla bir tutar hesaplanmayacak. Hesaplansaydı
 * kural gerçekten kırılırdı.
 */
function changePercent(
  current: string | null,
  previous: string | null,
): string | null {
  if (current === null || previous === null) return null;

  const now = Number(current);
  const before = Number(previous);

  // Sıfıra bölme: fiyatı 0 olan bir kayıt teorik olarak mümkün.
  if (!Number.isFinite(now) || !Number.isFinite(before) || before === 0) {
    return null;
  }

  return (((now - before) / before) * 100).toFixed(2);
}

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
        // Ekrandaki Kripto/Döviz/Metal filtresi bunu kullanıyor.
        // Sembolden çıkarım yapmak ("GRAM_ ile başlıyorsa maden")
        // kırılgan olurdu: farklı adlandırılmış bir varlık sessizce
        // yanlış kutuya düşerdi.
        kind: asset.kind,
        /**
         * Varlık şu an işlem görebiliyor mu.
         *
         * ⚠️ EKRAN BUNU KENDİ HESAPLAMASIN DİYE SUNUCUDAN GELİYOR.
         * İstemci de New York saatini hesaplayabilirdi ama o zaman aynı
         * kural iki yerde yaşardı: telefonun saati yanlışsa (ya da
         * kullanıcı bilerek değiştirdiyse) ekran "açık" der, sunucu
         * reddederdi. Kullanıcı düğmeye basıp anlamadığı bir hata alırdı.
         *
         * ⚠️ HİSSE DIŞINDAKİLER İÇİN HER ZAMAN `true`. Kripto 7/24;
         * döviz ve maden hafta sonu yeni fiyat almasa da son fiyattan
         * işlem görmeye devam ediyor (forward-fill kuralı). Yani bu alan
         * "seansı olan varlık sınıfı" için anlamlı, diğerleri için sabit.
         */
        tradable: isTradableNow(asset.kind),
        /**
         * Son 24 saatteki yüzde değişim, iki ondalıklı metin.
         *
         * ⚠️ SUNUCUDA HESAPLANIYOR, EKRANDA DEĞİL. İstemciye iki fiyat
         * gönderip orada bölmek de olurdu ama o bölme `Number` ile
         * yapılırdı — bigint zincirinin son halkası orada kırılırdı.
         *
         * ⚠️ `null` "değişim yok" DEĞİL, "bilinmiyor". Sıfır göndermek
         * "fiyat hiç kıpırdamadı" iddiası olurdu; oysa 24 saat önceki
         * kaydımız yok.
         */
        changePercent24h: changePercent(asset.priceTry, asset.priceTry24hAgo),
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
/**
 * GET /assets/:symbol/stats — son 24 saatin özeti.
 *
 * Varlık detay ekranındaki "24 SAAT" bloğunu besliyor: yüksek, düşük,
 * açılış, kapanış.
 *
 * ⚠️ AYRI UÇ, `/assets` LİSTESİNE EKLENMEDİ. Liste 20 varlık için 5
 * saniyede bir çekiliyor; bu hesabı oraya koysaydık her turda 20 ayrı
 * 24 saatlik tarama yapılırdı. Detay ekranı ise tek varlık ve tek
 * açılışta bir kez soruyor.
 */
marketRouter.get("/:symbol/stats", async (request, response) => {
  const { symbol } = request.params;

  const currency = parseCurrency(request.query.currency);

  if (currency === null) {
    return response.status(400).json({
      error: { code: "INVALID_CURRENCY", message: "Geçersiz para birimi." },
    });
  }

  try {
    const asset = await findAssetIdBySymbol(symbol);

    if (asset === null) {
      return response.status(404).json({
        error: { code: "ASSET_NOT_FOUND", message: "Varlık bulunamadı." },
      });
    }

    const stats = await getDailyStats(asset.id);

    /**
     * ⚠️ 24 SAAT ÖZETİ BURADA GÜNCEL KURLA ÇEVRİLİYOR — ve bu DOĞRU.
     *
     * Grafikte her noktaya o anın kuru uygulanıyor çünkü aylar öncesine
     * gidiyor. Burada pencere yalnızca 24 SAAT; kur gün içinde zaten
     * değişmiyor (TCMB günde bir yayımlıyor). Aynı özeni göstermek
     * dört ayrı kur araması demekti, karşılığı sıfır.
     */
    const fx = currency === "usd" ? await latestUsdTryRate() : null;

    if (currency === "usd" && fx === null) {
      return response.status(503).json({
        error: {
          code: "FX_UNAVAILABLE",
          message: "Dolar kuru bulunamadı, TL görünümünü kullanın.",
        },
      });
    }

    const conv = (value: string | null | undefined): string | null => {
      if (value === null || value === undefined) return null;
      if (fx === null) return value;

      return formatScaled(
        tryToUsd(toPrice(value), toPrice(fx.rate)),
        PRICE_SCALE,
      );
    };

    return response.json({
      symbol: symbol.toUpperCase(),
      currency,
      /*
        ⚠️ `tradable` BU UCA DA EKLENDİ — VE SEBEBİ TEKRAR EDEN BİR ŞEKİL.

        Ayrım `/assets` listesinde vardı, detay ekranında yoktu; o
        yüzden varlık detayı borsa kapalıyken "16 sa" yazıyordu ve
        arıza gibi görünüyordu. Aynı düzeltmeyi bugün cüzdanda da
        yapmak gerekti.

        Kural tek yerde (`isTradableNow`), ama onu ÇAĞIRMAYI her uçta
        ayrı ayrı hatırlamak gerekiyor. Bir sonraki yeni uçta da
        unutulacak — çözümü uçları azaltmak ya da ortak bir
        serileştirici yazmak, ama o ayrı bir iş.
      */
      tradable: isTradableNow(asset.kind),
      // Veri yoksa null — sıfır göndermek "fiyat sıfırdı" demek olurdu.
      high: conv(stats?.high),
      low: conv(stats?.low),
      open: conv(stats?.open),
      close: conv(stats?.close),
      // ⚠️ Hacim saklanmıyor. Binance veriyor ama kolonu yok (migration).
      // Alanı göndermek, ekranın onu beklediğini ve bir gün geleceğini
      // görünür kılıyor.
      volume: null,
    });
  } catch (error) {
    console.error(`[GET /assets/${symbol}/stats] başarısız:`, error);
    return response.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "İstatistik okunamadı." },
    });
  }
});

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

  const currency = parseCurrency(request.query.currency);

  if (currency === null) {
    return response.status(400).json({
      error: { code: "INVALID_CURRENCY", message: "Geçersiz para birimi." },
    });
  }

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

    /**
     * ⚠️ DOLAR GÖRÜNÜMÜ HER NOKTAYA O ANIN KURUNU UYGULUYOR.
     *
     * Bütün eğriyi bugünkü kura bölmek kolay ve YANLIŞ olurdu: her nokta
     * aynı sayıya bölününce eğrinin ŞEKLİ değişmez, yalnızca etiketler
     * değişir. Grafik liranın değer kaybını dolar kazancı gibi gösterir.
     *
     * Ölçüldü (BTC, 90 gün): TL +%12,2 · dolar +%6,6. Fark tamamen kur.
     */
    const usd = currency === "usd" ? await findAssetIdBySymbol("USD") : null;

    if (currency === "usd" && usd === null) {
      return response.status(503).json({
        error: {
          code: "FX_UNAVAILABLE",
          message: "Dolar kuru bulunamadı, TL görünümünü kullanın.",
        },
      });
    }

    const points = await getPriceSeries(
      asset.id,
      bucketSeconds,
      since,
      until,
      usd?.id ?? null,
    );

    return response.json({
      symbol: symbol.toUpperCase(),
      name: asset.name,
      range: window?.ok === true ? "custom" : range,
      bucketSeconds,
      currency,
      // ⚠️ Fiyat STRING. Sayı olarak gönderseydik istemcide float'a düşerdi
      // ve money.ts'ten beri taşıdığımız bigint zinciri son adımda kırılırdı.
      //
      // ⚠️ Kuru olmayan nokta ATLANIYOR, 0 ya da 1 uydurulmuyor: varlık
      // kur geçmişinden eskiyse o gün için dolar fiyatı BİLİNMİYOR.
      // Uydurulan bir kur, TL tutarını dolar diye göstermek olurdu.
      points: points.flatMap((p) => {
        if (currency === "try") {
          return [{ ts: p.ts.toISOString(), price: p.priceTry }];
        }

        if (p.usdRate === null) return [];

        const usdPrice = tryToUsd(toPrice(p.priceTry), toPrice(p.usdRate));

        return [
          {
            ts: p.ts.toISOString(),
            price: formatScaled(usdPrice, PRICE_SCALE),
          },
        ];
      }),
    });
  } catch (error) {
    console.error(`[GET /assets/${symbol}/prices] başarısız:`, error);
    return response.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Fiyat geçmişi okunamadı." },
    });
  }
});
