import { describe, it, expect, vi, afterEach } from "vitest";
import { TcmbAdapter } from "./tcmb.js";
import { toPrice } from "../lib/money.js";

type FakeCurrency = {
  code: string;
  unit: number;
  /** null -> `<ForexBuying/>`, yani o gün o kur boş yayımlanmış. */
  buying: string | null;
};

/** Çok para birimli TCMB yanıtı üretir. */
function xmlOf(currencies: FakeCurrency[]): string {
  const body = currencies
    .map(
      (c) => `
  <Currency CrossOrder="0" Kod="${c.code}" CurrencyCode="${c.code}">
    <Unit>${c.unit}</Unit>
    <Isim>TEST</Isim>
    ${c.buying === null ? "<ForexBuying/>" : `<ForexBuying>${c.buying}</ForexBuying>`}
    <ForexSelling>9.9999</ForexSelling>
  </Currency>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="12.03.2020">${body}
</Tarih_Date>`;
}

/** Tek USD'li kısayol — eski testler bunu kullanıyor. */
function xmlWith(rate: string): string {
  return xmlOf([{ code: "USD", unit: 1, buying: rate }]);
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
      /USD bulunamadı/,
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

describe("TcmbAdapter — çok para birimi", () => {
  const DOC = xmlOf([
    { code: "USD", unit: 1, buying: "29.4382" },
    { code: "EUR", unit: 1, buying: "32.5739" },
    { code: "JPY", unit: 100, buying: "20.7467" },
  ]);

  function serve(xml: string) {
    return vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => xml,
    }));
  }

  it("her para birimi için kendi kurunu döndürür", async () => {
    vi.stubGlobal("fetch", serve(DOC));
    const adapter = new TcmbAdapter();

    expect((await adapter.getRate("USD", "2024-01-02")).rate).toBe(
      toPrice("29.4382"),
    );
    expect((await adapter.getRate("EUR", "2024-01-02")).rate).toBe(
      toPrice("32.5739"),
    );
  });

  /**
   * ⚠️ PROJEDEKİ EN SİNSİ TUZAKLARDAN BİRİ.
   * TCMB yeni 100 birim üzerinden yayımlıyor. Bölmezsek yen 100 kat
   * pahalı görünür — ve 20 TL "makul" durduğu için kimse fark etmez.
   */
  it("JPY'yi 100'e bölerek bir birime indirir", async () => {
    vi.stubGlobal("fetch", serve(DOC));

    const r = await new TcmbAdapter().getRate("JPY", "2024-01-02");

    // 20,7467 / 100 = 0,207467
    expect(r.rate).toBe(toPrice("0.207467"));
  });

  /**
   * TCMB bir gün birimi değiştirirse sessizce yanlış hesaplamaktansa
   * patlamayı seçiyoruz. Sessiz kalsaydı kur 100 kat kayardı.
   */
  it("belgedeki birim tablomuzla uyuşmazsa hata fırlatır", async () => {
    vi.stubGlobal(
      "fetch",
      serve(xmlOf([{ code: "JPY", unit: 1, buying: "0.2074" }])),
    );

    await expect(
      new TcmbAdapter().getRate("JPY", "2024-01-02"),
    ).rejects.toThrow(/birimi değişmiş/);
  });

  /**
   * ⚠️ ESKİ AYRIŞTIRICININ GERÇEK HATASI.
   * `CurrencyCode="USD"[\s\S]*?<ForexBuying>` deseni belge sonuna kadar
   * gidebiliyordu. USD'nin kuru o gün boşsa desen SONRAKİ para biriminin
   * kurunu yakalar, hata vermez, yanlış sayı döndürürdü.
   */
  it("kur boşsa sonraki para biriminin kuruna sızmaz", async () => {
    vi.stubGlobal(
      "fetch",
      serve(
        xmlOf([
          { code: "USD", unit: 1, buying: null }, // boş
          { code: "EUR", unit: 1, buying: "32.5739" },
        ]),
      ),
    );

    await expect(
      new TcmbAdapter().getRate("USD", "2024-01-02"),
    ).rejects.toThrow(/alış kuru boş/);
  });

  /**
   * TCMB bütün kurları TEK dosyada yayımlıyor. Önbellek kura göre değil
   * belgeye göre tutuluyor; 8 döviz 8 istek değil 1 istek etmeli.
   * Cron 15 saniyede bir çalıştığı için bu fark günde ~46.000 istek.
   */
  it("aynı günün üç kuru için tek istek atar", async () => {
    const f = serve(DOC);
    vi.stubGlobal("fetch", f);

    const adapter = new TcmbAdapter();
    await adapter.getRate("USD", "2024-01-02");
    await adapter.getRate("EUR", "2024-01-02");
    await adapter.getRate("JPY", "2024-01-02");

    expect(f.mock.calls.length).toBe(1);
  });

  it("tanımsız para birimini reddeder", async () => {
    vi.stubGlobal("fetch", serve(DOC));

    await expect(
      new TcmbAdapter().getRate("XYZ", "2024-01-02"),
    ).rejects.toThrow(/Desteklenmeyen/);
  });
});
