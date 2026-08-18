import { parseScaled, PRICE_SCALE } from "../lib/money.js";
import type { Price } from "../lib/money.js";
import { MarketDataError } from "./provider.js";

const BASE_URL = "https://www.tcmb.gov.tr/kurlar";

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
  /** 1 USD kaç TL — 1e8 ölçekli */
  rate: Price;
}

export interface FxRateProvider {
  getUsdTry(date: string): Promise<FxRate>;
}

export class TcmbAdapter implements FxRateProvider {
  /**
   * Aynı tarih için tekrar tekrar istek atmamak içindir.
   * `null` değeri "o gün dosya yok" demek — bu da önbelleğe alınır, yoksa
   * her hafta sonu sorgusunda cumartesi ve pazar tekrar tekrar sorulur.
   */
  private readonly cache = new Map<string, Price | null>();

  async getUsdTry(date: string): Promise<FxRate> {
    for (let back = 0; back < MAX_LOOKBACK_DAYS; back++) {
      const day = shiftDays(date, -back);
      const rate = await this.rateOf(day);

      if (rate !== null) {
        return { requestedDate: date, date: day, rate };
      }
    }

    throw new MarketDataError(
      `${date} ve öncesindeki ${MAX_LOOKBACK_DAYS} günde USD kuru bulunamadı`,
      "tcmb",
    );
  }

  /** Önbellekli tek gün sorgusu. Dosya yoksa null döner — bu hata değildir. */
  private async rateOf(date: string): Promise<Price | null> {
    const cached = this.cache.get(date);
    if (cached !== undefined) return cached;

    const rate = await fetchDay(date);
    this.cache.set(date, rate);
    return rate;
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

async function fetchDay(date: string): Promise<Price | null> {
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

  return parseUsdRate(await response.text(), date);
}

/**
 * XML'den USD alış kurunu çıkarır.
 *
 * Yapı sabit ve tek bir alan aradığımız için hedefli bir düzenli ifade
 * kullanıldı; XML ayrıştırıcı bağımlılığı eklenmedi.
 *
 * KARAR: ForexBuying (döviz alış) kullanılıyor. TCMB dört kur yayımlıyor
 * (alış/satış x döviz/efektif). Hangisi seçilirse seçilsin tutarlı olmak
 * yeterli; ForexBuying rapordaki doğrulamada da kullanılan kur.
 *
 * NOT: <Unit> alanı USD için 1. Bazı para birimlerinde 100 olur (örn. JPY);
 * başka para birimi eklenirse kurun Unit'e bölünmesi gerekir.
 */
function parseUsdRate(xml: string, date: string): Price {
  const match = xml.match(
    /CurrencyCode="USD"[\s\S]*?<ForexBuying>([\d.]+)<\/ForexBuying>/,
  );

  const raw = match?.[1];
  if (!raw) {
    throw new MarketDataError(
      `${date} tarihli TCMB verisinde USD kuru okunamadı`,
      "tcmb",
    );
  }

  return parseScaled(raw, PRICE_SCALE) as Price;
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
