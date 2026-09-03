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
  type PositionValue,
  type ProfitSummary,
  calculatePortfolio,
  calculateProfit,
} from './calculate.js';
import {
  getCashCents,
  getDepositedCents,
  getHoldings,
  getOrderLedger,
} from './repository.js';
import {
  calculateCostBasis,
  calculatePositionProfit,
  type LedgerOrder,
  type PositionProfit,
} from './cost-basis.js';

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

/**
 * Kâr/zarar bilgisi eklenmiş pozisyon.
 *
 * `PositionValue` (calculate.ts) yalnızca DEĞER biliyor: miktar × fiyat.
 * Maliyet emir defterinden geldiği için ayrı bir katmanda ekleniyor;
 * calculate.ts veritabanını tanımıyor ve tanımamalı.
 */
export interface PositionWithProfit extends PositionValue, PositionProfit {}

/**
 * ⚠️ `positions` ALANI BİLEREK DARALTILIYOR.
 *
 * `PortfolioSummary`'den geliyor ve tipi `PositionValue[]`. Omit ile
 * çıkarıp yeniden tanımlamasaydık router `costCents`'i göremezdi —
 * çalışma anında alan orada olurdu ama TypeScript yokmuş gibi davranırdı.
 */
export interface PortfolioResult
  extends Omit<PortfolioSummary, 'positions'>,
    ProfitSummary {
  positions: PositionWithProfit[];
}

export async function getPortfolio(userId: string): Promise<PortfolioResult> {
  // Üç sorgu birbirine bağlı değil -> paralel çalışsınlar.
  // Sırayla `await` etseydik üç gidiş-dönüş süresi toplanırdı.
  const [cashCents, holdingRows, depositedCents, assetPrices, ledger] =
    await Promise.all([
      getCashCents(userId),
      getHoldings(userId),
      getDepositedCents(userId),
      listAssetsWithLatestPrice(),
      getOrderLedger(userId),
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

  /**
   * Emir defterini varlığa göre grupla.
   *
   * ⚠️ SIRA KORUNUYOR. Sorgu zaten `executed_at, id` ile sıralı geliyor
   * ve gruplama o sırayı bozmuyor — `calculateCostBasis` defteri baştan
   * sona yürüdüğü için sıra bozulursa maliyet sessizce yanlış çıkar.
   */
  const ledgerBySymbol = new Map<string, LedgerOrder[]>();

  for (const row of ledger) {
    const list = ledgerBySymbol.get(row.symbol) ?? [];

    list.push({
      side: row.side,
      quantity: toAmount(row.quantity),
      netCents: row.netCents as Penny,
    });

    ledgerBySymbol.set(row.symbol, list);
  }

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
      kind: row.kind,
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

  /**
   * Pozisyon başına kâr/zarar.
   *
   * ⚠️ BU, PORTFÖY TOPLAMINDAKİ KÂR/ZARARDAN FARKLI BİR ŞEY.
   *
   *   toplam kâr    = bütün servet − dışarıdan yatırılan para
   *   pozisyon kârı = o varlığın değeri − o varlığa ödenen para
   *
   * İkisi birbirini tutmak zorunda değil: nakitte bekleyen para toplamı
   * etkiler ama hiçbir pozisyonun kârı değildir. Aynı sayıymış gibi
   * göstermek kullanıcıyı yanıltır.
   */
  const positionsWithProfit = summary.positions.map((position) => {
    const orders = ledgerBySymbol.get(position.symbol) ?? [];
    const basis = calculateCostBasis(orders);

    return {
      ...position,
      ...calculatePositionProfit(basis.costCents, position.valueCents),
    };
  });

  return { ...summary, positions: positionsWithProfit, ...profit };
}
