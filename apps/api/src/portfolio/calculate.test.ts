import { describe, it, expect } from "vitest";
import { toAmount, toPenny, toPrice } from "../lib/money.js";
import type { Penny } from "../lib/money.js";
import {
  calculatePortfolio,
  calculateProfit,
  percentOf,
} from "./calculate.js";

/** Kısaltma — testler okunur kalsın. */
const position = (
  symbol: string,
  quantity: string,
  price: string | null,
) => ({
  symbol,
  name: symbol,
  quantity: toAmount(quantity),
  price: price === null ? null : toPrice(price),
  asOf: price === null ? null : new Date("2026-08-19T12:00:00Z"),
});

describe("percentOf", () => {
  it("payı yüzdeye çevirir, iki ondalık", () => {
    expect(percentOf(1100n, 10000n)).toBe("11.00");
  });

  it("küsuratlı oranı yuvarlar", () => {
    // 1/3 = %33,333... -> "33.33"
    expect(percentOf(1n, 3n)).toBe("33.33");
  });

  it("sıfıra bölmede hata fırlatmaz, null döner", () => {
    // Portföy boşken bu NORMAL bir durum, hata değil.
    expect(percentOf(100n, 0n)).toBeNull();
  });
});

describe("calculatePortfolio", () => {
  it("pozisyon değerini miktar x fiyat olarak hesaplar", () => {
    const result = calculatePortfolio(0n as Penny, [
      position("BTC", "0.001", "3000000"),
    ]);

    // 0,001 x 3.000.000 = 3.000 TL = 300000 kuruş
    expect(result.positions[0]?.valueCents).toBe(300000n);
  });

  it("toplam = nakit + pozisyonlar", () => {
    const result = calculatePortfolio(toPenny("96911.26"), [
      position("BTC", "0.001", "3000000"), // 3.000,00 TL
    ]);

    expect(result.cashCents).toBe(9691126n);
    expect(result.positionsValueCents).toBe(300000n);
    expect(result.totalValueCents).toBe(9991126n); // 99.911,26 TL
  });

  it("birden fazla pozisyonu toplar", () => {
    const result = calculatePortfolio(0n as Penny, [
      position("BTC", "0.001", "3000000"), // 300000
      position("ETH", "0.1", "90000"), //    900000
    ]);

    expect(result.positionsValueCents).toBe(1200000n);
  });

  it("pay yüzdelerini toplam üzerinden hesaplar", () => {
    const result = calculatePortfolio(toPenny("5000"), [
      position("BTC", "0.001", "3000000"), // 3.000 TL
      position("ETH", "0.1", "20000"), //     2.000 TL
    ]);

    // Toplam 10.000 TL -> BTC %30, ETH %20, nakit %50
    expect(result.totalValueCents).toBe(1000000n);
    expect(result.positions[0]?.sharePercent).toBe("30.00");
    expect(result.positions[1]?.sharePercent).toBe("20.00");
  });

  it("boş portföyde toplam nakde eşittir", () => {
    const result = calculatePortfolio(toPenny("100000"), []);

    expect(result.totalValueCents).toBe(10000000n);
    expect(result.positions).toHaveLength(0);
    expect(result.hasIncompletePrices).toBe(false);
  });
});

describe("calculatePortfolio — fiyatı olmayan varlık", () => {
  it("değeri null bırakır, listeden düşürmez", () => {
    // Kullanıcı varlığını görmeye devam etmeli, sadece değeri "—" olmalı.
    // Listeden düşürseydik varlığının kaybolduğunu sanırdı.
    const result = calculatePortfolio(0n as Penny, [
      position("YENI", "5", null),
    ]);

    expect(result.positions).toHaveLength(1);
    expect(result.positions[0]?.valueCents).toBeNull();
    expect(result.positions[0]?.sharePercent).toBeNull();
  });

  it("eksik fiyatı bayrakla bildirir", () => {
    // ⚠️ Bu bayrak olmasaydı ekran sessizce DÜŞÜK bir toplam gösterirdi.
    const result = calculatePortfolio(0n as Penny, [
      position("BTC", "0.001", "3000000"),
      position("YENI", "5", null),
    ]);

    expect(result.hasIncompletePrices).toBe(true);
    // Toplam sadece fiyatı bilinenden oluşuyor
    expect(result.totalValueCents).toBe(300000n);
  });
});

describe("calculateProfit", () => {
  it("kâr = toplam değer - yatırılan", () => {
    const result = calculateProfit(toPenny("110000"), toPenny("100000"));

    expect(result.profitCents).toBe(1000000n); // 10.000 TL
    expect(result.profitPercent).toBe("10.00");
  });

  it("zararı negatif verir", () => {
    const result = calculateProfit(toPenny("96911.26"), toPenny("100000"));

    expect(result.profitCents).toBe(-308874n); // -3.088,74 TL
    expect(result.profitPercent).toBe("-3.09");
  });

  it("hiç para yatırılmamışsa yüzde null", () => {
    const result = calculateProfit(toPenny("0"), toPenny("0"));

    expect(result.profitCents).toBe(0n);
    expect(result.profitPercent).toBeNull();
  });
});
