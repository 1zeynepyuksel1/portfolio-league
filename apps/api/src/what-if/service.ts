import { formatTwrPercent } from '@portfolio-league/contracts';
import { formatTRY, type Penny } from '../lib/money.js';
import {
  findMultiplesForDate,
  findAssetBySymbol,
  findHistoricalPrice,
  findLatestPrice,
  findTufeIndexOnOrBefore,
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

  /**
   * 2b. O TARİHTEKİ DOLAR KURU.
   *
   * ⚠️ BUGÜNKÜ KUR DEĞİL, O GÜNKÜ KUR — ve fark devasa.
   *
   * 12 Mart 2020'de dolar ~6,28 ₺'ydi, bugün ~47,88. Bugünkü kurla
   * çevirseydik "o gün BTC 620 dolardı" gibi tamamen yanlış bir sayı
   * çıkardı (gerçeği ~4.700 dolar).
   *
   * Bunu doğru yapabiliyoruz çünkü USD sıradan bir varlık gibi
   * `price_history`'de duruyor ve geri doldurma 2017'ye kadar günlük
   * kuru yazdı. Ayrı bir kur tablosu olsaydı bu sorgu da ayrı olurdu.
   *
   * ⚠️ `null` olabilir: USD kaydının başlangıcından önceki tarihler.
   * O durumda dolar alanları boş dönüyor — uydurulmuyor.
   */
  // ⚠️ `findAssetBySymbol` `undefined` döndürüyor, `null` değil —
  // bulunamayan satır için Drizzle'ın `rows[0]` davranışı. `== null`
  // ikisini birden yakalıyor.
  const usdAsset = await findAssetBySymbol('USD');

  const startUsdRate =
    usdAsset == null
      ? null
      : (await findHistoricalPrice(usdAsset.id, input.date)) ?? null;

  /**
   * BUGÜNKÜ kur — başlangıç kurundan AYRI okunuyor.
   *
   * ⚠️ İKİSİ FARKLI SORGU VE BU ZORUNLU. Tek kur kullanıp iki fiyatı da
   * onunla çevirseydik, ya geçmiş fiyat bugünkü kurla (12 Mart 2020'de
   * BTC 620 dolar gibi saçma bir sayı) ya da bugünkü fiyat 2020 kuruyla
   * hesaplanırdı. Her fiyat KENDİ GÜNÜNÜN kuruyla çevrilmeli.
   */
  const currentUsdRate =
    usdAsset == null ? null : (await findLatestPrice(usdAsset.id)) ?? null;

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

  // ⚠️ Tam ay eşleşmesi ARAMIYORUZ, "o ay ya da öncesi" arıyoruz.
  // TÜFE her zaman gecikmeli yayımlanıyor (TÜİK, ertesi ayın 3'ü) — içinde
  // bulunduğumuz ayın endeksi hiçbir zaman mevcut olmaz. Tam eşleşme
  // arasaydık özellik her zaman hata verirdi.
  const startTufeRecord = await findTufeIndexOnOrBefore(startMonth);
  if (!startTufeRecord) {
    throw new InflationIndexNotFoundError(startMonth);
  }

  const currentTufeRecord = await findTufeIndexOnOrBefore(currentMonth);
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
    /**
     * O günün fiyatının dolar karşılığı.
     *
     * Bölme burada `parseFloat` ile yapılıyor — bu dosyanın tamamı öyle
     * (bilinçli borç, docs/batuhan.md §6). Gösterim için zararsız;
     * emir motoru bu koda hiç dokunmuyor.
     */
    startPriceUsd:
      startUsdRate == null || parseFloat(startUsdRate.priceTry) <= 0
        ? null
        : (startPriceFloat / parseFloat(startUsdRate.priceTry)).toFixed(2),
    /** Çevrimde kullanılan kur — ekranda dipnot olarak gösteriliyor. */
    startUsdTryRate:
      startUsdRate == null ? null : formatKurus(parseFloat(startUsdRate.priceTry)),

    /** Bugünkü fiyatın dolar karşılığı — BUGÜNKÜ kurla. */
    currentPriceUsd:
      currentUsdRate == null || parseFloat(currentUsdRate.priceTry) <= 0
        ? null
        : (currentPriceFloat / parseFloat(currentUsdRate.priceTry)).toFixed(2),
    currentUsdTryRate:
      currentUsdRate == null
        ? null
        : formatKurus(parseFloat(currentUsdRate.priceTry)),
    currentDate: currentPriceRecord.ts.toISOString().slice(0, 10),
    currentPriceTry: formatKurus(currentPriceFloat),
    purchasedQuantity: purchasedQuantity.toFixed(8),
    initialInvestmentTry: formatKurus(initialInvestmentTry),
    currentValueTry: formatKurus(currentValueTry),
    nominalProfitTry: nominalProfitFormatted,
    nominalReturnPercentRaw: nominalReturn,
    nominalReturnPercentFormatted: formatTwrPercent(nominalReturn),
    // Gerçekten KULLANILAN ay bildiriliyor, istenen ay değil.
    // Fark önemli: bugün 2026-08 ama en son yayımlanan endeks 2026-07'nin.
    // İstenen ayı yazsaydık ekran, kullanılmayan bir aya ait veriymiş gibi
    // gösterirdi.
    tufeStartMonth: startTufeRecord.month,
    tufeEndMonth: currentTufeRecord.month,
    cumulativeInflationPercentRaw: inflationRate,
    cumulativeInflationPercentFormatted: formatTwrPercent(inflationRate),
    realReturnPercentRaw: realReturn,
    realReturnPercentFormatted: formatTwrPercent(realReturn),
    summary,
  };
}

/**
 * "O günden bugüne kaç kat" listesi + ENFLASYON EŞİĞİ.
 *
 * ⚠️ ENFLASYON EŞİĞİ BU EKRANIN ASIL FİKRİ.
 *
 * "BTC 104 kat arttı" tek başına gurur verici bir sayı ama eksik: aynı
 * dönemde TÜFE 12,8 kat arttı. Yani paranın alım gücü 104 kat değil,
 * 104 ÷ 12,8 = 8,1 kat arttı.
 *
 * Eşiğin ALTINDA kalan varlıklar nominal olarak "kazandırmış" görünür
 * ama gerçekte alım gücü KAYBETTİRMİŞTİR. Ekran bu çizgiyi listenin
 * içine çizerek hangi varlığın gerçekten kazandırdığını gösteriyor.
 */
export async function calculateMultiples(date: string): Promise<{
  date: string;
  /** TÜFE'nin aynı dönemdeki katı — listedeki kırmızı çizgi. */
  inflationMultiple: number;
  tufeStartMonth: string;
  tufeEndMonth: string;
  assets: Array<{
    symbol: string;
    name: string;
    kind: string;
    /** Nominal kat: bugünkü fiyat ÷ o günkü fiyat. */
    multiple: number;
    /** Enflasyondan arındırılmış kat: nominal ÷ enflasyon. */
    realMultiple: number;
    startPriceTry: string;
    currentPriceTry: string;
  }>;
}> {
  const rows = await findMultiplesForDate(date);

  const startMonth = date.slice(0, 7);
  const startTufe = await findTufeIndexOnOrBefore(startMonth);
  // ⚠️ Bugünün ayı DEĞİL, en son YAYIMLANMIŞ ay. TÜFE her zaman
  // gecikmeli: Ağustos'tayken en yeni endeks Temmuz'unki olabilir.
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentTufe = await findTufeIndexOnOrBefore(currentMonth);

  if (!startTufe || !currentTufe) {
    throw new InflationIndexNotFoundError(startMonth);
  }

  const startIndex = parseFloat(startTufe.tufeIndex);
  const endIndex = parseFloat(currentTufe.tufeIndex);

  // Sıfıra bölme koruması: endeks 0 olamaz ama veri bozuksa çökmeyelim.
  const inflationMultiple = startIndex > 0 ? endIndex / startIndex : 1;

  const assets = rows
    .map((row) => {
      const start = parseFloat(row.startPriceTry);
      const current = parseFloat(row.currentPriceTry);
      const multiple = start > 0 ? current / start : 0;

      return {
        symbol: row.symbol,
        name: row.name,
        kind: row.kind,
        multiple,
        realMultiple: inflationMultiple > 0 ? multiple / inflationMultiple : 0,
        startPriceTry: row.startPriceTry,
        currentPriceTry: row.currentPriceTry,
      };
    })
    // Katı sıfır olan varlık = fiyatı okunamamış. Listeden düşüyor.
    .filter((a) => a.multiple > 0)
    // ⚠️ BÜYÜKTEN KÜÇÜĞE. Ekran enflasyon eşiğini listenin ORTASINA
    // çiziyor; bu ancak sıralı listede anlamlı olur.
    .sort((a, b) => b.multiple - a.multiple);

  return {
    date,
    inflationMultiple,
    tufeStartMonth: startTufe.month,
    tufeEndMonth: currentTufe.month,
    assets,
  };
}
