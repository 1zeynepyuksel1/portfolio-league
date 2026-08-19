import { listAssetsWithLatestPrice } from '../market/repository.js';
import {
  type Amount,
  type Penny,
  type Price,
  toAmount,
  toPrice,
} from '../lib/money.js';
import {
  type PortfolioSummary,
  type PositionInput,
  type ProfitSummary,
  calculatePortfolio,
  calculateProfit,
} from './calculate.js';
import {
  getCashCents,
  getDepositedCents,
  getHoldings,
} from './repository.js';

/**
 * Portföy servisi — sorguları hesapla birleştiren katman.
 *
 * Router HTTP'yi bilir, repository SQL'i bilir, calculate matematiği bilir.
 * Bu dosya üçünü tanıştırıyor ve hiçbirinin işini yapmıyor.
 */

export class PortfolioNotFoundError extends Error {
  constructor() {
    super('Hesap bulunamadı');
    this.name = 'PortfolioNotFoundError';
  }
}

export interface PortfolioResult extends PortfolioSummary, ProfitSummary {}

export async function getPortfolio(userId: string): Promise<PortfolioResult> {
  // Üç sorgu birbirine bağlı değil -> paralel çalışsınlar.
  // Sırayla `await` etseydik üç gidiş-dönüş süresi toplanırdı.
  const [cashCents, holdingRows, depositedCents, assetPrices] =
    await Promise.all([
      getCashCents(userId),
      getHoldings(userId),
      getDepositedCents(userId),
      listAssetsWithLatestPrice(),
    ]);

  if (cashCents === null) {
    throw new PortfolioNotFoundError();
  }

  // Fiyatları sembole göre indeksle — aşağıdaki döngü her pozisyon için
  // diziyi baştan taramasın. 25 varlıkta fark etmez ama desen doğru olsun:
  // döngü içinde arama, N+1'in bellek versiyonudur.
  const priceBySymbol = new Map(
    assetPrices.map((asset) => [asset.symbol, asset]),
  );

  const positions: PositionInput[] = holdingRows.map((row) => {
    const priceRow = priceBySymbol.get(row.symbol);

    // Fiyatı hiç çekilmemiş ya da varlık pasife alınmış olabilir.
    // `null` geçiyoruz; calculate.ts bunu toplama katmayıp bayrak kaldırıyor.
    const price: Price | null =
      priceRow?.priceTry != null ? toPrice(priceRow.priceTry) : null;

    const quantity: Amount = toAmount(row.quantity);

    return {
      symbol: row.symbol,
      name: row.name,
      quantity,
      price,
      asOf: priceRow?.asOf ?? null,
    };
  });

  const summary = calculatePortfolio(cashCents as Penny, positions);
  const profit = calculateProfit(
    summary.totalValueCents,
    depositedCents as Penny,
  );

  return { ...summary, ...profit };
}
