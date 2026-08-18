import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAndStorePrices } from "./price-cron.js";
import { toPrice } from "../lib/money.js";
import type { MarketDataProvider } from "./provider.js";

/**
 * Bu dosya veritabanına HİÇ dokunmaz.
 *
 * `vi.mock` ile repository modülünün tamamı sahtesiyle değiştiriliyor.
 * fetch mock'lamaktan farkı: orada global bir fonksiyonu değiştiriyorduk,
 * burada bir MODÜLÜN kendisini. Vitest, price-cron.ts "./repository.js"
 * dediğinde ona gerçek dosyayı değil bizim verdiğimizi teslim ediyor.
 *
 * Kazancı: Postgres çalışmasa bile testler geçer, milisaniyede biter, ve
 * "veritabanı yazması başarısız olursa ne olur" senaryosu uydurulabilir.
 */
vi.mock("./repository.js", () => ({
  listActiveAssets: vi.fn(),
  insertPrice: vi.fn(),
  latestPrice: vi.fn(),
}));

// mock'lanmış modülü içeri alıyoruz — artık sahte sürümü geliyor
import { listActiveAssets, insertPrice } from "./repository.js";

const ASSETS = [
  { id: "id-btc", symbol: "BTC", name: "Bitcoin" },
  { id: "id-eth", symbol: "ETH", name: "Ethereum" },
];

/** İstenen sembol için sabit fiyat döndüren sahte piyasa kaynağı. */
function fakeMarket(prices: Record<string, string>): MarketDataProvider {
  return {
    getLatest: vi.fn(async (symbol: string) => {
      const price = prices[symbol];
      if (!price) throw new Error(`${symbol} alınamadı`);
      return { date: "2026-08-18", price: toPrice(price) };
    }),
    getHistory: vi.fn(async () => []),
  };
}

function fakeFx(rate: string) {
  return {
    getUsdTry: vi.fn(async () => ({
      date: "2026-08-18",
      requestedDate: "2026-08-18",
      rate: toPrice(rate),
    })),
  };
}

beforeEach(() => {
  vi.mocked(listActiveAssets).mockReset();
  vi.mocked(insertPrice).mockReset();
});

describe("fetchAndStorePrices", () => {
  it("her varlık için TL fiyatı yazar", async () => {
    vi.mocked(listActiveAssets).mockResolvedValue(ASSETS);
    const market = fakeMarket({ BTC: "1000", ETH: "100" });

    const result = await fetchAndStorePrices(market, fakeFx("40"));

    expect(result.written).toBe(2);
    expect(result.failed).toEqual([]);

    // 1000 USD × 40 = 40.000 TL
    expect(vi.mocked(insertPrice).mock.calls[0]?.[2]).toBe("40000.00000000");
    // 100 USD × 40 = 4.000 TL
    expect(vi.mocked(insertPrice).mock.calls[1]?.[2]).toBe("4000.00000000");
  });

  it("bir varlık patlarsa diğerini yazmaya devam eder", async () => {
    // BTC listede yok -> fakeMarket hata fırlatacak. ETH sağlam.
    vi.mocked(listActiveAssets).mockResolvedValue(ASSETS);
    const market = fakeMarket({ ETH: "100" });

    const result = await fetchAndStorePrices(market, fakeFx("40"));

    expect(result.failed).toEqual(["BTC"]);
    expect(result.written).toBe(1);

    // Yazılan tek kayıt ETH olmalı
    expect(vi.mocked(insertPrice).mock.calls).toHaveLength(1);
    expect(vi.mocked(insertPrice).mock.calls[0]?.[0]).toBe("id-eth");
  });

  it("kur alınamazsa hiçbir şey yazmaz", async () => {
    // Kursuz TL fiyatı hesaplanamaz. Yarım veri yazmaktansa hiç yazmamak
    // doğru: eksik kayıt, olmayan kayıttan daha tehlikelidir.
    vi.mocked(listActiveAssets).mockResolvedValue(ASSETS);
    const brokenFx = {
      getUsdTry: vi.fn(async () => {
        throw new Error("TCMB yanıt vermedi");
      }),
    };

    await expect(
      fetchAndStorePrices(fakeMarket({ BTC: "1000" }), brokenFx),
    ).rejects.toThrow(/TCMB/);

    expect(vi.mocked(insertPrice).mock.calls).toHaveLength(0);
  });

  it("aktif varlık yoksa kura bile gitmez", async () => {
    vi.mocked(listActiveAssets).mockResolvedValue([]);
    const fx = fakeFx("40");

    const result = await fetchAndStorePrices(fakeMarket({}), fx);

    expect(result.written).toBe(0);
    expect(fx.getUsdTry).not.toHaveBeenCalled();
  });

  it("tüm varlıklara aynı zaman damgasını yazar", async () => {
    vi.mocked(listActiveAssets).mockResolvedValue(ASSETS);

    await fetchAndStorePrices(
      fakeMarket({ BTC: "1000", ETH: "100" }),
      fakeFx("40"),
    );

    const [firstTs, secondTs] = vi
      .mocked(insertPrice)
      .mock.calls.map((c) => c[1]);

    // Aynı turda yazılan kayıtlar aynı ana ait olmalı — aksi hâlde
    // "portföyün şu andaki değeri" hesabı iki farklı zamanı karıştırır.
    expect(firstTs).toEqual(secondTs);
  });
});
