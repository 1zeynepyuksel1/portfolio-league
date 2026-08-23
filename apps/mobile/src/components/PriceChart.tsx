/**
 * PriceChart — fiyat serisini çizen, eksenli ve dokunarak okunabilen grafik.
 *
 * Hazır kütüphane yerine elle yazıldı: ölçekleme matematiği görünür kalıyor.
 *
 * ⚠️ BU DOSYADAKİ EN ÖNEMLİ AYRIM: FLOAT NEREDE SERBEST.
 *
 * Projenin kuralı "para `bigint`, `float` yasak". O kural PARA için.
 * Piksel koordinatı para değil — 0,3 piksellik sapmanın maliyeti yok.
 *
 *   fiyatı OKU ve GÖSTER  -> bigint (format.ts)
 *   çizim geometrisi      -> float serbest
 *
 * Fiyat etiketini float'tan üretirsen kuralı gerçekten kırarsın:
 * "3.688.083,84 ₺" yerine "3688083.8400000003" çıkar.
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
  /**
   * Sunucunun kullandığı kova boyutu (saniye).
   *
   * Zaman etiketlerinin biçimini belirliyor: saatlik kovada "14:30",
   * günlükte "12 Ara", haftalıkta "Ara 24". Sabit bir biçim seçseydik
   * "Tümü" aralığında 471 tane aynı saat, "1G"de 287 tane aynı gün
   * yazardı — ikisi de bilgi taşımaz.
   */
  bucketSeconds?: number;
  color?: string;
  onScrub?: (point: ChartPoint | null) => void;
  /**
   * İki parmakla sıkıştırınca yeni zaman penceresi.
   *
   * Üst ekran bunu sunucuya soruyor ve sunucu pencere genişliğine göre
   * DAHA İNCE kovayla cevap veriyor — yani yakınlaştırmak gerçekten
   * detay getiriyor, sadece çizgiyi büyütmüyor.
   */
  onZoom?: (window: { from: Date; to: Date }) => void;
};

/** Alt eksen için ayrılan yükseklik. */
const AXIS_HEIGHT = 22;
/** Sağdaki fiyat etiketleri için ayrılan genişlik. */
const AXIS_WIDTH = 62;
/** Çizginin üst/alt kenara yapışmaması için. */
const PADDING_Y = 10;

/** Kaç yatay ızgara çizgisi. 4 aralık = 5 çizgi. */
const GRID_LINES = 5;
/** Kaç zaman etiketi. Daha fazlası dar ekranda üst üste biner. */
const TIME_LABELS = 4;

const HOUR = 3600;
const DAY = 24 * HOUR;

const MONTHS_SHORT = [
  'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
];

/**
 * Ondalıklı fiyat metnini çizim için sayıya çevirir.
 *
 * ⚠️ `Number()` YALNIZCA BURADA. Dönen değer min/max bulmak ve piksele
 * ölçeklemek için; hiçbir zaman ekrana yazılmıyor.
 */
function toPlot(decimal: string): number {
  return Number(decimal);
}

/** Tam tarih — okuma kutusunda ve üst ekranda kullanılıyor. */
export function formatChartDate(iso: string): string {
  const d = new Date(iso);

  const day = d.getDate();
  const month = MONTHS_SHORT[d.getMonth()];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');

  return `${day} ${month} ${d.getFullYear()} ${hh}:${mm}`;
}

/**
 * Eksen etiketi — kova boyutuna göre kısaltılmış.
 *
 * Amaç en az yer kaplayıp en çok ayırt etmek: aynı gün içindeki noktalar
 * için saat, günler arası için gün+ay, aylar arası için ay+yıl.
 */
function formatAxisLabel(iso: string, bucketSeconds: number): string {
  const d = new Date(iso);

  if (bucketSeconds < DAY) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  if (bucketSeconds < 30 * DAY) {
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
  }

  return `${MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

/**
 * Fiyat ekseni etiketi — kısaltılmış.
 *
 * ⚠️ BURADA TAM BİÇİM KULLANILMIYOR VE BU BİLİNÇLİ.
 * "3.688.083,84 ₺" 62 piksele sığmaz, sığsa da eksen okunmaz olur.
 * Eksen SEVİYE gösteriyor, kesin tutar değil — kesin tutarı okuma kutusu
 * ve başlık veriyor, ikisi de `formatPrice` üzerinden bigint yolundan.
 */
function formatAxisPrice(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}B`;
  if (value >= 1) return value.toFixed(2);

  return value.toFixed(4);
}

export function PriceChart({
  points,
  width,
  height,
  bucketSeconds = DAY,
  color,
  onScrub,
  onZoom,
}: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  /**
   * ⚠️ `onScrub` REF'TE TUTULUYOR.
   *
   * PanResponder yalnızca BİR KEZ kuruluyor. İçindeki fonksiyon o anki
   * prop'u yakalar ve üst bileşen yeniden çizildiğinde eski sürüm kapalı
   * kalır — "stale closure". Ref her zaman güncel değeri tutuyor.
   */
  const scrubRef = useRef(onScrub);
  scrubRef.current = onScrub;

  const pointsRef = useRef(points);
  pointsRef.current = points;

  const zoomRef = useRef(onZoom);
  zoomRef.current = onZoom;

  /**
   * Sıkıştırma başlangıcındaki iki parmak arası mesafe.
   *
   * `null` = sıkıştırma yok (tek parmak, yani okuma).
   */
  const pinchStart = useRef<number | null>(null);

  /** Sıkıştırma sırasında canlı ölçek — çizimi anında büyütmek için. */
  const [pinchScale, setPinchScale] = useState(1);

  /** Çizimin yapıldığı alan — eksenler dışarıda kalıyor. */
  const plotWidth = width - AXIS_WIDTH;
  const plotHeight = height - AXIS_HEIGHT;
  const innerHeight = plotHeight - PADDING_Y * 2;

  const plotWidthRef = useRef(plotWidth);
  plotWidthRef.current = plotWidth;

  const values = points.map((p) => toPlot(p.priceTry));

  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;

  /**
   * ⚠️ SIFIRA BÖLME KORUMASI — SESSİZ BİR HATA.
   *
   * Bütün fiyatlar aynıysa `max - min` sıfır olur. `(v - min) / 0` -> NaN
   * -> SVG hiçbir şey çizmez VE HATA VERMEZ. Boş bir kutu kalır.
   */
  const span = max - min;
  const flat = span === 0;

  function xOf(index: number): number {
    if (points.length < 2) return plotWidth / 2;
    return (index / (points.length - 1)) * plotWidth;
  }

  function yOf(value: number): number {
    if (flat) return plotHeight / 2;

    /**
     * ⚠️ Y TERS ÇEVRİLİYOR.
     * SVG'de y ekranın ÜSTÜNDEN aşağı büyür; fiyat yukarı doğru büyümeli.
     * Çevirmezsen grafik baş aşağı çıkar — ve baş aşağı bir fiyat grafiği
     * hâlâ inandırıcı görünür, sadece yükselişi düşüş gibi gösterir.
     */
    return PADDING_Y + (1 - (value - min) / span) * innerHeight;
  }

  /** İki dokunuş arasındaki piksel mesafesi. */
  function touchDistance(event: GestureResponderEvent): number | null {
    const touches = event.nativeEvent.touches;
    if (touches.length < 2) return null;

    const [a, b] = touches;
    if (a === undefined || b === undefined) return null;

    return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: (e) => {
          const d = touchDistance(e);
          if (d !== null) {
            pinchStart.current = d;
          } else {
            pick(e);
          }
        },

        onPanResponderMove: (e) => {
          const d = touchDistance(e);

          if (d === null) {
            // Tek parmak -> okuma
            pick(e);
            return;
          }

          // İki parmak -> sıkıştırma. Okuma imlecini kapat, yoksa
          // parmaklardan biri fiyat okuyormuş gibi görünür.
          if (pinchStart.current === null) {
            pinchStart.current = d;
            return;
          }

          clear();
          setPinchScale(d / pinchStart.current);
        },

        onPanResponderRelease: () => finish(),
        onPanResponderTerminate: () => finish(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /**
   * Dokunuş bitti: sıkıştırma yapıldıysa yeni pencereyi bildir.
   *
   * ⚠️ İSTEK PARMAK KALKINCA GİDİYOR, HER KAREDE DEĞİL.
   * Hareket sırasında saniyede onlarca istek gitmesi hem sunucuyu yorar
   * hem de cevaplar sırasız dönüp grafiğin titremesine yol açar. Hareket
   * boyunca yalnızca yerel ölçek uygulanıyor (çizgi büyüyor), gerçek veri
   * bir kez isteniyor.
   */
  function finish(): void {
    const scale = pinchStart.current !== null ? pinchScale : null;

    pinchStart.current = null;
    setPinchScale(1);
    clear();

    const list = pointsRef.current;

    // Anlamsız küçük hareketleri yok say — parmak titremesi yakınlaştırma
    // sayılmamalı.
    if (scale === null || list.length < 2 || Math.abs(scale - 1) < 0.15) {
      return;
    }

    const firstTs = new Date(list[0]!.ts).getTime();
    const lastTs = new Date(list[list.length - 1]!.ts).getTime();

    const center = (firstTs + lastTs) / 2;

    // Parmaklar AÇILIRSA (scale > 1) yakınlaşıyoruz -> pencere DARALIYOR.
    const newSpan = (lastTs - firstTs) / scale;

    zoomRef.current?.({
      from: new Date(center - newSpan / 2),
      to: new Date(center + newSpan / 2),
    });
  }

  function pick(event: GestureResponderEvent): void {
    const list = pointsRef.current;
    if (list.length === 0) return;

    // locationX = bileşenin SOL KENARINA göre konum. pageX olsaydı
    // grafiğin sayfadaki yerine bağlı bir kayma çıkardı.
    const x = event.nativeEvent.locationX;

    const ratio = list.length < 2 ? 0 : x / plotWidthRef.current;

    /**
     * ⚠️ `Math.round`, `floor` DEĞİL. Floor kullansaydık parmak bir noktanın
     * hemen sağındayken hâlâ soldakini seçerdi; imleç parmaktan geride
     * kalır ve "takılıyor" hissi verir.
     */
    const index = Math.round(ratio * (list.length - 1));
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
  const area = `M ${coords.join(' L ')} L ${plotWidth},${plotHeight} L 0,${plotHeight} Z`;

  const rising = (values[values.length - 1] as number) >= (values[0] as number);
  const stroke = color ?? (rising ? '#43b56f' : '#ec3013');

  const active = activeIndex !== null ? points[activeIndex] : undefined;
  const activeX = activeIndex !== null ? xOf(activeIndex) : 0;
  const activeY = activeIndex !== null ? yOf(values[activeIndex] as number) : 0;

  /**
   * Yatay ızgara seviyeleri — min ile max arasında eşit aralıklı.
   *
   * "Yuvarlak sayı" (100, 250, 500 gibi) seçmek daha şık olurdu ama
   * fiyatlar 0,30 ₺ ile 3.700.000 ₺ arasında değişiyor; tek bir yuvarlama
   * kuralı ikisine birden uymuyor. Eşit aralık her ölçekte doğru çalışıyor.
   */
  const levels = flat
    ? [min]
    : Array.from(
        { length: GRID_LINES },
        (_, i) => min + (span * i) / (GRID_LINES - 1),
      );

  /** Zaman etiketlerinin düşeceği nokta sıraları — eşit aralıklı. */
  const labelIndices = Array.from({ length: TIME_LABELS }, (_, i) =>
    Math.round((i / (TIME_LABELS - 1)) * (points.length - 1)),
  );

  return (
    <View style={{ width, height }}>
      {/*
        ⚠️ SIKIŞTIRMA SIRASINDA YEREL ÖLÇEK.

        Parmak hareket ederken sunucuya gitmiyoruz — çizim yatayda
        büyüyerek anında tepki veriyor. Gerçek veri parmak kalkınca bir
        kez isteniyor.

        Bu geri bildirim olmasaydı kullanıcı sıkıştırırken hiçbir şey
        olmuyor sanır, parmağını kaldırır, sonra grafik birden değişirdi.
        `overflow: hidden` büyüyen çizimin eksenlerin üstüne taşmasını
        engelliyor.
      */}
      <View
        style={{
          width: plotWidth,
          height: plotHeight,
          overflow: 'hidden',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
      <Svg
        width={width}
        height={height}
        style={{ transform: [{ scaleX: pinchScale }] }}
      >
        <Defs>
          <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={stroke} stopOpacity={0.22} />
            <Stop offset="1" stopColor={stroke} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Yatay ızgara — çizginin ALTINDA kalması için önce çiziliyor */}
        {levels.map((value, i) => {
          const y = yOf(value);
          return (
            <Line
              key={`g${i}`}
              x1={0}
              y1={y}
              x2={plotWidth}
              y2={y}
              stroke="rgba(148, 163, 184, 0.12)"
              strokeWidth={1}
            />
          );
        })}

        <Path d={area} fill="url(#fill)" />

        <Polyline
          points={line}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* İmleç */}
        {active !== undefined && (
          <>
            <Line
              x1={activeX}
              y1={0}
              x2={activeX}
              y2={plotHeight}
              stroke="#94A3B8"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            {/* İki daire: dış halka noktayı çizgiden ayırıyor */}
            <Circle cx={activeX} cy={activeY} r={6} fill="#0B132B" />
            <Circle cx={activeX} cy={activeY} r={4} fill={stroke} />
          </>
        )}
      </Svg>
      </View>

      {/* Fiyat seviyeleri — sağda, ızgara çizgileriyle hizalı */}
      {!flat &&
        levels.map((value, i) => (
          <Text
            key={`p${i}`}
            style={[
              styles.priceLabel,
              // -6: metnin dikey ortası çizgiye denk gelsin
              { top: yOf(value) - 6, width: AXIS_WIDTH - 4 },
            ]}
          >
            {formatAxisPrice(value)}
          </Text>
        ))}

      {/* Zaman ekseni — altta */}
      {labelIndices.map((index, i) => {
        const point = points[index];
        if (point === undefined) return null;

        // İlk etiket sola, son etiket sağa yaslanıyor; ortadakiler
        // noktalarının üstünde ortalanıyor. Yaslamasaydık uçtakiler
        // grafiğin dışına taşardı.
        const x = xOf(index);
        const anchor =
          i === 0
            ? { left: 0 }
            : i === labelIndices.length - 1
              ? { right: AXIS_WIDTH }
              : { left: x - 24 };

        return (
          <Text key={`t${i}`} style={[styles.timeLabel, anchor]}>
            {formatAxisLabel(point.ts, bucketSeconds)}
          </Text>
        );
      })}

      {/*
        Okuma kutusu — parmağın KARŞI TARAFINA yerleşiyor.
        Sabit bir yere koysaydık kullanıcının eli yarı zaman okumak
        istediği yazının üstünde olurdu.
      */}
      {active !== undefined && (
        <View
          pointerEvents="none"
          style={[
            styles.readout,
            activeX < plotWidth / 2 ? { right: 0 } : { left: 0 },
          ]}
        >
          <Text style={styles.readoutPrice}>{formatPrice(active.priceTry)}</Text>
          <Text style={styles.readoutDate}>{formatChartDate(active.ts)}</Text>
        </View>
      )}

      {/*
        ⚠️ DOKUNMA KATMANI EN ÜSTTE VE YALNIZCA ÇİZİM ALANINDA.
        Metin etiketlerinin üstünde durması gerekiyor, yoksa parmak
        etikete denk geldiğinde olay yakalanmaz. Eksen bölgesini
        kapsamıyor — orada kaydırmanın anlamı yok.
      */}
      <View
        style={[styles.touchLayer, { width: plotWidth, height: plotHeight }]}
        {...panResponder.panHandlers}
      />
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

  priceLabel: {
    position: 'absolute',
    right: 0,
    color: '#64748B',
    fontSize: 10,
    textAlign: 'right',
  },
  timeLabel: {
    position: 'absolute',
    bottom: 2,
    color: '#64748B',
    fontSize: 10,
    width: 48,
    textAlign: 'center',
  },

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

  touchLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
