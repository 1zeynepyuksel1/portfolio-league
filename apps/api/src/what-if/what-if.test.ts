import { describe, expect, it, vi } from 'vitest';
import { whatIfQuerySchema } from './what-if.schema.js';
import * as repo from './repository.js';
import {
  AssetNotFoundError,
  calculateWhatIf,
  getTufeValue,
  HistoricalPriceNotFoundError,
  LatestPriceNotFoundError,
} from './service.js';

describe('What-If Module Tests', () => {
  describe('Query Schema Validation', () => {
    it('geçerli parametreleri doğru parse eder ve formatlar', () => {
      const result = whatIfQuerySchema.safeParse({
        symbol: 'btc',
        date: '2020-03-12',
        amountKurus: '1000000',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.symbol).toBe('BTC');
        expect(result.data.date).toBe('2020-03-12');
        expect(result.data.amountKurus).toBe(1000000n);
      }
    });

    it('geçersiz tarih formatını reddeder', () => {
      const result = whatIfQuerySchema.safeParse({
        symbol: 'BTC',
        date: '12-03-2020',
        amountKurus: '1000000',
      });

      expect(result.success).toBe(false);
    });

    it('sıfır veya negatif tutarı reddeder', () => {
      const result = whatIfQuerySchema.safeParse({
        symbol: 'BTC',
        date: '2020-03-12',
        amountKurus: '-5000',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('TÜFE Helper', () => {
    it('bilinen aylar için doğru TÜFE endeksini döner', () => {
      expect(getTufeValue('2020-03')).toBe(453.47);
      expect(getTufeValue('2017-01')).toBe(299.74);
    });

    it('bilinmeyen eski tarihler için alt sınırı döner', () => {
      expect(getTufeValue('2015-01')).toBe(299.74);
    });
  });

  describe('calculateWhatIf Engine', () => {
    it('nominal ve reel getiriyi, miktarı ve Türkçe formatları hatasız hesaplar', async () => {
      const mockAsset = {
        id: 'asset-btc-uuid',
        symbol: 'BTC',
        name: 'Bitcoin',
        kind: 'crypto' as const,
        isActive: true,
        sortOrder: 1,
        createdAt: new Date(),
      };

      const mockHistoricalPrice = {
        ts: new Date('2020-03-12T12:00:00Z'),
        priceTry: '45000.00000000', // 1 BTC = 45.000 TL
      };

      const mockLatestPrice = {
        ts: new Date('2026-08-19T10:00:00Z'),
        priceTry: '2250000.00000000', // 1 BTC = 2.250.000 TL (50x nominal artış)
      };

      vi.spyOn(repo, 'findAssetBySymbol').mockResolvedValue(mockAsset);
      vi.spyOn(repo, 'findHistoricalPrice').mockResolvedValue(mockHistoricalPrice);
      vi.spyOn(repo, 'findLatestPrice').mockResolvedValue(mockLatestPrice);
      vi.spyOn(repo, 'findTufeIndex').mockImplementation(async (month: string) => {
        if (month === '2020-03') return { month: '2020-03', tufeIndex: '453.4700' };
        if (month === '2026-08') return { month: '2026-08', tufeIndex: '4120.0000' };
        return undefined;
      });

      const result = await calculateWhatIf({
        symbol: 'BTC',
        date: '2020-03-12',
        amountKurus: 1000000n, // 10.000 TL
      });

      expect(result.symbol).toBe('BTC');
      expect(result.assetName).toBe('Bitcoin');
      expect(result.startDate).toBe('2020-03-12');
      expect(result.initialInvestmentTry).toBe('10.000,00 ₺');
      expect(result.purchasedQuantity).toBe((10000 / 45000).toFixed(8)); // ~0.22222222 BTC
      expect(result.currentValueTry).toBe('500.000,00 ₺'); // 10.000 * 50 = 500.000 TL
      expect(result.nominalProfitTry).toBe('+490.000,00 ₺');
      expect(result.nominalReturnPercentFormatted).toBe('+%4900,00');

      // Enflasyon: (4120 - 453.47) / 453.47 = ~8.0855 (+%808,55)
      // Reel Getiri: (1 + 49) / (1 + 8.0855) - 1 = 50 / 9.0855 - 1 = ~4.5033 (+%450,33)
      expect(result.cumulativeInflationPercentRaw).toBeCloseTo(8.0855, 2);
      expect(result.realReturnPercentRaw).toBeCloseTo(4.5033, 2);
      expect(result.summary).toContain('Bitcoin (BTC) alsaydınız');
    });

    it('varlık bulunamazsa AssetNotFoundError fırlatır', async () => {
      vi.spyOn(repo, 'findAssetBySymbol').mockResolvedValue(undefined);

      await expect(
        calculateWhatIf({
          symbol: 'UNKNOWN',
          date: '2020-03-12',
          amountKurus: 1000000n,
        }),
      ).rejects.toThrow(AssetNotFoundError);
    });

    it('geçmiş fiyat kaydı yoksa HistoricalPriceNotFoundError fırlatır', async () => {
      vi.spyOn(repo, 'findAssetBySymbol').mockResolvedValue({
        id: 'asset-btc-uuid',
        symbol: 'BTC',
        name: 'Bitcoin',
        kind: 'crypto' as const,
        isActive: true,
        sortOrder: 1,
        createdAt: new Date(),
      });
      vi.spyOn(repo, 'findHistoricalPrice').mockResolvedValue(undefined);

      await expect(
        calculateWhatIf({
          symbol: 'BTC',
          date: '2015-01-01',
          amountKurus: 1000000n,
        }),
      ).rejects.toThrow(HistoricalPriceNotFoundError);
    });

    it('canlı güncel fiyat yoksa LatestPriceNotFoundError fırlatır', async () => {
      vi.spyOn(repo, 'findAssetBySymbol').mockResolvedValue({
        id: 'asset-btc-uuid',
        symbol: 'BTC',
        name: 'Bitcoin',
        kind: 'crypto' as const,
        isActive: true,
        sortOrder: 1,
        createdAt: new Date(),
      });
      vi.spyOn(repo, 'findHistoricalPrice').mockResolvedValue({
        ts: new Date('2020-03-12'),
        priceTry: '45000.00',
      });
      vi.spyOn(repo, 'findLatestPrice').mockResolvedValue(undefined);

      await expect(
        calculateWhatIf({
          symbol: 'BTC',
          date: '2020-03-12',
          amountKurus: 1000000n,
        }),
      ).rejects.toThrow(LatestPriceNotFoundError);
    });
  });
});
