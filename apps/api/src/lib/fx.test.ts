import { describe, it, expect } from "vitest";
import { usdToTry } from "./fx.js";
import { toPrice } from "./money.js";

describe("usdToTry", () => {
  it("basit çarpımı doğru ölçekte yapar", () => {
    // 100 USD, kur 40 -> 4000 TL
    expect(usdToTry(toPrice("100"), toPrice("40"))).toBe(toPrice("4000"));
  });

  it("gerçek veriyle doğrulanmış örnek", () => {
    // 12 Mart 2020: BTC 4800.00 USD, TCMB kuru 6.2264
    // 4800 × 6,2264 = 29.886,72
    expect(usdToTry(toPrice("4800"), toPrice("6.2264"))).toBe(
      toPrice("29886.72"),
    );
  });

  it("ölçek sınırında yarımı yukarı yuvarlar", () => {
    // 0,00000001 USD × 1,5 = 0,000000015
    // Fiyat ölçeği 8 basamak taşıyor, yani sonuç tam sığmıyor.
    // Kırpma olsaydı 0,00000001 çıkardı; ROUND_HALF_UP 0,00000002 verir.
    expect(usdToTry(toPrice("0.00000001"), toPrice("1.5"))).toBe(
      toPrice("0.00000002"),
    );
  });

  it("sıfır fiyat sıfır kalır", () => {
    expect(usdToTry(toPrice("0"), toPrice("47.81"))).toBe(toPrice("0"));
  });

  it("kur 1 iken fiyat değişmez", () => {
    expect(usdToTry(toPrice("1234.56789"), toPrice("1"))).toBe(
      toPrice("1234.56789"),
    );
  });
});
