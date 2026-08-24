
import type { Price } from "../lib/money.js";

export interface PricePoint {
  /**
   * "YYYY-MM-DD" — mumun açıldığı gün.
   *
   * Günlük mumlarda bu tek başına yeterli. Saatlik mumlarda aynı güne
   * 24 mum düşer, yani gün bilgisi ayırt edici değildir — o yüzden
   * `openTime` de taşınıyor.
   */
  date: string;

  /**
   * Mumun açılış anı, epoch milisaniye.
   *
   * ⚠️ SAATLİK VERİ İÇİN ŞART. `date` alanı saati kırpıyor; saatlik
   * doldurmada 24 mumun hepsi aynı "2026-08-22" değerine düşer ve
   * veritabanındaki (asset_id, ts) birincil anahtarı yüzünden 23'ü
   * SESSİZCE atılır (onConflictDoNothing). Tam damgayı taşımak şart.
   */
  openTime: number;

  price: Price;
}

/**
 * Desteklenen mum aralıkları.
 *
 * Binance'in kabul ettiği değerlerle birebir aynı olmalı — bu metin
 * doğrudan URL'e giriyor.
 */
export type Candle = '5m' | '1h' | '1d';

/**
 * ⚠️ İSİM ÇAKIŞMASI UYARISI.
 *
 * Binance'in `1m` mumu BİR DAKİKA demek. Bizim `ranges.ts`'teki `1m`
 * aralığı ise BİR AY. İkisi aynı metin, farklı anlam.
 *
 * Bu yüzden dakikalık veri için `5m` seçildi: hem karışma riski yok,
 * hem de `1d` aralığının kova boyutu (5 dakika) ile birebir örtüşüyor.
 * Daha ince mum çekmek boşuna veri olurdu — kova zaten seyreltirdi.
 */

export interface MarketDataProvider {
  getLatest(symbol: string): Promise<PricePoint>;
  getHistory(
    symbol: string,
    from: string,
    to: string,
    /** Varsayılan '1d' — mevcut çağıranlar değişmeden çalışsın. */
    candle?: Candle,
  ): Promise<PricePoint[]>;
}


export class MarketDataError extends Error {
  constructor(
    message: string,
    readonly source: string,
    readonly symbol?: string,
  ) {
    super(message);
    this.name = "MarketDataError";
  }
}
