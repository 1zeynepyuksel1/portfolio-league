import { divRound, parseScaled, PRICE_SCALE } from "../lib/money.js";
import type { Price } from "../lib/money.js";
import { MarketDataError } from "./provider.js";
import type { MarketDataProvider, PricePoint } from "./provider.js";

/**
 * lbma.ts — altın ve gümüş fiyat kaynağı.
 *
 * NEDEN LBMA (docs/00-veri-saglayici-dogrulama.md §3):
 * EVDS'de günlük altın fiyatı YOK — hepsi aylık, tek işgünü serisi 2018'de
 * arşivlenmiş. LBMA "London fixing" altının dünya referans fiyatı; GoldAPI
 * gibi aracıların sattığı veri de buradan geliyor. Anahtarsız, kotasız,
 * 1968'e kadar gidiyor.
 *
 * ÖLÇÜLDÜ (24 Ağustos 2026):
 *   gold_pm.json  -> 200, 913 KB, 14.667 kayıt, 1 Nisan 1968'den
 *   silver.json   -> 200, 897 KB, 14.830 kayıt, 2 Ocak 1968'den
 *
 * KARAR: AM değil **PM** fixing. LBMA günde iki fixing yayımlıyor ve ikisi
 * farklı fiyat. PM daha çok referans alınır; ikisi arasında gidip gelmek
 * seride yapay dalgalanma üretirdi.
 */

const ENDPOINTS: Record<string, string> = {
  GRAM_ALTIN: "https://prices.lbma.org.uk/json/gold_pm.json",
  GRAM_GUMUS: "https://prices.lbma.org.uk/json/silver.json",
};

/**
 * LBMA yanıtının biçimi:
 *
 *   {"is_cms_locked":0, "d":"2026-08-21", "v":[4582.1, 3359.14, 3923.19]}
 *
 * `v` üç para birimi taşıyor: [USD, GBP, EUR]. Biz USD alıyoruz — hem
 * Binance ile aynı taban, hem de pipeline zaten USD→TL çeviriyor.
 *
 * ⚠️ ESKİ KAYITLARDA `v[2]` NULL. 1968'de euro yoktu. USD hep dolu ama
 * yine de kontrol ediliyor: kaynağın gelecekte ne yapacağını bilmiyoruz.
 */
type LbmaRow = {
  d: string;
  v: (number | null)[];
};

/**
 * ⚠️ EN ÖNEMLİ ÇEVRİM — LBMA **TROY ONS** FİYATLIYOR, BİZ **GRAM** SATIYORUZ.
 *
 * 1 troy ons = 31,1034768 gram. Çevirmezsen altın 31 kat pahalı görünür.
 *
 * Tehlikesi şu: 4.582 dolarlık bir "gram altın" saçma durur ve fark
 * edilir. Ama ters yönde bir hata (mesela 31,1 yerine 28,35 — o normal
 * ons, mücevherde kullanılan) sadece %10 saparddı ve ASLA fark edilmezdi.
 * Bu yüzden sabit burada, tek yerde, testiyle birlikte duruyor.
 *
 * Sayı PRICE_SCALE (1e8) ile ölçeklenmiş bigint olarak tutuluyor ki
 * bölme float'a hiç uğramasın.
 */
export const TROY_OUNCE_GRAMS = "31.1034768";

const TROY_OUNCE_GRAMS_SCALED = parseScaled(TROY_OUNCE_GRAMS, PRICE_SCALE);

/** Ölçek düzeltmesi için 1e8. */
const PRICE_ONE = 10n ** BigInt(PRICE_SCALE);

/**
 * Ons fiyatını gram fiyatına çevirir.
 *
 * ÖLÇEK MATEMATİĞİ:
 *   ons (1e8) × 1e8  =  ara (1e16)
 *   ara (1e16) ÷ gramSayısı (1e8)  =  sonuç (1e8)   ← ölçek korundu
 *
 * `divRound` ZORUNLU: düz bigint bölmesi kırpar ve her kırpma kullanıcı
 * aleyhine kuruş eritir (CLAUDE.md, bilinen tuzak #2).
 */
export function ouncePriceToGram(ouncePrice: Price): Price {
  return divRound(ouncePrice * PRICE_ONE, TROY_OUNCE_GRAMS_SCALED) as Price;
}

/**
 * ⚠️ ÖNBELLEK ZORUNLU, İYİLEŞTİRME DEĞİL.
 *
 * Cron 15 saniyede bir çalışıyor. Önbelleksiz her turda 900 KB × 2 maden
 * indirilirdi: günde ~10 GB ve LBMA bizi haklı olarak engellerdi.
 *
 * TTL 1 saat: LBMA günde BİR kez yayımlıyor, saatlik tazeleme fazlasıyla
 * yeterli. Süreç ömrü boyunca sonsuza kadar tutmuyoruz — o zaman gün
 * dönümünde yeni fixing hiç görünmezdi.
 */
const CACHE_TTL_MS = 60 * 60 * 1000;

type CacheEntry = { fetchedAt: number; rows: LbmaRow[] };

const cache = new Map<string, CacheEntry>();

/** Test için: önbelleği boşaltır. */
export function clearLbmaCache(): void {
  cache.clear();
}

export class LbmaAdapter implements MarketDataProvider {
  async getLatest(symbol: string): Promise<PricePoint> {
    const rows = await this.load(symbol);

    // ⚠️ SONDAN GERİYE ARIYORUZ, sadece son kaydı almıyoruz.
    // Serinin son satırında fiyat null olabilir (yayımlanmamış fixing).
    // Körü körüne `at(-1)` alsaydık o gün fiyat hiç yazılmazdı.
    for (let i = rows.length - 1; i >= 0; i--) {
      const point = toPricePoint(rows[i]);
      if (point !== null) return point;
    }

    throw new MarketDataError("Güncel fiyat bulunamadı", "lbma", symbol);
  }

  async getHistory(
    symbol: string,
    from: string,
    to: string,
  ): Promise<PricePoint[]> {
    const rows = await this.load(symbol);
    const out: PricePoint[] = [];

    for (const row of rows) {
      // Metin karşılaştırması yeterli: "YYYY-MM-DD" biçimi sözlük
      // sırasıyla tarih sırasına birebir uyuyor. Date nesnesi kurmak
      // 14.000 kayıt için boşuna iş ve saat dilimi riski olurdu.
      if (row.d < from || row.d > to) continue;

      const point = toPricePoint(row);
      if (point !== null) out.push(point);
    }

    return out;
  }

  /**
   * Seriyi indirir — ya da önbellekten verir.
   *
   * ⚠️ SAYFALAMA YOK ve bu Binance'ten temel farkı: LBMA tüm seriyi tek
   * yanıtta veriyor. Binance 1000 mumla sınırlı olduğu için orada döngü
   * var; burada olsaydı gereksiz karmaşıklık olurdu.
   */
  private async load(symbol: string): Promise<LbmaRow[]> {
    const url = ENDPOINTS[symbol];

    if (url === undefined) {
      throw new MarketDataError(
        `LBMA'da desteklenmeyen varlık: ${symbol}`,
        "lbma",
        symbol,
      );
    }

    const cached = cache.get(symbol);

    if (cached !== undefined && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.rows;
    }

    let response: Response;

    try {
      response = await fetch(url);
    } catch (error) {
      throw new MarketDataError(
        `LBMA'ya ulaşılamadı: ${error instanceof Error ? error.message : error}`,
        "lbma",
        symbol,
      );
    }

    if (!response.ok) {
      throw new MarketDataError(
        `LBMA ${response.status} döndü`,
        "lbma",
        symbol,
      );
    }

    const body: unknown = await response.json();

    if (!Array.isArray(body)) {
      throw new MarketDataError("LBMA yanıtı dizi değil", "lbma", symbol);
    }

    const rows = body as LbmaRow[];

    cache.set(symbol, { fetchedAt: Date.now(), rows });

    return rows;
  }
}

/**
 * Bir LBMA satırını PricePoint'e çevirir. Fiyat okunamazsa `null`.
 *
 * ⚠️ NEDEN `null`, NEDEN HATA DEĞİL: seride tek tük boş gün var (tatil,
 * yayımlanmamış fixing). Hata fırlatsaydık 14.000 kaydın tamamı tek bir
 * boş satır yüzünden düşerdi. Boş satır atlanır, seri devam eder.
 */
function toPricePoint(row: LbmaRow | undefined): PricePoint | null {
  if (row === undefined) return null;

  const usdPerOunce = row.v?.[0];

  if (typeof usdPerOunce !== "number" || !Number.isFinite(usdPerOunce)) {
    return null;
  }

  if (typeof row.d !== "string" || row.d.length < 10) return null;

  /**
   * ⚠️ SAYIYI ÖNCE METNE ÇEVİRİYORUZ, DOĞRUDAN BIGINT'E DEĞİL.
   *
   * JSON'dan `number` olarak geliyor — bu noktada zaten float. Ama
   * `parseScaled` metin bekliyor ve `toString()` float'ın en yakın ondalık
   * gösterimini veriyor; oradan sonrası bigint. Kayıp burada bitiyor.
   *
   * Kaynak metin verseydi (Binance gibi) bu adım hiç olmazdı. LBMA JSON
   * sayısı yayımlıyor, seçim bizim değil.
   */
  let price: Price;

  try {
    price = parseScaled(usdPerOunce.toString(), PRICE_SCALE) as Price;
  } catch {
    return null;
  }

  const openTime = Date.parse(`${row.d}T00:00:00Z`);

  if (Number.isNaN(openTime)) return null;

  return {
    date: row.d,
    openTime,
    // Depoya GRAM fiyatı yazılıyor — varlığın adı "Gram Altın".
    price: ouncePriceToGram(price),
  };
}

export { symbolSupported };

function symbolSupported(symbol: string): boolean {
  return symbol in ENDPOINTS;
}
