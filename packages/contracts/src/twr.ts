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
 * 
 * @note **Neden Number(bigint) dönüşümü yapılıyor?**
 * 1. TWR bir para tutarı değil, bir orandır (ratio/percentage). 0.215 gibi ondalıklı bir
 *    çarpanı tamsayı (bigint) ile saklayamayız.
 * 2. Hassasiyet & Güvenlik: JavaScript Number tipi (IEEE 754 çift duyarlıklı float) 
 *    Number.MAX_SAFE_INTEGER = 2^53 - 1 değerine kadar tam sayıyı kayıpsız tutar. 
 *    Kuruş cinsinden bu ~90.07 trilyon TL'ye tekabül eder. Ligdeki 100.000 TL = 10^7 kuruş
 *    olup bu sınırın çok altındadır.
 * 3. Hata Birikimi: Haftalık ligde yaklaşık 7 alt dönem bulunur; bu dönemlerin bileşik
 *    çarpımında float yuvarlama hatası birikimi ihmal edilebilir düzeydedir (< 1e-14).
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
    // Para tutarları kuruş (bigint) olarak gelir, oran hesabı için Number'a dönüştürülür.
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
 * TWR getiri oranını Türkçe finans standardına uygun kullanıcı dostu yüzde metnine dönüştürür.
 * 
 * Standart:
 * - Pozitif: "+%39,63"
 * - Negatif: "-%4,13"
 * - Nötr / Sıfır: "%0,00"
 * 
 * Ondalık ayırıcı olarak Türkçe standardı olan virgül (',') kullanılır (money.ts ile uyumlu).
 * 
 * @param twr Ondalık getiri oranı (Örn: 0.39634)
 * @param decimals Ondalık basamak sayısı (Varsayılan: 2)
 * @returns Biçimlendirilmiş Türkçe yüzde metni (Örn: "+%39,63", "-%4,13", "%0,00")
 */
export function formatTwrPercent(twr: number, decimals = 2): string {
  if (isNaN(twr) || !isFinite(twr)) {
    const zeroDecimals = (0).toFixed(decimals).replace('.', ',');
    return `%${zeroDecimals}`;
  }

  const percentage = twr * 100;
  const isZeroValue = Math.abs(percentage) < 0.5 / Math.pow(10, decimals);

  const formattedNumber = Math.abs(percentage)
    .toFixed(decimals)
    .replace('.', ',');

  if (isZeroValue) {
    return `%${formattedNumber}`;
  }
  if (percentage > 0) {
    return `+%${formattedNumber}`;
  }
  if (percentage < 0) {
    return `-%${formattedNumber}`;
  }

  return `%${formattedNumber}`;
}
