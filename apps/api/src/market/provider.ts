
import type { Price } from "../lib/money.js";

export interface PricePoint {
  date: string;
  price: Price;
}

export interface MarketDataProvider {
  getLatest(symbol: string): Promise<PricePoint>;
  getHistory(symbol: string, from: string, to: string): Promise<PricePoint[]>;
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
