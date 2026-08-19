import { Router } from 'express';
import { requireAccessToken } from '../auth/middleware.js';
import { AMOUNT_SCALE, PRICE_SCALE, formatScaled } from '../lib/money.js';
import { PortfolioNotFoundError, getPortfolio } from './service.js';

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
portfolioRouter.get('/', requireAccessToken, async (_request, response) => {
  const userId = response.locals.userId as string;

  try {
    const portfolio = await getPortfolio(userId);

    return response.json({
      cashCents: portfolio.cashCents.toString(),
      positionsValueCents: portfolio.positionsValueCents.toString(),
      totalValueCents: portfolio.totalValueCents.toString(),

      depositedCents: portfolio.depositedCents.toString(),
      profitCents: portfolio.profitCents.toString(),
      profitPercent: portfolio.profitPercent,

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
        valueCents: p.valueCents === null ? null : p.valueCents.toString(),
        sharePercent: p.sharePercent,
        asOf: p.asOf?.toISOString() ?? null,
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
