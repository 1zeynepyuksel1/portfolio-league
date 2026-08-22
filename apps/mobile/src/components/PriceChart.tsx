/**
 * PriceChart — fiyat serisini çizen ve dokunarak okunabilen SVG bileşeni.
 *
 * Hazır grafik kütüphanesi yerine elle yazıldı. Kütüphane dokunmayı bedava
 * verirdi ama ölçekleme matematiği kutu içinde kalırdı; burada iş görünür
 * durumda.
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

import React, { useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Path,
  Polyline,
  Stop,
} from 'react-native-svg';
import { formatPrice } from '../lib/format';

export type ChartPoint = { ts: string; priceTry: string };

type Props = {
  points: ChartPoint[];
  width: number;
  height: number;
  /** Yükselişte yeşil, düşüşte kırmızı. Verilmezse yönden seçilir. */
  color?: string;
  /**
   * Kullanıcı grafiğe dokunduğunda seçilen nokta; parmağını kaldırınca
   * `null`. Üst ekran bunu kullanarak başlıktaki fiyatı değiştiriyor.
   */
  onScrub?: (point: ChartPoint | null) => void;
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

/** "2026-08-22T09:52:00.000Z" -> "22 Ağu 2026 12:52" (yerel saat) */
const MONTHS_SHORT = [
  'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
];

export function formatChartDate(iso: string): string {
  const d = new Date(iso);

  const day = d.getDate();
  const month = MONTHS_SHORT[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');

  return `${day} ${month} ${year} ${hh}:${mm}`;
}

export function PriceChart({
  points,
  width,
  height,
  color,
  onScrub,
}: Props) {
  /** Dokunulan noktanın dizideki sırası. `null` = dokunulmuyor. */
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  /**
   * ⚠️ `onScrub` BİR REF'TE TUTULUYOR.
   *
   * PanResponder yalnızca BİR KEZ kuruluyor (useMemo). İçindeki fonksiyon
   * o anki `onScrub`'ı yakalar ve üst bileşen yeniden çizildiğinde eski
   * sürüm kapalı kalır — "stale closure" denen klasik hata. Ref her zaman
   * güncel değeri tuttuğu için sorun ortadan kalkıyor.
   */
  const scrubRef = useRef(onScrub);
  scrubRef.current = onScrub;

  const pointsRef = useRef(points);
  pointsRef.current = points;

  const values = points.map((p) => toPlot(p.priceTry));

  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;

  /**
   * ⚠️ SIFIRA BÖLME KORUMASI — VE NEDEN SESSİZ BİR HATA.
   *
   * Bütün fiyatlar aynıysa (düz çizgi: hafta sonu döviz, ya da tek kovalık
   * veri) `max - min` sıfır olur. `(v - min) / 0` -> NaN -> SVG hiçbir şey
   * çizmez VE HATA DA VERMEZ. Ekranda boş bir kutu kalır, sebebi görünmez.
   */
  const span = max - min;
  const flat = span === 0;
  const plotHeight = height - PADDING_Y * 2;

  function xOf(index: number): number {
    if (points.length < 2) return width / 2;
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

  /**
   * Dokunulan yatay konumu en yakın veri noktasına çevirir.
   *
   * ⚠️ `Math.round`, `Math.floor` DEĞİL. Floor kullansaydık parmak bir
   * noktanın hemen sağındayken hâlâ soldakini seçerdi; imleç parmaktan
   * geride kalır ve "takılıyor" hissi verir. Round en yakına atlar.
   */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Dokunuşu bu bileşen üstlensin — aksi hâlde ScrollView kapar.
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: (e) => pick(e),
        onPanResponderMove: (e) => pick(e),

        onPanResponderRelease: () => clear(),
        onPanResponderTerminate: () => clear(),
      }),
    // Boş bağımlılık: responder bir kez kurulup ömür boyu yaşıyor.
    // Güncel veriye ref'ler üzerinden erişiliyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function pick(event: GestureResponderEvent): void {
    const list = pointsRef.current;
    if (list.length === 0) return;

    // locationX = bileşenin SOL KENARINA göre konum. pageX olsaydı
    // ekranın soluna göre olurdu ve grafiğin sayfadaki yerine bağlı
    // bir kayma çıkardı.
    const x = event.nativeEvent.locationX;

    const ratio = list.length < 2 ? 0 : x / width;
    const index = Math.round(ratio * (list.length - 1));

    // Parmak grafiğin dışına taşabilir; sınırların içine çekiyoruz.
    const clamped = Math.max(0, Math.min(list.length - 1, index));

    setActiveIndex(clamped);
    scrubRef.current?.(list[clamped] as ChartPoint);
  }

  function clear(): void {
    setActiveIndex(null);
    scrubRef.current?.(null);
  }

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

  const coords = points.map((_, i) => `${xOf(i)},${yOf(values[i] as number)}`);
  const line = coords.join(' ');
  const area = `M ${coords.join(' L ')} L ${width},${height} L 0,${height} Z`;

  const rising = (values[values.length - 1] as number) >= (values[0] as number);
  const stroke = color ?? (rising ? '#43b56f' : '#ec3013');

  const active = activeIndex !== null ? points[activeIndex] : undefined;
  const activeX = activeIndex !== null ? xOf(activeIndex) : 0;
  const activeY =
    activeIndex !== null ? yOf(values[activeIndex] as number) : 0;

  return (
    <View style={{ width, height }} {...panResponder.panHandlers}>
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
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* İmleç: dikey çizgi + nokta */}
        {active !== undefined && (
          <>
            <Line
              x1={activeX}
              y1={0}
              x2={activeX}
              y2={height}
              stroke="#94A3B8"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            {/* İki daire: dış halka koyu zeminde noktayı çizgiden ayırıyor */}
            <Circle cx={activeX} cy={activeY} r={6} fill="#0B132B" />
            <Circle cx={activeX} cy={activeY} r={4} fill={stroke} />
          </>
        )}
      </Svg>

      {/* En yüksek / en düşük — yalnızca dokunulmuyorken */}
      {!flat && active === undefined && (
        <>
          <Text style={[styles.bound, styles.boundTop]}>
            {formatPrice(points[values.indexOf(max)]?.priceTry ?? '0')}
          </Text>
          <Text style={[styles.bound, styles.boundBottom]}>
            {formatPrice(points[values.indexOf(min)]?.priceTry ?? '0')}
          </Text>
        </>
      )}

      {/*
        Okuma kutusu — dokunulan noktanın fiyatı ve tarihi.

        ⚠️ Kutu parmağın KARŞI TARAFINA yerleşiyor: parmak sol yarıdaysa
        sağa, sağ yarıdaysa sola. Sabit bir yere koysaydık kullanıcının
        parmağı yarı zaman okumak istediği yazının üstünde olurdu.
      */}
      {active !== undefined && (
        <View
          pointerEvents="none"
          style={[
            styles.readout,
            activeX < width / 2 ? { right: 0 } : { left: 0 },
          ]}
        >
          <Text style={styles.readoutPrice}>{formatPrice(active.priceTry)}</Text>
          <Text style={styles.readoutDate}>{formatChartDate(active.ts)}</Text>
        </View>
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

  readout: {
    position: 'absolute',
    top: 0,
    backgroundColor: 'rgba(11, 19, 43, 0.92)',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  readoutPrice: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  readoutDate: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 1,
  },
});
