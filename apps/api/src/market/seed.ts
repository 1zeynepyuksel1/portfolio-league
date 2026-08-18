import { db } from "../db/client.js";
import { assets } from "../db/schema.js";

/**
 * assets tablosunun ilk verisi.
 *
 * NEDEN MIGRATION'A GÖMÜLMEDİ?
 *
 * Migration şemayı kurar, veri koymaz. Varlık listesi zamanla değişecek
 * (Faz 2'de altın ve gümüş gelecek), migration'lar ise geçmişin kaydıdır ve
 * değiştirilmez. Bu yüzden ayrı bir betik.
 *
 * `symbol` alanı BİZİM kodumuz: "BTC", "BTCUSDT" değil. Binance'in işlem çifti
 * biçimi BinanceAdapter'ın içindeki PAIRS tablosunda kalır — borsanın biçimi
 * veritabanına sızmaz. Aynı varlığı yarın başka bir kaynaktan çekersek burada
 * hiçbir şey değişmez.
 *
 * `onConflictDoNothing` sayesinde betik defalarca çalıştırılabilir.
 */
const SEED = [
  { symbol: "BTC", name: "Bitcoin", kind: "crypto" as const, sortOrder: 1 },
  { symbol: "ETH", name: "Ethereum", kind: "crypto" as const, sortOrder: 2 },
];

export async function seedAssets(): Promise<void> {
  await db.insert(assets).values(SEED).onConflictDoNothing();
}

// Doğrudan çalıştırıldığında (npm run seed) tohumla ve çık.
if (process.argv[1]?.includes("seed")) {
  seedAssets()
    .then(() => {
      console.log(`${SEED.length} varlık eklendi (veya zaten vardı)`);
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error("Seed başarısız:", error);
      process.exit(1);
    });
}
