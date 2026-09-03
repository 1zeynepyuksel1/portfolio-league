import { Router } from 'express';
import { isTradableNow } from '../market/market-hours.js';
import { requireAccessToken } from '../auth/middleware.js';
import { AMOUNT_SCALE, PRICE_SCALE, formatScaled } from '../lib/money.js';
import { PortfolioNotFoundError, getPortfolio } from './service.js';
import { calculateTwrForUser, calculateTwrForPeriod } from '../leagues/twr-engine.js';
import { divRound } from '../lib/money.js';
import { centsTryToUsd, parseCurrency, tryToUsd } from '../lib/fx.js';
import { latestUsdTryRate, findAssetIdBySymbol } from '../market/repository.js';
import { toPrice } from '../lib/money.js';
import type { Penny, Price } from '../lib/money.js';
import { isRange, startOf } from '../market/ranges.js';
import { getPortfolioHistory } from './repository.js';

export const portfolioRouter = Router();

/**
 * GET /portfolio/history — portföy değer geçmişi eğrisi.
 */
portfolioRouter.get('/history', requireAccessToken, async (request, response) => {
  const userId = response.locals.userId as string;
  const range = request.query.range as string || '1w';
  const currency = parseCurrency(request.query.currency);

  if (!isRange(range)) {
    return response.status(400).json({
      error: { code: 'INVALID_RANGE', message: 'Geçersiz aralık.' },
    });
  }

  if (currency === null) {
    return response.status(400).json({
      error: { code: 'INVALID_CURRENCY', message: 'Geçersiz para birimi.' },
    });
  }

  try {
    const usd = currency === 'usd' ? await findAssetIdBySymbol('USD') : null;
    if (currency === 'usd' && usd === null) {
      return response.status(503).json({
        error: {
          code: 'FX_UNAVAILABLE',
          message: 'Dolar kuru bulunamadı, TL görünümünü kullanın.',
        },
      });
    }

    const since = startOf(range as any, new Date());
    const history = await getPortfolioHistory(userId, since, usd?.id ?? null);

    /*
      ARALIĞA GÖRE GETİRİ — ekrandaki büyük yüzde bunu kullanıyor.

      ⚠️ NEDEN BURADA, `/portfolio`'DA DEĞİL. Aralığı bilen tek uç bu:
      `since` zaten hesaplanmış durumda. `/portfolio`'ya `range`
      parametresi eklemek, aynı tarihi iki ayrı yerde hesaplamak
      demekti — ve ikisi bir gün ayrışırdı.

      ⚠️ `since === null` YALNIZCA 'max' İÇİN OLUR. Ekrandaki beş
      düğmenin hiçbiri 'max' değil, ama uç kabul ediyor; tarih yoksa
      hesabı hiç yapmıyoruz (aşağıda `null` dönüyor). Uydurma bir
      başlangıç tarihi seçmek, uydurma bir getiri üretirdi.
    */
    const twr = since === null
      ? null
      : await calculateTwrForPeriod(userId, since, new Date());

    const currentPortfolio = await getPortfolio(userId);
    const fxRate = currency === 'usd' ? await latestUsdTryRate() : null;

    const mapped = history.flatMap((p) => {
      if (currency === 'try') {
        return [{ ts: p.ts.toISOString(), value: p.totalValueCents.toString() }];
      }

      if (p.usdRate === null) return [];

      const usdPrice = centsTryToUsd(p.totalValueCents as Penny, toPrice(p.usdRate));
      return [{ ts: p.ts.toISOString(), value: usdPrice.toString() }];
    });

    if (currency === 'try') {
      mapped.push({
        ts: new Date().toISOString(),
        value: currentPortfolio.totalValueCents.toString(),
      });
    } else if (fxRate !== null) {
      const currentUsdPrice = centsTryToUsd(currentPortfolio.totalValueCents as Penny, toPrice(fxRate.rate));
      mapped.push({
        ts: new Date().toISOString(),
        value: currentUsdPrice.toString(),
      });
    }

    return response.json({
      range,
      currency,
      points: mapped,

      /*
        ARALIĞA GÖRE GETİRİ — yüzde VE tutar.

        ⚠️ TUTAR NEDEN `bitiş - başlangıç` DEĞİL.

        Naif fark, araya giren PARA GİRİŞLERİNİ kazanç sayar: günlük
        1.000 ₺ bonusu alan kullanıcı, hiç işlem yapmasa bile "+1.000 ₺
        kazandın" görürdü. CLAUDE.md'deki 3 numaralı tuzak tam olarak
        bu ve TWR bu yüzden var.

        Doğrusu: yüzdeyi TWR veriyor (girişleri zaten dışlıyor), tutarı
        da o yüzdeden türetiyoruz. Böylece iki sayı AYNI hikâyeyi
        anlatıyor — yan yana duran ama farklı yöntemle hesaplanmış iki
        sayı, kullanıcıya hangisine inanacağını sordurur.

        ⚠️ FLOAT YOK. `twrFloat`'ı doğrudan çarpmıyoruz; 10.000'e
        ölçeklenmiş bir tam sayıya çevirip `divRound` ile bölüyoruz.
        Para hesabında `bigint` kuralı burada da geçerli ve bölme
        kırpmasın diye ROUND_HALF_UP şart.
      */
      twrPercent: twr === null ? null : (twr.twrFloat * 100).toFixed(2),
      changeCents:
        twr === null
          ? null
          : divRound(
              twr.startValueCents * BigInt(Math.round(twr.twrFloat * 10_000)),
              10_000n,
            ).toString(),
    });
  } catch (error) {
    console.error('[GET /portfolio/history] başarısız:', error);
    return response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Geçmiş bilgisi okunamadı.' },
    });
  }
});

/**
 * GET /portfolio — kullanıcının nakit, pozisyon ve toplam değeri.
 *
 * Faz 1 bitiş kriterindeki "portföyde görün" adımı bu (docs/02-gorev-paylasimi.md).
 *
 * KARAR: bütün sayısal alanlar STRING.
 * JSON'da sayı yazsaydık istemci tarafında `number` olarak okunur, float'a
 * düşerdi. money.ts'ten buraya kadar taşınan bigint disiplini ağın öbür
 * ucunda çökerdi. Aynı desen GET /assets ve POST /orders'ta da var.
 */
portfolioRouter.get('/', requireAccessToken, async (request, response) => {
  const userId = response.locals.userId as string;

  const currency = parseCurrency(request.query.currency);

  if (currency === null) {
    return response.status(400).json({
      error: {
        code: 'INVALID_CURRENCY',
        message: 'Geçersiz para birimi. Beklenen: try, usd',
      },
    });
  }

  try {
    const portfolio = await getPortfolio(userId);
    const twrInfo = await calculateTwrForUser(userId);
    const twrPercent = (twrInfo.twrFloat * 100).toFixed(2);

    const fx = currency === 'usd' ? await latestUsdTryRate() : null;

    if (currency === 'usd' && fx === null) {
      return response.status(503).json({
        error: {
          code: 'FX_RATE_UNAVAILABLE',
          message: 'Dolar kuru şu an okunamıyor, TL görünümünü kullanın.',
        },
      });
    }

    const rate = fx === null ? null : toPrice(fx.rate);

    /**
     * Kuruş -> sent çevirici. Kur yoksa null döner.
     *
     * ⚠️ NAKİT BAKİYE TL'DE TUTULUYOR VE ÖYLE KALACAK. Dolar görünümü
     * HESAPLANIYOR, saklanmıyor. İki para biriminde bakiye tutmak,
     * aralarında dönüşüm kuralı ve yepyeni bir hata sınıfı demek —
     * hangi bakiye doğru? Emir hangisinden düşer? Kur değişince ne olur?
     */
    const toUsdCents = (cents: bigint): string | null =>
      rate === null ? null : centsTryToUsd(cents as Penny, rate).toString();

    return response.json({
      currency,
      usdTryRate: fx?.rate ?? null,
      rateAsOf: fx?.asOf.toISOString() ?? null,

      cashCents: portfolio.cashCents.toString(),
      positionsValueCents: portfolio.positionsValueCents.toString(),
      totalValueCents: portfolio.totalValueCents.toString(),

      cashUsdCents: toUsdCents(portfolio.cashCents),
      positionsValueUsdCents: toUsdCents(portfolio.positionsValueCents),
      totalValueUsdCents: toUsdCents(portfolio.totalValueCents),

      depositedCents: portfolio.depositedCents.toString(),
      /**
       * ⚠️ BUGÜNÜN KURUYLA ÇEVRİLİYOR — "ne kadar dolar yatırdım" DEĞİL.
       *
       * Para farklı tarihlerde, farklı kurlarla girdi. Dürüst cevap her
       * girişi kendi günündeki kurla çevirmek olurdu; onu yapmıyoruz
       * çünkü bu bir gösterim merceği, muhasebe değil. Aynı şey portföyün
       * tamamı için de geçerli: burada gördüğün dolar tutarı "bugün
       * bozdursam kaç dolar" sorusunun cevabı.
       */
      depositedUsdCents: toUsdCents(portfolio.depositedCents),
      profitCents: portfolio.profitCents.toString(),
      /**
       * ⚠️ YÜZDE ÇEVRİLMİYOR — VE BU BİLEREK.
       *
       * Kâr yüzdesi zaten para biriminden bağımsız: hem pay hem payda
       * aynı kurla bölünürse kur sadeleşir. Çevirmeye kalksaydık aynı
       * sayıyı iki kez bölüp yuvarlama hatası eklerdik.
       *
       * ⚠️ Ama bu, "dolar bazlı getiri" DEĞİL. Dolar bazlı getiri
       * yatırımın YAPILDIĞI GÜNÜN kuruyla hesaplanır; buradaki yüzde
       * TL bazlı getiridir, yalnızca gösterimi dolar. Lig sıralaması da
       * TL bazlı TWR kullanıyor (docs/01-plan.md) ve bu düğme ona
       * dokunmuyor — dokunsaydı aynı portföy iki kullanıcıda farklı
       * sıralanırdı.
       */
      profitPercent: portfolio.profitPercent,
      twrPercent,

      // ⚠️ Fiyatı okunamayan varlık varsa toplam EKSİK hesaplanmıştır.
      // Ekran bunu kullanıcıya söylemeli; sessizce düşük toplam göstermek
      // yanıltıcı olur.
      hasIncompletePrices: portfolio.hasIncompletePrices,

      positions: portfolio.positions.map((p) => ({
        symbol: p.symbol,
        name: p.name,
        /*
          ⚠️ EKRAN "15 sa" DİYORDU, "piyasa kapalı" DEMESİ GEREKİRDİ.

          Piyasa ekranı bu ayrımı yapıyordu (`market/router.ts`), cüzdan
          yapmıyordu — çünkü alan yalnızca oraya eklenmişti. ABD borsası
          kapalıyken pozisyon satırı "AAPL · 15 sa" görünüyor ve ARIZA
          gibi okunuyordu. Oysa hiçbir şey bozuk değil.

          ⚠️ Kural `isTradableNow`'a taşındı — üçüncü kez yazılmasın diye.
        */
        tradable: isTradableNow(p.kind),
        // Ölçekli bigint -> ondalık metin. numeric(28,10) ile aynı biçim.
        quantity: formatScaled(p.quantity, AMOUNT_SCALE),
        priceTry: p.price === null ? null : formatScaled(p.price, PRICE_SCALE),
        priceUsd:
          p.price === null || rate === null
            ? null
            : formatScaled(tryToUsd(p.price as Price, rate), PRICE_SCALE),
        valueCents: p.valueCents === null ? null : p.valueCents.toString(),
        valueUsdCents:
          p.valueCents === null ? null : toUsdCents(p.valueCents),
        sharePercent: p.sharePercent,
        asOf: p.asOf?.toISOString() ?? null,

        // Aldığından beri kâr/zarar. Maliyet emir defterinden hesaplanıyor
        // (bkz. cost-basis.ts) — `holdings` tablosunda tutulmuyor.
        costCents: p.costCents.toString(),
        costUsdCents: toUsdCents(p.costCents),
        profitCents: p.profitCents.toString(),
        profitUsdCents: toUsdCents(p.profitCents),
        // Fiyatı okunamayan ya da maliyeti sıfır olan pozisyonda null.
        // Sıfır göndermek "kâr yok" demek olurdu; oysa bilmiyoruz.
        profitPercent: p.profitPercent,
      })),
    });
  } catch (error) {
    if (error instanceof PortfolioNotFoundError) {
      return response.status(404).json({
        error: { code: 'ACCOUNT_NOT_FOUND', message: error.message },
      });
    }

    console.error('[GET /portfolio] beklenmeyen hata:', error);

    return response.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Portföy okunurken beklenmeyen bir hata oluştu.',
      },
    });
  }
});
