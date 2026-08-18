import { describe, it, expect, vi } from "vitest";

// Bu test yalnızca saf dönüşüm fonksiyonunu sınıyor; veritabanına
// bağlanmasın diye db istemcisi mock'lanıyor.
vi.mock("../db/client.js", () => ({ db: {} }));

import { toUtcDate } from "./repository.js";

describe("toUtcDate", () => {
  it("timezone'suz string'i UTC olarak yorumlar", () => {
    // PostgreSQL'in `timestamp` kolonu böyle bir string döndürüyor.
    // Saat dilimi bilgisi YOK. Yerel saat sanılırsa Türkiye'de 3 saat kayar.
    const result = toUtcDate("2026-08-18 09:50:00.146");

    expect(result?.toISOString()).toBe("2026-08-18T09:50:00.146Z");
  });

  it("saati kaydırmaz", () => {
    // Kayma olsaydı saat 12 çıkardı (UTC+3).
    expect(toUtcDate("2026-08-18 09:00:00")?.getUTCHours()).toBe(9);
  });

  it("zaten ISO olan string'i bozmaz", () => {
    expect(toUtcDate("2026-08-18T09:50:00.000Z")?.toISOString()).toBe(
      "2026-08-18T09:50:00.000Z",
    );
  });

  it("Date nesnesini olduğu gibi geçirir", () => {
    const date = new Date("2026-08-18T09:50:00.000Z");
    expect(toUtcDate(date)).toBe(date);
  });

  it("null'ı null bırakır", () => {
    // Fiyatı hiç çekilmemiş varlık — uydurulmuş tarih dönmemeli.
    expect(toUtcDate(null)).toBeNull();
  });
});
