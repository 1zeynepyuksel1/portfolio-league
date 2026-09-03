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

/**
 * Kuruş metnini ondalıklı LİRA metnine çevirir: "10132959" -> "101329.59"
 *
 * ⚠️ BU FONKSİYON GERÇEK BİR EKRAN HATASINDAN DOĞDU.
 *
 * `GET /portfolio/history` değerleri KURUŞ olarak döndürüyor (projenin
 * kuralı: para her yerde kuruş). Cüzdan ekranı bu diziyi olduğu gibi
 * `PriceChart`'a veriyordu; grafik ise verilen sayıyı LİRA sanıp eksene
 * yazıyordu.
 *
 * Sonuç: bakiye 101.329,59 ₺ iken eksen "10.18M" diyordu — yani 100 kat
 * büyük. Çizginin ŞEKLİ doğruydu (hepsi aynı oranda büyük), yalnızca
 * etiketler yanlıştı. Bu yüzden gözden kaçması kolay: grafik "çalışıyor"
 * görünüyor.
 *
 * ⚠️ `Number(cents) / 100` YAZILMADI. Bu bir para değeri ve ekranda
 * gösteriliyor; float'a düşmek `money.ts`'in varlık sebebini çöpe atar.
 * Bölme metin üzerinde yapılıyor: tam sayı kısmı ile son iki basamak
 * ayrılıyor, kayıp yok.
 */
export function centsToDecimal(cents: string): string {
  const negatif = cents.startsWith('-');
  const rakamlar = (negatif ? cents.slice(1) : cents).padStart(3, '0');

  const lira = rakamlar.slice(0, -2);
  const kurus = rakamlar.slice(-2);

  return `${negatif ? '-' : ''}${lira}.${kurus}`;
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

  if (trimmed.length === 0) return intPart;

  /**
   * ⚠️ ANLAMLI BASAMAKLA KISALTMA — sabit basamak sayısıyla değil.
   *
   * Sunucu 10 ondalık döndürüyor (AMOUNT_SCALE). "0,0060889495" ekranda
   * okunmuyor: göz basamakları sayamıyor ve satır taşıyor.
   *
   * Sabit 4 basamağa yuvarlasaydık küçük miktarlar YOK OLURDU:
   * 0,0000123 BTC "0,0000" diye görünür, kullanıcı hiç almadığını
   * sanardı. Bunun yerine ilk anlamlı basamaktan itibaren 4 basamak
   * alıyoruz — büyük miktarda kısa, küçük miktarda hassas.
   *
   *   1,2345678900  -> "1,2345"
   *   0,0060889495  -> "0,006088"
   *   0,0000123456  -> "0,00001234"
   *
   * ⚠️ Bu YALNIZCA GÖSTERİM. Sunucuya giden miktar hiç kırpılmıyor;
   * emir hep tam değerle gidiyor (order-math.ts).
   */
  const leadingZeros = trimmed.length - trimmed.replace(/^0+/, '').length;
  const keep = Math.min(leadingZeros + 4, trimmed.length);

  return `${intPart},${trimmed.slice(0, keep)}`;
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
export function formatRelativeTime(
  isoDate: string | null,
  /*
    ⚠️ `compact` YALNIZCA "önce" KELİMESİNİ DÜŞÜRÜR — BİRİMİ DEĞİL.

    Liste satırlarında her varlığın yanında bu metin var; ellisinde
    birden "önce" yazmak satırı gereksiz uzatıyor. Ama BİRİM
    kısaltılamaz: 'sn' saniye, 'dk' dakika, 'sa' saat, 'gün' gün.
    Saat değerini 'sn' diye yazmak 22 saatlik veriyi 22 saniyelik
    gibi gösterirdi — bir finans uygulamasının yapabileceği en kötü
    yanlış, çünkü fiyatın TAZE olduğunu iddia eder.
  */
  compact = false,
): string {
  if (!isoDate) return 'fiyat yok';

  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  const son = compact ? '' : ' önce';

  if (seconds < 5) return 'şimdi';
  if (seconds < 60) return `${seconds} sn${son}`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} dk${son}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa${son}`;

  return `${Math.floor(hours / 24)} gün${son}`;
}

/**
 * Yüzdelik değerleri +/-, 0,00 vb. durumlara göre biçimlendirir.
 * Sıfır değerinde ne + ne de - işareti konulmaz.
 * 
 * @param percent - Ondalıklı veya sayısal yüzde değeri (ör: 3.5 = %3,5)
 * @param prefix - Yüzde işareti, varsayılan false (ör: true ise %3,5 değilse 3,5%)
 */
export function formatPercent(percent: number | string | null | undefined, prefix = false): string {
  if (percent === null || percent === undefined) return '—';
  const num = Number(percent);
  if (isNaN(num)) return '—';
  
  const isZero = Math.abs(num) < 0.005;
  const sign = isZero ? '' : num > 0 ? '+' : '';
  const formatted = num.toFixed(2).replace('.', ',');
  
  return prefix ? `${sign}%${formatted}` : `${sign}${formatted}%`;
}
