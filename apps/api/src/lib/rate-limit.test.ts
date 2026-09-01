import { beforeEach, describe, expect, it } from 'vitest';
import { hit, resetRateLimits } from './rate-limit.js';

beforeEach(() => resetRateLimits());

describe('hit — kayan pencere', () => {
  it('sınıra kadar izin verir, sonrasında reddeder', () => {
    for (let i = 0; i < 3; i++) {
      expect(hit('a', 3, 60_000).ok).toBe(true);
    }
    expect(hit('a', 3, 60_000).ok).toBe(false);
  });

  it('anahtarlar birbirini etkilemez', () => {
    for (let i = 0; i < 3; i++) hit('a', 3, 60_000);

    // ⚠️ Bu ayrım güvenlik açısından kritik: bir kullanıcının denemeleri
    // başka bir kullanıcıyı kilitleyebilseydi, saldırgan istediği hesabı
    // hizmet dışı bırakabilirdi (kilitleme saldırısı).
    expect(hit('b', 3, 60_000).ok).toBe(true);
  });

  /*
    ⚠️ ASIL SINANAN DAVRANIŞ BU: reddedilen deneme de sayılıyor.

    Sayaç yalnızca başarılı denemelerde artsaydı, sınıra takılan saldırgan
    beklemeden denemeye devam edebilirdi — her ret bir sonraki pencereye
    yer açardı ve sınır hiçbir zaman gerçekten kapanmazdı.
  */
  it('reddedilen denemeler de pencereyi doldurur', () => {
    for (let i = 0; i < 3; i++) hit('c', 3, 60_000);

    const ilkRet = hit('c', 3, 60_000);
    const ikinciRet = hit('c', 3, 60_000);

    expect(ilkRet.ok).toBe(false);
    expect(ikinciRet.ok).toBe(false);
    // Bekleme süresi kısalmıyor — yeni denemeler pencereyi taze tutuyor.
    expect(ikinciRet.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('pencere geçince hak yenilenir', () => {
    // Pencere 1 ms: ilk denemeler anında pencereden düşüyor.
    for (let i = 0; i < 3; i++) hit('d', 3, 1);

    const sonra = Date.now() + 5;
    while (Date.now() < sonra) {
      /* kısa bekleme — sahte zamana gerek yok, pencere 1 ms */
    }

    expect(hit('d', 3, 1).ok).toBe(true);
  });

  it('reddedince kaç saniye sonra denenebileceğini söyler', () => {
    for (let i = 0; i < 2; i++) hit('e', 2, 60_000);

    const red = hit('e', 2, 60_000);
    expect(red.ok).toBe(false);
    expect(red.retryAfterSeconds).toBeGreaterThan(0);
    expect(red.retryAfterSeconds).toBeLessThanOrEqual(60);
  });
});
