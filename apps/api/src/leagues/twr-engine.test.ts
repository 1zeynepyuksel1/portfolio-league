import { describe, expect, it } from 'vitest';
import { calculateTwr, formatTwrPercent } from '@portfolio-league/contracts';

describe('TWR Engine Unit Tests', () => {
  it('Nakit akışı olmayan tek dönem TWR getirisini doğru hesaplamalı', () => {
    // 100.000 TL -> 125.000 TL (+%25)
    const subPeriods = [
      {
        startValueKurus: 10000000n,
        endValueKurus: 12500000n,
      },
    ];

    const twr = calculateTwr(subPeriods);
    expect(twr).toBeCloseTo(0.25, 4);
    expect(formatTwrPercent(twr)).toBe('+%25,00');
  });

  it('Nakit akışı (günlük bonus) içeren çoklu alt dönem TWR getirisini doğru hesaplamalı', () => {
    // Dönem 1: 100.000 TL -> 110.000 TL (+%10)
    // Nakit bonus eklendi: +10.000 TL -> Yeni bakiye 120.000 TL
    // Dönem 2: 120.000 TL -> 132.000 TL (+%10)
    // Bileşik TWR = (1 + 0.10) * (1 + 0.10) - 1 = 1.21 - 1 = 0.21 (+%21)
    const subPeriods = [
      {
        startValueKurus: 10000000n,
        endValueKurus: 11000000n,
      },
      {
        startValueKurus: 12000000n,
        endValueKurus: 13200000n,
      },
    ];

    const twr = calculateTwr(subPeriods);
    expect(twr).toBeCloseTo(0.21, 4);
    expect(formatTwrPercent(twr)).toBe('+%21,00');
  });

  it('Zarar durumunda negatif TWR getirisini doğru hesaplamalı', () => {
    // 100.000 TL -> 85.000 TL (-%15)
    const subPeriods = [
      {
        startValueKurus: 10000000n,
        endValueKurus: 8500000n,
      },
    ];

    const twr = calculateTwr(subPeriods);
    expect(twr).toBeCloseTo(-0.15, 4);
    expect(formatTwrPercent(twr)).toBe('-%15,00');
  });
});
