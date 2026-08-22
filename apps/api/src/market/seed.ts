import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { assets, inflationIndex } from "../db/schema.js";

/**
 * İşlem görebilir varlıklar.
 *
 * ⚠️ BU LİSTE TEK BAŞINA YETMİYOR. Bir varlığın fiyatının gelmesi için
 * kaynağının da tanımlı olması gerekiyor:
 *   - `crypto` -> binance.ts içindeki PAIRS tablosu
 *   - `fx`     -> tcmb.ts içindeki FX_UNITS tablosu
 * Buraya ekleyip oraya eklemezsen cron her turda o varlık için hata basar.
 */
const SEED_ASSETS = [
  // --- Kripto (Binance USDT paritesi) ---
  { symbol: "BTC", name: "Bitcoin", kind: "crypto" as const, sortOrder: 1 },
  { symbol: "ETH", name: "Ethereum", kind: "crypto" as const, sortOrder: 2 },
  { symbol: "BNB", name: "BNB", kind: "crypto" as const, sortOrder: 3 },
  { symbol: "SOL", name: "Solana", kind: "crypto" as const, sortOrder: 4 },
  { symbol: "XRP", name: "XRP", kind: "crypto" as const, sortOrder: 5 },
  { symbol: "ADA", name: "Cardano", kind: "crypto" as const, sortOrder: 6 },
  { symbol: "DOGE", name: "Dogecoin", kind: "crypto" as const, sortOrder: 7 },
  { symbol: "AVAX", name: "Avalanche", kind: "crypto" as const, sortOrder: 8 },
  { symbol: "LINK", name: "Chainlink", kind: "crypto" as const, sortOrder: 9 },
  { symbol: "LTC", name: "Litecoin", kind: "crypto" as const, sortOrder: 10 },

  // --- Döviz (TCMB) ---
  { symbol: "USD", name: "Amerikan Doları", kind: "fx" as const, sortOrder: 11 },
  { symbol: "EUR", name: "Euro", kind: "fx" as const, sortOrder: 12 },
  { symbol: "GBP", name: "İngiliz Sterlini", kind: "fx" as const, sortOrder: 13 },
  { symbol: "CHF", name: "İsviçre Frangı", kind: "fx" as const, sortOrder: 14 },
  { symbol: "CAD", name: "Kanada Doları", kind: "fx" as const, sortOrder: 15 },
  { symbol: "AUD", name: "Avustralya Doları", kind: "fx" as const, sortOrder: 16 },
  { symbol: "SEK", name: "İsveç Kronu", kind: "fx" as const, sortOrder: 17 },
  { symbol: "JPY", name: "Japon Yeni", kind: "fx" as const, sortOrder: 18 },

  // --- Maden ---
  // Fiyat kaynağı henüz yok (Binance'te yok, TCMB XML'inde yok, EVDS'de
  // ayrı seri). Aşağıda is_active=false yapılıyor.
  { symbol: "GRAM_ALTIN", name: "Gram Altın", kind: "metal" as const, sortOrder: 90 },
];

/**
 * Fiyat kaynağı olmayan varlıklar.
 *
 * NEDEN LİSTEDEN SİLMİYORUZ: `price_history` yabancı anahtarla varlığa
 * bağlı ve `onDelete: cascade`. Varlığı silmek geçmişini de siler. Kaynağı
 * yazdığımızda `is_active`'i true'ya çevirmek yeterli olacak.
 *
 * NEDEN LİSTEDE BIRAKIP AKTİF TUTMUYORUZ: fiyatı olmayan varlık ekranda ya
 * boş satır olur ya da — daha kötüsü — eski bir fiyat donmuş hâlde gerçek
 * gibi görünür.
 */
const INACTIVE_SYMBOLS = ["GRAM_ALTIN"];

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

/**
 * ⚠️ BU TABLO YAKLAŞIKTIR — resmî kaynak değildir.
 *
 * Yukarıdaki değerler elle girilmiş ve ileri tarihlere doğru gerçek veriden
 * sapıyor. Ölçüldü (21 Ağustos 2026):
 *
 *     2025-01   burada 2820,00   EVDS 2819,65    fark   0,35
 *     2025-06   burada 3150,00   EVDS 3132,17    fark  17,83
 *     2026-07   burada 4060,00   EVDS 4211,58    fark 151,58  (%3,6)
 *
 * Reel getiri hesabı bu sayıları kullanıyor. %3,6'lık sapma, özelliğin
 * anlattığı hikâyeyi doğrudan değiştirir.
 *
 * GERÇEK VERİ İÇİN:
 *     npx tsx apps/api/src/market/tufe-backfill.ts
 *
 * O betik EVDS'den 2003'ten bugüne tüm seriyi çekiyor ve çakışmada
 * ÜZERİNE YAZIYOR. Buradaki tablo yalnızca EVDS anahtarı olmayan bir
 * ortamda uygulamanın çökmemesi için duruyor.
 */
export async function seedInflationIndex(): Promise<void> {
  const records = Object.entries(SEED_TUFE).map(([month, val]) => ({
    month,
    tufeIndex: val.toFixed(4),
  }));

  if (records.length > 0) {
    await db.insert(inflationIndex).values(records).onConflictDoNothing();
  }
}

/**
 * ⚠️ BURADA ARTIK FİYAT TOHUMLANMIYOR — ve bu bilinçli bir düzeltme.
 *
 * Eskiden bu fonksiyon BTC/ETH/GRAM_ALTIN/USD için elle yazılmış fiyatları
 * `12:00:00Z` damgasıyla yazıyordu. Geri doldurma ise gerçek fiyatları
 * `00:00:00Z` ile yazıyor.
 *
 * what-if/repository.ts `ORDER BY ts DESC LIMIT 1` yaptığı için aynı günde
 * 12:00 olan satır 00:00 olanı YENİYOR — yani uydurma fiyat gerçeğini
 * eziyordu. 12 Mart 2020 BTC için tohum 45.200 TL diyordu; o günün gerçeği
 * ~4.970 USD × ~6,28 kur ≈ 31.200 TL. "Ya alsaydın" ekranındaki üç hazır
 * düğmenin üçü de uydurma sayı döndürüyordu.
 *
 * KURAL: fiyatın tek kaynağı price-backfill.ts (geçmiş) ve price-cron.ts
 * (canlı). Tohum dosyası fiyata dokunmaz.
 */
export async function seedAssets(): Promise<void> {
  // 1. Varlıkları ekle.
  // onConflictDoNothing: mevcut satırlar korunur, yenileri eklenir.
  await db.insert(assets).values(SEED_ASSETS).onConflictDoNothing();

  // 2. Kaynağı olmayan varlıkları kapat.
  //
  // ⚠️ Bu neden ayrı bir UPDATE: yukarıdaki insert `onConflictDoNothing`
  // olduğu için GRAM_ALTIN zaten kayıtlıysa hiçbir alanı güncellenmez —
  // is_active dahil. Açık UPDATE olmadan eski kayıt aktif kalırdı.
  for (const symbol of INACTIVE_SYMBOLS) {
    await db
      .update(assets)
      .set({ isActive: false })
      .where(eq(assets.symbol, symbol));
  }

  // 3. TÜFE Endeks Tablosunu doldur
  await seedInflationIndex();
}

// Doğrudan çalıştırıldığında tohumla ve çık
seedAssets()
  .then(() => {
    const active = SEED_ASSETS.length - INACTIVE_SYMBOLS.length;
    console.log(
      `${active} aktif varlık (+${INACTIVE_SYMBOLS.length} pasif) ve TÜFE tablosu tohumlandı.`,
    );
    console.log('Fiyatlar için: npx tsx apps/api/src/market/price-backfill.ts');
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error("Seed başarısız:", error);
    process.exit(1);
  });
