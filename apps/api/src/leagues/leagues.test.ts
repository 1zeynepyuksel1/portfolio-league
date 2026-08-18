import { describe, expect, it } from 'vitest';
import { leaderboardQuerySchema } from './leagues.schema.js';
import { formatTwrPercent } from '@portfolio-league/contracts';

describe('Leagues Modülü Doğrulama ve Formatlama Testleri', () => {
  describe('leaderboardQuerySchema (Zod Validasyonu)', () => {
    it('Varsayılan sayfalama değerlerini (limit=50, offset=0) atamalı', () => {
      const result = leaderboardQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
      }
    });

    it('String olarak gelen limit ve offset değerlerini integer sayıya dönüştürmeli (coerce)', () => {
      const result = leaderboardQuerySchema.safeParse({
        limit: '25',
        offset: '10',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(25);
        expect(result.data.offset).toBe(10);
      }
    });

    it('Negatif offset veya 100 üstü limit değerlerini reddetmeli', () => {
      const negativeOffset = leaderboardQuerySchema.safeParse({ offset: -1 });
      expect(negativeOffset.success).toBe(false);

      const excessiveLimit = leaderboardQuerySchema.safeParse({ limit: 101 });
      expect(excessiveLimit.success).toBe(false);

      const zeroLimit = leaderboardQuerySchema.safeParse({ limit: 0 });
      expect(zeroLimit.success).toBe(false);
    });
  });

  describe('Liderlik Tablosu TWR Formatlama Standartları', () => {
    it('Pozitif, negatif ve sıfır getirileri Türkçe finans standardına göre formatlamalı', () => {
      expect(formatTwrPercent(0.3962)).toBe('+%39,62');
      expect(formatTwrPercent(-0.0413)).toBe('-%4,13');
      expect(formatTwrPercent(0)).toBe('%0,00');
      expect(formatTwrPercent(1.25)).toBe('+%125,00');
    });

    it('Liderlik tablosu DTO eşlemesi sıralamayı ve formatları doğru bağlamalı', () => {
      const mockRawEntries = [
        {
          periodId: 'period-1',
          userId: 'user-1',
          displayName: 'Zeynep',
          isPublic: true,
          startValueCents: 10000000n,
          endValueCents: 13962000n,
          twrPct: '0.3962',
          rank: 1,
          updatedAt: new Date(),
        },
        {
          periodId: 'period-1',
          userId: 'user-2',
          displayName: 'Batuhan',
          isPublic: true,
          startValueCents: 10000000n,
          endValueCents: 12100000n,
          twrPct: '0.2100',
          rank: 2,
          updatedAt: new Date(),
        },
        {
          periodId: 'period-1',
          userId: 'user-3',
          displayName: 'Ahmet',
          isPublic: false,
          startValueCents: 10000000n,
          endValueCents: 9587000n,
          twrPct: '-0.0413',
          rank: 3,
          updatedAt: new Date(),
        },
      ];

      const mapped = mockRawEntries.map((entry, index) => {
        const twrFloat = parseFloat(entry.twrPct);
        return {
          rank: entry.rank ?? index + 1,
          userId: entry.userId,
          displayName: entry.displayName,
          isPublic: entry.isPublic,
          twrPercentRaw: twrFloat,
          twrPercentFormatted: formatTwrPercent(twrFloat),
          startValueCents: entry.startValueCents.toString(),
          endValueCents: entry.endValueCents.toString(),
        };
      });

      expect(mapped[0]?.rank).toBe(1);
      expect(mapped[0]?.displayName).toBe('Zeynep');
      expect(mapped[0]?.twrPercentFormatted).toBe('+%39,62');
      expect(mapped[0]?.startValueCents).toBe('10000000');

      expect(mapped[1]?.rank).toBe(2);
      expect(mapped[1]?.displayName).toBe('Batuhan');
      expect(mapped[1]?.twrPercentFormatted).toBe('+%21,00');

      expect(mapped[2]?.rank).toBe(3);
      expect(mapped[2]?.displayName).toBe('Ahmet');
      expect(mapped[2]?.twrPercentFormatted).toBe('-%4,13');
    });
  });
});
