import { describe, expect, it } from 'vitest';
import { calculateTwr, formatTwrPercent } from './twr.js';

describe('Time-Weighted Return (TWR) Hesabı', () => {
  it('Hiç nakit akışı / bonus olmayan tek dönemde doğru getiri hesaplamalı', () => {
    // 100.000 TL -> 120.000 TL (%20 kâr)
    const result = calculateTwr([
      { startValueKurus: 10000000n, endValueKurus: 12000000n },
    ]);

    expect(result).toBeCloseTo(0.20, 4);
    expect(formatTwrPercent(result)).toBe('+%20,00');
  });

  it('Tek bonuslu 2 alt dönemli senaryoda bonusu kazanç saymadan bileşik getiri hesaplamalı', () => {
    // 1. Dönem: 100.000 TL -> 110.000 TL (+%10)
    // 1.000 TL bonus eklendi -> Yeni başlangıç: 111.000 TL
    // 2. Dönem: 111.000 TL -> 122.100 TL (+%10)
    // Beklenen TWR: (1 + 0.10) * (1 + 0.10) - 1 = +%21.00
    const result = calculateTwr([
      { startValueKurus: 10000000n, endValueKurus: 11000000n },
      { startValueKurus: 11100000n, endValueKurus: 12210000n },
    ]);

    expect(result).toBeCloseTo(0.21, 4);
    expect(formatTwrPercent(result)).toBe('+%21,00');
  });

  it("Zeynep'in haftalık hikâyesindeki çok dönemli (kâr ve düşüş içeren) senaryoyu doğrulamalı", () => {
    // 1. Dönem: 100.000 TL -> 120.000 TL (+%20.00)
    // 1.000 TL bonus -> Başlangıç: 121.000 TL
    // 2. Dönem: 121.000 TL -> 116.000 TL (-%4.1322)
    // 1.000 TL bonus -> Başlangıç: 117.000 TL
    // 3. Dönem: 117.000 TL -> 142.000 TL (+%21.3675)
    // Beklenen TWR: (1.20) * (116/121) * (142/117) - 1 = +%39.62
    const result = calculateTwr([
      { startValueKurus: 10000000n, endValueKurus: 12000000n },
      { startValueKurus: 12100000n, endValueKurus: 11600000n },
      { startValueKurus: 11700000n, endValueKurus: 14200000n },
    ]);

    expect(result).toBeCloseTo(0.3962, 3);
    expect(formatTwrPercent(result)).toBe('+%39,62');
  });

  it('Sadece günlük bonus toplayıp hiç yatırım yapmayan kullanıcının getirisi %0,00 olmalı (Adaletin Kanıtı)', () => {
    // Kullanıcı 100k ile başladı, hiç coin almadı.
    // 1. Gün: 100.000 -> 100.000 (%0)
    // 1k bonus -> 101.000 -> 101.000 (%0)
    // 1k bonus -> 102.000 -> 102.000 (%0)
    // Toplam TWR: %0,00
    const result = calculateTwr([
      { startValueKurus: 10000000n, endValueKurus: 10000000n },
      { startValueKurus: 10100000n, endValueKurus: 10100000n },
      { startValueKurus: 10200000n, endValueKurus: 10200000n },
    ]);

    expect(result).toBeCloseTo(0.00, 6);
    expect(formatTwrPercent(result)).toBe('%0,00');
  });

  it('Zarar edilen dönemlerde negatif TWR doğru hesaplanmalı', () => {
    // 1. Dönem: 100.000 TL -> 80.000 TL (-%20)
    // 1.000 TL bonus -> 81.000 TL
    // 2. Dönem: 81.000 TL -> 72.900 TL (-%10)
    // Beklenen TWR: (1 - 0.20) * (1 - 0.10) - 1 = -%28.00
    const result = calculateTwr([
      { startValueKurus: 10000000n, endValueKurus: 8000000n },
      { startValueKurus: 8100000n, endValueKurus: 7290000n },
    ]);

    expect(result).toBeCloseTo(-0.28, 4);
    expect(formatTwrPercent(result)).toBe('-%28,00');
  });

  it('Boş dönem listesinde %0,00 getiri dönmeli', () => {
    expect(calculateTwr([])).toBe(0);
    expect(formatTwrPercent(0)).toBe('%0,00');
  });

  it('Çok küçük değerlerin sıfıra yuvarlanmasında eksi/artı işareti koymamalı (Nötr Sıfır)', () => {
    expect(formatTwrPercent(-0.00003)).toBe('%0,00');
    expect(formatTwrPercent(0.00003)).toBe('%0,00');
    expect(formatTwrPercent(-0.000049)).toBe('%0,00');
    expect(formatTwrPercent(-0.000051)).toBe('-%0,01');
    expect(formatTwrPercent(0.000051)).toBe('+%0,01');
  });
});
