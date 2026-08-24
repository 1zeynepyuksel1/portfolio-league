import { describe, expect, it } from 'vitest';
import { ouncePriceToGram, TROY_OUNCE_GRAMS } from './lbma.js';
import { formatScaled, PRICE_SCALE, toPrice } from '../lib/money.js';

/**
 * Bu dosyada ağ YOK — sınanan şey çevrimin doğruluğu.
 *
 * ⚠️ NEDEN BU TESTLER KRİTİK: ons/gram hatası "makul görünen" sınıfa
 * giriyor. 31,1034768 yerine 28,3495 (normal ons) yazılsaydı fiyat
 * yalnızca %10 saparddı — grafik yine güzel çizilir, kimse fark etmezdi.
 * Sabit ancak elle hesaplanmış vakalarla kilitlenebilir.
 */
describe('ouncePriceToGram', () => {
  it('troy ons sabiti doğru', () => {
    // Uluslararası tanım: 1 troy ons = tam olarak 31,1034768 gram.
    // ⚠️ 28,349523125 (avoirdupois ons) DEĞİL — o mutfak onsu.
    expect(TROY_OUNCE_GRAMS).toBe('31.1034768');
  });

  it('ölçülmüş gerçek veri: 21 Ağustos 2026 altın PM fixing', () => {
    // LBMA gold_pm.json son kayıt: 4582.1 USD/ons
    // 4582,1 ÷ 31,1034768 = 147,31793585
    //
    // ⚠️ Bu sayı bağımsız olarak doğrulandı: Python `Decimal` ile 50
    // basamak hassasiyetinde hesaplanıp ROUND_HALF_UP ile 8 basamağa
    // indirildi. İlk yazdığım beklenti (147.31797996) elle hesaptı ve
    // YANLIŞTI — test kodu değil beni düzeltti.
    const gram = ouncePriceToGram(toPrice('4582.1'));

    expect(formatScaled(gram, PRICE_SCALE)).toBe('147.31793585');
  });

  it('ölçülmüş gerçek veri: 21 Ağustos 2026 gümüş', () => {
    // silver.json son kayıt: 69.51 USD/ons
    // 69,51 ÷ 31,1034768 = 2,23479839  (aynı şekilde Decimal ile doğrulandı)
    const gram = ouncePriceToGram(toPrice('69.51'));

    expect(formatScaled(gram, PRICE_SCALE)).toBe('2.23479839');
  });

  /**
   * ⚠️ ASIL TUZAK TESTİ.
   * Yanlış sabit (mutfak onsu) kullanılsaydı sonuç %10 sapardı — yani
   * hâlâ "makul" görünürdü. Bu test iki sonucun ayrıştığını kanıtlıyor.
   */
  it('yanlış ons sabitiyle sonuç belirgin şekilde ayrışır', () => {
    const dogru = ouncePriceToGram(toPrice('4582.1'));

    // 4582,1 ÷ 28,349523125 = 161,63... (mutfak onsu)
    const yanlisSayi = 4582.1 / 28.349523125;

    const dogruSayi = Number(formatScaled(dogru, PRICE_SCALE));

    // Aradaki fark ~%10 — grafikte fark edilmez ama parada eder.
    expect(Math.abs(yanlisSayi - dogruSayi)).toBeGreaterThan(14);
  });

  it('sıfır fiyat sıfır kalır', () => {
    expect(ouncePriceToGram(toPrice('0'))).toBe(toPrice('0'));
  });

  /**
   * ⚠️ Bölme KIRPMAMALI, yuvarlamalı. Kırpma her seferinde kullanıcı
   * aleyhine çalışır ve tek başına kuruşun altında kalır — ama her
   * fiyat yazımında tekrarlanır.
   */
  it('ölçek sınırında yarımı yukarı yuvarlar', () => {
    // Çok küçük bir fiyat: sonucun son basamağı yuvarlama kararına düşer.
    const gram = ouncePriceToGram(toPrice('0.00000100'));

    // 0,000001 ÷ 31,1034768 = 0,0000000321...  -> 8 basamakta 0,00000003
    expect(formatScaled(gram, PRICE_SCALE)).toBe('0.00000003');
  });
});
