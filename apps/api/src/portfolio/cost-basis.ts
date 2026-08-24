/**
 * cost-basis.ts — pozisyon başına MALİYET hesabı.
 *
 * "BTC'yi aldığımdan beri ne kadar kazandım?" sorusunun cevabı burada.
 *
 * ⚠️ MALİYET VERİTABANINDA TUTULMUYOR — DEFTERDEN HESAPLANIYOR.
 *
 * `holdings` tablosunda yalnızca miktar var. Oraya bir `avg_cost` kolonu
 * ekleyip her emirde güncellemek de mümkündü; yapılmadı çünkü o değer
 * TÜRETİLMİŞ bir veri: `orders` defterinden her zaman yeniden
 * üretilebilir. İki yerde tutulan veri er ya da geç ayrışır — bir emir
 * silinir, bir migration atlanır, bir hata kolonu bozar ve kimse fark
 * etmez. Defter tek doğruluk kaynağı olarak kalıyor.
 *
 * Bedeli: her portföy okumasında kullanıcının emirleri taranıyor. Bir
 * kullanıcının emir sayısı binleri bulursa önbellek gerekir; bu ligde
 * gerçekçi değil.
 */

import {
  type Amount,
  type Penny,
  addPenny,
  divRound,
  subPenny,
} from '../lib/money.js';

/** Defterdeki tek bir emir. Kronolojik sırada verilmeli. */
export interface LedgerOrder {
  side: 'buy' | 'sell';
  quantity: Amount;
  /**
   * Alışta ÖDENEN, satışta ELE GEÇEN tutar — komisyon dahil.
   *
   * ⚠️ `grossCents` DEĞİL `netCents`. Komisyon da maliyetin parçası:
   * 1.000 TL'lik BTC için 1.001 TL ödediysen, başa baş noktan 1.001'dir.
   * Brütü kullansaydık her pozisyon komisyon kadar kârlı görünürdü.
   */
  netCents: Penny;
}

export interface CostBasis {
  /** Elde kalan miktar. */
  quantity: Amount;
  /** O miktarın toplam maliyeti, kuruş. */
  costCents: Penny;
}

/**
 * Emir defterinden kalan miktarı ve maliyetini çıkarır.
 *
 * ⚠️ YÖNTEM: HAREKETLİ ORTALAMA (moving average), FIFO DEĞİL.
 *
 * FIFO ("ilk giren ilk çıkar") vergi hesabında doğru olan yöntem ama her
 * alımı ayrı bir parti olarak izlemeyi gerektirir. Bu bir simülasyon
 * ligi; kullanıcının görmek istediği "ortalama kaça aldım" — perakende
 * yatırım uygulamalarının tamamı bunu gösteriyor.
 *
 * ⚠️ SATIŞTA MALİYET ORANSAL AZALIYOR — VE BU KISIM KOLAY YANLIŞ YAPILIR.
 *
 * Yarısını sattığında maliyetin de yarısı gitmeli. Maliyeti olduğu gibi
 * bırakıp yalnızca miktarı azaltsaydık, kalan yarım BTC tam maliyetle
 * eşleşir ve ekran uydurma bir zarar gösterirdi.
 *
 *     yeniMaliyet = maliyet × (kalanMiktar / eskiMiktar)
 *
 * Bölme `divRound`'dan geçiyor: bigint bölmesi kırpar ve her satışta
 * kullanıcı aleyhine kuruş erirdi.
 */
export function calculateCostBasis(orders: LedgerOrder[]): CostBasis {
  let quantity = 0n as Amount;
  let costCents = 0n as Penny;

  for (const order of orders) {
    if (order.side === 'buy') {
      quantity = (quantity + order.quantity) as Amount;
      costCents = addPenny(costCents, order.netCents);
      continue;
    }

    // --- SATIŞ ---

    // Tamamı satıldıysa maliyet de sıfırlanır. Ayrıca ele alınıyor çünkü
    // aşağıdaki bölme paydası sıfır olurdu.
    if (order.quantity >= quantity || quantity === 0n) {
      quantity = 0n as Amount;
      costCents = 0n as Penny;
      continue;
    }

    const remaining = (quantity - order.quantity) as Amount;

    // Ölçekler sadeleşiyor: iki taraf da Amount (1e10) ölçekli, oran
    // birimsiz. Sonuç yine kuruş.
    costCents = divRound(costCents * remaining, quantity) as Penny;
    quantity = remaining;
  }

  return { quantity, costCents };
}

export interface PositionProfit {
  /** Pozisyonun maliyeti. */
  costCents: Penny;
  /** Güncel değer − maliyet. Negatif olabilir. */
  profitCents: Penny;
  /**
   * Yüzde getiri, iki ondalıklı metin ("12.34" / "-5.10").
   * Maliyet sıfırsa `null` — sıfıra bölme yok.
   */
  profitPercent: string | null;
}

/**
 * Pozisyonun kâr/zararını hesaplar.
 *
 * `valueCents` null ise (fiyat çekilememiş) kâr da hesaplanamaz —
 * uydurma bir sayı üretmektense null döndürüyoruz.
 */
export function calculatePositionProfit(
  costCents: Penny,
  valueCents: Penny | null,
): PositionProfit {
  if (valueCents === null) {
    return { costCents, profitCents: 0n as Penny, profitPercent: null };
  }

  const profitCents = subPenny(valueCents, costCents);

  if (costCents === 0n) {
    // Maliyeti sıfır olan pozisyon: bedava gelmiş (ileride bonus/hediye
    // varlık olabilir) ya da defterde eksik veri var. Yüzde tanımsız.
    return { costCents, profitCents, profitPercent: null };
  }

  /**
   * ⚠️ YÜZDE HESABI `float` KULLANMIYOR.
   *
   * `(profit / cost) * 100` yazmak en kolay yol olurdu ama para
   * bölmesinde float kullanmak projenin kuralına aykırı ve sonuçta
   * "12.340000000000001" gibi değerler üretir.
   *
   * Yerine: önce 10.000 ile çarpıp bölüyoruz (iki ondalık için 100 × 100),
   * sonra metni elle biçimlendiriyoruz. Aynı desen portfolio/calculate.ts
   * içindeki `percentOf`'ta da var.
   */
  const scaled = divRound(profitCents * 10_000n, absOf(costCents));

  return { costCents, profitCents, profitPercent: formatHundredths(scaled) };
}

function absOf(value: bigint): bigint {
  return value < 0n ? -value : value;
}

/** 1234n -> "12.34" · -510n -> "-5.10" */
function formatHundredths(value: bigint): string {
  const negative = value < 0n;
  const abs = absOf(value);

  const whole = abs / 100n;
  const frac = (abs % 100n).toString().padStart(2, '0');

  return `${negative ? '-' : ''}${whole}.${frac}`;
}
