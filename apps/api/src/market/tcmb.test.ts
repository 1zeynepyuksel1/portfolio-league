import { describe, it, expect, vi, afterEach } from "vitest";
import { TcmbAdapter } from "./tcmb.js";
import { toPrice } from "../lib/money.js";

/** TCMB yanıtının sadeleştirilmiş hâli — testin ihtiyacı olan alanlar. */
function xmlWith(rate: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="12.03.2020">
  <Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">
    <Unit>1</Unit>
    <ForexBuying>${rate}</ForexBuying>
    <ForexSelling>9.9999</ForexSelling>
  </Currency>
</Tarih_Date>`;
}

/**
 * Sahte fetch üretir.
 *
 * `rates` anahtarları TCMB dosya adındaki GGAAYYYY biçimindedir.
 * Listede olmayan her gün için 404 döner — yani "o gün kur yayımlanmamış".
 * Hafta sonunu böyle taklit ediyoruz; gerçek sunucuda bunu ayarlayamazdık.
 */
function mockFetch(rates: Record<string, string>) {
  return vi.fn(async (url: string) => {
    const day = url.match(/(\d{8})\.xml$/)?.[1];
    const rate = day ? rates[day] : undefined;

    if (!rate) return { ok: false, status: 404 };
    return { ok: true, status: 200, text: async () => xmlWith(rate) };
  });
}

// Her testten sonra gerçek fetch'i geri koy, yoksa testler birbirini etkiler.
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TcmbAdapter", () => {
  it("kurun yayımlandığı günde doğrudan döndürür", async () => {
    vi.stubGlobal("fetch", mockFetch({ "12032020": "6.2264" }));

    const r = await new TcmbAdapter().getUsdTry("2020-03-12");

    expect(r.rate).toBe(toPrice("6.2264"));
    expect(r.date).toBe("2020-03-12");
    expect(r.requestedDate).toBe("2020-03-12");
  });

  it("cumartesi cuma kuruna düşer (forward-fill)", async () => {
    // Sadece cuma yayımlanmış. Cumartesi ve pazar 404.
    vi.stubGlobal("fetch", mockFetch({ "13032020": "6.2711" }));

    const r = await new TcmbAdapter().getUsdTry("2020-03-14");

    expect(r.rate).toBe(toPrice("6.2711"));
    expect(r.date).toBe("2020-03-13"); // kurun geldiği gün
    expect(r.requestedDate).toBe("2020-03-14"); // sorduğumuz gün
  });

  it("pazar iki gün geriye gider", async () => {
    vi.stubGlobal("fetch", mockFetch({ "13032020": "6.2711" }));

    const r = await new TcmbAdapter().getUsdTry("2020-03-15");

    expect(r.date).toBe("2020-03-13");
  });

  it("ay sınırını geçerek geriye gidebilir", async () => {
    // 1 Mart pazar, 28 Şubat cuma. Dosya yolu da ay değiştirir: 202002/28022020
    vi.stubGlobal("fetch", mockFetch({ "28022020": "6.2000" }));

    const r = await new TcmbAdapter().getUsdTry("2020-03-01");

    expect(r.date).toBe("2020-02-28");
    expect(r.rate).toBe(toPrice("6.2"));
  });

  it("hiç kur bulunamazsa hata fırlatır", async () => {
    vi.stubGlobal("fetch", mockFetch({}));

    await expect(new TcmbAdapter().getUsdTry("2020-03-14")).rejects.toThrow(
      /bulunamadı/,
    );
  });

  it("sınırsız geriye gitmez", async () => {
    const f = mockFetch({});
    vi.stubGlobal("fetch", f);

    await expect(
      new TcmbAdapter().getUsdTry("2020-03-14"),
    ).rejects.toThrow();

    // MAX_LOOKBACK_DAYS = 10 -> en fazla 10 istek
    expect(f.mock.calls.length).toBe(10);
  });

  it("aynı günü ikinci kez sorunca ağa çıkmaz (önbellek)", async () => {
    const f = mockFetch({ "13032020": "6.2711" });
    vi.stubGlobal("fetch", f);

    const adapter = new TcmbAdapter();

    await adapter.getUsdTry("2020-03-14");
    const afterFirst = f.mock.calls.length;

    await adapter.getUsdTry("2020-03-14");

    expect(f.mock.calls.length).toBe(afterFirst);
  });

  it("USD bulunmayan yanıtta hata fırlatır", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => "<Tarih_Date></Tarih_Date>",
      })),
    );

    await expect(new TcmbAdapter().getUsdTry("2020-03-12")).rejects.toThrow(
      /okunamadı/,
    );
  });

  it("404 dışındaki hataları yutmaz", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500 })),
    );

    await expect(new TcmbAdapter().getUsdTry("2020-03-12")).rejects.toThrow(
      /500/,
    );
  });
});
