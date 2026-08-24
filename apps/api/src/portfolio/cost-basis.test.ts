import { describe, expect, it } from 'vitest';
import { toAmount } from '../lib/money.js';
import type { Penny } from '../lib/money.js';
import {
  calculateCostBasis,
  calculatePositionProfit,
  type LedgerOrder,
} from './cost-basis.js';

/**
 * Bu dosyada mock YOK — cost-basis.ts saf hesap.
 *
 * Sınanan şey "kod çalışıyor mu" değil "sayı doğru mu". Yanlış bir maliyet
 * hesabı hata vermez; sadece kullanıcıya olmayan bir kâr ya da olmayan bir
 * zarar gösterir. Para sistemlerinde en tehlikeli hata sınıfı bu.
 */

function buy(quantity: string, netCents: bigint): LedgerOrder {
  return { side: 'buy', quantity: toAmount(quantity), netCents: netCents as Penny };
}

function sell(quantity: string, netCents: bigint): LedgerOrder {
  return { side: 'sell', quantity: toAmount(quantity), netCents: netCents as Penny };
}

describe('calculateCostBasis', () => {
  it('boş defterde sıfır döndürür', () => {
    const r = calculateCostBasis([]);

    expect(r.quantity).toBe(0n);
    expect(r.costCents).toBe(0n);
  });

  it('tek alımda maliyet ödenen tutardır', () => {
    // 0,001 BTC için 3.697,62 TL ödendi (komisyon dahil)
    const r = calculateCostBasis([buy('0.001', 369762n)]);

    expect(r.quantity).toBe(toAmount('0.001'));
    expect(r.costCents).toBe(369762n);
  });

  /**
   * ⚠️ KOMİSYON MALİYETE DAHİL.
   * `netCents` kullanıyoruz, `grossCents` değil. Brütü kullansaydık her
   * pozisyon komisyon kadar kârlı görünürdü — yani hiç kazanmadığın bir
   * kâr ekranda yazardı.
   */
  it('iki alımda maliyetler toplanır', () => {
    const r = calculateCostBasis([
      buy('1', 100_000n),
      buy('1', 200_000n),
    ]);

    expect(r.quantity).toBe(toAmount('2'));
    expect(r.costCents).toBe(300_000n);
  });

  /**
   * ⚠️ TESTİN EN ÖNEMLİSİ — SATIŞTA MALİYET ORANSAL AZALIR.
   *
   * 2 adet aldın, 300.000 kuruş ödedin. 1 adet sattın.
   * Kalan 1 adedin maliyeti 150.000 olmalı, 300.000 DEĞİL.
   *
   * Maliyeti olduğu gibi bıraksaydık kalan 1 adet 300.000'e mal olmuş
   * görünür ve ekran uydurma bir zarar gösterirdi.
   *
   * Satıştan elde edilen tutarın (netCents) maliyete etkisi YOKTUR —
   * o nakde döner, pozisyonun maliyetini değiştirmez.
   */
  it('satışta maliyet oransal azalır', () => {
    const r = calculateCostBasis([
      buy('2', 300_000n),
      sell('1', 999_999n), // satış tutarı bilerek alakasız
    ]);

    expect(r.quantity).toBe(toAmount('1'));
    expect(r.costCents).toBe(150_000n);
  });

  it('tamamı satılınca maliyet sıfırlanır', () => {
    const r = calculateCostBasis([
      buy('1', 100_000n),
      sell('1', 120_000n),
    ]);

    expect(r.quantity).toBe(0n);
    expect(r.costCents).toBe(0n);
  });

  /**
   * Elde olandan fazlasını satmak emir motorunda zaten engelleniyor
   * (INSUFFICIENT_HOLDING). Yine de defter bozuksa sonsuza kadar negatif
   * miktar taşımaktansa sıfırlıyoruz.
   */
  it('elde olandan fazla satış sıfırla sonuçlanır', () => {
    const r = calculateCostBasis([
      buy('1', 100_000n),
      sell('5', 500_000n),
    ]);

    expect(r.quantity).toBe(0n);
    expect(r.costCents).toBe(0n);
  });

  it('al-sat-al sırasında ortalama doğru ilerler', () => {
    const r = calculateCostBasis([
      buy('2', 200_000n),  // ortalama 100.000/adet
      sell('1', 150_000n), // kalan 1 adet, maliyet 100.000
      buy('1', 300_000n),  // toplam 2 adet, maliyet 400.000
    ]);

    expect(r.quantity).toBe(toAmount('2'));
    expect(r.costCents).toBe(400_000n);
  });

  /**
   * ⚠️ KIRPMA DEĞİL YUVARLAMA.
   * 3 adet 100.000 kuruşa alındı, 1 adet satıldı.
   * Kalan 2 adedin maliyeti 100.000 × 2/3 = 66.666,67 -> 66.667.
   * Düz bigint bölmesi 66.666 verirdi; her satışta kullanıcı aleyhine
   * bir kuruş erirdi.
   */
  it('oransal azaltmada ROUND_HALF_UP uygulanır', () => {
    const r = calculateCostBasis([
      buy('3', 100_000n),
      sell('1', 0n),
    ]);

    expect(r.costCents).toBe(66_667n);
  });
});

describe('calculatePositionProfit', () => {
  it('kârı ve yüzdeyi hesaplar', () => {
    // 100.000 kuruşa alındı, şimdi 125.000 ediyor -> +25.000 (+%25)
    const r = calculatePositionProfit(100_000n as Penny, 125_000n as Penny);

    expect(r.profitCents).toBe(25_000n);
    expect(r.profitPercent).toBe('25.00');
  });

  it('zararı negatif döndürür', () => {
    const r = calculatePositionProfit(100_000n as Penny, 90_000n as Penny);

    expect(r.profitCents).toBe(-10_000n);
    expect(r.profitPercent).toBe('-10.00');
  });

  it('iki ondalık basamağa yuvarlar', () => {
    // 12.345 / 100.000 = %12,345 -> "12.35" (yarım yukarı)
    const r = calculatePositionProfit(100_000n as Penny, 112_345n as Penny);

    expect(r.profitPercent).toBe('12.35');
  });

  /**
   * ⚠️ FİYATI OKUNAMAYAN VARLIK.
   * Kâr hesaplanamaz. Sıfır döndürmek "kâr yok" demek olurdu ve bu bir
   * YALAN — bilmiyoruz. `null` bilmediğimizi söylüyor, ekran da öyle
   * gösteriyor.
   */
  it('değer bilinmiyorsa yüzde null döner', () => {
    const r = calculatePositionProfit(100_000n as Penny, null);

    expect(r.profitPercent).toBeNull();
  });

  it('maliyet sıfırsa sıfıra bölmez', () => {
    const r = calculatePositionProfit(0n as Penny, 50_000n as Penny);

    expect(r.profitCents).toBe(50_000n);
    expect(r.profitPercent).toBeNull();
  });
});
