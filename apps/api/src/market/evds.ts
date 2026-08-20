/**
 * evds.ts — TCMB Elektronik Veri Dağıtım Sistemi (EVDS) Entegrasyonu
 * 
 * Bu dosya:
 * 1. Türkiye Cumhuriyet Merkez Bankası EVDS portalına bağlanır.
 * 2. Resmi TÜFE (Tüketici Fiyat Endeksi 2003=100) serisini (TP.FG.J0) çeker.
 * 3. Tarihsel ve güncel aylık enflasyon verilerini JSON formatında ayrıştırır.
 */

export type EvdsTufeItem = {
  month: string; // Format: "YYYY-MM" (Örn: "2020-03")
  tufeIndex: number; // Örn: 450.58
};

type EvdsApiResponse = {
  totalCount: number;
  items?: Array<{
    Tarih?: string; // Format: "2020-3" veya "2020-03"
    TP_FG_J0?: string | number | null;
  }>;
};

export const EVDS_SERIES_CODE = 'TP.FG.J0'; // Resmi TÜFE Genel Endeks Kodu
export const EVDS_BASE_URL = 'https://evds2.tcmb.gov.tr/service/evds';

/**
 * Belirtilen tarih aralığındaki TÜFE serisini EVDS API'sinden çeker
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
      key: key,
    },
  });

  if (!response.ok) {
    throw new Error(`EVDS API isteği başarısız oldu: HTTP ${response.status}`);
  }

  const data = (await response.json()) as EvdsApiResponse;

  if (!data.items || !Array.isArray(data.items)) {
    return [];
  }

  const results: EvdsTufeItem[] = [];

  for (const item of data.items) {
    if (!item.Tarih || item.TP_FG_J0 === null || item.TP_FG_J0 === undefined) {
      continue;
    }

    // Tarih formatını "YYYY-MM" standardına getir (Örn: "2020-3" -> "2020-03")
    const parts = item.Tarih.split('-');
    if (parts.length < 2 || !parts[0] || !parts[1]) continue;

    const year = parts[0];
    const month = parts[1].padStart(2, '0');
    const standardMonth = `${year}-${month}`;

    const parsedIndex = typeof item.TP_FG_J0 === 'number'
      ? item.TP_FG_J0
      : parseFloat(String(item.TP_FG_J0).replace(',', '.'));

    if (!isNaN(parsedIndex) && parsedIndex > 0) {
      results.push({
        month: standardMonth,
        tufeIndex: parsedIndex,
      });
    }
  }

  return results;
}
