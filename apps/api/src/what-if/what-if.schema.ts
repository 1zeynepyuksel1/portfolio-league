import { z } from 'zod';

// "Ya Alsaydın" simülatörü sorgu parametreleri şeması
export const whatIfQuerySchema = z.object({
  symbol: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Varlık sembolü gereklidir.'),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tarih formatı YYYY-MM-DD olmalıdır (Örn: 2020-03-12).'),
  amountKurus: z.coerce
    .bigint()
    .positive('Yatırılan tutar pozitif bir kuruş değeri olmalıdır (Örn: 10.000 TL için 1000000).'),
});

export type WhatIfQueryInput = z.infer<typeof whatIfQuerySchema>;

// Simülasyon sonuç DTO'su
export type WhatIfResultDto = {
  /**
   * O tarihteki fiyatın dolar karşılığı ve çevrimde kullanılan kur.
   *
   * ⚠️ İkisi de `null` olabilir: USD serisinin başlangıcından önceki
   * tarihler. Boş göndermek, bugünkü kurla uydurmaktan iyidir.
   */
  startPriceUsd: string | null;
  startUsdTryRate: string | null;
  symbol: string;
  assetName: string;
  startDate: string;
  startPriceTry: string;
  currentDate: string;
  currentPriceTry: string;
  purchasedQuantity: string;
  initialInvestmentTry: string;
  currentValueTry: string;
  nominalProfitTry: string;
  nominalReturnPercentRaw: number;
  nominalReturnPercentFormatted: string;
  tufeStartMonth: string;
  tufeEndMonth: string;
  cumulativeInflationPercentRaw: number;
  cumulativeInflationPercentFormatted: string;
  realReturnPercentRaw: number;
  realReturnPercentFormatted: string;
  summary: string;
};
