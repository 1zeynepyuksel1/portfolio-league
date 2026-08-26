import { parseScaled, PRICE_SCALE } from "../lib/money.js";
import type { Price } from "../lib/money.js";
import { MarketDataError } from "./provider.js";
import type { Candle, MarketDataProvider, PricePoint } from "./provider.js";

/**
 * yahoo.ts — ABD hisse senedi fiyat kaynağı.
 *
 * NEDEN YAHOO (26 Ağustos 2026'da gerçek isteklerle ölçüldü):
 *
 *   30/30 sembol         -> HTTP 200
 *   her sembol           -> 2017-01-03'ten bugüne 2.425 günlük mum
 *   tek istek gecikmesi  -> 0,16-0,33 sn (5 örnek)
 *   geri doldurma        -> 2.425 mum TEK istekte (265 KB)
 *   anahtar              -> gerekmiyor
 *
 * Elenen alternatif: **Stooq**. Anahtarsız CSV veriyordu ama artık
 * JavaScript proof-of-work doğrulaması koymuş — sunucudan çekilemiyor.
 *
 * ⚠️ RESMİ API DEĞİL. Anahtar yok demek sözleşme de yok demek: Yahoo
 * yarın kapatabilir, biçim değiştirebilir, hız sınırı koyabilir. Kabul
 * edilme sebebi ücretsiz ve tarihsel derinliği tam olması. Bozulursa
 * belirti nettir: cron log'unda `MarketDataError`, ekranda fiyat eskir —
 * sessizce yanlış veri gelmez.
 *
 * ⚠️ GERİ DOLDURMADA SAYFALAMA YOK — Binance'ten farkı bu. Binance tek
 * yanıtta en fazla 1000 mum verdiği için orada döngü var. Yahoo 2.425
 * mumun hepsini tek yanıtta verdi, döngü gereksiz karmaşıklık olurdu.
 */

// ---------------------------------------------------------------------------
// SEMBOL TABLOSU
// ---------------------------------------------------------------------------

/**
 * Desteklenen ABD hisseleri — 30 sembol.
 *
 * ⚠️ NEDEN KURAL DEĞİL, ELLE TABLO. Binance'teki `PAIRS` ile aynı gerekçe:
 * "kullanıcının yazdığı her sembolü Yahoo'ya sor" deseydik, geçersiz bir
 * sembol her turda 404 üretirdi ve desteklediğimiz varlıkların AÇIK bir
 * listesi hiç olmazdı. Tablo aynı zamanda `seed.ts` ile tek doğruluk
 * kaynağını paylaşıyor.
 *
 * Sembol adı Yahoo'da ne ise burada da o — çevrim tablosu YOK. Bir katman
 * daha eklemek, bozulduğunda iki yerde aramak demek olurdu.
 *
 * Otuzunun da 2017 öncesine gittiği tek tek doğrulandı. Yenisi eklenirse
 * o kontrol tekrarlanmalı: geç halka arz olmuş bir şirket (COIN 2021,
 * RIVN 2021) listede yer alabilir ama grafiği kısa olur. Kod bunu zaten
 * `firstAvailable` ile ekrana taşıyor, ayrıca bir şey yapmak gerekmiyor.
 */
export const STOCKS: Record<string, string> = {
  AAPL: "Apple",
  MSFT: "Microsoft",
  NVDA: "Nvidia",
  GOOGL: "Alphabet",
  AMZN: "Amazon",
  META: "Meta",
  TSLA: "Tesla",
  NFLX: "Netflix",
  AMD: "AMD",
  INTC: "Intel",
  JPM: "JPMorgan Chase",
  V: "Visa",
  MA: "Mastercard",
  BAC: "Bank of America",
  WMT: "Walmart",
  KO: "Coca-Cola",
  PEP: "PepsiCo",
  MCD: "McDonald's",
  NKE: "Nike",
  DIS: "Disney",
  BA: "Boeing",
  CAT: "Caterpillar",
  XOM: "Exxon Mobil",
  CVX: "Chevron",
  PFE: "Pfizer",
  JNJ: "Johnson & Johnson",
  UNH: "UnitedHealth",
  ORCL: "Oracle",
  CSCO: "Cisco",
  ADBE: "Adobe",
};

export function stockSupported(symbol: string): boolean {
  return symbol in STOCKS;
}

// ---------------------------------------------------------------------------
// İSTEK
// ---------------------------------------------------------------------------

const BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

/**
 * ⚠️ USER-AGENT ZORUNLU — VE BU SESSİZ BİR TUZAK.
 *
 * Ölçüldü, aynı URL, tek fark başlık:
 *
 *   User-Agent yok        -> HTTP 429 (Too Many Requests)
 *   User-Agent "Mozilla"  -> HTTP 200
 *
 * Node'un yerleşik `fetch`'i varsayılan olarak `node` gönderiyor. Başlığı
 * koymasaydık İLK istek bile 429 alırdı — ve 429 "çok fazla istek attın"
 * dediği için hata mesajı bizi tamamen yanlış yöne, hız sınırı aramaya
 * gönderirdi. Oysa sorun hızda değil, kimlikte.
 */
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
};

/**
 * Yahoo yanıtının kullandığımız kısmı.
 *
 * Tam yanıt çok daha geniş (52 haftalık zirve, temettü, hacim...).
 * Sadece okuduğumuz alanları tiplemek bilinçli: kaynak yeni alan
 * eklediğinde tip bozulmasın, kaldırdığında derleyici bize söylesin.
 */
type YahooChart = {
  chart: {
    result:
      | Array<{
          meta: {
            currency?: string;
            regularMarketPrice?: number;
            regularMarketTime?: number;
          };
          timestamp?: number[];
          indicators: {
            quote?: Array<{ close?: (number | null)[] }>;
          };
        }>
      | null;
    error: { code?: string; description?: string } | null;
  };
};

/**
 * `Candle` -> Yahoo `interval` eşlemesi.
 *
 * ⚠️ YAHOO'NUN GERİYE BAKMA SINIRLARI ARALIĞA GÖRE DEĞİŞİYOR: `5m` için
 * ~60 gün, `1h` için ~730 gün, `1d` için sınırsız. Geri doldurma yalnızca
 * `1d` kullanıyor — hisse için dakikalık geçmişi zaten kaynaktan değil,
 * seans sırasında çalışan cron'dan biriktiriyoruz.
 */
const INTERVALS: Record<Candle, string> = {
  "5m": "5m",
  "1h": "1h",
  "1d": "1d",
};

async function request(url: string, symbol: string): Promise<YahooChart> {
  let response: Response;

  try {
    response = await fetch(url, { headers: HEADERS });
  } catch (error) {
    throw new MarketDataError(
      `Yahoo'ya ulaşılamadı: ${error instanceof Error ? error.message : error}`,
      "yahoo",
      symbol,
    );
  }

  if (!response.ok) {
    // 404 = sembol yok ya da borsadan çıkarılmış. Yahoo bunu gövdede de
    // açıkça yazıyor ("No data found, symbol may be delisted").
    throw new MarketDataError(
      `Yahoo ${response.status} döndü`,
      "yahoo",
      symbol,
    );
  }

  const body = (await response.json()) as YahooChart;

  if (body.chart?.error != null) {
    throw new MarketDataError(
      `Yahoo hatası: ${body.chart.error.description ?? body.chart.error.code}`,
      "yahoo",
      symbol,
    );
  }

  const result = body.chart?.result?.[0];

  if (result === undefined) {
    throw new MarketDataError("Yahoo boş sonuç döndü", "yahoo", symbol);
  }

  return body;
}

// ---------------------------------------------------------------------------
// ADAPTÖR
// ---------------------------------------------------------------------------

export class YahooAdapter implements MarketDataProvider {
  /**
   * Güncel fiyat.
   *
   * ⚠️ `meta.regularMarketPrice` OKUNUYOR, mum dizisinin son elemanı DEĞİL.
   * Seans sırasında mum dizisinin son elemanı O GÜNÜN HENÜZ KAPANMAMIŞ
   * mumu; `regularMarketPrice` ise son işlem fiyatı. İkincisi daha taze
   * ve yanıtın en küçük parçası (1,6 KB).
   *
   * Piyasa kapalıyken bu alan son kapanışı veriyor — doğru davranış.
   * Ama cron zaten kapalıyken hisse çekmiyor (`price-cron.ts`), çünkü
   * aynı kapanış fiyatını dakikada bir tekrar yazmak sadece yer kaplardı.
   */
  async getLatest(symbol: string): Promise<PricePoint> {
    if (!stockSupported(symbol)) {
      throw new MarketDataError(
        `Yahoo tablosunda olmayan sembol: ${symbol}`,
        "yahoo",
        symbol,
      );
    }

    const body = await request(
      `${BASE_URL}/${symbol}?range=1d&interval=1d`,
      symbol,
    );

    const meta = body.chart.result![0]!.meta;
    const value = meta.regularMarketPrice;

    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      throw new MarketDataError("Güncel fiyat okunamadı", "yahoo", symbol);
    }

    /**
     * ⚠️ PARA BİRİMİ KONTROLÜ — sessiz felaketin önlenmesi.
     *
     * Boru hattı bu fiyatı USD kabul edip TCMB kuruyla TL'ye çeviriyor.
     * Yahoo aynı uçtan başka borsaların hissesini de veriyor ve onlar
     * GBP, EUR ya da JPY dönüyor. Yanlış para birimi gelseydi sayı yine
     * makul görünür, sadece ~40 kat yanlış olurdu — ve hiçbir yerde
     * hata çıkmazdı.
     */
    if (meta.currency !== undefined && meta.currency !== "USD") {
      throw new MarketDataError(
        `${symbol} USD değil ${meta.currency} fiyatlanıyor`,
        "yahoo",
        symbol,
      );
    }

    const stamp = (meta.regularMarketTime ?? Math.floor(Date.now() / 1000)) * 1000;

    return {
      date: new Date(stamp).toISOString().slice(0, 10),
      openTime: stamp,
      price: toPrice(value, symbol),
    };
  }

  /**
   * Tarihsel günlük seri.
   *
   * ⚠️ `range=max` KULLANILMIYOR — VE SEBEBİ ÖLÇÜLDÜ.
   *
   * `range=max&interval=1d` istediğimde Yahoo 1984'ten 2026'ya SADECE 168
   * mum döndürdü; yani seriyi sessizce seyreltmiş. `period1`/`period2` ile
   * aynı aralığı istediğimde 2.425 günlük mum geldi.
   *
   * Tuzağın tehlikesi: `range=max` HATA VERMİYOR. Kod çalışır, grafik
   * çizilir, sadece geçmiş 14 kat seyrek olur ve "2020'de alsaydın"
   * hesabı yanlış güne denk gelir.
   */
  async getHistory(
    symbol: string,
    from: string,
    to: string,
    candle: Candle = "1d",
  ): Promise<PricePoint[]> {
    if (!stockSupported(symbol)) {
      throw new MarketDataError(
        `Yahoo tablosunda olmayan sembol: ${symbol}`,
        "yahoo",
        symbol,
      );
    }

    const period1 = Math.floor(Date.parse(`${from}T00:00:00Z`) / 1000);
    // Bitiş günü DAHİL olsun diye gün sonuna kadar.
    const period2 = Math.floor(Date.parse(`${to}T23:59:59Z`) / 1000);

    if (Number.isNaN(period1) || Number.isNaN(period2)) {
      throw new MarketDataError(
        `Geçersiz tarih aralığı: ${from} - ${to}`,
        "yahoo",
        symbol,
      );
    }

    const body = await request(
      `${BASE_URL}/${symbol}?period1=${period1}&period2=${period2}&interval=${INTERVALS[candle]}`,
      symbol,
    );

    const result = body.chart.result![0]!;
    const stamps = result.timestamp ?? [];
    const closes = result.indicators.quote?.[0]?.close ?? [];

    const out: PricePoint[] = [];

    for (let i = 0; i < stamps.length; i++) {
      const value = closes[i];
      const stamp = stamps[i];

      /**
       * ⚠️ `null` KAPANIŞ ATLANIYOR, HATA FIRLATILMIYOR.
       *
       * Seride tek tük boş gün oluyor (yarım seans, veri gecikmesi).
       * Hata fırlatsaydık 2.425 mumun tamamı tek bir boş satır yüzünden
       * düşerdi. LBMA adaptöründeki kararın aynısı.
       */
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        continue;
      }

      if (typeof stamp !== "number") continue;

      const openTime = stamp * 1000;

      out.push({
        date: new Date(openTime).toISOString().slice(0, 10),
        openTime,
        price: toPrice(value, symbol),
      });
    }

    if (out.length === 0) {
      throw new MarketDataError(
        `${from} - ${to} aralığında veri yok`,
        "yahoo",
        symbol,
      );
    }

    return out;
  }
}

/**
 * JSON sayısını `Price`'a çevirir.
 *
 * ⚠️ ÖNCE METNE, SONRA BIGINT'E. LBMA adaptöründeki gerekçenin aynısı:
 * JSON'dan `number` geliyor, yani bu noktada zaten float. Metne
 * çevirdikten sonrası tam sayı aritmetiği; kayıp burada bitiyor.
 *
 * ⚠️ `toString()` DEĞİL `toFixed(PRICE_SCALE)` — VE BU BİR HATADAN ÇIKTI.
 *
 * İlk yazımda `toString()` vardı. `getLatest` çalıştı (313.225 geldi),
 * geçmiş serisi ilk denemede patladı:
 *
 *     Fiyat çevrilemedi: 74.70249938964844      <- 14 ondalık basamak
 *
 * Sebebi `parseScaled`'in BİLİNÇLİ davranışı: ölçekten (8 basamak) fazla
 * ondalık gelirse sessizce kırpmıyor, HATA fırlatıyor (`money.ts`).
 * O kural kullanıcının GİRDİĞİ değeri korumak için var — birisi 12
 * basamak yazdıysa onu sessizce yutmak, girdiğinin kaybolması demek.
 *
 * Burada durum farklı ve ayrımı görmek önemli: 74.70249938964844'ün
 * 8. basamaktan sonrası VERİ DEĞİL, float gösterim gürültüsü. Yahoo
 * fiyatı float olarak saklıyor, gerçek değer 74,7025 dolar. Sekizinci
 * basamak zaten mikro-sentin altı.
 *
 * Yani kırpmıyoruz, gürültüyü kesiyoruz. `toFixed` YUVARLIYOR (kırpmıyor),
 * dolayısıyla sistematik bir yön hatası da doğmuyor.
 *
 * LBMA'da bu çıkmadı çünkü onun JSON'u kısa sayılar veriyor (4582.1).
 * Aynı hatayı bir gün orada da görebiliriz — kaynağın biçimi bizim
 * kontrolümüzde değil.
 */
function toPrice(value: number, symbol: string): Price {
  try {
    return parseScaled(value.toFixed(PRICE_SCALE), PRICE_SCALE) as Price;
  } catch {
    throw new MarketDataError(
      `Fiyat çevrilemedi: ${value}`,
      "yahoo",
      symbol,
    );
  }
}

/**
 * ⚠️⚠️ BÖLÜNME (SPLIT) — BU DOSYANIN EN ÖNEMLİ NOTU.
 *
 * Yahoo'nun `close` alanı BÖLÜNMEYE GÖRE DÜZELTİLMİŞ geliyor. Ölçüldü:
 *
 *   AAPL 24 Ağustos 2020 gerçek işlem fiyatı : ~503 USD
 *   Yahoo'nun verdiği close                  :  125,86 USD
 *   AAPL 31 Ağustos 2020'de 4:1 bölündü      :  503 / 4 = 125,75  ✔
 *
 * Düzeltilmemiş veri kullansaydık "2019'da AAPL alsaydın" hesabı TAM
 * DÖRT KAT şişerdi ve hiçbir yerde hata çıkmazdı.
 *
 * ⚠️ AMA DÜZELTME GERİYE DÖNÜK — VE BU KALICI BİR BAKIM BORCU.
 *
 * Yahoo geçmişi BUGÜNKÜ hisse adedine göre düzeltiyor. Bugün geri
 * doldurup 2020 için 125,86 yazarsak ve AAPL gelecek yıl tekrar bölünürse,
 * kayıtlı geçmişimizin TAMAMI o varlık için yanlış olur — yeni gelen
 * fiyatlarla eski kayıtlar farklı ölçekte olur, grafikte bölünme gününde
 * yapay bir uçurum belirir.
 *
 * Çözümü tek: bölünme olan varlığın geçmişini SİLİP baştan doldurmak.
 * Kripto ve dövizde böyle bir şey yok, bu tamamen hisseye özgü.
 *
 * ⚠️ `adjclose` KULLANILMIYOR — bilinçli. O alan temettüyü de düzeltiyor
 * (aynı gün için 121,97 diyor). Temettü düzeltmesi "toplam getiri"
 * modeli demek: hisseyi alıp temettüleri de yeniden yatırdığını varsayar.
 * Bu uygulama temettüyü nakit olarak modellemiyor, dolayısıyla `adjclose`
 * kullanmak ekranda gösterilen fiyatla portföy hesabını birbirinden
 * ayırırdı. `close` daha dürüst: kullanıcı hissenin fiyatını görüyor.
 * Bedeli, alıp tutma getirisinin temettü kadar (AAPL'de ~%3 / 5 yıl)
 * eksik görünmesi. Kabul edildi ve burada yazılı.
 */
