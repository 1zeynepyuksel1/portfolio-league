import { describe, expect, it } from 'vitest';
import { centsToDecimal } from './format';

/**
 * ⚠️ BU TESTLER GERÇEK BİR EKRAN HATASINDAN DOĞDU.
 *
 * Cüzdan grafiğinin ekseni "10.18M" yazıyordu, oysa bakiye 101.329,59 ₺
 * idi. Sebep: `GET /portfolio/history` KURUŞ döndürüyor, `PriceChart` ise
 * LİRA bekliyor. Çizginin şekli doğru olduğu için hata yalnızca
 * etiketlerde görünüyordu — grafik "çalışıyor" gibi duruyordu.
 */

describe('centsToDecimal', () => {
  it('ekrandaki gerçek değeri doğru çeviriyor', () => {
    // 101.329,59 ₺ -> eksen artık 101.329 civarı yazmalı, 10.18M değil.
    expect(centsToDecimal('10132959')).toBe('101329.59');
  });

  it('kuruş basamaklarını koruyor', () => {
    expect(centsToDecimal('100')).toBe('1.00');
    expect(centsToDecimal('105')).toBe('1.05');
    expect(centsToDecimal('150')).toBe('1.50');
  });

  it('yüzün altındaki değerlerde basamak kaybetmiyor', () => {
    /*
      ⚠️ `padStart(3, '0')` OLMASA BURASI KIRILIRDI.

      "5" için `slice(0, -2)` boş metin verir ve sonuç ".05" olurdu —
      geçersiz bir sayı. Grafik onu `NaN` okur ve SESSİZCE hiçbir şey
      çizmez.
    */
    expect(centsToDecimal('5')).toBe('0.05');
    expect(centsToDecimal('50')).toBe('0.50');
    expect(centsToDecimal('0')).toBe('0.00');
  });

  it('negatif değerleri koruyor', () => {
    // Portföy değeri negatif olamaz ama kâr/zarar olabilir.
    expect(centsToDecimal('-2500')).toBe('-25.00');
    expect(centsToDecimal('-5')).toBe('-0.05');
  });

  it('BÜYÜK sayılarda hassasiyet kaybetmiyor', () => {
    /*
      ⚠️ TESTİN ASIL SEBEBİ BU.

      `Number(cents) / 100` yazsaydık bu değer güvenli tam sayı
      aralığının üstünde bozulurdu. Metin üzerinde bölmek kayıpsız.
    */
    expect(centsToDecimal('9007199254740993')).toBe('90071992547409.93');
  });
});
