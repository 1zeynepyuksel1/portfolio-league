import { Router } from 'express';
import { requireAccessToken } from '../auth/middleware.js';
import { AMOUNT_SCALE, PRICE_SCALE, formatScaled } from '../lib/money.js';
import { PortfolioNotFoundError, getPortfolio } from './service.js';
import { calculateTwrForUser } from '../leagues/twr-engine.js';
import { centsTryToUsd, parseCurrency, tryToUsd } from '../lib/fx.js';
import { latestUsdTryRate } from '../market/repository.js';
import { toPrice } from '../lib/money.js';
import type { Penny, Price } from '../lib/money.js';

export const portfolioRouter = Router();

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
