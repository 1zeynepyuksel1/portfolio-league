/**
 * money.ts — para aritmetiği
 *
 * TEMEL KURAL: Bu projede para asla `number` ile tutulmaz.
 *
 * Sebebi: JavaScript'in `number` tipi IEEE 754 kayan noktalı sayıdır ve
 * 0.1 gibi sayıları ikilik tabanda tam gösteremez:
 *
 *     0.1 + 0.2 === 0.30000000000000004   // true
 *
 * Her işlemde kuruşun altında sapma birikir. Bizim ligimizde sıralama yüzde
 * getiriye göre yapıldığı için bu sapma doğrudan "kim kazandı"yı değiştirir.
 *
 * Çözüm: parayı en küçük birim cinsinden TAM SAYI olarak tut.
 * 12.345,67 TL  ->  1234567n  (kuruş)
 *
 * `bigint` seçildi çünkü `number` tam sayı olarak da güvenli değil:
 * Number.MAX_SAFE_INTEGER = 2^53. `bigint`'in üst sınırı yok.
 */

// ---------------------------------------------------------------------------
// 1. MARKALI TİPLER (branded types)
// ---------------------------------------------------------------------------

/**
 * Problem: kuruş da, fiyat da, miktar da `bigint`. TypeScript için üçü de aynı
 * tip, yani şu kod sorunsuz derlenir ama tamamen saçmadır:
 *
 *     const toplam = bakiye + fiyat;   // kuruş + 1e8 ölçekli fiyat = anlamsız
 *
 * Bu hatayı çalışma anında yakalayamazsın; sonuç yine bir bigint, sadece yanlış.
 *
 * Çözüm: tipe görünmez bir "marka" iliştir. Marka yalnızca tip düzeyinde vardır,
 * derlenmiş JavaScript'te hiçbir izi kalmaz — yani çalışma anı maliyeti sıfır.
 */
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

/** Para: kuruş cinsinden. 1 TL = 100n */
export type Penny = Brand<bigint, "Penny">;

/** Fiyat: 1e8 ölçekli. 1 birim varlığın TL fiyatı */
export type Price = Brand<bigint, "Price">;

/** Miktar: 1e10 ölçekli. Kaç birim varlık */
export type Amount = Brand<bigint, "Amount">;

// ---------------------------------------------------------------------------
// 2. ÖLÇEKLER
// ---------------------------------------------------------------------------


export const PENNY_SCALE = 2;
export const PRICE_SCALE = 8;
export const AMOUNT_SCALE = 10;

/** 10^n hesaplar. Math.pow kullanılmaz — o `number` döner, hassasiyet kaybettirir. */
function pow10(n: number): bigint {
  return 10n ** BigInt(n);
}

// ---------------------------------------------------------------------------
// 3. YUVARLAMA — bu dosyanın en kritik fonksiyonu
// ---------------------------------------------------------------------------

/**
 * `bigint` bölmesi YUVARLAMAZ, KIRPAR (sıfıra doğru):
 *
 *      7n / 2n  ===  3n     // 3.5 değil
 *     -7n / 2n  === -3n
 *
 * Her kırpma bir miktar değeri siler. Alım-satımın her adımında olursa
 * sistematik olarak hep aynı yöne kayar ve bakiye tutmaz.
 *
 * Bu yüzden para üzerinde `/` operatörü SADECE burada kullanılır.
 * Başka hiçbir dosyada para bölmesi yapılmayacak.
 *
 * KARAR: ROUND_HALF_UP = "yarım, sıfırdan UZAĞA".
 *     2.5 ->  3
 *    -2.5 -> -3
 * Java BigDecimal'in HALF_UP'ı da budur; ticari standart. Alternatif
 * "yarım her zaman yukarı" (-2.5 -> -2) olurdu; onu seçmedik çünkü pozitif ve
 * negatif tutarlara asimetrik davranır.
 */
export function divRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new Error("money: sıfıra bölme");
  }

  // İşareti baştan ayır, hesabı mutlak değerlerle yap. Böylece negatif sayılarda
  // "yukarı" kavramının belirsizliği ortadan kalkar.
  const isNegative = numerator < 0n !== denominator < 0n;
  const absNum = numerator < 0n ? -numerator : numerator;
  const absDen = denominator < 0n ? -denominator : denominator;

  const quotient = absNum / absDen;
  const remainder = absNum % absDen;

  // Kalanın yarımdan büyük veya yarıma eşit olup olmadığını kesirsiz sınamanın
  // yolu: kalanı ikiye katlayıp böleneyle karşılaştırmak.
  const rounded = remainder * 2n >= absDen ? quotient + 1n : quotient;

  return isNegative ? -rounded : rounded;
}

// ---------------------------------------------------------------------------
// 4. AYRIŞTIRMA (parse) — dış dünyadan içeri
// ---------------------------------------------------------------------------

/**
 * Ondalık metni ölçekli bigint'e çevirir.
 *
 * KABUL EDİLEN BİÇİM: makine biçimi — ondalık ayırıcı NOKTA, binlik ayırıcı YOK.
 *     "446.45"  "0.00000001"  "-12.5"  "1234"
 * Binance, EVDS ve LBMA verisi bu biçimde geliyor.
 *
 * Kullanıcının ekrandan girdiği Türkçe biçim ("1.234,56") ayrı bir fonksiyonla
 * ele alınacak. İkisini tek fonksiyonda kabul etmek belirsizlik yaratır:
 * "1.234" bin iki yüz otuz dört mü, bir tam iki yüz otuz dört mü?
 *
 * TUZAK: Sakın parseFloat/Number kullanma. O anda float'a düşersin ve dosyanın
 * varlık sebebi ortadan kalkar. Metin doğrudan işlenir.
 */
export function parseScaled(text: string, scale: number): bigint {
  const trimmed = text.trim();

  // Yalnızca: isteğe bağlı işaret + rakamlar + isteğe bağlı (nokta + rakamlar).
  // Bilimsel gösterim (1e5), boşluk, para sembolü kasten reddedilir.
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`money: geçersiz sayı biçimi: "${text}"`);
  }

  const isNegative = trimmed.startsWith("-");
  const unsigned = isNegative ? trimmed.slice(1) : trimmed;

  const [intPart, fracPart = ""] = unsigned.split(".");

  // TUZAK: ölçekten fazla basamak gelirse SESSİZCE KIRPMA, hata fırlat.
  // Sessiz kırpma kullanıcının girdiği değerin kaybolması demektir ve bunu
  // kimse fark etmez.
  if (fracPart.length > scale) {
    throw new Error(
      `money: "${text}" ${fracPart.length} ondalık basamak içeriyor, ` +
        `bu ölçek en fazla ${scale} taşıyabilir`,
    );
  }

  // Ondalık kısmı ölçeğe tamamla: "45" + scale 8 -> "45000000"
  const padded = fracPart.padEnd(scale, "0");
  const digits = intPart + padded;

  const value = BigInt(digits);
  return isNegative ? -value : value;
}

export const toPenny = (text: string): Penny =>
  parseScaled(text, PENNY_SCALE) as Penny;

export const toPrice = (text: string): Price =>
  parseScaled(text, PRICE_SCALE) as Price;

export const toAmount = (text: string): Amount =>
  parseScaled(text, AMOUNT_SCALE) as Amount;

// ---------------------------------------------------------------------------
// 5. BİÇİMLENDİRME (format) — içeriden dışarı
// ---------------------------------------------------------------------------

/**
 * Ölçekli bigint'i ondalık metne çevirir. parseScaled'ın tam tersi.
 *     (1234567n, 2) -> "12345.67"
 *
 * NOT: Intl.NumberFormat burada kullanılmıyor. Ölçekli bigint'i ona doğrudan
 * veremezsin — 1234567n verirsen "1.234.567" yazar, oysa kastettiğin 12.345,67.
 * Önce ölçeği düşürmen gerekir, bölersen de hassasiyet kaybedersin.
 * Metin üzerinde çalışmak hem kayıpsız hem daha anlaşılır.
 */
export function formatScaled(value: bigint, scale: number): string {
  const isNegative = value < 0n;
  const abs = isNegative ? -value : value;

  const divisor = pow10(scale);
  const intPart = abs / divisor;
  const fracPart = abs % divisor;

  // Ondalık kısım baştaki sıfırları kaybetmesin: 5n, scale 2 -> "05"
  const fracText = fracPart.toString().padStart(scale, "0");

  const sign = isNegative ? "-" : "";
  return scale === 0 ? `${sign}${intPart}` : `${sign}${intPart}.${fracText}`;
}

/** Tam sayı metnine binlik ayırıcı ekler: "1234567" -> "1.234.567" */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Kuruşu Türkçe para biçimine çevirir.
 *     1234567n -> "12.345,67 ₺"
 * Nokta binlik ayırıcı, virgül ondalık ayırıcı.
 */
export function formatTRY(value: Penny): string {
  const isNegative = value < 0n;
  const abs = isNegative ? -value : value;

  const divisor = pow10(PENNY_SCALE);
  const intPart = (abs / divisor).toString();
  const fracPart = (abs % divisor).toString().padStart(PENNY_SCALE, "0");

  const sign = isNegative ? "-" : "";
  return `${sign}${groupThousands(intPart)},${fracPart} ₺`;
}

// ---------------------------------------------------------------------------
// 6. İŞLEM HESAPLARI
// ---------------------------------------------------------------------------

/**
 * Brüt tutar = fiyat x miktar
 *
 * BURASI EN SİNSİ KISIM. Çarpımda ölçekler TOPLANIR:
 *
 *     fiyat (1e8)  x  miktar (1e10)  =  sonuç (1e18)
 *
 * Sonucu kuruşa (1e2) indirmek için 1e16'ya bölmek gerekir — ve o bölme
 * mutlaka divRound'dan geçmelidir.
 *
 * Buradaki hatanın tehlikesi: sonuç MAKUL GÖRÜNÜR. Basamak kaydırsan bakiye
 * 100 kat yanlış çıkar ve hemen anlarsın. Ama yuvarlamayı atlarsan sonuç
 * sadece kuruş kadar sapar ve testin yoksa aylarca fark etmezsin.
 */
export function calcGross(price: Price, amount: Amount): Penny {
  const excessScale = PRICE_SCALE + AMOUNT_SCALE - PENNY_SCALE; // 8 + 10 - 2 = 16
  return divRound(price * amount, pow10(excessScale)) as Penny;
}

/**
 * Komisyon hesabı. Oran baz puan (basis point) cinsinden verilir.
 * 1 baz puan = %0,01. Yani 25 bps = %0,25.
 *
 * Neden yüzde değil baz puan: yüzdeyi ondalıkla ifade etmek (0.25) yine kayan
 * nokta demek. Baz puan tam sayıdır, `bigint` aritmetiğine sorunsuz girer.
 */
export function calcCommission(gross: Penny, basisPoints: number): Penny {
  if (!Number.isInteger(basisPoints) || basisPoints < 0) {
    throw new Error("money: baz puan negatif olmayan tam sayı olmalı");
  }
  return divRound(gross * BigInt(basisPoints), 10_000n) as Penny;
}

/** Alışta ödenen toplam: brüt + komisyon */
export function calcBuyTotal(gross: Penny, commission: Penny): Penny {
  return addPenny(gross, commission) ;
}

/** Satışta ele geçen net: brüt - komisyon */
export function calcSellNet(gross: Penny, commission: Penny): Penny {
  return subPenny(gross, commission) ;
}


export function addPenny(a: Penny, b: Penny): Penny {
  return (a + b) as Penny;
}

export function subPenny(a: Penny, b: Penny): Penny {
  return (a - b) as Penny;
}