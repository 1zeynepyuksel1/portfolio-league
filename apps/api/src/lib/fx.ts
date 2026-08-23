import { divRound, PRICE_SCALE } from "./money.js";
import type { Penny, Price } from "./money.js";

/** 1e8 — fiyat ölçeğindeki "bir" değeri. */
const PRICE_ONE = 10n ** BigInt(PRICE_SCALE);

/**
 * USD cinsinden bir fiyatı TL'ye çevirir.
 *
 * ÖLÇEK MATEMATİĞİ — buradaki hatanın tehlikesi sonucun makul görünmesidir:
 *
 *   usd  (1e8 ölçekli)  ×  rate (1e8 ölçekli)  =  ara sonuç (1e16 ölçekli)
 *
 * Sonuç yine bir fiyat, yani 1e8 ölçekli olmalı. Fazla gelen 1e8'i bölerek
 * atıyoruz — ve bu bölme mutlaka divRound'dan geçiyor, çünkü bigint bölmesi
 * kırpar ve her kırpma kullanıcı aleyhine kuruş eritir.
 *
 * Örnek: 100 USD, kur 40 -> 4000 TL
 *   10000000000n × 4000000000n = 40000000000000000000n   (1e16 ölçekli)
 *   ÷ 100000000n              = 400000000000n            (1e8 ölçekli = 4000)
 *
 * NOT: Kur her zaman TCMB'den gelir, borsadan değil. Binance'in TRY paritesi
 * yalnızca 20 Aralık 2019'a kadar gidiyor; USDT paritesi 2017'ye. Bu yüzden
 * fiyat USD çekilip burada TL'ye çevriliyor.
 * (bkz. docs/00-veri-saglayici-dogrulama.md §1)
 */
export function usdToTry(usd: Price, usdTryRate: Price): Price {
  return divRound(usd * usdTryRate, PRICE_ONE) as Price;
}

/**
 * ---------------------------------------------------------------------------
 * TERS YÖN — TL'yi USD'ye çevirmek (gösterim merceği)
 * ---------------------------------------------------------------------------
 *
 * ⚠️ BU İKİ FONKSİYON `usdToTry`'IN SİMETRİĞİ DEĞİL, TERSİ.
 *
 * `usdToTry` fiyat ÜRETİYOR: veriyi Binance'ten USD çekiyoruz, TL'ye
 * çevirip saklıyoruz. Aşağıdakiler ise saklanmış TL'yi kullanıcıya USD
 * göstermek için çeviriyor — sonuç HİÇBİR YERE YAZILMIYOR.
 *
 * Bu ayrım önemli: gidiş-dönüş çevrim kayıpsız değil. TL'ye çevirip
 * sakladığımız bir değeri tekrar USD'ye çevirince orijinal USD fiyatını
 * birebir geri alamayabiliriz (yuvarlama). Sorun değil, çünkü bu sayı
 * yalnızca ekranda duruyor; emir de portföy de TL üzerinden hesaplanıyor.
 *
 * ⚠️ LİG SIRALAMASI TL'DE KALIR. TL %30 değer kaybederse aynı portföy
 * TL'de harika, dolarda vasat görünür — ikisi de doğru, ama lig BİRİNİ
 * seçmek zorunda ve TWR'yi TL üzerinden seçtik (docs/01-plan.md).
 * Bu fonksiyonlar bir GÖSTERİM MERCEĞİ; sıralama kodu bunlara hiç
 * dokunmamalı. Dokunursa aynı portföy iki kullanıcıda farklı sıralanır.
 */

/**
 * Ölçekten bağımsız çekirdek: `value ÷ kur`.
 *
 * NEDEN TEK FONKSİYON, İKİ SARMALAYICI:
 *
 * Kuruş (1e2) ve fiyat (1e8) farklı ölçekler ama işlem aynı. Önce
 * PRICE_ONE ile çarpıp kurun ölçeğini dengeliyoruz, sonra bölüyoruz:
 *
 *   value (1eN)  ×  PRICE_ONE (1e8)  =  ara (1e[N+8])
 *   ara (1e[N+8]) ÷ rate (1e8)       =  sonuç (1eN)   ← ölçek korundu
 *
 * Yani N ne olursa olsun sonuç girdiyle aynı ölçekte çıkıyor. Markalı
 * tipleri ayrı tutmak için iki ince sarmalayıcı var — çekirdek `bigint`
 * alıyor ki `Penny`'yi `Price` sanma hatası yapılamasın.
 *
 * ⚠️ `divRound` ZORUNLU. Düz `bigint` bölmesi kırpar; her kırpma
 * kullanıcı aleyhine kuruş eritir (CLAUDE.md, bilinen tuzak #2).
 */
function divideByRate(value: bigint, usdTryRate: Price): bigint {
  return divRound(value * PRICE_ONE, usdTryRate);
}

/**
 * TL cinsinden bir FİYATI dolara çevirir.
 *
 * Örnek: 4000 TL, kur 40 -> 100 USD
 *   400000000000n × 100000000n = 40000000000000000000n  (1e16)
 *   ÷ 4000000000n              = 10000000000n           (1e8 = 100)
 */
export function tryToUsd(tryPrice: Price, usdTryRate: Price): Price {
  return divideByRate(tryPrice, usdTryRate) as Price;
}

/**
 * TL KURUŞU dolar sentine çevirir.
 *
 * ⚠️ SONUÇ "SENT" — kuruş değil. İkisi de 1e2 ölçekli olduğu için tip
 * sistemi ikisini ayırt EDEMİYOR; `Penny` markası her ikisini de kabul
 * eder. Karışırsa 100 sent "1 TL" diye biçimlendirilir ve sayı makul
 * görünür. Bu yüzden çevrilen değer yanıtta ayrı bir alan adıyla ve
 * `currency` etiketiyle birlikte gidiyor, aynı alanın içine yazılmıyor.
 */
export function centsTryToUsd(cents: Penny, usdTryRate: Price): Penny {
  return divideByRate(cents, usdTryRate) as Penny;
}

/**
 * ---------------------------------------------------------------------------
 * GÖSTERİM PARA BİRİMİ — `?currency=` parametresi
 * ---------------------------------------------------------------------------
 */

export const DISPLAY_CURRENCIES = ["try", "usd"] as const;

export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

/**
 * `?currency=` parametresini okur. Verilmemişse varsayılan `try`.
 *
 * ⚠️ GEÇERSİZ DEĞER SESSİZCE `try`'A DÜŞMÜYOR, `null` DÖNÜYOR.
 *
 * Kullanıcı `?currency=eur` yazarsa sessizce TL göstermek, "istediğin oldu"
 * yalanı söylemek olur — ekranda TL rakamları €  simgesiyle görünebilir.
 * Çağıran taraf `null` görünce 400 döndürüyor.
 *
 * Sorgu parametresi DİZİ olarak da gelebilir (`?currency=a&currency=b`);
 * `typeof` kontrolü bunu da eliyor.
 */
export function parseCurrency(raw: unknown): DisplayCurrency | null {
  if (raw === undefined) return "try";

  if (typeof raw !== "string") return null;

  const lower = raw.toLowerCase();

  return (DISPLAY_CURRENCIES as readonly string[]).includes(lower)
    ? (lower as DisplayCurrency)
    : null;
}
