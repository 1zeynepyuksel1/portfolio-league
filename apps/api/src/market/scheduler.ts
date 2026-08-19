import cron from "node-cron";
import { fetchAndStorePrices } from "./price-cron.js";

/**
 * Fiyat çekme zamanlayıcısı.
 *
 * ARALIK NEDEN 15 SANİYE? (docs/01-plan.md 5.1)
 *
 * İki gerekçe:
 *
 * 1. HATA PAYI. Emir motoru fiyat 120 saniyeden eskiyse 503 döndürüyor
 *    (orders/repository.ts). 15 saniyede çekerken üst üste 7 tur başarısız
 *    olsa bile emirler geçmeye devam eder. 60 saniyede sadece 1 tur payın
 *    olurdu — tek bir ağ kesintisi bütün emirleri durdururdu.
 *
 * 2. EKRAN. Kullanıcı fiyat izlerken 60 saniye "donmuş" hissettiriyor.
 *
 * Maliyeti yok: 25 varlık x 4 tur/dk = 100 istek/dk, Binance limitinin
 * (1200 ağırlık/dk) ~%17'si. Depolama da gece temizliğiyle sınırlı.
 *
 * ⚠️ ALTI ALAN — standart cron BEŞ alandır (dk sa gün ay haftagünü).
 * node-cron başa bir SANİYE alanı ekliyor. Yani bu ifade standart cron'da
 * çalışmaz; kopyalayıp başka bir sisteme taşırsan bozulur.
 *
 *   */15  *  *  *  *  *
 *    ↑    ↑  ↑  ↑  ↑  ↑
 *    sn   dk sa gün ay haftagünü
 */
const EVERY_15_SECONDS = "*/15 * * * * *";

/**
 * Önceki tur bitmeden yenisinin başlamasını engelleyen bayrak.
 *
 * Neden gerekli: bir tur 15 saniyeden uzun sürerse (ağ yavaşladı, varlık
 * sayısı arttı) cron yeni turu yine de başlatır. İki tur aynı anda çalışırsa
 * aynı `ts` değerini yazmaya kalkarlar; PK(asset_id, ts) bunu veritabanı
 * seviyesinde engeller ama boşuna istek atılmış olur.
 *
 * ⚠️ Aralık 15 saniyeye indiği için bu bayrak artık GERÇEKTEN iş görüyor.
 * 25 varlık sıralı çekilirken bir tur ~5 saniye sürüyor; ağ yavaşlarsa
 * 15 saniyeyi aşmak zor değil.
 */
let running = false;

export function startPriceCron(): void {
  cron.schedule(EVERY_15_SECONDS, () => void runOnce());

  // İlk turu beklemeden çalıştır — sunucu açılır açılmaz fiyat olsun,
  // yoksa ilk tura kadar price_history boş kalır.
  void runOnce();

  console.log("[price-cron] başladı, aralık: 15 saniye");
}

async function runOnce(): Promise<void> {
  if (running) {
    console.warn("[price-cron] önceki tur sürüyor, bu tur atlandı");
    return;
  }

  running = true;
  try {
    const result = await fetchAndStorePrices();

    if (result.failed.length > 0) {
      console.warn(
        `[price-cron] ${result.written} yazıldı, başarısız: ${result.failed.join(", ")}`,
      );
    }
  } catch (error) {
    // EN DIŞ KATMAN — buradan hata kaçarsa yakalanmamış promise reddi olur
    // ve Node süreci düşürebilir. API sunucusu cron ile aynı süreçte
    // çalıştığı için bu, tüm uygulamanın çökmesi demek.
    console.error(
      "[price-cron] tur tamamen başarısız:",
      error instanceof Error ? error.message : error,
    );
  } finally {
    running = false;
  }
}
