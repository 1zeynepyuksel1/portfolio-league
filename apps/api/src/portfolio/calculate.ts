/**
 * Portföy değeri — SAF KATMAN.
 *
 * Tek formül:
 *
 *     toplam değer = nakit + Σ(miktar × güncel fiyat)
 *
 * Bu sayı üç yerden isteniyor (docs/01-plan.md 8.1):
 *   - GET /portfolio                      (ekran)
 *   - gece cron'u -> portfolio_snapshots  (değer geçmişi grafiği)
 *   - lig dönemi sınırları                (Zeynep, TWR girdisi)
 *
 * Üçü de aynı fonksiyonu çağıracak. Hesap iki yere kopyalanırsa bir gün
 * ikisi ayrışır ve hangisinin doğru olduğunu kimse bilemez.
 *
 * calculate.ts saf: veritabanı yok, tarih yok, yan etki yok. Testi mock
 * gerektirmiyor — orders/calculate.ts ile aynı gerekçe.
 */

import {
  type Amount,
  type Penny,
  type Price,
  addPenny,
  calcGross,
  divRound,
  formatScaled,
} from "../lib/money.js";

// ---------------------------------------------------------------------------
// 1. TİPLER
// ---------------------------------------------------------------------------

/** Veritabanından gelen ham pozisyon. */
export interface PositionInput {
  symbol: string;
  name: string;
  quantity: Amount;
  /**
   * Fiyatı hiç çekilmemiş varlık olabilir (yeni eklendi, cron patladı).
   * `null` geçilir — uydurma fiyat üretmiyoruz.
   */
  price: Price | null;
  asOf: Date | null;
}

/** Değeri hesaplanmış pozisyon. */
export interface PositionValue {
  symbol: string;
  name: string;
  quantity: Amount;
  price: Price | null;
  /** miktar × fiyat. Fiyat yoksa null. */
  valueCents: Penny | null;
  /** Portföydeki payı, yüzde ("12.34"). Hesaplanamıyorsa null. */
  sharePercent: string | null;
  asOf: Date | null;
}

export interface PortfolioSummary {
  cashCents: Penny;
  /** Pozisyonların toplam değeri (nakit hariç) */
  positionsValueCents: Penny;
  /** nakit + pozisyonlar */
  totalValueCents: Penny;
  positions: PositionValue[];
  /**
   * ⚠️ Fiyatı okunamayan pozisyon var mı.
   *
   * Varsa `totalValueCents` EKSİK hesaplanmış demektir. Ekranda uyarı
   * gösterilmeli; sessizce düşük bir toplam göstermek kullanıcıyı yanıltır.
   */
  hasIncompletePrices: boolean;
}

// ---------------------------------------------------------------------------
// 2. YÜZDE
// ---------------------------------------------------------------------------

/**
 * `part / whole` oranını yüzde metnine çevirir: "12.34"
 *
 * Neden bigint üzerinden: float'a düşmemek için. `Number(a) / Number(b) * 100`
 * yazmak kolaydı ama money.ts'in tüm gerekçesini çöpe atardı.
 *
 * 10_000 ile çarpıp bölüyoruz: 2 ondalık basamak istiyoruz (100) ve yüzdeye
 * çeviriyoruz (100). 100 × 100 = 10_000.
 *     part=11, whole=100 -> 11×10000/100 = 1100 -> formatScaled(_, 2) = "11.00"
 */
export function percentOf(part: bigint, whole: bigint): string | null {
  // Sıfıra bölme: divRound hata fırlatır. Portföy boşken bu normal bir
  // durum, hata değil — null dönüp ekranın "—" göstermesini sağlıyoruz.
  if (whole === 0n) return null;

  return formatScaled(divRound(part * 10_000n, whole), 2);
}

// ---------------------------------------------------------------------------
// 3. HESAP
// ---------------------------------------------------------------------------

/**
 * Pozisyonların değerini ve portföy toplamını hesaplar.
 *
 * Fiyatı olmayan pozisyon TOPLAMA KATILMAZ ama listeden de DÜŞMEZ.
 * Kullanıcı elindeki varlığı görmeye devam eder, sadece değeri "—" olur.
 * Listeden düşürseydik kullanıcı varlığının kaybolduğunu sanırdı.
 */
export function calculatePortfolio(
  cashCents: Penny,
  inputs: PositionInput[],
): PortfolioSummary {
  let positionsValue = 0n as Penny;
  let hasIncompletePrices = false;

  // Birinci geçiş: her pozisyonun değeri ve toplam.
  const valued = inputs.map((input) => {
    if (input.price === null) {
      hasIncompletePrices = true;
      return { input, valueCents: null };
    }

    // miktar × fiyat -> kuruş. Ölçek matematiği money.ts'te:
    // PRICE_SCALE + AMOUNT_SCALE - PENNY_SCALE = 16
    const valueCents = calcGross(input.price, input.quantity);
    positionsValue = addPenny(positionsValue, valueCents);

    return { input, valueCents };
  });

  const totalValue = addPenny(cashCents, positionsValue);

  // İkinci geçiş: pay yüzdeleri. Toplam bilinmeden hesaplanamadığı için
  // ayrı geçiş gerekiyor.
  const positions: PositionValue[] = valued.map(({ input, valueCents }) => ({
    symbol: input.symbol,
    name: input.name,
    quantity: input.quantity,
    price: input.price,
    valueCents,
    sharePercent:
      valueCents === null ? null : percentOf(valueCents, totalValue),
    asOf: input.asOf,
  }));

  return {
    cashCents,
    positionsValueCents: positionsValue,
    totalValueCents: totalValue,
    positions,
    hasIncompletePrices,
  };
}

// ---------------------------------------------------------------------------
// 4. KÂR / ZARAR
// ---------------------------------------------------------------------------

export interface ProfitSummary {
  /** Hesaba giren toplam para: kayıt bonusu + günlük bonuslar */
  depositedCents: Penny;
  /** toplam değer − yatırılan */
  profitCents: Penny;
  /** Yüzde olarak, "12.34". Yatırılan 0 ise null. */
  profitPercent: string | null;
}

/**
 * Basit (nominal) kâr/zarar.
 *
 * ⚠️ BU LİG SIRALAMASI DEĞİL. Lig TWR ile hesaplanıyor
 * (packages/contracts/src/twr.ts, docs/01-plan.md 8.2).
 *
 * Fark şu: bu hesap "toplam ne kazandım" sorusunu cevaplıyor ve para
 * girişlerini maliyet sayarak düzeltiyor. Ama para girişlerinin ZAMANINI
 * dikkate almıyor. Erken gelen kullanıcı daha çok günlük bonus topladığı
 * için burada avantajlı görünür — ligde görünmez.
 *
 * Ekranda "kâr/zarar" olarak göstermek doğru, sıralamada kullanmak yanlış.
 */
export function calculateProfit(
  totalValueCents: Penny,
  depositedCents: Penny,
): ProfitSummary {
  const profit = (totalValueCents - depositedCents) as Penny;

  return {
    depositedCents,
    profitCents: profit,
    profitPercent: percentOf(profit, depositedCents),
  };
}
