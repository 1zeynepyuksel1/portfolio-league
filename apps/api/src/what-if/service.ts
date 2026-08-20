import { formatTwrPercent } from '@portfolio-league/contracts';
import { formatTRY, type Penny } from '../lib/money.js';
import {
  findAssetBySymbol,
  findHistoricalPrice,
  findLatestPrice,
  findTufeIndex,
} from './repository.js';
import type { WhatIfQueryInput, WhatIfResultDto } from './what-if.schema.js';

// Özel Hata Sınıfları
export class AssetNotFoundError extends Error {
  constructor(symbol: string) {
    super(`"${symbol}" sembolüne sahip varlık bulunamadı.`);
    this.name = 'AssetNotFoundError';
  }
}

export class HistoricalPriceNotFoundError extends Error {
  constructor(symbol: string, date: string) {
    super(`"${symbol}" varlığı için ${date} tarihli geçmiş fiyat kaydı bulunamadı.`);
    this.name = 'HistoricalPriceNotFoundError';
  }
}

export class LatestPriceNotFoundError extends Error {
  constructor(symbol: string) {
    super(`"${symbol}" varlığı için güncel canlı fiyat bulunamadı.`);
    this.name = 'LatestPriceNotFoundError';
  }
}

export class InflationIndexNotFoundError extends Error {
  constructor(month: string) {
    super(`"${month}" ayı için TÜFE enflasyon verisi veritabanında bulunamadı.`);
    this.name = 'InflationIndexNotFoundError';
  }
}

/**
 * "Ya Alsaydın" Geçmiş Yatırım ve Enflasyon Hesaplama Motoru
 * Doğrudan PostgreSQL veritabanındaki price_history ve inflation_index tablolarından beslenir.
 */
export async function calculateWhatIf(input: WhatIfQueryInput): Promise<WhatIfResultDto> {
  // 1. Varlığı bul
  const asset = await findAssetBySymbol(input.symbol);
  if (!asset) {
    throw new AssetNotFoundError(input.symbol);
  }

  // 2. Geçmiş fiyatı bul
  const startPriceRecord = await findHistoricalPrice(asset.id, input.date);
  if (!startPriceRecord) {
    throw new HistoricalPriceNotFoundError(input.symbol, input.date);
  }

  // 3. Güncel canlı fiyatı bul
  const currentPriceRecord = await findLatestPrice(asset.id);
  if (!currentPriceRecord) {
    throw new LatestPriceNotFoundError(input.symbol);
  }

  const startPriceFloat = parseFloat(startPriceRecord.priceTry);
  const currentPriceFloat = parseFloat(currentPriceRecord.priceTry);

  if (startPriceFloat <= 0) {
    throw new Error('Geçmiş fiyat sıfır veya negatif olamaz.');
  }

  // 4. Parasal Hesaplamalar
  const initialInvestmentTry = Number(input.amountKurus) / 100;
  const purchasedQuantity = initialInvestmentTry / startPriceFloat;
  const currentValueTry = purchasedQuantity * currentPriceFloat;
  const nominalProfitTry = currentValueTry - initialInvestmentTry;

  // 5. Nominal Getiri Oranı: (Fiyat_son - Fiyat_ilk) / Fiyat_ilk
  const nominalReturn = (currentPriceFloat - startPriceFloat) / startPriceFloat;

  // 6. Enflasyon (TÜFE) ve Reel Getiri Hesabı (Doğrudan Veritabanından)
  const startMonth = input.date.slice(0, 7); // "YYYY-MM"
  const currentMonth = currentPriceRecord.ts.toISOString().slice(0, 7);

  const startTufeRecord = await findTufeIndex(startMonth);
  if (!startTufeRecord) {
    throw new InflationIndexNotFoundError(startMonth);
  }

  const currentTufeRecord = await findTufeIndex(currentMonth);
  if (!currentTufeRecord) {
    throw new InflationIndexNotFoundError(currentMonth);
  }

  const tufeStart = parseFloat(startTufeRecord.tufeIndex);
  const tufeEnd = parseFloat(currentTufeRecord.tufeIndex);

  // Kümülatif Enflasyon: (TÜFE_son - TÜFE_ilk) / TÜFE_ilk
  const inflationRate = tufeStart > 0 ? (tufeEnd - tufeStart) / tufeStart : 0;

  // Reel Getiri Formülü (Fisher Denklemi): (1 + Nominal) / (1 + Enflasyon) - 1
  const realReturn = inflationRate >= 0
    ? (1 + nominalReturn) / (1 + inflationRate) - 1
    : nominalReturn;

  // 7. Formatlama
  const formatKurus = (tryAmount: number) => {
    const kurusBigInt = BigInt(Math.round(tryAmount * 100)) as Penny;
    return formatTRY(kurusBigInt);
  };

  const nominalProfitFormatted = (nominalProfitTry >= 0 ? '+' : '') + formatKurus(nominalProfitTry);

  const summary = `${input.date} tarihinde ${asset.name} (${asset.symbol}) alsaydınız; ` +
    `yatırdığınız ${formatKurus(initialInvestmentTry)} bugün ${formatKurus(currentValueTry)} olurdu. ` +
    `Paranız nominal olarak ${formatTwrPercent(nominalReturn)}, enflasyondan arındırılmış reel olarak ise ${formatTwrPercent(realReturn)} kazandırdı!`;

  return {
    symbol: asset.symbol,
    assetName: asset.name,
    startDate: input.date,
    startPriceTry: formatKurus(startPriceFloat),
    currentDate: currentPriceRecord.ts.toISOString().slice(0, 10),
    currentPriceTry: formatKurus(currentPriceFloat),
    purchasedQuantity: purchasedQuantity.toFixed(8),
    initialInvestmentTry: formatKurus(initialInvestmentTry),
    currentValueTry: formatKurus(currentValueTry),
    nominalProfitTry: nominalProfitFormatted,
    nominalReturnPercentRaw: nominalReturn,
    nominalReturnPercentFormatted: formatTwrPercent(nominalReturn),
    tufeStartMonth: startMonth,
    tufeEndMonth: currentMonth,
    cumulativeInflationPercentRaw: inflationRate,
    cumulativeInflationPercentFormatted: formatTwrPercent(inflationRate),
    realReturnPercentRaw: realReturn,
    realReturnPercentFormatted: formatTwrPercent(realReturn),
    summary,
  };
}
