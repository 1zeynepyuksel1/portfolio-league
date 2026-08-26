import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAndStorePrices, resetStockSchedule } from "./price-cron.js";
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
  { id: "id-btc", symbol: "BTC", name: "Bitcoin", kind: "crypto" as const },
  { id: "id-eth", symbol: "ETH", name: "Ethereum", kind: "crypto" as const },
];

/** İstenen sembol için sabit fiyat döndüren sahte piyasa kaynağı. */
function fakeMarket(prices: Record<string, string>): MarketDataProvider {
  return {
    getLatest: vi.fn(async (symbol: string) => {
      const price = prices[symbol];
      if (!price) throw new Error(`${symbol} alınamadı`);
      return {
        date: "2026-08-18",
        openTime: Date.parse("2026-08-18T00:00:00Z"),
        price: toPrice(price),
      };
    }),
    getHistory: vi.fn(async () => []),
  };
}

/**
 * Sahte kur kaynağı.
 *
 * `rates` para birimi -> kur. `getUsdTry` artık `getRate("USD", ...)`
 * kısayolu olduğu için ikisi de aynı tablodan besleniyor.
 */
function fakeFx(usdRate: string, rates: Record<string, string> = {}) {
  const table: Record<string, string> = { USD: usdRate, ...rates };

  const getRate = vi.fn(async (code: string, date: string) => {
    const rate = table[code];
    if (!rate) throw new Error(`${code} kuru yok`);
    return {
      date: "2026-08-18",
      requestedDate: date,
      rate: toPrice(rate),
    };
  });

  return {
    getRate,
    getUsdTry: vi.fn(async (date: string) => getRate("USD", date)),
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
      getRate: vi.fn(async () => {
        throw new Error("TCMB yanıt vermedi");
      }),
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

  /**
   * ⚠️ BU TEST BİR HATAYI KİLİTLİYOR.
   * Eskiden her varlık Binance'e soruluyordu. USD ve EUR'un Binance'te
   * USDT paritesi olmadığı için cron her turda — 15 saniyede bir — üç
   * varlık için hata basıyordu. Artık tür kaynağı belirliyor.
   */
  it("döviz varlığını Binance'e değil TCMB'ye sorar", async () => {
    vi.mocked(listActiveAssets).mockResolvedValue([
      { id: "id-btc", symbol: "BTC", name: "Bitcoin", kind: "crypto" as const },
      { id: "id-eur", symbol: "EUR", name: "Euro", kind: "fx" as const },
    ]);

    const market = fakeMarket({ BTC: "1000" }); // EUR bilerek yok
    const fx = fakeFx("40", { EUR: "45.5" });

    const result = await fetchAndStorePrices(market, fx);

    expect(result.written).toBe(2);
    expect(result.failed).toEqual([]);

    // Binance'e YALNIZCA BTC sorulmuş olmalı
    expect(vi.mocked(market.getLatest).mock.calls.map((c) => c[0])).toEqual([
      "BTC",
    ]);

    // Döviz TL cinsinden geliyor: çevrim YOK, kur doğrudan fiyat.
    expect(vi.mocked(insertPrice).mock.calls[1]?.[2]).toBe("45.50000000");
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

/**
 * ABD HİSSELERİ — seans ve kadans davranışı.
 *
 * ⚠️ SAHTE SAAT ZORUNLU. `isRegularSessionOpen()` gerçek saati okuyor;
 * bu testler gerçek saatle yazılsaydı sonuçları GÜNÜN SAATİNE bağlı olurdu.
 * Batuhan akşam çalışırken geçer, sabah çalışırken düşerdi — ve sebebi
 * kodda değil takvimde olduğu için saatlerce aranırdı.
 *
 * `toFake: ["Date"]` ile SADECE saat sahteleniyor. Hepsini sahtelersek
 * (setTimeout dahil) `await` zincirleri ilerlemez ve testler asılı kalır.
 */
describe("fetchAndStorePrices · ABD hisseleri", () => {
  const STOCK_ASSETS = [
    { id: "id-aapl", symbol: "AAPL", name: "Apple", kind: "stock" as const },
    { id: "id-msft", symbol: "MSFT", name: "Microsoft", kind: "stock" as const },
  ];

  // 26 Ağustos 2026 Çarşamba, 11:00 New York -> seans AÇIK
  const MARKET_OPEN = new Date("2026-08-26T15:00:00Z");
  // 29 Ağustos 2026 Cumartesi -> seans KAPALI
  const MARKET_CLOSED = new Date("2026-08-29T15:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    resetStockSchedule();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("seans açıkken hisse fiyatı yazılır", async () => {
    vi.setSystemTime(MARKET_OPEN);
    vi.mocked(listActiveAssets).mockResolvedValue(STOCK_ASSETS);

    const stock = fakeMarket({ AAPL: "200", MSFT: "400" });
    const result = await fetchAndStorePrices(
      fakeMarket({}),
      fakeFx("40"),
      fakeMarket({}),
      stock,
    );

    expect(result.written).toBe(2);
    expect(result.skipped).toBe(0);
    expect(stock.getLatest).toHaveBeenCalledTimes(2);

    // 200 USD × 40 = 8.000 TL
    expect(vi.mocked(insertPrice).mock.calls[0]![2]).toBe("8000.00000000");
  });

  it("piyasa KAPALIYKEN Yahoo'ya hiç sorulmaz", async () => {
    vi.setSystemTime(MARKET_CLOSED);
    vi.mocked(listActiveAssets).mockResolvedValue(STOCK_ASSETS);

    const stock = fakeMarket({ AAPL: "200", MSFT: "400" });
    const result = await fetchAndStorePrices(
      fakeMarket({}),
      fakeFx("40"),
      fakeMarket({}),
      stock,
    );

    expect(result.written).toBe(0);
    expect(result.skipped).toBe(2);

    // ⚠️ ASIL KANIT: ağ isteği HİÇ yapılmadı.
    // Sadece `written === 0` baksaydık, "istek atıldı ama yazma başarısız"
    // senaryosu da testi geçerdi.
    expect(stock.getLatest).not.toHaveBeenCalled();

    // Atlanan varlık HATA sayılmamalı — log'a uyarı basılmasın.
    expect(result.failed).toEqual([]);
  });

  it("60 saniye dolmadan ikinci tur hisseyi atlar", async () => {
    vi.setSystemTime(MARKET_OPEN);
    vi.mocked(listActiveAssets).mockResolvedValue(STOCK_ASSETS);

    const stock = fakeMarket({ AAPL: "200", MSFT: "400" });

    const first = await fetchAndStorePrices(
      fakeMarket({}), fakeFx("40"), fakeMarket({}), stock,
    );
    expect(first.written).toBe(2);

    // 15 saniye sonra — bir sonraki normal cron turu
    vi.setSystemTime(new Date(MARKET_OPEN.getTime() + 15_000));

    const second = await fetchAndStorePrices(
      fakeMarket({}), fakeFx("40"), fakeMarket({}), stock,
    );
    expect(second.written).toBe(0);
    expect(second.skipped).toBe(2);
    expect(stock.getLatest).toHaveBeenCalledTimes(2); // artmadı

    // 60 saniye dolunca tekrar çekilir
    vi.setSystemTime(new Date(MARKET_OPEN.getTime() + 61_000));

    const third = await fetchAndStorePrices(
      fakeMarket({}), fakeFx("40"), fakeMarket({}), stock,
    );
    expect(third.written).toBe(2);
    expect(stock.getLatest).toHaveBeenCalledTimes(4);
  });

  it("hisse atlansa bile kripto aynı turda yazılmaya devam eder", async () => {
    vi.setSystemTime(MARKET_CLOSED);
    vi.mocked(listActiveAssets).mockResolvedValue([...ASSETS, ...STOCK_ASSETS]);

    const result = await fetchAndStorePrices(
      fakeMarket({ BTC: "1000", ETH: "100" }),
      fakeFx("40"),
      fakeMarket({}),
      fakeMarket({ AAPL: "200", MSFT: "400" }),
    );

    // Kripto 7/24 — hafta sonu da yazılmalı.
    expect(result.written).toBe(2);
    expect(result.skipped).toBe(2);
    expect(result.failed).toEqual([]);
  });
});
