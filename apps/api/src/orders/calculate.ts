/**
 * Emir hesabı — SAF KATMAN.
 *
 * Emir motoru üç katman:
 *   1. Bu dosya  — hesap. Veritabanı yok, ağ yok, yan etki yok.
 *   2. service   — transaction, satır kilidi, tablolara yazma.
 *   3. router    — HTTP, Zod doğrulama, idempotency, durum kodları.
 *
 * NEDEN AYRI DOSYA?
 *
 * Bu katmanda hiçbir dış bağımlılık yok: aynı girdiye her zaman aynı çıktıyı
 * verir. Böyle fonksiyonlara "saf" (pure) denir ve iki faydası var:
 *
 *   - Testi mock gerektirmez. Veritabanı ayağa kaldırmadan, sahte nesne
 *     yazmadan doğrudan çağırıp sonucu kontrol edersin.
 *   - Para hesabı, eşzamanlılık karmaşasından ayrı durur. Kilit mantığında
 *     hata ararken komisyon formülüne bakmak zorunda kalmazsın.
 *
 * Bu dosyada `await` YOKTUR ve olmamalıdır. `await` görürsen katman
 * sınırı sızmış demektir.
 */

import {
  type Amount,
  type Penny,
  type Price,
  calcBuyTotal,
  calcCommission,
  calcGross,
  calcSellNet,
  formatTRY,
} from "../lib/money.js";

// ---------------------------------------------------------------------------
// 1. SABİTLER
// ---------------------------------------------------------------------------

export type OrderSide = "buy" | "sell";

/**
 * Komisyon oranı — 10 baz puan = %0,1.
 *
 * NEDEN BAZ PUAN, NEDEN 0.001 DEĞİL:
 * `0.001` bir `number`'dır, yani float. Bu projede para hesabına float
 * sokmuyoruz. Baz puan tam sayıdır ve `calcCommission` içinde
 * `gross × 10 / 10_000` olarak işlenir — hiçbir adımda float yok.
 *
 * Gerçek borsalarda 10-25 bps arası tipiktir. Sanal ligde komisyonun amacı
 * gelir değil, DAVRANIŞ: sıfır komisyon olsaydı kullanıcı günde yüzlerce
 * al-sat yapıp fiyat gürültüsünü kâra çevirmeye çalışırdı.
 */
export const FEE_BASIS_POINTS = 10;

/**
 * En küçük emir tutarı: 1 TL.
 *
 * ⚠️ TUZAK — bu sabit olmasaydı bedava varlık kazanılabilirdi.
 * Çok küçük bir miktar (0,0000000001 BTC) girildiğinde `gross` kuruşa
 * yuvarlanırken 0'a düşer. Kullanıcı 0 kuruş öder, karşılığında varlık alır.
 * Tek seferde önemsiz, döngüye sokulduğunda sınırsız para basar.
 */
export const MIN_ORDER_PENNY = 100n as Penny;

// ---------------------------------------------------------------------------
// 2. HATA TİPİ
// ---------------------------------------------------------------------------

/**
 * Doğrulama hatası.
 *
 * `code` alanı neden var: router bu kodu HTTP durum koduna çevirecek
 * (docs/01-plan.md §9). Hata metnine bakarak karar vermek kırılgandır —
 * metin değişince eşleşme sessizce bozulur. Kod sabittir.
 */
export class OrderValidationError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "OrderValidationError";
  }
}

// ---------------------------------------------------------------------------
// 3. SONUÇ TİPİ
// ---------------------------------------------------------------------------

/**
 * Bir emrin para dökümü. Üçü de `orders` tablosuna yazılacak
 * (gross_cents, fee_cents, net_cents).
 */
export interface OrderAmounts {
  /** Miktar × fiyat — komisyon hariç işlem tutarı */
  gross: Penny;
  /** Komisyon */
  fee: Penny;
  /**
   * Hesabı gerçekten etkileyen tutar. YÖNE GÖRE DEĞİŞİR:
   *   alım  → gross + fee  (hesaptan ÇIKAN)
   *   satım → gross − fee  (hesaba GİREN)
   *
   * Her iki durumda da komisyon kullanıcının aleyhinedir; işaret farkı
   * değil, yön farkı. Alırken daha çok ödersin, satarken daha az alırsın.
   */
  net: Penny;
}

// ---------------------------------------------------------------------------
// 4. HESAP
// ---------------------------------------------------------------------------

/**
 * Bir emrin para dökümünü hesaplar.
 *
 * Bu fonksiyon bakiyeye BAKMAZ, holding'e BAKMAZ, hiçbir şey YAZMAZ.
 * "Bu emir ne kadar tutar" sorusunun cevabı — "bu emir geçer mi" değil.
 * O kontroller katman 2'nin işi, çünkü onlar için veritabanı gerekiyor.
 */
export function calculateOrder(
  side: OrderSide,
  price: Price,
  quantity: Amount,
): OrderAmounts {
  // Sıfır ve negatif elenmeli. Negatif miktarla "alım" aslında karşılıksız
  // para girişi olurdu: gross negatif çıkar, bakiye artar.
  if (quantity <= 0n) {
    throw new OrderValidationError(
      "Miktar sıfırdan büyük olmalı",
      "INVALID_QUANTITY",
    );
  }

  // Fiyat 0 ise varlık bedava demektir. Cron bozuk veri yazmışsa buradan
  // dönmeli — emir motoru fiyata körü körüne güvenmiyor.
  if (price <= 0n) {
    throw new OrderValidationError(
      "Fiyat sıfırdan büyük olmalı",
      "INVALID_PRICE",
    );
  }

  const gross = calcGross(price, quantity);

  // ⚠️ Yuvarlama sonrası kontrol. `quantity > 0` olması `gross > 0` demek
  // DEĞİL — çok küçük miktarlar kuruşa yuvarlanırken 0'a düşüyor.
  // Bu yüzden kontrol çarpımdan ÖNCE değil, SONRA yapılıyor.
  if (gross < MIN_ORDER_PENNY) {
    throw new OrderValidationError(
      `Emir tutarı en az ${formatTRY(MIN_ORDER_PENNY)} olmalı`,
      "AMOUNT_TOO_SMALL",
    );
  }

  const fee = calcCommission(gross, FEE_BASIS_POINTS);

  // Yön farkı tek satırda. Toplama/çıkarma `money.ts`'teki yardımcılarla
  // yapılıyor ki markalı tip korunsun — düz `gross + fee` yazsaydık
  // sonuç `bigint` olur, `Penny` markası düşerdi.
  const net = side === "buy" ? calcBuyTotal(gross, fee) : calcSellNet(gross, fee);

  return { gross, fee, net };
}
