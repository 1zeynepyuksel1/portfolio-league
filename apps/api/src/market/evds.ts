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

export type EvdsTufeItem = {
  month: string; // Format: "YYYY-MM" (Örn: "2020-03")
  tufeIndex: number; // Örn: 450.58
};

export const EVDS_SERIES_CODE = 'TP.GENENDEKS.T1';
export const EVDS_BASE_URL = 'https://evds3.tcmb.gov.tr/igmevdsms-dis';

/**
 * Yanıttaki alan adı seri kodundan türetiliyor: noktalar alt çizgi olur.
 *   TP.GENENDEKS.T1 -> TP_GENENDEKS_T1
 *
 * Elle yazsaydık seri kodu değiştiğinde biri güncellenir diğeri unutulur
 * ve ayrıştırıcı sessizce boş liste döndürürdü — en kötü hata türü.
 */
const EVDS_FIELD = EVDS_SERIES_CODE.replace(/\./g, '_');

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
export async function fetchTufeFromEvds(
  startDate = '01-01-2017',
  endDate = '31-12-2026',
  apiKey?: string,
): Promise<EvdsTufeItem[]> {
  const key = apiKey || process.env.EVDS_API_KEY;

  if (!key) {
    throw new Error('EVDS_API_KEY tanımlı değil.');
  }

  const url = `${EVDS_BASE_URL}/series=${EVDS_SERIES_CODE}&startDate=${startDate}&endDate=${endDate}&type=json`;

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

  const results: EvdsTufeItem[] = [];

  for (const item of data.items) {
    const rawDate = item.Tarih;
    const rawValue = item[EVDS_FIELD];

    if (typeof rawDate !== 'string' || rawValue === null || rawValue === undefined) {
      continue;
    }

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
