import { describe, expect, it } from 'vitest';
import { toUtcDate, toUtcIso } from './pg-time.js';

/*
  ⚠️ BU TESTLER YEREL SAAT DİLİMİNDEN BAĞIMSIZ OLMAK ZORUNDA.

  "Beklenen 09:45" diye yazsaydık test yalnızca Türkiye'de geçerdi ve
  CI (UTC) ile geliştiricinin makinesi farklı sonuç verirdi. Bunun yerine
  MUTLAK AN (`toISOString`) karşılaştırılıyor — o her dilimde aynı.
*/
describe('toUtcDate — dilimsiz zaman damgası', () => {
  it('dilim işareti olmayan metni UTC sayar', () => {
    expect(toUtcDate('2026-08-26 09:45:19.888652').toISOString()).toBe(
      '2026-08-26T09:45:19.888Z',
    );
  });

  it('mikrosaniye olmadan da çalışır', () => {
    expect(toUtcDate('2026-08-26 09:45:19').toISOString()).toBe(
      '2026-08-26T09:45:19.000Z',
    );
  });

  /*
    ⚠️ ASIL SINANAN ŞEY BU: düzeltmesiz okuma ile farkın SIFIR olmadığı.

    Test yalnızca "doğru değeri döndürüyor mu" diye baksaydı, kodu
    `new Date(text)` ile değiştirdiğimizde UTC makinede yine geçerdi ve
    hatayı yakalamazdı. Burada yerel yorumun farklı bir an ürettiği
    doğrulanıyor — yalnızca makine gerçekten UTC değilse anlamlı, o yüzden
    koşullu.
  */
  it('yerel yorumdan farklı bir an üretir (UTC olmayan makinede)', () => {
    const metin = '2026-08-26 09:45:19';
    const yerelOfset = new Date(`${metin}Z`).getTimezoneOffset();

    if (yerelOfset === 0) return; // makine UTC, karşılaştırılacak fark yok

    expect(toUtcDate(metin).getTime()).not.toBe(new Date(metin).getTime());
  });
});

describe('toUtcIso — eksik veri uydurulmuyor', () => {
  it('metni ISO’ya çevirir', () => {
    expect(toUtcIso('2026-08-26 09:45:19')).toBe('2026-08-26T09:45:19.000Z');
  });

  /*
    ⚠️ Boş girdi "şimdi" DÖNMEMELİ. Önceki kod `new Date()` ile bugünü
    koyuyordu; ekranda "bugün alınmış" yazıyordu ve yanlış olduğu
    anlaşılmıyordu. `null` en azından dürüst.
  */
  it('null / undefined / boş metin için null döner', () => {
    expect(toUtcIso(null)).toBeNull();
    expect(toUtcIso(undefined)).toBeNull();
    expect(toUtcIso('')).toBeNull();
  });
});
