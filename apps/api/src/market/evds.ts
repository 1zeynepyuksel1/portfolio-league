/**
 * evds.ts — TCMB Elektronik Veri Dağıtım Sistemi (EVDS) Entegrasyonu
 *
 * Bu dosya:
 * 1. TCMB EVDS servisine bağlanır.
 * 2. TÜFE Genel Endeks serisini çeker.
 * 3. Aylık verileri "YYYY-MM" biçimine normalleştirir.
 *
 * ⚠️ İKİ TUZAK — ikisi de gerçek istekle doğrulandı,
 * ayrıntı: docs/00-veri-saglayici-dogrulama.md §4 ve §5
 *
 * TUZAK 1 — BASE URL.
 * İnternetteki hemen bütün örnekler (blog yazıları, Python kütüphaneleri,
 * eski kılavuz kopyaları) `evds2.tcmb.gov.tr/service/evds` gösteriyor.
 * O adres artık 302 ile ana sayfaya yönlendiriyor ve JSON yerine portalın
 * HTML'ini döndürüyor — istek "başarılı" görünür, veri gelmez.
 *
 *   evds2.../service/evds/series=…    -> 302, HTML
 *   evds3.../service/evds/series=…    -> 200 ama text/html (SPA sayfası)
 *   evds3.../igmevdsms-dis/series=…   -> 403 application/json  ✅ doğru uç
 *
 * Anahtarsız istekteki 403, doğru uç noktanın kanıtı: yanlış path sessizce
 * HTML dönerken doğru path anlamlı bir hata veriyor.
 *
 * TUZAK 2 — SERİ KODU.
 * `TP.FG.J0` ARŞİV serisidir, Ocak 2026'da donmuştur. Canlı seri
 * `TP.GENENDEKS.T1` (aylık, 2003 -> bugün).
 *
 * Anahtar HTTP header'ında `key: <anahtar>` gönderilir, query parametresi
 * olarak DEĞİL.
 */

import { divRound, toPrice, type Price } from '../lib/money.js';
import { FX_UNITS } from './tcmb.js';

export type EvdsTufeItem = {
  month: string; // Format: "YYYY-MM" (Örn: "2020-03")
  tufeIndex: number; // Örn: 450.58
};

export const EVDS_SERIES_CODE = 'TP.GENENDEKS.T1';
export const EVDS_BASE_URL = 'https://evds3.tcmb.gov.tr/igmevdsms-dis';

type EvdsApiResponse = {
  totalCount?: number;
  // Alan adı seri koduna göre değiştiği için dinamik indeksleme gerekiyor.
  items?: Array<Record<string, string | number | null | undefined>>;
};

/**
 * Belirtilen tarih aralığındaki TÜFE serisini çeker.
 *
 * Tarih biçimi EVDS'nin istediği gibi: GG-AA-YYYY.
 *
 * ⚠️ EVDS 1000 gözlem sınırı uyguluyor ve bu sınır BİTİŞ tarihinden GERİYE
 * doğru işliyor. TÜFE aylık olduğu için 2003-2026 arası ~280 gözlem —
 * sınırın çok altında, tek istek yeterli. Günlük bir seride bu geçerli
 * olmazdı.
 */
/**
 * Ortak alt katman: EVDS'den bir seriyi çeker, ham satırları döndürür.
 *
 * TÜFE de kur da aynı boruyu kullanıyor — URL biçimi, header'daki anahtar,
 * content-type kontrolü tek yerde. İki kez yazsaydık biri düzeltilir,
 * diğeri eski hâliyle kalırdı.
 */
async function fetchEvdsItems(
  seriesCode: string,
  startDate: string,
  endDate: string,
  apiKey?: string,
): Promise<Array<{ date: string; value: string | number }>> {
  const key = apiKey || process.env.EVDS_API_KEY;

  if (!key) {
    throw new Error('EVDS_API_KEY tanımlı değil.');
  }

  const url = `${EVDS_BASE_URL}/series=${seriesCode}&startDate=${startDate}&endDate=${endDate}&type=json`;

  const response = await fetch(url, {
    headers: {
      // Query parametresi DEĞİL — header. Query'de gönderirsek 403 alırız.
      key,
    },
  });

  if (!response.ok) {
    throw new Error(`EVDS API isteği başarısız oldu: HTTP ${response.status}`);
  }

  // ⚠️ Yanıt JSON değilse (yanlış base URL -> HTML) burada patlar.
  // Sessizce boş liste dönmektense hata fırlatmak doğru: veri gelmediğini
  // fark etmemiz gerekiyor.
  const contentType = response.headers?.get('content-type') ?? '';
  if (contentType !== '' && !contentType.includes('json')) {
    throw new Error(
      `EVDS JSON yerine ${contentType} döndürdü — base URL yanlış olabilir`,
    );
  }

  const data = (await response.json()) as EvdsApiResponse;

  if (!data.items || !Array.isArray(data.items)) {
    return [];
  }

  const field = seriesCode.replace(/\./g, '_');
  const rows: Array<{ date: string; value: string | number }> = [];

  for (const item of data.items) {
    const rawDate = item.Tarih;
    const rawValue = item[field];

    // ⚠️ `null` NORMAL bir durum: hafta sonu ve resmî tatillerde kur
    // yayımlanmıyor. Atlıyoruz; çağıran taraf forward-fill uyguluyor.
    if (typeof rawDate !== 'string' || rawValue === null || rawValue === undefined) {
      continue;
    }

    rows.push({ date: rawDate, value: rawValue });
  }

  return rows;
}

export async function fetchTufeFromEvds(
  startDate = '01-01-2017',
  endDate = '31-12-2026',
  apiKey?: string,
): Promise<EvdsTufeItem[]> {
  const items = await fetchEvdsItems(
    EVDS_SERIES_CODE,
    startDate,
    endDate,
    apiKey,
  );

  const results: EvdsTufeItem[] = [];

  for (const item of items) {
    const rawDate = item.date;
    const rawValue = item.value;

    // "2020-3" -> "2020-03"
    const parts = rawDate.split('-');
    if (parts.length < 2 || !parts[0] || !parts[1]) continue;

    const standardMonth = `${parts[0]}-${parts[1].padStart(2, '0')}`;

    const parsedIndex =
      typeof rawValue === 'number'
        ? rawValue
        : parseFloat(String(rawValue).replace(',', '.'));

    if (!isNaN(parsedIndex) && parsedIndex > 0) {
      results.push({ month: standardMonth, tufeIndex: parsedIndex });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// GÜNLÜK DÖVİZ KURU
// ---------------------------------------------------------------------------

/**
 * Seri kodu kalıbı: `TP.DK.{KOD}.A`
 *
 * Sondaki `.A` "alış" demek — TCMB XML'indeki `ForexBuying` ile aynı seri.
 * Tutarlılık için ikisi de alış kuru kullanıyor: canlı fiyat XML'den,
 * geçmiş buradan geliyor ve aralarında sistematik fark olmamalı.
 *
 * Sekiz para biriminin de var olduğu gerçek istekle doğrulandı
 * (Ocak 2024, hepsi 22 dolu gözlem döndürdü).
 */
function seriesCodeFor(currencyCode: string): string {
  return `TP.DK.${currencyCode}.A`;
}

/** Geriye dönük uyumluluk için duruyor. */
export const EVDS_USD_SERIES_CODE = seriesCodeFor('USD');

export type EvdsRateItem = {
  /** "YYYY-MM-DD" */
  date: string;
  /**
   * BİR birim dövizin TL karşılığı — `Price` (1e8 ölçekli bigint).
   *
   * ⚠️ İKİ AYRI SEBEPLE HAM METİN DEĞİL:
   *
   * 1. `number` olmamalı. Bu değer fiyatlarla çarpılacak; float'a düşerse
   *    money.ts'te kurduğumuz zincir kırılır. `Price` zaten bigint.
   *
   * 2. Ham değer NORMALLEŞTİRİLMİŞ durumda. EVDS de TCMB gibi bazı
   *    kurları 100 birim üzerinden veriyor (JPY: "20.74670000" = 100 yen).
   *    Burada FX_UNITS'e bölünüyor. Ham metni dışarı verseydik her çağıran
   *    bölmeyi kendi hatırlamak zorunda kalırdı — biri unutur.
   */
  rate: Price;
};

/** "02-01-2020" -> "2020-01-02" */
function evdsDayToIso(raw: string): string | null {
  const parts = raw.split('-');
  if (parts.length !== 3) return null;

  const [day, month, year] = parts;
  if (!day || !month || !year) return null;

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Bir para biriminin günlük kur geçmişini çeker.
 *
 * ⚠️ NEDEN YIL YIL: EVDS 1000 gözlem sınırı uyguluyor ve sınır BİTİŞ
 * tarihinden GERİYE işliyor. Günlük seride 2017-2026 arası ~3.300 gözlem —
 * tek istekte sorsaydık sessizce yalnızca son 1000 günü alırdık ve
 * eksikliği fark etmezdik.
 *
 * Yıl başına ~365 gözlem, sınırın çok altında.
 *
 * Dönen listede hafta sonu ve tatiller YOKTUR (o günlerde kur yayımlanmıyor).
 * Boşlukları çağıran taraf forward-fill ile dolduruyor.
 */
export async function fetchFxHistory(
  currencyCode: string,
  startYear: number,
  endYear: number,
  apiKey?: string,
): Promise<EvdsRateItem[]> {
  const unit = FX_UNITS[currencyCode];
  if (unit === undefined) {
    throw new Error(
      `Desteklenmeyen para birimi: ${currencyCode} (tcmb.ts FX_UNITS'e ekle)`,
    );
  }

  const divisor = BigInt(unit);
  const results: EvdsRateItem[] = [];

  for (let year = startYear; year <= endYear; year++) {
    const items = await fetchEvdsItems(
      seriesCodeFor(currencyCode),
      `01-01-${year}`,
      `31-12-${year}`,
      apiKey,
    );

    for (const item of items) {
      const date = evdsDayToIso(item.date);
      if (date === null) continue;

      // Metin -> bigint -> birime böl. Hiçbir adımda `number` yok.
      // divRound şart: bigint bölmesi kırpar (bkz. money.ts).
      const quoted = toPrice(String(item.value));
      results.push({ date, rate: divRound(quoted, divisor) as Price });
    }
  }

  // Tarihe göre sırala — forward-fill sıralı veri gerektiriyor.
  results.sort((a, b) => a.date.localeCompare(b.date));

  return results;
}

/** `fetchFxHistory("USD", ...)` için kısayol. */
export async function fetchUsdTryHistory(
  startYear: number,
  endYear: number,
  apiKey?: string,
): Promise<EvdsRateItem[]> {
  return fetchFxHistory('USD', startYear, endYear, apiKey);
}
