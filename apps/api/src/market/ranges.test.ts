import { describe, expect, it } from 'vitest';
import { isRange, RANGES, specOf, startOf } from './ranges.js';

/**
 * Bu dosyada mock YOK — ranges.ts saf veri ve saf fonksiyon.
 *
 * Test edilen şey "kod çalışıyor mu" değil, "sayılar doğru mu". Kova
 * boyutu yanlış olsa kod yine çalışır, grafik yine çizilir — sadece
 * yanlış çözünürlükte. Sessiz bozulma; ancak ölçerek yakalanır.
 */
describe('ranges', () => {
  describe('isRange', () => {
    it('bilinen aralıkları kabul eder', () => {
      for (const r of RANGES) {
        expect(isRange(r)).toBe(true);
      }
    });

    it('bilinmeyeni ve yanlış tipi reddeder', () => {
      expect(isRange('2y')).toBe(false);
      expect(isRange('')).toBe(false);
      expect(isRange(undefined)).toBe(false);
      // Sorgu parametresi dizi olarak da gelebilir: ?range=1d&range=1w
      expect(isRange(['1d'])).toBe(false);
    });
  });

  describe('kova boyutları hedef nokta sayısını tutturuyor', () => {
    /**
     * ⚠️ ASIL SINANAN ŞEY BU.
     *
     * Her aralık için: pencere / kova = kaç nokta çıkar?
     * Hedef 90-500 arası. Altında çizgi köşeli görünür, üstünde noktalar
     * aynı piksele düşer — veri taşınır ama görünmez.
     *
     * Biri değiştirilirse bu test düşer ve "neden" sorusu sorulur.
     */
    const cases: Array<[string, number]> = [
      ['1d', 288],
      ['1w', 168],
      ['1m', 120],
      ['3m', 90],
      ['1y', 365],
    ];

    for (const [range, expected] of cases) {
      it(`${range} -> ${expected} nokta`, () => {
        const spec = specOf(range as never);
        // max dışındaki hepsinin penceresi var
        expect(spec.lookbackSeconds).not.toBeNull();

        const points = (spec.lookbackSeconds as number) / spec.bucketSeconds;
        expect(points).toBe(expected);
        expect(points).toBeGreaterThanOrEqual(90);
        expect(points).toBeLessThanOrEqual(500);
      });
    }

    it('max penceresizdir ve haftalık kova kullanır', () => {
      const spec = specOf('max');

      // Alt sınır yok: varlığın ilk kaydından başlar.
      expect(spec.lookbackSeconds).toBeNull();
      expect(spec.bucketSeconds).toBe(7 * 24 * 60 * 60);

      // 2017'den bugüne ~9 yıl. Haftalık kovada ~470 nokta —
      // sınırın hemen altında, yani en uzun aralıkta bile taşmıyor.
      const weeksInNineYears = (9 * 365) / 7;
      expect(weeksInNineYears).toBeLessThan(500);
    });
  });

  describe('startOf', () => {
    // Sabit bir "şimdi" — testin yarın da aynı sonucu vermesi için.
    const now = new Date('2026-08-22T12:00:00.000Z');

    it('1d tam bir gün geriye gider', () => {
      expect(startOf('1d', now)?.toISOString()).toBe(
        '2026-08-21T12:00:00.000Z',
      );
    });

    it('1y 365 gün geriye gider', () => {
      expect(startOf('1y', now)?.toISOString()).toBe(
        '2025-08-22T12:00:00.000Z',
      );
    });

    /**
     * ⚠️ `null` BURADA "hata" DEĞİL, "alt sınır yok" DEMEK.
     * getPriceSeries bunu görünce WHERE koşuluna tarih eklemiyor.
     * Yanlışlıkla 0 ya da epoch başlangıcı döndürseydik sorgu yine
     * çalışırdı ama niyet kodda görünmez olurdu.
     */
    it('max için null döner', () => {
      expect(startOf('max', now)).toBeNull();
    });

    it('ay sınırını doğru geçer', () => {
      // 1 Mart'tan bir gün geriye = 28 Şubat (2026 artık yıl değil)
      const marchFirst = new Date('2026-03-01T00:00:00.000Z');
      expect(startOf('1d', marchFirst)?.toISOString()).toBe(
        '2026-02-28T00:00:00.000Z',
      );
    });
  });
});
