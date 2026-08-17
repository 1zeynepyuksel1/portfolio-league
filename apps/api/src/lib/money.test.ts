import { describe, it, expect } from "vitest";
import {
  divRound,
  toPenny,
  toPrice,
  toAmount,
  calcGross,
  addPenny,
  parseScaled,
  formatScaled,
  formatTRY,
} from "./money.js";

describe("divRound", () => {
  it("yarımı sıfırdan uzağa yuvarlar", () => {
    expect(divRound(7n, 2n)).toBe(4n);
    expect(divRound(-7n, 2n)).toBe(-4n);
  });

  it("aşağı yuvarlamayı da doğru yapar", () => {
    expect(divRound(5n, 2n)).toBe(3n);
    expect(divRound(1n, 3n)).toBe(0n);
  });

  it("sıfıra bölmeyi reddeder", () => {
    expect(() => divRound(1n, 0n)).toThrow();
  });
});

describe("para aritmetiği", () => {
  it("0.1 + 0.2 problemi bizde yok", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(toPenny("0.1") + toPenny("0.2")).toBe(toPenny("0.3"));
  });

  it("farklı ölçekleri toplamayı reddeder", () => {
    // @ts-expect-error Price, Penny parametresine verilemez
    addPenny(toPenny("1"), toPrice("2"));
  });

  it("brüt tutarı doğru ölçekte hesaplar", () => {
    expect(calcGross(toPrice("5000"), toAmount("2.5"))).toBe(1250000n);
  });
});

describe("parse ve format", () => {
  it("gidiş-dönüş kayıpsız", () => {
    expect(formatScaled(parseScaled("1234.56", 2), 2)).toBe("1234.56");
  });

  it("fazla ondalık basamağı reddeder", () => {
    expect(() => toPenny("1.234")).toThrow();
  });

  it("Türkçe para biçimine dönüştürür", () => {
    expect(formatTRY(toPenny("12345.67"))).toBe("12.345,67 ₺");
  });
});
