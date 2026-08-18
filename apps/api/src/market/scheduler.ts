import cron from "node-cron";
import { fetchAndStorePrices } from "./price-cron.js";

/**
 * Fiyat çekme zamanlayıcısı.
 *
 * ARALIK NEDEN 1 DAKİKA?
 *
 * docs/01-plan.md: emir motoru, fiyat 120 saniyeden eskiyse 503 döndürecek.
 * 2 dakikadan seyrek çekersek emirler reddedilmeye başlar. 1 dakika güvenli
 * pay bırakıyor: bir tur kaçsa bile fiyat hâlâ taze sayılır.
 *
 * Daha sık çekmenin faydası yok — lig haftalık ve TWR ile hesaplanıyor,
 * saniyelik hareketin sıralamaya etkisi yok.
 */
const EVERY_MINUTE = "* * * * *";

/**
 * Önceki tur bitmeden yenisinin başlamasını engelleyen bayrak.
 *
 * Neden gerekli: bir tur 60 saniyeden uzun sürerse (ağ yavaşladı, varlık
 * sayısı arttı) cron yeni turu yine de başlatır. İki tur aynı anda çalışırsa
 * aynı `ts` değerini yazmaya kalkarlar; PK(asset_id, ts) bunu veritabanı
 * seviyesinde engeller ama boşuna istek atılmış olur.
 */
let running = false;

export function startPriceCron(): void {
  cron.schedule(EVERY_MINUTE, () => void runOnce());

  // İlk turu beklemeden çalıştır — sunucu açılır açılmaz fiyat olsun,
  // yoksa ilk dakika boyunca price_history boş kalır.
  void runOnce();

  console.log("[price-cron] başladı, aralık: 1 dakika");
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
