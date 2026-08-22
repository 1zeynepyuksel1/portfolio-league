import { divRound, parseScaled, PRICE_SCALE } from "../lib/money.js";
import type { Price } from "../lib/money.js";
import { MarketDataError } from "./provider.js";

const BASE_URL = "https://www.tcmb.gov.tr/kurlar";

/**
 * Desteklenen para birimleri ve TCMB'nin kotasyon BİRİMİ.
 *
 * ⚠️ BU TABLONUN VARLIK SEBEBİ BİR TUZAK.
 * TCMB her kuru "1 birim" üzerinden yayımlamıyor. USD için `<Unit>1</Unit>`
 * ama JPY için `<Unit>100</Unit>` — yani XML'deki sayı 100 YEN'in TL
 * karşılığı. Bölmezsen yen 100 katı pahalı görünür ve bu sayı "makul"
 * durduğu için gözden kaçar.
 *
 * ÖLÇÜLDÜ (EVDS TP.DK.JPY.A, 2 Ocak 2024): 20,74670000
 * Gerçek 1 JPY o gün ~0,207 TL. Aradaki çarpan tam olarak 100.
 *
 * Aynı tuzak EVDS tarafında da var ve orada `<Unit>` alanı HİÇ YOK — o
 * yüzden birim bilgisi tek merkezde, burada duruyor. evds.ts bu tabloyu
 * içe aktarıp kullanıyor; iki ayrı liste tutsaydık biri düzeltilir öbürü
 * eski kalırdı.
 *
 * SİSTEM KURALI: price_history her zaman BİR BİRİMİN fiyatını tutar.
 * 1 JPY = 0,20746700 TL olarak yazılır, 100 JPY olarak değil.
 */
export const FX_UNITS: Record<string, number> = {
  USD: 1,
  EUR: 1,
  GBP: 1,
  CHF: 1,
  CAD: 1,
  AUD: 1,
  SEK: 1,
  JPY: 100,
};

/**
 * Kur bulunamazsa en fazla kaç gün geriye gidilir.
 *
 * Hafta sonu 2 gün, ama dini bayramlar arife ile birlikte 9 güne kadar
 * çıkabiliyor. 10 güvenli bir üst sınır. Sınırsız yapmıyoruz — yoksa TCMB
 * çöktüğünde kod yıllar öncesine kadar geri gider ve sonunda çok eski bir
 * kurla işlem yapar.
 */
const MAX_LOOKBACK_DAYS = 10;

/**
 * Bir kur sorgusunun sonucu.
 *
 * `date` alanı ÖNEMLİ: istediğin tarih değil, kurun gerçekten yayımlandığı
 * tarihtir. Cumartesi sorduğunda cuma dönebilir. Bunu bilmeden kullanırsan
 * hafta sonu emirlerinin hangi kurla fiyatlandığını kaybedersin.
 */
export interface FxRate {
  /** Sorduğun tarih, "YYYY-MM-DD" */
  requestedDate: string;
  /** Kurun gerçekten yayımlandığı tarih, "YYYY-MM-DD" */
  date: string;
  /**
   * BİR birim döviz kaç TL — 1e8 ölçekli.
   *
   * "Bir birim" vurgusu önemli: TCMB JPY'yi 100 birim üzerinden yayımlıyor,
   * `parseRate` bunu bölerek normalleştiriyor (bkz. FX_UNITS).
   */
  rate: Price;
}

export interface FxRateProvider {
  /** Herhangi bir para biriminin kuru. `code` FX_UNITS'te tanımlı olmalı. */
  getRate(code: string, date: string): Promise<FxRate>;
  /** `getRate("USD", date)` için kısayol. Mevcut çağıranlar için korundu. */
  getUsdTry(date: string): Promise<FxRate>;
}

export class TcmbAdapter implements FxRateProvider {
  /**
   * Gün -> o güne ait XML BELGESİ (yoksa null).
   *
   * ⚠️ ÖNBELLEK KURU DEĞİL BELGEYİ TUTUYOR — ve fark önemli.
   * TCMB tek dosyada bütün para birimlerini yayımlıyor. Önbellek "kod|tarih"
   * anahtarlı olsaydı 8 döviz için AYNI dosya 8 kez indirilirdi; cron 15
   * saniyede bir çalıştığı için bu günde ~46.000 gereksiz istek demekti.
   *
   * Belgeyi bir kez indirip 8 kez ayrıştırmak, 8 kez indirip 8 kez
   * ayrıştırmaktan farksız görünür ama ağ maliyeti sekizde bire iner.
   *
   * `null` değeri "o gün dosya yok" demek — bu da önbelleğe alınır, yoksa
   * her hafta sonu sorgusunda cumartesi ve pazar tekrar tekrar sorulur.
   */
  private readonly documents = new Map<string, string | null>();

  async getRate(code: string, date: string): Promise<FxRate> {
    if (FX_UNITS[code] === undefined) {
      throw new MarketDataError(`Desteklenmeyen para birimi: ${code}`, "tcmb");
    }

    for (let back = 0; back < MAX_LOOKBACK_DAYS; back++) {
      const day = shiftDays(date, -back);
      const rate = await this.rateOf(code, day);

      if (rate !== null) {
        return { requestedDate: date, date: day, rate };
      }
    }

    throw new MarketDataError(
      `${date} ve öncesindeki ${MAX_LOOKBACK_DAYS} günde ${code} kuru bulunamadı`,
      "tcmb",
    );
  }

  async getUsdTry(date: string): Promise<FxRate> {
    return this.getRate("USD", date);
  }

  /**
   * Önbellekli tek gün sorgusu. Dosya yoksa null döner — bu hata DEĞİLDİR,
   * hafta sonu/tatil bilgisidir ve forward-fill bunu kullanır.
   *
   * Dosya VARSA ama para birimi içinde yoksa hata fırlatılır: o bir veri
   * sorunudur, sessizce "kur yok" muamelesi görmemeli.
   */
  private async rateOf(code: string, date: string): Promise<Price | null> {
    const xml = await this.documentOf(date);
    if (xml === null) return null;

    return parseRate(xml, code, date);
  }

  private async documentOf(date: string): Promise<string | null> {
    const cached = this.documents.get(date);
    if (cached !== undefined) return cached;

    const xml = await fetchDay(date);
    this.documents.set(date, xml);
    return xml;
  }
}

/**
 * TCMB dosya yolu: /kurlar/YYYYMM/DDMMYYYY.xml
 * Örnek: 12 Mart 2020 -> /kurlar/202003/12032020.xml
 */
function urlFor(date: string): string {
  const [y, m, d] = splitDate(date);
  return `${BASE_URL}/${y}${m}/${d}${m}${y}.xml`;
}

/** Günün XML belgesini indirir. Dosya yoksa null. */
async function fetchDay(date: string): Promise<string | null> {
  let response: Response;
  try {
    response = await fetch(urlFor(date));
  } catch (cause) {
    throw new MarketDataError(
      `TCMB'ye ulaşılamadı: ${String(cause)}`,
      "tcmb",
    );
  }

  // 404 BEKLENEN bir durumdur: hafta sonu ve tatilde kur yayımlanmıyor.
  // Hata değil, "o gün veri yok" bilgisi. Forward-fill bunu kullanır.
  if (response.status === 404) return null;

  if (!response.ok) {
    throw new MarketDataError(`TCMB ${response.status} döndürdü`, "tcmb");
  }

  return response.text();
}

/**
 * XML'den bir para biriminin alış kurunu çıkarır — BİR BİRİM başına.
 *
 * Yapı sabit olduğu için XML ayrıştırıcı bağımlılığı eklenmedi, hedefli
 * düzenli ifade kullanıldı.
 *
 * KARAR: ForexBuying (döviz alış) kullanılıyor. TCMB dört kur yayımlıyor
 * (alış/satış x döviz/efektif). Hangisi seçilirse seçilsin tutarlı olmak
 * yeterli; ForexBuying rapordaki doğrulamada da kullanılan kur.
 *
 * ⚠️ ÖNCE BLOK, SONRA ALAN — ve bu sıra bir hata sınıfını kapatıyor.
 * Eski hâli `CurrencyCode="USD"[\s\S]*?<ForexBuying>` diye tek seferde
 * arıyordu. `[\s\S]*?` belge sonuna kadar gidebildiği için, aradığımız
 * para biriminin ForexBuying alanı O GÜN BOŞSA (`<ForexBuying/>` — nadir
 * ama oluyor) desen SONRAKİ para biriminin kurunu yakalardı. Hata vermez,
 * makul bir sayı döner, yanlıştır.
 *
 * Önce `<Currency>...</Currency>` bloğunu izole edip alanları onun içinde
 * aramak bu sızmayı imkânsız kılıyor.
 */
export function parseRate(xml: string, code: string, date: string): Price {
  const unit = FX_UNITS[code];
  if (unit === undefined) {
    throw new MarketDataError(`Desteklenmeyen para birimi: ${code}`, "tcmb");
  }

  const block = xml.match(
    new RegExp(`<Currency[^>]*CurrencyCode="${code}"[\\s\\S]*?</Currency>`),
  )?.[0];

  if (!block) {
    throw new MarketDataError(
      `${date} tarihli TCMB verisinde ${code} bulunamadı`,
      "tcmb",
    );
  }

  const raw = block.match(/<ForexBuying>([\d.]+)<\/ForexBuying>/)?.[1];
  if (!raw) {
    throw new MarketDataError(
      `${date} tarihli TCMB verisinde ${code} alış kuru boş`,
      "tcmb",
    );
  }

  // ⚠️ Belgedeki <Unit> ile kendi tablomuz karşılaştırılıyor.
  // Amaç sadece bölmek değil, TCMB bir gün birimi değiştirirse bunu
  // FARK ETMEK. Sessizce belgeye uysaydık tablo yanlışa düşer ve
  // haberimiz olmazdı; sessizce tabloya uysaydık kur 100 kat kayardı.
  const declaredUnit = block.match(/<Unit>(\d+)<\/Unit>/)?.[1];
  if (declaredUnit !== undefined && Number(declaredUnit) !== unit) {
    throw new MarketDataError(
      `${code} birimi değişmiş: TCMB ${declaredUnit} diyor, tablomuzda ${unit} yazıyor ` +
        `(tcmb.ts FX_UNITS güncellenmeli)`,
      "tcmb",
    );
  }

  const quoted = parseScaled(raw, PRICE_SCALE) as Price;

  // Bir birimin fiyatına indir. JPY için 100'e bölünüyor.
  // divRound şart: bigint bölmesi kırpar (bkz. money.ts).
  return divRound(quoted, BigInt(unit)) as Price;
}

/** "2020-03-12" -> ["2020", "03", "12"] */
function splitDate(date: string): [string, string, string] {
  const parts = date.split("-");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new MarketDataError(`Geçersiz tarih: ${date}`, "tcmb");
  }
  return [parts[0], parts[1], parts[2]];
}

/**
 * Tarihi gün cinsinden kaydırır. "2020-03-14" + (-2) -> "2020-03-12"
 *
 * Hesap UTC üzerinden yapılır. Yerel saat kullanılsaydı yaz saati geçişlerinde
 * bir gün kayabilirdi.
 */
function shiftDays(date: string, days: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms)) {
    throw new MarketDataError(`Geçersiz tarih: ${date}`, "tcmb");
  }
  return new Date(ms + days * 86_400_000).toISOString().slice(0, 10);
}
