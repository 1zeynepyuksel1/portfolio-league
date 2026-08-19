import { describe, it, expect } from "vitest";
import { toAmount, toPrice } from "../lib/money.js";
import {
  FEE_BASIS_POINTS,
  MIN_ORDER_PENNY,
  OrderValidationError,
  calculateOrder,
} from "./calculate.js";

/**
 * Bu dosyada mock YOK — ne `vi.fn()` ne `vi.mock`.
 * calculate.ts saf olduğu için sahte nesneye ihtiyaç duymuyor.
 * Saf katmanın en somut faydası bu.
 */

describe("calculateOrder — hesap", () => {
  it("brütü fiyat x miktar olarak hesaplar", () => {
    // 0,5 BTC x 3.000.000,50 TL = 1.500.000,25 TL
    const result = calculateOrder(
      "buy",
      toPrice("3000000.50"),
      toAmount("0.5"),
    );

    expect(result.gross).toBe(150000025n); // 1.500.000,25 TL
  });

  it("komisyonu binde bir alır", () => {
    const result = calculateOrder("buy", toPrice("3000000.50"), toAmount("0.5"));

    // 1.500.000,25 x %0,1 = 1.500,00 TL
    expect(result.fee).toBe(150000n);
  });

  it("alımda net = brüt + komisyon (hesaptan çıkan)", () => {
    const result = calculateOrder("buy", toPrice("3000000.50"), toAmount("0.5"));

    expect(result.net).toBe(150150025n); // 1.501.500,25 TL
    expect(result.net).toBe(result.gross + result.fee);
  });

  it("satımda net = brüt - komisyon (hesaba giren)", () => {
    const result = calculateOrder("sell", toPrice("3000000.50"), toAmount("0.5"));

    expect(result.net).toBe(149850025n); // 1.498.500,25 TL
    expect(result.net).toBe(result.gross - result.fee);
  });

  it("aynı emirde alım ile satım arasındaki fark iki kat komisyondur", () => {
    const price = toPrice("3000000.50");
    const quantity = toAmount("0.5");

    const buy = calculateOrder("buy", price, quantity);
    const sell = calculateOrder("sell", price, quantity);

    // Fiyat hiç değişmeden al-sat yapan kullanıcının kaybı budur.
    expect(buy.net - sell.net).toBe(buy.fee * 2n);
  });
});

describe("calculateOrder — yuvarlama", () => {
  it("komisyonda yarımı yukarı yuvarlar, kırpmaz", () => {
    // 15,00 TL brüt -> komisyon tam 1,5 kuruş.
    // Kırpsak 1 kuruş çıkardı; divRound yarımı sıfırdan uzağa yuvarlıyor.
    const result = calculateOrder("buy", toPrice("15"), toAmount("1"));

    expect(result.gross).toBe(1500n);
    expect(result.fee).toBe(2n); // 1 değil
    expect(result.net).toBe(1502n);
  });

  it("sonuçların hepsi bigint'tir — float sızmamıştır", () => {
    const result = calculateOrder("buy", toPrice("3000000.50"), toAmount("0.5"));

    expect(typeof result.gross).toBe("bigint");
    expect(typeof result.fee).toBe("bigint");
    expect(typeof result.net).toBe("bigint");
  });
});

describe("calculateOrder — doğrulama", () => {
  it("miktar sıfırsa reddeder", () => {
    expect(() =>
      calculateOrder("buy", toPrice("3000000"), toAmount("0")),
    ).toThrow(OrderValidationError);
  });

  it("miktar negatifse reddeder", () => {
    // Negatif miktarla alım karşılıksız para girişi olurdu:
    // brüt negatif çıkar, bakiyeden negatif düşülür, bakiye ARTAR.
    expect(() =>
      calculateOrder("buy", toPrice("3000000"), toAmount("-1")),
    ).toThrow(/sıfırdan büyük/);
  });

  it("fiyat sıfırsa reddeder", () => {
    // Cron bozuk veri yazmışsa emir motoru buna güvenmemeli.
    expect(() =>
      calculateOrder("buy", toPrice("0"), toAmount("1")),
    ).toThrow(/Fiyat/);
  });

  it("hata kodu taşır — router bunu HTTP durumuna çevirecek", () => {
    try {
      calculateOrder("buy", toPrice("3000000"), toAmount("0"));
      expect.unreachable("hata fırlatmalıydı");
    } catch (error) {
      expect(error).toBeInstanceOf(OrderValidationError);
      expect((error as OrderValidationError).code).toBe("INVALID_QUANTITY");
    }
  });
});

describe("calculateOrder — minimum tutar açığı", () => {
  it("yuvarlama sonrası sıfıra düşen emri reddeder", () => {
    // ⚠️ AÇIK: miktar sıfırdan büyük ama brüt kuruşa yuvarlanınca 0 oluyor.
    // Kontrol çarpımdan SONRA olmasaydı kullanıcı 0 kuruş ödeyip varlık alırdı.
    // Döngüye sokulursa sınırsız varlık üretir.
    let thrown: unknown;
    try {
      calculateOrder("buy", toPrice("3000000"), toAmount("0.0000000001"));
    } catch (error) {
      thrown = error;
    }

    expect((thrown as OrderValidationError).code).toBe("AMOUNT_TOO_SMALL");
  });

  it("minimum tutarın tam üstünde geçer", () => {
    // 1 birim x 1,00 TL = 1,00 TL = tam sınır
    const result = calculateOrder("buy", toPrice("1.00"), toAmount("1"));

    expect(result.gross).toBe(MIN_ORDER_PENNY);
  });

  it("minimum tutarın hemen altında reddeder", () => {
    // 0,99 birim x 1,00 TL = 0,99 TL — sınırın 1 kuruş altı
    expect(() =>
      calculateOrder("buy", toPrice("1.00"), toAmount("0.99")),
    ).toThrow(/en az/);
  });
});

describe("sabitler", () => {
  it("komisyon oranı binde bir (10 baz puan)", () => {
    // Oran değişirse bu test kırılır ve karar bilinçli alınmış olur.
    expect(FEE_BASIS_POINTS).toBe(10);
  });

  it("minimum emir tutarı 1 TL", () => {
    expect(MIN_ORDER_PENNY).toBe(100n);
  });
});
