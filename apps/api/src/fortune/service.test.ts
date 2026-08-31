import { describe, expect, it } from 'vitest';
import { composeFortune, getFortuneDate } from './service.js';

const lines = [
  { id: 'main', category: 'main' as const, text: '{asset} ana cümlesi.', assetKey: null },
  { id: 'specific', category: 'asset_specific' as const, text: 'BTC özel cümlesi.', assetKey: 'BTC' },
  { id: 'closing', category: 'closing' as const, text: 'Kapanış cümlesi.', assetKey: null },
];

describe('fortune service', () => {
  it('ana cümledeki varlık yer tutucusunu aktif varlığın adıyla doldurur', () => {
    const randomValues = [0.1, 0.9, 0.9];
    const text = composeFortune({
      asset: { symbol: 'BTC', name: 'Bitcoin' },
      lines,
      // main seç, asset-specific ve closing ekleme
      random: () => randomValues.shift() ?? 0.9,
    });

    expect(text).toBe('Bitcoin ana cümlesi.');
  });

  it('İstanbul gününü UTC gece yarısından bağımsız üretir', () => {
    expect(getFortuneDate(new Date('2026-08-28T21:30:00.000Z'))).toBe('2026-08-29');
  });
});
