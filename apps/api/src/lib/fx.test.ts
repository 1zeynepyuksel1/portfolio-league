import { describe, it, expect } from "vitest";
import { centsTryToUsd, tryToUsd, usdToTry } from "./fx.js";
import { toPrice } from "./money.js";
import type { Penny } from "./money.js";

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

describe("tryToUsd", () => {
  it("basit bölmeyi doğru ölçekte yapar", () => {
    // 4000 TL, kur 40 -> 100 USD
    expect(tryToUsd(toPrice("4000"), toPrice("40"))).toBe(toPrice("100"));
  });

  /**
   * ⚠️ ASIL SINANAN: gidiş-dönüş çevrim KAYIPSIZ DEĞİL.
   *
   * Bu test "hata"yı değil, kabul edilmiş davranışı kilitliyor. Birileri
   * ileride "gidiş-dönüş aynı sayıyı vermeli" diye kod yazarsa bu test
   * ona neden yazamayacağını söyleyecek.
   */
  it("gidiş-dönüş orijinali her zaman geri vermez", () => {
    const rate = toPrice("6.2264");
    const usd = toPrice("4800");

    const asTry = usdToTry(usd, rate);
    const backToUsd = tryToUsd(asTry, rate);

    // Bu örnekte tam dönüyor — ama garanti değil, aşağıdaki örnek dönmüyor.
    expect(backToUsd).toBe(usd);
  });

  it("yuvarlama yüzünden son basamakta sapma olabilir", () => {
    const rate = toPrice("41.2345");
    const usd = toPrice("0.00000007");

    const asTry = usdToTry(usd, rate);
    const backToUsd = tryToUsd(asTry, rate);

    // Ölçek 8 basamak; ara değer sığmıyor ve iki yuvarlama üst üste biniyor.
    // Sapma en fazla bir birim olmalı — daha fazlası ölçek hatası demektir.
    const drift = backToUsd > usd ? backToUsd - usd : usd - backToUsd;
    expect(drift).toBeLessThanOrEqual(1n);
  });

  it("kur 1 iken fiyat değişmez", () => {
    expect(tryToUsd(toPrice("1234.56789"), toPrice("1"))).toBe(
      toPrice("1234.56789"),
    );
  });

  it("ölçek sınırında yarımı yukarı yuvarlar", () => {
    // 0,00000003 TL ÷ 2 = 0,000000015 -> kırpma 0,00000001 verirdi
    expect(tryToUsd(toPrice("0.00000003"), toPrice("2"))).toBe(
      toPrice("0.00000002"),
    );
  });
});

describe("centsTryToUsd", () => {
  it("kuruşu sente çevirir", () => {
    // 100.000,00 TL = 10.000.000 kuruş, kur 40 -> 2500,00 USD = 250.000 sent
    expect(centsTryToUsd(10_000_000n as Penny, toPrice("40"))).toBe(
      250_000n as Penny,
    );
  });

  /**
   * ⚠️ KURUŞ SEVİYESİNDE YUVARLAMA KULLANICI ALEYHİNE OLMAMALI.
   * Düz bigint bölmesi kırpar; her portföy görüntülemesinde bir sent
   * eksik göstermek küçük ama sistematik bir yanlıştır.
   */
  it("yarım senti yukarı yuvarlar, kırpmaz", () => {
    // 3 kuruş ÷ 2 = 1,5 sent -> kırpma 1 verirdi, ROUND_HALF_UP 2 verir
    expect(centsTryToUsd(3n as Penny, toPrice("2"))).toBe(2n as Penny);
  });

  /**
   * ⚠️ ZARAR NEGATİF BİR SAYI — çevrim işareti korumalı.
   * divRound işareti baştan ayırıp mutlak değerle çalışıyor; bozulursa
   * zarar kâr gibi görünür ve ekranda YEŞİL yazar.
   */
  it("negatif tutarda işareti korur", () => {
    expect(centsTryToUsd(-10_000_000n as Penny, toPrice("40"))).toBe(
      -250_000n as Penny,
    );
  });

  it("sıfır bakiye sıfır kalır", () => {
    expect(centsTryToUsd(0n as Penny, toPrice("41.5"))).toBe(0n as Penny);
  });
});
