import { describe, expect, it } from 'vitest';
import {
  describeNextSessionOpen,
  isRegularSessionOpen,
  nextSessionOpen,
} from './market-hours.js';

/**
 * ⚠️ TESTLER UTC DAMGASIYLA YAZILIYOR, YEREL SAATLE DEĞİL.
 *
 * `new Date('2026-08-26T13:30:00Z')` her makinede aynı anı gösterir.
 * `new Date(2026, 7, 26, 13, 30)` ise makinenin yerel dilimine göre
 * değişir — test Batuhan'ın makinesinde geçip CI'da düşerdi.
 */

describe('isRegularSessionOpen · yaz saati (EDT, UTC-4)', () => {
  // 26 Ağustos 2026 Çarşamba. Ölçüldü: Yahoo o gün gmtoffset -14400 diyor.
  it('09:30 ET tam açılış anı — AÇIK', () => {
    expect(isRegularSessionOpen(new Date('2026-08-26T13:30:00Z'))).toBe(true);
  });

  it('09:29 ET — henüz kapalı', () => {
    expect(isRegularSessionOpen(new Date('2026-08-26T13:29:00Z'))).toBe(false);
  });

  it('11:00 ET seans ortası — açık', () => {
    expect(isRegularSessionOpen(new Date('2026-08-26T15:00:00Z'))).toBe(true);
  });

  it('15:59 ET — son dakika hâlâ açık', () => {
    expect(isRegularSessionOpen(new Date('2026-08-26T19:59:00Z'))).toBe(true);
  });

  it('16:00 ET kapanış zili — KAPALI', () => {
    // Üst sınır HARİÇ. `<=` yazılsaydı burada bir dakikalık pencere kalırdı.
    expect(isRegularSessionOpen(new Date('2026-08-26T20:00:00Z'))).toBe(false);
  });
});

describe('isRegularSessionOpen · kış saati (EST, UTC-5)', () => {
  /**
   * ⚠️ BU BLOK TESTİN ASIL SEBEBİ.
   *
   * Aynı UTC saati (13:30) yazın AÇIK, kışın KAPALI. Çünkü New York
   * yazın UTC-4, kışın UTC-5. Saat dilimini sabit yazsaydık yılın
   * yarısında bir saat kayardık ve bu SESSİZ bir hata olurdu: seans
   * açılışında 60 dakika boyunca "piyasa kapalı" derdik.
   *
   * 15 Ocak 2026 Perşembe.
   */
  it('13:30 UTC kışın 08:30 ET demek — KAPALI', () => {
    expect(isRegularSessionOpen(new Date('2026-01-15T13:30:00Z'))).toBe(false);
  });

  it('14:30 UTC kışın 09:30 ET demek — AÇIK', () => {
    expect(isRegularSessionOpen(new Date('2026-01-15T14:30:00Z'))).toBe(true);
  });

  it('21:00 UTC kışın 16:00 ET demek — KAPALI', () => {
    expect(isRegularSessionOpen(new Date('2026-01-15T21:00:00Z'))).toBe(false);
  });
});

describe('isRegularSessionOpen · hafta sonu', () => {
  it('cumartesi seans saatinde bile kapalı', () => {
    // 29 Ağustos 2026 Cumartesi, 15:00 UTC = 11:00 ET
    expect(isRegularSessionOpen(new Date('2026-08-29T15:00:00Z'))).toBe(false);
  });

  it('pazar seans saatinde bile kapalı', () => {
    expect(isRegularSessionOpen(new Date('2026-08-30T15:00:00Z'))).toBe(false);
  });
});

describe('nextSessionOpen', () => {
  it('seans öncesi sorulunca aynı günün 09:30 ET anını verir', () => {
    // Çarşamba 06:00 ET
    const next = nextSessionOpen(new Date('2026-08-26T10:00:00Z'));
    expect(next?.toISOString()).toBe('2026-08-26T13:30:00.000Z');
  });

  it('kapanıştan sonra ERTESİ GÜN 09:30 ET', () => {
    // Çarşamba 16:30 ET -> Perşembe 09:30 ET
    const next = nextSessionOpen(new Date('2026-08-26T20:30:00Z'));
    expect(next?.toISOString()).toBe('2026-08-27T13:30:00.000Z');
  });

  it('cuma kapanışından sonra PAZARTESİ 09:30 ET — hafta sonunu atlar', () => {
    // 28 Ağustos 2026 Cuma 17:00 ET -> 31 Ağustos Pazartesi 09:30 ET
    const next = nextSessionOpen(new Date('2026-08-28T21:00:00Z'));
    expect(next?.toISOString()).toBe('2026-08-31T13:30:00.000Z');
  });

  it('dönen an gerçekten AÇIK, bir dakika öncesi KAPALI', () => {
    // Tarama mantığının kendi kendini doğrulaması: sınırı tam yakaladık mı?
    const next = nextSessionOpen(new Date('2026-08-28T21:00:00Z'));
    expect(next).not.toBeNull();
    expect(isRegularSessionOpen(next!)).toBe(true);
    expect(isRegularSessionOpen(new Date(next!.getTime() - 60_000))).toBe(false);
  });

  it('kış saatine geçişin ötesini sorunca da sınırı doğru bulur', () => {
    // 30 Ekim 2026 Cuma kapanışı. ABD 1 Kasım 2026'da kış saatine geçiyor,
    // yani sonraki pazartesi (2 Kasım) EST: 09:30 ET = 14:30 UTC.
    const next = nextSessionOpen(new Date('2026-10-30T21:00:00Z'));
    expect(next?.toISOString()).toBe('2026-11-02T14:30:00.000Z');
  });
});

describe('describeNextSessionOpen', () => {
  it('mesajı Türkiye saatiyle veriyor', () => {
    // Cuma kapanışı -> pazartesi 09:30 ET = 13:30 UTC = 16:30 TSİ
    const text = describeNextSessionOpen(new Date('2026-08-28T21:00:00Z'));
    expect(text).toContain('Piyasa kapalı');
    expect(text).toContain('16:30');
    expect(text).toContain('Pazartesi');
  });
});
