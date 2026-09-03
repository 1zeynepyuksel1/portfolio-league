/**
 * ChartBackground — kimlik ekranlarının arkasındaki animasyonlu grafik dokusu.
 *
 * Kaynak: design_handoff_portfolioyun_auth/README.md "Background texture"
 *
 * ⚠️ TEK KURAL: BU BİR DOKU, ÖN PLAN DEĞİL.
 * Hiçbir parça %50 etkin saydamlığı geçmiyor ve hiçbiri başlığın üstünde
 * tam güçte durmuyor. Opaklıkları yükseltmek "daha güzel" değil, metni
 * okunmaz yapar — tasarımın en kolay bozulacak yeri burası.
 *
 * KATMANLAR (arkadan öne):
 *   1. Izgara            — sabit
 *   2. Sparkline'lar     — breathe (nefes alma)
 *   3. Mumlar            — glow (parlama)
 *   4. Hacim + etiketler — sabit
 *   5. Uzun iz           — trace (çizilip silinme)
 *   6. Süzülen işaretler — floatUp (yukarı süzülme)
 *
 * ⚠️ NEDEN AYRI AYRI <Svg>?
 * Her animasyonlu katman kendi `Animated.View`'unun içinde. Hepsini tek
 * SVG'ye koyup içerideki grupları animasyonlamak da mümkündü ama o zaman
 * `useNativeDriver: true` kullanamazdık — RN'de yerel sürücü yalnızca
 * View'ların transform/opacity'sinde çalışıyor. Yerel sürücü, animasyonu
 * JavaScript ipliğinden alıp UI ipliğine taşıyor; JS meşgulken bile
 * takılmıyor. Giriş ekranında ağ isteği varken bu fark görünür.
 *
 * Tek istisna aşağıda: `strokeDashoffset` bir SVG özelliği, View değil —
 * o katman JS sürücüsüyle çalışmak zorunda.
 */

import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet } from 'react-native';
import Svg, {
  G,
  Line,
  Polyline,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { colors } from '../theme';

/** Tasarımın referans çerçevesi. Tüm koordinatlar bu uzayda. */
const VB_WIDTH = 390;
const VB_HEIGHT = 844;

const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

// ---------------------------------------------------------------------------
// ŞEKİL VERİLERİ
// ---------------------------------------------------------------------------

/** Izgara: yatay ve dikey ince çizgiler. */
const GRID_Y = [150, 290, 430, 570, 710];
const GRID_X = [98, 196, 294];

type Spark = {
  points: string;
  color: string;
  opacity: number;
  rotation: number;
  origin: string;
};

/**
 * Dağınık sparkline'lar — beşer parçalı kısa kırık çizgiler.
 *
 * Hepsi kenar boşluklarında duruyor: tasarım "hiçbiri başlığın üstünde tam
 * güçte olmasın" diyor. Ortadaki dikey şerit (x ≈ 60-330, y ≈ 180-260)
 * başlığın yeri, oraya bilerek şekil konmadı.
 */
const SPARKS: Spark[] = [
  /*
    ⚠️ YERLEŞİM ARTIK RASTGELE DEĞİL — METİN BÖLGELERİ KORUNUYOR.

    Önceki dağılım ekrana serpiştirilmişti ve iki çizgi tam maskotun
    üstüne düşüyordu; kalınlık artınca da bunlar "arka plan" olmaktan
    çıkıp lekeye dönüştü. Arka planın kuralı şu: ne kadar canlı olursa
    olsun, OKUNAN HİÇBİR ŞEYİN ARKASINDAN GEÇMEZ.

    viewBox 390 x 844. Yasak bölgeler (metin var):

        kilit      x   0-300   y  50-175
        başlık     x   0-380   y 195-375
        metin+çip  x   0-335   y 385-515
        düğmeler   x  15-375   y 620-790

    Serbest bölgeler (aşağıdaki 22 çizgi buralara dağıtıldı):

        sağ üst kolon        x 300-390  y  40-180
        çiplerin sağı        x 330-390  y 380-510
        ORTA BANT            x   0-390  y 520-615   <- en yoğun
        alt şerit            x   0-390  y 795-840

    ⚠️ ORTA BANT NEDEN EN YOĞUN. Ekranın o kısmında hiç metin yok ve
    tam görsel merkeze denk geliyor — canlılık hissi oradan geliyor,
    kenarlardan değil.
  */

  /* --- sağ üst kolon --- */
  { points: '0,26 14,12 26,20 40,4 55,14 68,0',   color: colors.gain, opacity: 0.86, rotation: -12, origin: '312, 58' },
  { points: '0,4 13,16 26,8 38,20 50,14 62,26',   color: colors.loss, opacity: 0.74, rotation:  16, origin: '328, 126' },

  /* --- çiplerin sağı --- */
  { points: '0,18 12,26 24,10 38,16 50,2 62,8',   color: colors.gain, opacity: 0.78, rotation:   8, origin: '334, 394' },
  { points: '0,2 13,14 25,8 39,22 52,16 64,30',   color: colors.loss, opacity: 0.70, rotation: -20, origin: '342, 460' },

  /* --- başlığın sağ kenarı (yalnızca uçta) --- */
  { points: '0,20 13,8 26,16 39,2 52,12 65,0',    color: colors.gain, opacity: 0.62, rotation:  22, origin: '356, 204' },
  { points: '0,12 13,24 26,14 39,28 52,20 65,32', color: colors.loss, opacity: 0.60, rotation: -18, origin: '362, 342' },

  /* --- ORTA BANT · üst sıra --- */
  { points: '0,34 15,20 28,28 44,8 58,18 72,0',   color: colors.gain, opacity: 0.92, rotation: -10, origin: '8, 524' },
  { points: '0,6 12,18 25,10 38,24 51,18 63,28',  color: colors.loss, opacity: 0.84, rotation:  14, origin: '74, 546' },
  { points: '0,28 14,16 27,24 40,8 53,18 67,2',   color: colors.gain, opacity: 0.88, rotation:  -6, origin: '140, 520' },
  { points: '0,8 14,20 27,12 40,26 53,18 66,30',  color: colors.loss, opacity: 0.80, rotation:  18, origin: '206, 550' },
  { points: '0,24 14,14 27,22 41,6 54,16 66,4',   color: colors.gain, opacity: 0.90, rotation: -14, origin: '272, 526' },
  { points: '0,30 12,16 25,24 38,10 51,20 64,6',  color: colors.loss, opacity: 0.76, rotation:  10, origin: '330, 556' },

  /* --- ORTA BANT · alt sıra --- */
  { points: '0,18 12,26 24,10 38,16 50,2 62,8',   color: colors.loss, opacity: 0.82, rotation:  20, origin: '28, 590' },
  { points: '0,26 14,12 26,20 40,4 55,14 68,0',   color: colors.gain, opacity: 0.94, rotation:  -8, origin: '94, 608' },
  { points: '0,4 13,16 26,8 38,20 50,14 62,26',   color: colors.loss, opacity: 0.78, rotation:  12, origin: '160, 584' },
  { points: '0,34 15,20 28,28 44,8 58,18 72,0',   color: colors.gain, opacity: 0.86, rotation: -20, origin: '226, 612' },
  { points: '0,2 13,14 25,8 39,22 52,16 64,30',   color: colors.loss, opacity: 0.72, rotation:   6, origin: '292, 588' },
  { points: '0,12 13,24 26,14 39,28 52,20 65,32', color: colors.gain, opacity: 0.84, rotation: -16, origin: '344, 614' },

  /* --- alt şerit (düğmelerin altı) --- */
  { points: '0,20 13,8 26,16 39,2 52,12 65,0',    color: colors.gain, opacity: 0.70, rotation:  10, origin: '14, 800' },
  { points: '0,6 12,18 25,10 38,24 51,18 63,28',  color: colors.loss, opacity: 0.64, rotation: -14, origin: '108, 818' },
  { points: '0,28 14,16 27,24 40,8 53,18 67,2',   color: colors.gain, opacity: 0.72, rotation:  16, origin: '204, 798' },
  { points: '0,8 14,20 27,12 40,26 53,18 66,30',  color: colors.loss, opacity: 0.66, rotation:  -8, origin: '296, 816' },
];

type Candle = { x: number; bodyY: number; bodyH: number; up: boolean };

/**
 * Mum grupları. Yeşil mumlar dolu, kırmızılar içi boş.
 *
 * `up` yalnızca rengi ve dolgusu belirliyor — bu bir doku, gerçek fiyat
 * değil. Gerçek grafiği Faz 2'de PriceChart çizecek.
 */
const CANDLES_A: Candle[] = [
  { x: 0,  bodyY: 8,  bodyH: 20, up: false },
  { x: 11, bodyY: 2,  bodyH: 26, up: true },
  { x: 22, bodyY: 12, bodyH: 14, up: true },
  { x: 33, bodyY: 6,  bodyH: 18, up: false },
  { x: 44, bodyY: 0,  bodyH: 24, up: true },
  { x: 55, bodyY: 10, bodyH: 16, up: false },
];

const CANDLES_B: Candle[] = [
  { x: 0,  bodyY: 6,  bodyH: 22, up: true },
  { x: 11, bodyY: 14, bodyH: 12, up: false },
  { x: 22, bodyY: 4,  bodyH: 20, up: true },
  { x: 33, bodyY: 16, bodyH: 10, up: false },
  { x: 44, bodyY: 8,  bodyH: 18, up: true },
];

/**
 * ⚠️ ÜÇÜNCÜ GRUP — YOĞUNLUK İÇİN, DOLGU İÇİN DEĞİL.
 *
 * İki grup ekranın sol-üst ve sağ-alt köşesindeydi; ortada geniş bir
 * boşluk kalıyordu. Üçüncüsü o boşluğu kapatıyor.
 *
 * ⚠️ ARKA PLAN OKUNURLUĞU BOZMAMALI. Bu yüzden mum SAYISI arttı ama
 * opaklık artmadı: doku sıklaşıyor, öne çıkmıyor. Üstündeki başlık
 * hâlâ ilk okunan şey olmalı — arka plan bir zemin, bir içerik değil.
 */
const CANDLES_C: Candle[] = [
  { x: 0,  bodyY: 10, bodyH: 16, up: false },
  { x: 11, bodyY: 2,  bodyH: 24, up: true },
  { x: 22, bodyY: 14, bodyH: 12, up: false },
  { x: 33, bodyY: 4,  bodyH: 22, up: true },
];

/** Hacim çubukları — 6px genişlik, değişken yükseklik. */
const VOLUME_BARS = [
  { x: 0,  h: 14 },
  { x: 9,  h: 26 },
  { x: 18, h: 19 },
  { x: 27, h: 31 },
];

/**
 * Grafik etiketleri.
 *
 * ⚠️ Tasarımdaki `XU100` ve `BIST` yerine ürünün gerçek varlıkları
 * yazıldı. BIST Faz 3'e ertelendi; olmayan bir piyasanın adını arka planda
 * bile yazmak, ekranda gördüğünü ürünün vaadi sanan kullanıcıyı yanıltır.
 * Doku olarak işlevi aynı.
 */
const TICKERS = [
  { text: 'BTC',     x: 28,  y: 292, rotation: -16 },
  { text: 'USD/TRY', x: 22,  y: 578, rotation: -10 },
  { text: 'XAU',     x: 298, y: 616, rotation:  14 },
  { text: 'ETH',     x: 322, y: 226, rotation:  -8 },
];

/** Süzülen küçük işaretler. Süreler bilerek asal-benzeri: aynı anda hizalanmasınlar. */
const FLOATERS = [
  { x: 58,  y: 300, up: true,  durationMs: 11000, delayMs: 0 },
  { x: 300, y: 205, up: true,  durationMs: 13000, delayMs: -4000 },
  { x: 196, y: 505, up: false, durationMs: 14000, delayMs: -8000 },
  { x: 118, y: 652, up: true,  durationMs: 16000, delayMs: -2000 },
];

/** Ekranı boydan boya geçen uzun iz. */
const TRACE_POINTS =
  '0,470 48,436 96,452 148,392 196,412 244,360 292,380 340,336 390,352';

/** `stroke-dasharray` uzunluğu. İzin toplam uzunluğundan biraz fazla. */
const TRACE_DASH = 260;

// ---------------------------------------------------------------------------
// ANİMASYON YARDIMCILARI
// ---------------------------------------------------------------------------

/**
 * İki değer arasında sonsuz gidip gelen bir animasyon kurar.
 *
 * ⚠️ `reduceMotion` true ise animasyon HİÇ başlamıyor ve değer ORTA
 * noktada duruyor. Sıfırda bırakmak katmanı görünmez yapardı — tasarım
 * "hareketi azalt" ayarında dokunun kaybolmasını değil, donmasını istiyor.
 */
function useLoop(
  from: number,
  to: number,
  durationMs: number,
  reduceMotion: boolean,
  delayMs = 0,
): Animated.Value {
  const value = useRef(new Animated.Value(from)).current;

  useEffect(() => {
    if (reduceMotion) {
      value.setValue((from + to) / 2);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: to,
          duration: durationMs / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
          delay: delayMs,
        }),
        Animated.timing(value, {
          toValue: from,
          duration: durationMs / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    // Ekrandan çıkınca durdur. Durdurmazsak animasyon arka planda dönmeye
    // devam eder; birkaç ekran sonra pil ve kare hızı fark edilir şekilde düşer.
    return () => loop.stop();
  }, [value, from, to, durationMs, delayMs, reduceMotion]);

  return value;
}

/** Tek yönlü, başa saran ilerleme (0 -> 1). floatUp ve trace bunu kullanıyor. */
function useProgress(
  durationMs: number,
  reduceMotion: boolean,
  delayMs = 0,
  linear = true,
): Animated.Value {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      value.setValue(0.5);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(value, {
        toValue: 1,
        duration: durationMs,
        easing: linear ? Easing.linear : Easing.inOut(Easing.ease),
        // ⚠️ floatUp yerel sürücüyle çalışıyor (transform + opacity).
        // trace çalışamıyor — aşağıda ayrıca açıklandı.
        useNativeDriver: true,
        delay: delayMs,
      }),
    );

    loop.start();
    return () => loop.stop();
  }, [value, durationMs, delayMs, linear, reduceMotion]);

  return value;
}

// ---------------------------------------------------------------------------
// ALT BİLEŞENLER
// ---------------------------------------------------------------------------

function Candles({
  data,
  x,
  y,
  rotation,
}: {
  data: Candle[];
  x: number;
  y: number;
  rotation: number;
}) {
  return (
    <G x={x} y={y} rotation={rotation} origin={`${x}, ${y}`}>
      {data.map((c, i) => {
        /*
          ⚠️ DÜŞÜŞ MAVİ ÇİZİLİYORDU (`colors.accent`) — VE BU YANLIŞTI.

          Yorumda "kırmızılar içi boş" yazıyordu ama kod mavi
          kullanıyordu; yani belge ile davranış ayrışmıştı. Mum
          grafiğinin evrensel dili yeşil/kırmızı — mavi bir mum
          "düşüş" değil, "başka bir şey" okunur.

          `colors.loss` zaten temada ve uygulamanın her yerinde
          düşüşü o gösteriyor. Arka planın farklı konuşmasının
          sebebi yoktu.
        */
        const stroke = c.up ? colors.gain : colors.loss;
        const centerX = c.x + 3;

        return (
          <G key={i}>
            {/* Fitil: gövdenin üstünden altına uzanan ince çizgi */}
            <Line
              x1={centerX}
              y1={c.bodyY - 5}
              x2={centerX}
              y2={c.bodyY + c.bodyH + 5}
              stroke={stroke}
              strokeWidth={1.8}
            />
            <Rect
              x={c.x}
              y={c.bodyY}
              width={6}
              height={c.bodyH}
              stroke={stroke}
              strokeWidth={1.8}
              // Yükseliş mumu dolu, düşüş mumu içi boş — tasarımın kuralı.
              fill={c.up ? stroke : 'none'}
            />
          </G>
        );
      })}
    </G>
  );
}

/**
 * Yukarı süzülen tek bir işaret.
 *
 * Kendi `Animated.View`'u var çünkü her biri farklı süre ve gecikmeyle
 * hareket ediyor; tek bir animasyon değerini paylaşamazlar.
 */
function Floater({
  x,
  y,
  up,
  durationMs,
  delayMs,
  reduceMotion,
}: {
  x: number;
  y: number;
  up: boolean;
  durationMs: number;
  delayMs: number;
  reduceMotion: boolean;
}) {
  const progress = useProgress(durationMs, reduceMotion, delayMs);

  // 46px aşağıdan başlayıp 84px yukarı çıkıyor (README'deki floatUp).
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [46, -84],
  });

  // Girerken belirip çıkarken sönüyor — uçlarda sert görünmesin diye.
  const opacity = progress.interpolate({
    inputRange: [0, 0.18, 0.78, 1],
    outputRange: [0, 0.55, 0.4, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity, transform: [{ translateY }] }]}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <Polyline
          points={up ? '0,8 6,0 12,8' : '0,0 6,8 12,0'}
          x={x}
          y={y}
          fill="none"
          stroke={up ? colors.gain : colors.loss}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// ANA BİLEŞEN
// ---------------------------------------------------------------------------

export function ChartBackground() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    // Cihazda "hareketi azalt" açıksa animasyonları dondur. Erişilebilirlik
    // ayarı: bazı kullanıcılarda hareketli arayüz baş dönmesi yapıyor.
    let alive = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (alive) setReduceMotion(enabled);
      })
      .catch(() => {
        // Web'de ya da desteklenmeyen platformda sessizce geç — varsayılan
        // false, yani animasyonlar çalışır.
      });

    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const breathe = useLoop(0.3, 0.85, 6500, reduceMotion);
  const glowA = useLoop(0.2, 0.42, 6000, reduceMotion);
  const glowB = useLoop(0.2, 0.42, 7500, reduceMotion, 1200);
  const trace = useProgress(9000, reduceMotion, 0, false);

  /**
   * ⚠️ TEK JS SÜRÜCÜLÜ ANİMASYON — VE NEDENİ.
   * `strokeDashoffset` bir SVG çizim özelliği; RN'in yerel sürücüsü yalnızca
   * View'ların transform ve opacity'sini UI ipliğine taşıyabiliyor. Bu değer
   * her karede JS'ten geçmek zorunda.
   *
   * Kabul edilebilir çünkü tek bir çizgi ve saniyede yalnızca bu güncelleniyor.
   * Sekiz sparkline'ı da böyle animasyonlasaydık giriş ekranı ağ isteği
   * sırasında takılırdı.
   *
   * 260 -> 0 -> -260: çizgi önce çiziliyor, sonra öbür uçtan siliniyor.
   */
  const dashOffset = trace.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [TRACE_DASH, 0, -TRACE_DASH],
  });

  return (
    <>
      {/* 1 + 4. Sabit katman: ızgara, hacim çubukları, etiketler */}
      <Svg
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
      >
        {GRID_Y.map((y) => (
          <Line
            key={`h${y}`}
            x1={0}
            y1={y}
            x2={VB_WIDTH}
            y2={y}
            stroke={colors.gridLine}
            strokeWidth={1}
          />
        ))}
        {GRID_X.map((x) => (
          <Line
            key={`v${x}`}
            x1={x}
            y1={0}
            x2={x}
            y2={VB_HEIGHT}
            stroke={colors.gridLine}
            strokeWidth={1}
          />
        ))}

        <G x={318} y={332} rotation={-14} origin="318, 332">
          {VOLUME_BARS.map((b, i) => (
            <Rect
              key={i}
              x={b.x}
              // Çubuklar aynı TABANDAN yükseliyor: y'yi yükseklikten
              // çıkarmazsak hepsi tepeden hizalanır ve grafik gibi durmaz.
              y={32 - b.h}
              width={6}
              height={b.h}
              fill={colors.volumeBar}
            />
          ))}
        </G>

        {TICKERS.map((t) => (
          <SvgText
            key={t.text}
            x={t.x}
            y={t.y}
            rotation={t.rotation}
            origin={`${t.x}, ${t.y}`}
            fontSize={9}
            // Harf aralığı tasarımda 1.6 — etiketleri "veri" değil
            // "arka plan dokusu" gibi okutan şey bu genişlik.
            letterSpacing={1.6}
            fill={colors.chartLabel}
          >
            {t.text}
          </SvgText>
        ))}
      </Svg>

      {/* 2. Sparkline'lar — nefes alıyor */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: breathe }]}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
          preserveAspectRatio="xMidYMid slice"
        >
          {SPARKS.map((s, i) => {
            const [ox, oy] = s.origin.split(',').map((n) => Number(n.trim()));
            return (
              <Polyline
                key={i}
                points={s.points}
                x={ox}
                y={oy}
                rotation={s.rotation}
                origin={s.origin}
                fill="none"
                stroke={s.color}
                /*
                  ⚠️ 1.6 -> 2.2: ÇİZGİ KALINLIĞI DA RENGİN PARÇASI.

                  Opaklığı artırmak tek başına yetmiyordu — ince bir
                  çizgi ne kadar opak olursa olsun ekranda az piksel
                  kaplıyor, yani "renkli" hissi vermiyor. Aynı rengi
                  daha kalın çizmek, opaklığı daha da artırmaktan
                  hem daha etkili hem metin okunurluğu için daha az
                  riskli: kalın çizgiler ARALIKLI, yüksek opaklık ise
                  her yeri kaplıyor.
                */
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={s.opacity}
              />
            );
          })}
        </Svg>
      </Animated.View>

      {/* 3. Mumlar — iki grup, kaymalı gecikmeyle parlıyor */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: glowA }]}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
          preserveAspectRatio="xMidYMid slice"
        >
          {/* ⚠️ (18,122) MASKOTUN TAM ARKASIYDI — orta banda taşındı. */}
          <Candles data={CANDLES_A} x={44} y={546} rotation={-14} />
        </Svg>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: glowB }]}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
          preserveAspectRatio="xMidYMid slice"
        >
          <Candles data={CANDLES_B} x={302} y={548} rotation={12} />
          {/* ⚠️ (188,356) BAŞLIĞIN ARKASIYDI — alt banda taşındı. */}
          <Candles data={CANDLES_C} x={196} y={606} rotation={8} />
        </Svg>
      </Animated.View>

      {/* 5. Uzun iz — çiziliyor, sonra siliniyor */}
      <Svg
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <AnimatedPolyline
          points={TRACE_POINTS}
          fill="none"
          stroke={colors.gain}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.42}
          strokeDasharray={`${TRACE_DASH}`}
          strokeDashoffset={dashOffset}
        />
      </Svg>

      {/* 6. Süzülen işaretler */}
      {FLOATERS.map((f, i) => (
        <Floater key={i} {...f} reduceMotion={reduceMotion} />
      ))}
    </>
  );
}
