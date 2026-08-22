/**
 * PriceChart — fiyat serisini çizen SVG bileşeni.
 *
 * Hazır grafik kütüphanesi yerine elle yazıldı. Kütüphane dokunma ve
 * yakınlaştırmayı bedava verirdi ama ölçekleme matematiği kutu içinde
 * kalırdı; burada iş görünür durumda ve toplam ~40 satır.
 *
 * ⚠️ BU DOSYADAKİ EN ÖNEMLİ AYRIM: FLOAT NEREDE SERBEST.
 *
 * Projenin kuralı "para `bigint`, `float` yasak". O kural PARA için.
 * Piksel koordinatı para değil — ekranda 0,3 piksellik sapmanın hiçbir
 * maliyeti yok ve `bigint` ile piksel hesaplamak anlamsız.
 *
 * Sınır şurada:
 *   fiyatı OKU ve GÖSTER    -> bigint (format.ts)
 *   çizim geometrisi        -> float serbest
 *
 * Fiyat etiketini float'tan üretirsen kuralı gerçekten kırmış olursun:
 * "3.688.083,84 ₺" yazması gereken yerde "3688083.8400000003" çıkar.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Polyline, Stop } from 'react-native-svg';
import { formatPrice } from '../lib/format';

export type ChartPoint = { ts: string; priceTry: string };

type Props = {
  points: ChartPoint[];
  width: number;
  height: number;
  /** Yükselişte yeşil, düşüşte kırmızı. */
  color?: string;
};

/** Çizginin kenarlara yapışmaması için üstte ve altta bırakılan boşluk. */
const PADDING_Y = 8;

/**
 * Ondalıklı fiyat metnini çizim için sayıya çevirir.
 *
 * ⚠️ BURADA `Number()` KULLANMAK SERBEST — ve tek yer burası.
 * Dönen değer yalnızca min/max bulmak ve piksele ölçeklemek için
 * kullanılıyor, hiçbir zaman ekrana yazılmıyor. Ekrana yazılan her fiyat
 * `formatPrice` üzerinden, yani metin -> bigint yolundan geçiyor.
 */
function toPlot(decimal: string): number {
  return Number(decimal);
}

export function PriceChart({ points, width, height, color }: Props) {
  if (points.length < 2) {
    return (
      <View style={[styles.empty, { width, height }]}>
        <Text style={styles.emptyText}>
          {points.length === 0
            ? 'Bu aralıkta veri yok'
            : 'Çizgi için en az iki nokta gerekiyor'}
        </Text>
      </View>
    );
  }

  const values = points.map((p) => toPlot(p.priceTry));

  const min = Math.min(...values);
  const max = Math.max(...values);

  /**
   * ⚠️ SIFIRA BÖLME KORUMASI — VE NEDEN SESSİZ BİR HATA.
   *
   * Bütün fiyatlar aynıysa (düz çizgi: hafta sonu döviz, ya da tek kovalık
   * veri) `max - min` sıfır olur. `(v - min) / 0` -> NaN -> SVG hiçbir şey
   * çizmez VE HATA DA VERMEZ. Ekranda boş bir kutu kalır, sebebi görünmez.
   *
   * Böyle durumda çizgiyi tam ortadan geçiriyoruz — ki "fiyat değişmemiş"
   * bilgisi de bir bilgi.
   */
  const span = max - min;
  const flat = span === 0;

  const plotHeight = height - PADDING_Y * 2;

  function xOf(index: number): number {
    return (index / (points.length - 1)) * width;
  }

  function yOf(value: number): number {
    if (flat) return height / 2;

    const ratio = (value - min) / span;

    /**
     * ⚠️ Y TERS ÇEVRİLİYOR.
     *
     * SVG'de y ekranın ÜSTÜNDEN aşağı büyür; fiyat ise yukarı doğru
     * büyümeli. Çevirmezsen grafik baş aşağı çıkar — ve asıl tehlike bu:
     * baş aşağı bir fiyat grafiği hâlâ inandırıcı görünür, sadece yükselişi
     * düşüş gibi gösterir.
     */
    return PADDING_Y + (1 - ratio) * plotHeight;
  }

  const coords = points.map((_, i) => `${xOf(i)},${yOf(values[i] as number)}`);
  const line = coords.join(' ');

  // Çizginin altını dolduran alan: aynı noktalar + iki köşe ile kapatılıyor.
  const area = `M ${coords.join(' L ')} L ${width},${height} L 0,${height} Z`;

  // Yön: ilk noktaya göre son nokta. Renk verilmemişse buradan seçiliyor.
  const rising = (values[values.length - 1] as number) >= (values[0] as number);
  const stroke = color ?? (rising ? '#43b56f' : '#ec3013');

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={stroke} stopOpacity={0.22} />
            <Stop offset="1" stopColor={stroke} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        <Path d={area} fill="url(#fill)" />

        <Polyline
          points={line}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          // Köşeleri yuvarlatmak, seyrek veride çizginin kırık kırık
          // görünmesini engelliyor.
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>

      {/* En yüksek ve en düşük fiyat — bigint yolundan biçimlendiriliyor */}
      {!flat && (
        <>
          <Text style={[styles.bound, styles.boundTop]}>
            {formatPrice(points[values.indexOf(max)]?.priceTry ?? '0')}
          </Text>
          <Text style={[styles.bound, styles.boundBottom]}>
            {formatPrice(points[values.indexOf(min)]?.priceTry ?? '0')}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
  },
  bound: {
    position: 'absolute',
    right: 0,
    color: '#64748B',
    fontSize: 10,
  },
  boundTop: { top: 0 },
  boundBottom: { bottom: 0 },
});
