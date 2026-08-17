import { toPrice } from "../lib/money.js";
import {
  MarketDataError,
  type MarketDataProvider,
  type PricePoint,
} from "./provider.js";

const BASE_URL = "https://api.binance.com/api/v3/klines";

/** Binance istek başına en fazla bu kadar mum döndürür. */
const MAX_KLINES = 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Bizim varlık kodumuz -> Binance işlem çifti.
 *
 * Kural yerine tablo kullanıldı (symbol + "USDT" gibi). Sebep: tablo aynı
 * zamanda desteklenen varlıkların açık listesidir. Bilinmeyen bir sembol
 * geldiğinde Binance'ten sessizce 400 almak yerine anlamlı hata fırlatırız.
 *
 * USDT çifti seçildi çünkü TRY çifti yalnızca 20 Aralık 2019'a kadar gidiyor,
 * USDT ise 17 Ağustos 2017'ye. TL çevrimi ayrı katmanda TCMB kuruyla yapılır.
 */
const PAIRS: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
};

/**
 * Binance kline yanıtı nesne değil DİZİ döndürür, alan adı yoktur:
 *   [açılışZamanı, açılış, enYüksek, enDüşük, kapanış, hacim, ...]
 * Fiyatlar string olarak gelir ("4285.08000000") — bu iyi, float'a
 * dönüştürülmemiş hâlleriyle doğrudan money.ts'e verilebilirler.
 */
const IDX_OPEN_TIME = 0;
const IDX_CLOSE = 4;

export class BinanceAdapter implements MarketDataProvider {
  async getLatest(symbol: string): Promise<PricePoint> {
    const now = Date.now();
    const points = await this.fetchRange(symbol, now - 3 * DAY_MS, now);

    const last = points.at(-1);
    if (!last) {
      throw new MarketDataError("Güncel fiyat bulunamadı", "binance", symbol);
    }
    return last;
  }

  async getHistory(
    symbol: string,
    from: string,
    to: string,
  ): Promise<PricePoint[]> {
    return this.fetchRange(symbol, toMillis(from), toMillis(to));
  }

  /**
   * Sayfalama burada yapılır — çağıran 1000 mum sınırını bilmez.
   *
   * Her turda son mumun zamanından bir gün ilerleyerek devam ederiz. Dönen
   * kayıt sayısı sınırdan azsa veri bitmiş demektir, döngü kapanır.
   */
  private async fetchRange(
    symbol: string,
    fromMs: number,
    toMs: number,
  ): Promise<PricePoint[]> {
    const pair = PAIRS[symbol];
    if (!pair) {
      throw new MarketDataError(
        `Binance'te desteklenmeyen varlık: ${symbol}`,
        "binance",
        symbol,
      );
    }

    const out: PricePoint[] = [];
    let cursor = fromMs;

    while (cursor <= toMs) {
      const rows = await this.fetchPage(pair, cursor, symbol);
      if (rows.length === 0) break;

      let lastOpenTime = cursor;
      for (const row of rows) {
        const point = toPricePoint(row, symbol);
        lastOpenTime = openTimeOf(row, symbol);
        if (lastOpenTime > toMs) break;
        out.push(point);
      }

      // Sınırdan az kayıt geldiyse kaynakta daha fazla veri yok.
      if (rows.length < MAX_KLINES) break;
      cursor = lastOpenTime + DAY_MS;
    }

    return out;
  }

  private async fetchPage(
    pair: string,
    startTime: number,
    symbol: string,
  ): Promise<unknown[][]> {
    const url =
      `${BASE_URL}?symbol=${pair}&interval=1d` +
      `&startTime=${startTime}&limit=${MAX_KLINES}`;

    let response: Response;
    try {
      response = await fetch(url);
    } catch (cause) {
      throw new MarketDataError(
        `Binance'e ulaşılamadı: ${String(cause)}`,
        "binance",
        symbol,
      );
    }

    if (!response.ok) {
      throw new MarketDataError(
        `Binance ${response.status} döndürdü`,
        "binance",
        symbol,
      );
    }

    const body: unknown = await response.json();
    if (!Array.isArray(body)) {
      throw new MarketDataError(
        "Binance yanıtı dizi değil",
        "binance",
        symbol,
      );
    }
    return body as unknown[][];
  }
}

/** Epoch milisaniyeyi "YYYY-MM-DD" biçimine çevirir. Her zaman UTC. */
function toDateString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * "YYYY-MM-DD" biçimini epoch milisaniyeye çevirir.
 * Sonuna "T00:00:00Z" eklenir — aksi hâlde yerel saat dilimi devreye girer
 * ve tarih bir gün kayabilir.
 */
function toMillis(date: string): number {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms)) {
    throw new MarketDataError(`Geçersiz tarih: ${date}`, "binance");
  }
  return ms;
}

function openTimeOf(row: unknown[], symbol: string): number {
  const value = row[IDX_OPEN_TIME];
  if (typeof value !== "number") {
    throw new MarketDataError(
      "Binance mumunda açılış zamanı okunamadı",
      "binance",
      symbol,
    );
  }
  return value;
}

function toPricePoint(row: unknown[], symbol: string): PricePoint {
  const close = row[IDX_CLOSE];
  if (typeof close !== "string") {
    throw new MarketDataError(
      "Binance mumunda kapanış fiyatı okunamadı",
      "binance",
      symbol,
    );
  }

  return {
    date: toDateString(openTimeOf(row, symbol)),
    price: toPrice(close),
  };
}
