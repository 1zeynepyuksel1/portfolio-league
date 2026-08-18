import { describe, it, expect, vi, afterEach } from "vitest";
import { BinanceAdapter } from "./binance.js";
import { toPrice } from "../lib/money.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/** 12 Mart 2020, 00:00 UTC */
const MAR12 = 1583971200000;

/**
 * Binance kline satırı üretir.
 * Gerçek yanıt nesne değil dizidir, sıra önemlidir:
 *   [açılışZamanı, açılış, enYüksek, enDüşük, kapanış, hacim, ...]
 */
function kline(openTime: number, close: string) {
  return [openTime, "0", "0", "0", close, "0", openTime + DAY_MS - 1];
}

/** Ardışık günlerden oluşan n adet mum. */
function klines(startMs: number, count: number, close = "100") {
  return Array.from({ length: count }, (_, i) =>
    kline(startMs + i * DAY_MS, close),
  );
}

/** Her çağrıda sırayla verilen sayfaları döndüren sahte fetch. */
function mockPages(...pages: unknown[][][]) {
  let call = 0;
  return vi.fn(async () => {
    const rows = pages[call] ?? [];
    call++;
    return { ok: true, status: 200, json: async () => rows };
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BinanceAdapter", () => {
  it("kapanış fiyatını doğru indeksten okur", async () => {
    // Dizideki 5. eleman (indeks 4) kapanıştır. Diğerleri kasten "0".
    vi.stubGlobal("fetch", mockPages([kline(MAR12, "4800.00000000")]));

    const points = await new BinanceAdapter().getHistory(
      "BTC",
      "2020-03-12",
      "2020-03-12",
    );

    expect(points).toHaveLength(1);
    expect(points[0]?.price).toBe(toPrice("4800"));
  });

  it("tarihi UTC olarak biçimlendirir", async () => {
    // 11 Mart 23:00 UTC = Türkiye'de 12 Mart 02:00.
    // Kod yerel saat kullansaydı "2020-03-12" derdi; UTC kullandığı için 11.
    vi.stubGlobal("fetch", mockPages([kline(MAR12 - 60 * 60 * 1000, "100")]));

    const points = await new BinanceAdapter().getHistory(
      "BTC",
      "2020-03-11",
      "2020-03-12",
    );

    expect(points[0]?.date).toBe("2020-03-11");
  });

  it("istek tarihini UTC epoch'a çevirir", async () => {
    const f = mockPages([]);
    vi.stubGlobal("fetch", f);

    await new BinanceAdapter().getHistory("BTC", "2020-03-12", "2020-03-12");

    // Yerel saat kullanılsaydı Türkiye'de 3 saat kayardı.
    expect(String((f.mock.calls as unknown[][])[0]?.[0])).toContain(`startTime=${MAR12}`);
  });

  it("1000 kayıt dolduğunda ikinci sayfayı ister", async () => {
    // İlk sayfa tam dolu -> devamı olabilir. İkinci sayfa yarım -> veri bitti.
    const f = mockPages(klines(MAR12, 1000), klines(MAR12 + 1000 * DAY_MS, 5));
    vi.stubGlobal("fetch", f);

    const points = await new BinanceAdapter().getHistory(
      "BTC",
      "2020-03-12",
      "2026-01-01",
    );

    expect(f.mock.calls.length).toBe(2);
    expect(points.length).toBe(1005);
  });

  it("sınırdan az kayıt gelirse ikinci istek atmaz", async () => {
    const f = mockPages(klines(MAR12, 5));
    vi.stubGlobal("fetch", f);

    await new BinanceAdapter().getHistory("BTC", "2020-03-12", "2026-01-01");

    expect(f.mock.calls.length).toBe(1);
  });

  it("bitiş tarihini geçen kayıtları atar", async () => {
    // Kaynak 5 gün döndürüyor ama biz 3 gün istedik.
    vi.stubGlobal("fetch", mockPages(klines(MAR12, 5)));

    const points = await new BinanceAdapter().getHistory(
      "BTC",
      "2020-03-12",
      "2020-03-14",
    );

    expect(points).toHaveLength(3);
    expect(points.at(-1)?.date).toBe("2020-03-14");
  });

  it("getLatest son noktayı döndürür", async () => {
    const now = Date.now();
    vi.stubGlobal(
      "fetch",
      mockPages([kline(now - DAY_MS, "100"), kline(now, "63718.01")]),
    );

    const point = await new BinanceAdapter().getLatest("BTC");

    expect(point.price).toBe(toPrice("63718.01"));
  });

  it("bilinmeyen sembolü reddeder", async () => {
    vi.stubGlobal("fetch", mockPages([]));

    await expect(new BinanceAdapter().getLatest("XAU")).rejects.toThrow(
      /desteklenmeyen/,
    );
  });

  it("bilinmeyen sembolde ağa hiç çıkmaz", async () => {
    const f = mockPages([]);
    vi.stubGlobal("fetch", f);

    await expect(new BinanceAdapter().getLatest("XAU")).rejects.toThrow();

    expect(f.mock.calls.length).toBe(0);
  });

  it("HTTP hatasını yutmaz", async () => {
    // fetch 500'de hata FIRLATMAZ, response.ok elle kontrol edilmeli.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500 })),
    );

    await expect(
      new BinanceAdapter().getHistory("BTC", "2020-03-12", "2020-03-12"),
    ).rejects.toThrow(/500/);
  });

  it("dizi olmayan yanıtı reddeder", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ code: -1121, msg: "Invalid symbol" }),
      })),
    );

    await expect(
      new BinanceAdapter().getHistory("BTC", "2020-03-12", "2020-03-12"),
    ).rejects.toThrow(/dizi değil/);
  });

  it("geçersiz tarihi reddeder", async () => {
    vi.stubGlobal("fetch", mockPages([]));

    await expect(
      new BinanceAdapter().getHistory("BTC", "12-03-2020", "2020-03-12"),
    ).rejects.toThrow(/Geçersiz tarih/);
  });
});
