/**
 * format.ts — Sunucudan gelen sayıları ekrana yazmak için.
 *
 * ⚠️ EN ÖNEMLİ KURAL: BU DOSYADA `Number()` YOK.
 *
 * Sunucu bütün para değerlerini STRING gönderiyor:
 *   priceTry: "3107273.31000900"    (8 ondalıklı)
 *   cashCents: "9691126"            (kuruş)
 *
 * Sebebi backend'de kurulan zincir: money.ts -> bigint -> numeric(24,8) -> JSON.
 * Burada `Number(priceTry)` yazarsak zincir ağın bu ucunda kırılır ve
 * kuruşlar sessizce kayar (0.1 + 0.2 !== 0.3).
 *
 * Bu dosya metin ve `bigint` ile çalışır. `number`'a hiç dönüşmez.
 */

/** "1234567" -> "1.234.567" */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Ondalıklı metni kuruşa çevirir — YUVARLAYARAK, kırpmadan.
 *
 *     "3107273.31000900" -> 310727331n   (3.107.273,31 TL)
 *
 * Neden yuvarlama: kırpsaydık her fiyat yarım kuruşa kadar aşağı kayardı.
 * Ekranda küçük bir fark ama backend'deki ROUND_HALF_UP kuralıyla tutarsız
 * olurdu — aynı sayı iki yerde farklı görünür.
 *
 * Nasıl: üç ondalık basamak alıp bigint'e çeviriyoruz, sonra +5 ekleyip
 * 10'a bölüyoruz. Bölme kırptığı için bu "yarım yukarı" demek oluyor.
 */
export function decimalToCents(decimal: string): bigint {
  const isNegative = decimal.startsWith('-');
  const unsigned = isNegative ? decimal.slice(1) : decimal;

  const [intPart = '0', fracPart = ''] = unsigned.split('.');

  // Üçüncü ondalık basamak yuvarlama kararını verecek.
  const threeDecimals = (fracPart + '000').slice(0, 3);
  const scaled = BigInt(intPart + threeDecimals); // 1e3 ölçekli

  const rounded = (scaled + 5n) / 10n; // yarım yukarı, sonra kuruşa in

  return isNegative ? -rounded : rounded;
}

/**
 * Kuruşu Türkçe para biçimine çevirir.
 *
 *     310727331n -> "3.107.273,31 ₺"
 *
 * Nokta binlik, virgül ondalık — backend'deki formatTRY ile aynı biçim.
 */
export type DisplayCurrency = 'try' | 'usd';

/**
 * Para birimi simgesi.
 *
 * ⚠️ SAYI BİÇİMİ DEĞİŞMİYOR, SADECE SİMGE.
 *
 * Dolar dünyada "1,234.56" diye yazılır — nokta ondalık, virgül binlik.
 * Biz Türkçe biçimde bırakıyoruz ("1.234,56 $") çünkü kullanıcı Türk ve
 * ekranın geri kalanı Türkçe. Aynı ekranda iki farklı sayı yazım kuralı
 * olsaydı kullanıcı 1.234'ü bin iki yüz mü bir nokta iki yüz mü diye
 * duraksardı — asıl kafa karışıklığı orada çıkar.
 */
function symbolOf(currency: DisplayCurrency): string {
  return currency === 'usd' ? '$' : '₺';
}

export function formatCents(
  cents: bigint,
  currency: DisplayCurrency = 'try',
): string {
  const isNegative = cents < 0n;
  const abs = isNegative ? -cents : cents;

  const lira = groupThousands((abs / 100n).toString());
  const kurus = (abs % 100n).toString().padStart(2, '0');

  return `${isNegative ? '-' : ''}${lira},${kurus} ${symbolOf(currency)}`;
}

/** Sunucudan gelen kuruş metnini doğrudan biçimlendirir: "9691126" -> "96.911,26 ₺" */
export function formatCentsString(
  cents: string,
  currency: DisplayCurrency = 'try',
): string {
  return formatCents(BigInt(cents), currency);
}

/** Ondalıklı fiyat metnini biçimlendirir: "3107273.31000900" -> "3.107.273,31 ₺" */
export function formatPrice(
  decimal: string,
  currency: DisplayCurrency = 'try',
): string {
  return formatCents(decimalToCents(decimal), currency);
}

/**
 * Varlık miktarındaki gereksiz sıfırları atar.
 *
 *     "0.0010000000" -> "0,001"
 *     "1.0000000000" -> "1"
 *
 * Sunucu numeric(28,10) döndürdüğü için hep 10 basamak geliyor.
 * Ekranda "0,0010000000" okunmaz.
 */
export function formatQuantity(decimal: string): string {
  const [intPart = '0', fracPart = ''] = decimal.split('.');

  const trimmed = fracPart.replace(/0+$/, '');

  return trimmed.length > 0 ? `${intPart},${trimmed}` : intPart;
}

/**
 * Zaman damgasını "ne kadar önce" biçimine çevirir.
 *
 *     "2026-08-19T13:27:30.100Z" -> "12 sn önce"
 *
 * Neden gösteriyoruz: kullanıcı fiyatın ne kadar taze olduğunu bilmeli.
 * Ağ koptuğunda sayı "3 dk önce"ye döner — uygulama yalan söylemez,
 * dürüstçe eskir. WebSocket olmadan "canlı" hissini veren şey bu.
 */
export function formatRelativeTime(isoDate: string | null): string {
  if (!isoDate) return 'fiyat yok';

  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);

  if (seconds < 5) return 'şimdi';
  if (seconds < 60) return `${seconds} sn önce`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} dk önce`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;

  return `${Math.floor(hours / 24)} gün önce`;
}
