/**
 * order-math.ts — emir tutarının EKRANDA ÖNİZLEMESİ.
 *
 * ⚠️ BU HESAP BAĞLAYICI DEĞİL, SUNUCUNUNKİ BAĞLAYICI.
 *
 * Kullanıcı miktarı yazarken "ne kadar tutacak" görmeli — her tuş vuruşunda
 * sunucuya sormak hem yavaş hem gereksiz. Ama emrin gerçek tutarını
 * `orders/repository.ts` belirliyor ve o, işlemin AÇILDIĞI andaki fiyatı
 * kullanıyor.
 *
 * Aradaki fark normaldir: kullanıcı miktarı yazarken fiyat değişir. Ekran
 * sunucudan dönen `netCents`'i göstermeli, buradaki tahmini değil.
 * (bkz. CLAUDE.md: "Fiyatı sunucu belirler")
 *
 * ⚠️ ÖLÇEKLER SUNUCUYLA BİREBİR AYNI OLMALI.
 * Buradaki bir sayı yanlış olursa ekran tutarlı ama YANLIŞ bir tahmin
 * gösterir — kullanıcı 100 TL bekler, 1.000 TL öder. Kaynak:
 * apps/api/src/lib/money.ts ve apps/api/src/orders/calculate.ts
 */

/** Kuruş: 2 ondalık. */
const PENNY_SCALE = 2;
/** Fiyat: 8 ondalık. */
const PRICE_SCALE = 8;
/** Varlık miktarı: 10 ondalık. */
const AMOUNT_SCALE = 10;

/**
 * ⚠️ ÇARPMA ÖLÇEKLERİ TOPLAR.
 *
 *   fiyat (1e8) × miktar (1e10) = ara sonuç (1e18)
 *
 * Sonuç kuruş, yani 1e2 olmalı. Fazlalık: 8 + 10 − 2 = 16.
 * Bu sayıyı yanlış yazmak sonucu 100 kat kaydırır ve sonuç "makul"
 * görünmeye devam eder — para hatalarının en sinsi türü.
 */
const EXCESS_SCALE = PRICE_SCALE + AMOUNT_SCALE - PENNY_SCALE;

/** Komisyon: 10 baz puan = %0,1. Binance'in gerçek oranı. */
const FEE_BASIS_POINTS = 10n;
const BASIS_POINT_DIVISOR = 10_000n;

/** Emrin alt sınırı: 1 TL. Sunucudaki MIN_ORDER_PENNY ile aynı. */
export const MIN_ORDER_CENTS = 100n;

function pow10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

/**
 * Ondalıklı metni ölçekli bigint'e çevirir. `number`'a hiç uğramaz.
 *
 *     parseScaled("1.5", 8) -> 150000000n
 *
 * Fazla ondalık basamak KIRPILIYOR — çünkü girdi zaten alan tarafından
 * sınırlanıyor ve burada hata fırlatmak kullanıcı yazarken ekranı kilitler.
 */
function parseScaled(decimal: string, scale: number): bigint {
  const [intPart = '0', fracPart = ''] = decimal.split('.');

  const padded = (fracPart + '0'.repeat(scale)).slice(0, scale);

  return BigInt((intPart === '' ? '0' : intPart) + padded);
}

/**
 * ROUND_HALF_UP bölme.
 *
 * ⚠️ `a / b` KULLANILMAZ — bigint bölmesi KIRPAR, yani her işlemde
 * kullanıcı aleyhine kuruş erir. Sunucudaki `divRound` ile aynı kural
 * olmalı, yoksa önizleme ile gerçek tutar bir kuruş farkla ayrışır ve
 * kullanıcı hangisine güveneceğini bilemez.
 *
 * Yöntem: payı ve paydayı 2 ile çarpıp paydayı ekliyoruz. Kırpma o zaman
 * "yarım yukarı" davranışına dönüşüyor.
 *   15/10 -> (30+10)/20 = 2   ✓ (1,5 yukarı)
 *   14/10 -> (28+10)/20 = 1   ✓ (1,4 aşağı)
 */
function divRound(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

export type OrderEstimate = {
  /** Komisyonsuz tutar, kuruş. */
  grossCents: bigint;
  /** Komisyon, kuruş. */
  feeCents: bigint;
  /** Alışta ödenecek, satışta eline geçecek tutar. */
  netCents: bigint;
};

/**
 * Emir tutarını tahmin eder.
 *
 * `priceDecimal` sunucudan geldiği hâliyle ("3670293.86588000"),
 * `quantityDecimal` kullanıcının yazdığı hâliyle ("0.5").
 *
 * Geçersiz girdide `null` döner — hata fırlatmıyoruz çünkü kullanıcı
 * yazarken alan sürekli yarım hâlde oluyor ("0.", "" gibi).
 */
export function estimateOrder(
  side: 'buy' | 'sell',
  priceDecimal: string | null,
  quantityDecimal: string,
): OrderEstimate | null {
  if (priceDecimal === null) return null;

  const trimmed = quantityDecimal.trim();
  if (trimmed === '' || !/^\d*\.?\d*$/.test(trimmed)) return null;

  const price = parseScaled(priceDecimal, PRICE_SCALE);
  const quantity = parseScaled(trimmed, AMOUNT_SCALE);

  if (price <= 0n || quantity <= 0n) return null;

  // Ölçek fazlalığı burada atılıyor — ve bölme divRound'dan geçiyor.
  const grossCents = divRound(price * quantity, pow10(EXCESS_SCALE));

  const feeCents = divRound(
    grossCents * FEE_BASIS_POINTS,
    BASIS_POINT_DIVISOR,
  );

  // Alışta komisyon ÜSTÜNE eklenir, satışta içinden düşülür.
  const netCents =
    side === 'buy' ? grossCents + feeCents : grossCents - feeCents;

  return { grossCents, feeCents, netCents };
}

/**
 * Verilen nakitle en fazla kaç adet alınabilir?
 *
 * ⚠️ KOMİSYON HESABA KATILIYOR. Sadece `nakit / fiyat` deseydik, sonuç
 * komisyonla birlikte bakiyeyi aşardı ve "Tümü" düğmesi her seferinde
 * "yetersiz bakiye" hatası üretirdi.
 *
 *   nakit >= brüt + brüt × 0,001   ->   brüt <= nakit / 1,001
 *
 * Sonuç AŞAĞI yuvarlanıyor (divRound değil, düz bölme): yukarı
 * yuvarlasaydık bir kuruş aşıp emri reddettirebilirdik.
 */
export function maxBuyableQuantity(
  cashCents: bigint,
  priceDecimal: string | null,
): string {
  if (priceDecimal === null || cashCents <= 0n) return '0';

  const price = parseScaled(priceDecimal, PRICE_SCALE);
  if (price <= 0n) return '0';

  const affordableGross =
    (cashCents * BASIS_POINT_DIVISOR) /
    (BASIS_POINT_DIVISOR + FEE_BASIS_POINTS);

  // grossCents = fiyat × miktar / 1e16  ->  miktar = gross × 1e16 / fiyat
  const quantity = (affordableGross * pow10(EXCESS_SCALE)) / price;

  return formatScaled(quantity, AMOUNT_SCALE);
}

/**
 * Ölçekli bigint'i ondalıklı metne çevirir — sunucuya gönderilecek biçim.
 *
 *     formatScaled(5000000000n, 10) -> "0.5000000000"
 *
 * Ondalık ayırıcı NOKTA: bu metin `POST /orders`'a gidiyor ve oradaki
 * şema virgül kabul etmiyor (makine biçimi). Ekranda gösterilecekse
 * format.ts'teki `formatQuantity` kullanılmalı.
 */
export function formatScaled(value: bigint, scale: number): string {
  const divisor = pow10(scale);

  const intPart = value / divisor;
  const fracPart = (value % divisor).toString().padStart(scale, '0');

  return `${intPart}.${fracPart}`;
}

/**
 * TL tutarından alınabilecek miktarı hesaplar.
 *
 * ⚠️ KOMİSYON DAHİL. Kullanıcı "5.000 ₺'lik al" dediğinde cebinden çıkan
 * 5.000 olmalı — komisyon o tutarın İÇİNDEN alınır, üstüne eklenmez.
 * Eklenseydi "5.000 ₺" yazıp 5.005 ₺ ödemiş olurdu ve bakiyesi tam
 * 5.000 ise emir reddedilirdi.
 *
 * Aynı mantık `maxBuyableQuantity` ile birebir aynı; tek farkı oradaki
 * girdinin bakiyenin tamamı olması. Ortak çekirdek kullanılıyor ki ikisi
 * ayrışmasın.
 *
 * ⚠️ AŞAĞI YUVARLIYOR (düz bölme). Yukarı yuvarlasaydık hesaplanan miktar
 * tutarı bir kuruş aşabilir ve emir `INSUFFICIENT_FUNDS` alırdı — hem de
 * kullanıcı tam da elindeki parayı yazmışken.
 */
export function quantityForAmount(
  amountCents: bigint,
  priceDecimal: string | null,
): string {
  return maxBuyableQuantity(amountCents, priceDecimal);
}
