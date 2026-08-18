/**
 * Alt dönem (Sub-period): İki nakit akışı (bonus/yatırım) arasındaki dönem.
 */
export type TwrSubPeriod = {
  startValueKurus: bigint;
  endValueKurus: bigint;
};

/**
 * Zaman Ağırlıklı Getiri (Time-Weighted Return - TWR) Hesabı
 * 
 * Formül: TWR = ∏ (1 + r_i) - 1
 * Burada r_i = (endValueKurus - startValueKurus) / startValueKurus
 * 
 * @param subPeriods Nakit akışlarıyla bölünmüş alt dönemlerin listesi
 * @returns Ondalık getiri oranı (Örn: +%21.50 getiri için 0.215, -%5 için -0.05)
 */
export function calculateTwr(subPeriods: TwrSubPeriod[]): number {
  if (!subPeriods || subPeriods.length === 0) {
    return 0;
  }

  let compoundGrowth = 1.0;

  for (const period of subPeriods) {
    if (period.startValueKurus <= 0n) {
      // Başlangıç değeri 0 veya negatifse bu alt dönemde getiri hesaplanamaz (sıfıra bölme hatası önlenir)
      continue;
    }

    // Alt dönem getiri oranı: r_i = (V_son - V_ilk) / V_ilk
    const start = Number(period.startValueKurus);
    const end = Number(period.endValueKurus);
    const subPeriodReturn = (end - start) / start;

    // Bileşik büyüme çarpanı: (1 + r_1) * (1 + r_2) * ...
    compoundGrowth *= 1.0 + subPeriodReturn;
  }

  // TWR = Toplam Büyüme - 1
  return compoundGrowth - 1.0;
}

/**
 * TWR getiri oranını ekranda gösterilecek kullanıcı dostu yüzde metnine dönüştürür.
 * 
 * @param twr Ondalık getiri oranı (Örn: 0.39634)
 * @param decimals Ondalık basamak sayısı (Varsayılan: 2)
 * @returns Biçimlendirilmiş metin (Örn: "+%39.63", "-%4.13", "%0.00")
 */
export function formatTwrPercent(twr: number, decimals = 2): string {
  if (isNaN(twr) || !isFinite(twr)) {
    return '%0.00';
  }

  const percentage = twr * 100;
  const formattedNumber = Math.abs(percentage).toFixed(decimals);

  if (percentage > 0) {
    return `+${formattedNumber}%`;
  }
  if (percentage < 0) {
    return `-${formattedNumber}%`;
  }

  return `%${formattedNumber}`;
}
