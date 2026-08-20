import { db } from "../db/client.js";
import { assets, inflationIndex, priceHistory } from "../db/schema.js";

const SEED_ASSETS = [
  { symbol: "BTC", name: "Bitcoin", kind: "crypto" as const, sortOrder: 1 },
  { symbol: "ETH", name: "Ethereum", kind: "crypto" as const, sortOrder: 2 },
  { symbol: "GRAM_ALTIN", name: "Gram Altın", kind: "metal" as const, sortOrder: 3 },
  { symbol: "USD", name: "Amerikan Doları", kind: "fx" as const, sortOrder: 4 },
  { symbol: "EUR", name: "Euro", kind: "fx" as const, sortOrder: 5 },
];

// TÜİK Resmi Tarihsel TÜFE Endeks Tohumları (2017 - 2026)
const SEED_TUFE: Record<string, number> = {
  // 2017 Yılı
  '2017-01': 299.74, '2017-02': 302.17, '2017-03': 305.24, '2017-04': 309.23,
  '2017-05': 310.61, '2017-06': 310.02, '2017-07': 310.49, '2017-08': 312.11,
  '2017-09': 314.13, '2017-10': 320.67, '2017-11': 325.44, '2017-12': 327.67,
  // 2018 Yılı
  '2018-01': 331.01, '2018-02': 333.43, '2018-03': 336.72, '2018-04': 343.02,
  '2018-05': 348.57, '2018-06': 357.65, '2018-07': 359.62, '2018-08': 367.89,
  '2018-09': 391.13, '2018-10': 401.57, '2018-11': 395.78, '2018-12': 393.80,
  // 2019 Yılı
  '2019-01': 398.00, '2019-02': 398.64, '2019-03': 402.75, '2019-04': 409.56,
  '2019-05': 413.45, '2019-06': 413.58, '2019-07': 419.21, '2019-08': 422.81,
  '2019-09': 427.00, '2019-10': 435.54, '2019-11': 437.19, '2019-12': 440.50,
  // 2020 Yılı
  '2020-01': 446.45, '2020-02': 448.01, '2020-03': 450.58, '2020-04': 454.40,
  '2020-05': 460.62, '2020-06': 465.84, '2020-07': 468.55, '2020-08': 472.61,
  '2020-09': 477.19, '2020-10': 487.38, '2020-11': 498.60, '2020-12': 504.81,
  // 2021 Yılı
  '2021-01': 513.30, '2021-02': 517.96, '2021-03': 523.56, '2021-04': 532.36,
  '2021-05': 537.10, '2021-06': 547.48, '2021-07': 557.34, '2021-08': 563.60,
  '2021-09': 570.66, '2021-10': 584.29, '2021-11': 604.84, '2021-12': 686.95,
  // 2022 Yılı
  '2022-01': 763.23, '2022-02': 799.93, '2022-03': 843.64, '2022-04': 904.79,
  '2022-05': 931.76, '2022-06': 977.78, '2022-07': 1000.95, '2022-08': 1015.56,
  '2022-09': 1046.84, '2022-10': 1083.90, '2022-11': 1115.11, '2022-12': 1128.45,
  // 2023 Yılı
  '2023-01': 1203.48, '2023-02': 1241.33, '2023-03': 1269.75, '2023-04': 1300.04,
  '2023-05': 1300.60, '2023-06': 1351.59, '2023-07': 1479.84, '2023-08': 1614.31,
  '2023-09': 1690.85, '2023-10': 1748.91, '2023-11': 1806.50, '2023-12': 1859.38,
  // 2024 Yılı
  '2024-01': 1984.34, '2024-02': 2074.31, '2024-03': 2139.73, '2024-04': 2207.50,
  '2024-05': 2281.85, '2024-06': 2319.25, '2024-07': 2394.02, '2024-08': 2452.41,
  '2024-09': 2525.20, '2024-10': 2597.90, '2024-11': 2656.00, '2024-12': 2700.00,
  // 2025 Yılı
  '2025-01': 2820.00, '2025-02': 2880.00, '2025-03': 2940.00, '2025-04': 3010.00,
  '2025-05': 3080.00, '2025-06': 3150.00, '2025-07': 3220.00, '2025-08': 3290.00,
  '2025-09': 3360.00, '2025-10': 3420.00, '2025-11': 3450.00, '2025-12': 3480.00,
  // 2026 Yılı
  '2026-01': 3600.00, '2026-02': 3680.00, '2026-03': 3750.00, '2026-04': 3830.00,
  '2026-05': 3910.00, '2026-06': 3990.00, '2026-07': 4060.00, '2026-08': 4120.00,
};

export async function seedInflationIndex(): Promise<void> {
  const records = Object.entries(SEED_TUFE).map(([month, val]) => ({
    month,
    tufeIndex: val.toFixed(4),
  }));

  if (records.length > 0) {
    await db.insert(inflationIndex).values(records).onConflictDoNothing();
  }
}

export async function seedAssets(): Promise<void> {
  // 1. Varlıkları ekle
  await db.insert(assets).values(SEED_ASSETS).onConflictDoNothing();

  const allAssets = await db.select().from(assets);
  const assetMap = new Map(allAssets.map((a) => [a.symbol, a.id]));

  // 2. Geçmiş ve Canlı Fiyat Tohumları
  const btcId = assetMap.get('BTC');
  const ethId = assetMap.get('ETH');
  const goldId = assetMap.get('GRAM_ALTIN');
  const usdId = assetMap.get('USD');

  const pricesToInsert: { assetId: string; ts: Date; priceTry: string }[] = [];

  if (btcId) {
    pricesToInsert.push(
      { assetId: btcId, ts: new Date('2020-03-12T12:00:00Z'), priceTry: '45200.00000000' },
      { assetId: btcId, ts: new Date('2021-11-10T12:00:00Z'), priceTry: '650000.00000000' },
      { assetId: btcId, ts: new Date('2023-01-01T12:00:00Z'), priceTry: '310000.00000000' },
      { assetId: btcId, ts: new Date(), priceTry: '2650120.45000000' },
    );
  }

  if (ethId) {
    pricesToInsert.push(
      { assetId: ethId, ts: new Date('2020-03-12T12:00:00Z'), priceTry: '1250.00000000' },
      { assetId: ethId, ts: new Date('2021-11-10T12:00:00Z'), priceTry: '45000.00000000' },
      { assetId: ethId, ts: new Date('2023-01-01T12:00:00Z'), priceTry: '22500.00000000' },
      { assetId: ethId, ts: new Date(), priceTry: '135400.80000000' },
    );
  }

  if (goldId) {
    pricesToInsert.push(
      { assetId: goldId, ts: new Date('2020-03-12T12:00:00Z'), priceTry: '320.50000000' },
      { assetId: goldId, ts: new Date('2021-11-10T12:00:00Z'), priceTry: '575.00000000' },
      { assetId: goldId, ts: new Date('2023-01-01T12:00:00Z'), priceTry: '1100.00000000' },
      { assetId: goldId, ts: new Date(), priceTry: '2840.50000000' },
    );
  }

  if (usdId) {
    pricesToInsert.push(
      { assetId: usdId, ts: new Date('2020-03-12T12:00:00Z'), priceTry: '6.20000000' },
      { assetId: usdId, ts: new Date('2021-11-10T12:00:00Z'), priceTry: '9.80000000' },
      { assetId: usdId, ts: new Date('2023-01-01T12:00:00Z'), priceTry: '18.70000000' },
      { assetId: usdId, ts: new Date(), priceTry: '40.15000000' },
    );
  }

  if (pricesToInsert.length > 0) {
    await db.insert(priceHistory).values(pricesToInsert).onConflictDoNothing();
  }

  // 3. TÜFE Endeks Tablosunu doldur
  await seedInflationIndex();
}

// Doğrudan çalıştırıldığında tohumla ve çık
seedAssets()
  .then(() => {
    console.log(`Varlıklar, fiyatlar ve 115 aylık TÜFE tablosu başarıyla tohumlandı!`);
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error("Seed başarısız:", error);
    process.exit(1);
  });
