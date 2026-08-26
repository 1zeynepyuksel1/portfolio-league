import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';
import { apiFetch } from '../api/client';
import { formatCentsString } from '../lib/format';
import { AssetBadge, SectionLabel } from '../components/DesignKit';
import { colors, fonts, spacing } from '../theme';

/**
 * WhatIfResultScreen — `docs/export/7a (1).png` sağ ekran.
 *
 * ⚠️ AYRI EKRAN, AŞAĞI KAYDIRILAN BİR BÖLÜM DEĞİL.
 *
 * Eskiden sonuç aynı sayfanın altına ekleniyordu ve kullanıcı seçim
 * kutularının arasından geçerek aşağı sürükleniyordu. Sonuç, sorunun
 * devamı değil CEVABI — kendi ekranını hak ediyor. Ayrıca ayrı ekran
 * olunca cevap sayfası kendi başına paylaşılabilir bir şey oluyor.
 *
 * ⚠️ ASIL FİKİR: ÜÇ SAYININ BİRBİRİYLE İLİŞKİSİ.
 *
 *     104×  ÷  12,8×  =  8,1×
 *   kâğıtta   enflasyon  alım gücünde
 *
 * "104 kat kazandım" cümlesi tek başına yanıltıcı. Aynı dönemde her şey
 * 12,8 kat pahalandıysa gerçek kazanç 8,1 kat. Ekran bu bölmeyi
 * gizlemek yerine ortaya koyuyor.
 */

type WhatIfResult = {
  symbol: string;
  assetName: string;
  startDate: string;
  startPriceTry: string;
  startPriceUsd: string | null;
  startUsdTryRate: string | null;
  currentDate: string;
  currentPriceTry: string;
  /**
   * Bugünkü fiyatın dolar karşılığı ve BUGÜNKÜ kur.
   *
   * ⚠️ Başlangıçtakinden ayrı alanlar — her fiyat kendi gününün kuruyla
   * çevriliyor. Aynı kuru ikisine birden uygulamak sayılardan birini
   * mutlaka bozar.
   */
  currentPriceUsd: string | null;
  currentUsdTryRate: string | null;
  purchasedQuantity: string;
  initialInvestmentTry: string;
  currentValueTry: string;
  nominalProfitTry: string;
  nominalReturnPercentRaw: number;
  nominalReturnPercentFormatted: string;
  cumulativeInflationPercentRaw: number;
  realReturnPercentRaw: number;
  realReturnPercentFormatted: string;
  tufeStartMonth: string;
  tufeEndMonth: string;
};

type Multiple = {
  symbol: string;
  name: string;
  kind: string;
  multiple: number;
  realMultiple: number;
};

type MultiplesResponse = {
  inflationMultiple: number;
  assets: Multiple[];
};

// ⚠️ Alan adı `price`, `priceTry` DEĞİL — grafik ucu artık dolar da
// dönebiliyor, birim ayrı alanda (`currency`) geliyor.
type PricePoint = { ts: string; price: string };

/** 104.3 -> "104×" · 12.83 -> "12,8×" */
function formatMultiple(value: number): string {
  if (value >= 100) return `${Math.round(value)}×`;
  return `${value.toFixed(1).replace('.', ',')}×`;
}

function humanDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

const CHART_HEIGHT = 150;

export function WhatIfResultScreen({
  symbol,
  date,
  amountTry,
  onBack,
  onAnotherDay,
}: {
  symbol: string;
  date: string;
  /** Tam TL, ondalıksız ("10000"). */
  amountTry: string;
  onBack: () => void;
  onAnotherDay: () => void;
}) {
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [multiples, setMultiples] = useState<MultiplesResponse | null>(null);
  const [series, setSeries] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQuantity, setShowQuantity] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      /**
       * Üç istek PARALEL gidiyor.
       *
       * Sırayla atsaydık üç gidiş-dönüş süresi toplanırdı; hiçbiri
       * diğerinin sonucuna ihtiyaç duymuyor. `Promise.all` biri
       * hata verirse hepsini düşürür — burada istenen bu, çünkü
       * eksik bir rapor göstermek yanıltıcı olur.
       */
      const [detail, mult, chart] = await Promise.all([
        apiFetch<WhatIfResult>(
          `/what-if?symbol=${symbol}&date=${date}&amountKurus=${amountTry}00`,
        ),
        apiFetch<MultiplesResponse>(`/what-if/multiples?date=${date}`),
        apiFetch<{ points: PricePoint[] }>(
          // Seçilen günden bugüne — grafiğin penceresi tam olarak bu.
          `/assets/${symbol}/prices?from=${date}T00:00:00.000Z&to=${new Date().toISOString()}`,
        ),
      ]);

      setResult(detail);
      setMultiples(mult);
      setSeries(chart.points);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rapor hazırlanamadı.');
    } finally {
      setLoading(false);
    }
  }, [symbol, date, amountTry]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.inkMuted} />
      </View>
    );
  }

  if (error !== null || result === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>{error ?? 'Rapor okunamadı.'}</Text>
        <TouchableOpacity style={styles.retry} onPress={onBack}>
          <Text style={styles.retryText}>Geri dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const nominalMultiple = 1 + result.nominalReturnPercentRaw;
  const inflationMultiple = 1 + result.cumulativeInflationPercentRaw;
  const realMultiple = 1 + result.realReturnPercentRaw;

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.screen} contentContainerStyle={styles.content}>
      {/* --- üst çubuk --- */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Geri"
        >
          <Text style={styles.iconText}>←</Text>
        </TouchableOpacity>

        <View style={styles.topTitle}>
          <AssetBadge symbol={result.symbol} />
          <Text style={styles.topTitleText}>
            {result.assetName} · {humanDate(result.startDate)}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.iconButton}
          onPress={() =>
            void Share.share({
              message:
                `${humanDate(result.startDate)} tarihinde ${result.initialInvestmentTry} ` +
                `${result.assetName} alsaydım bugün ${result.currentValueTry} olurdu ` +
                `(${formatMultiple(nominalMultiple)}). Enflasyondan sonra ` +
                `${formatMultiple(realMultiple)}.`,
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Paylaş"
        >
          <Text style={styles.iconText}>⤴</Text>
        </TouchableOpacity>
      </View>

      {/* --- büyük kat --- */}
      <View style={styles.hero}>
        <SectionLabel>PARAN KÂĞIT ÜZERİNDE</SectionLabel>

        <View style={styles.heroRow}>
          <Text style={styles.heroValue}>
            {nominalMultiple >= 100
              ? Math.round(nominalMultiple)
              : nominalMultiple.toFixed(1).replace('.', ',')}
          </Text>
          <Text style={styles.heroTimes}>×</Text>
        </View>

        <Text style={styles.heroSub}>
          {result.initialInvestmentTry} bugün{' '}
          <Text style={styles.heroSubStrong}>{result.currentValueTry}</Text>
        </Text>
      </View>

      {/* --- üç sayı: kâğıt ÷ enflasyon = alım gücü --- */}
      <View style={styles.mathBox}>
        <View style={styles.mathCell}>
          <Text style={styles.mathValue}>{formatMultiple(nominalMultiple)}</Text>
          <Text style={styles.mathLabel}>KÂĞIT ÜZERİNDE</Text>
        </View>

        <Text style={styles.mathOperator}>÷</Text>

        <View style={styles.mathCell}>
          <Text style={[styles.mathValue, { color: colors.loss }]}>
            {formatMultiple(inflationMultiple)}
          </Text>
          <Text style={styles.mathLabel}>ENFLASYON</Text>
        </View>

        <Text style={styles.mathOperator}>=</Text>

        <View style={styles.mathCell}>
          <Text style={[styles.mathValue, { color: colors.gain }]}>
            {formatMultiple(realMultiple)}
          </Text>
          <Text style={styles.mathLabel}>ALIM GÜCÜNDE</Text>
        </View>
      </View>

      <Text style={styles.mathNote}>
        Reel getiri {result.realReturnPercentFormatted} — kâğıt üzerindeki{' '}
        {formatMultiple(nominalMultiple)} katın enflasyondan sonra elinde
        kalan kısmı. Enflasyon {result.tufeStartMonth} → {result.tufeEndMonth}{' '}
        TÜFE endeksinden.
      </Text>

      {/* --- grafik --- */}
      <AreaChart
        points={series}
        inflationMultiple={inflationMultiple}
        amountTry={amountTry}
      />

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: colors.gain }]} />
          <Text style={styles.legendText}>{result.assetName} (nominal)</Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendLine, styles.legendDashed]} />
          <Text style={styles.legendText}>Enflasyon (alım gücü eşiği)</Text>
        </View>
      </View>

      {/* --- aynı gün başkasını alsaydım --- */}
      {multiples !== null && (
        <View style={styles.compare}>
          <View style={styles.compareHead}>
            <SectionLabel>AYNI GÜN BAŞKASINI ALSAYDIM</SectionLabel>
            <Text style={styles.compareUnit}>nominal kat</Text>
          </View>

          {(() => {
            // Çubukların ölçeği en büyük değere göre. Sabit bir üst sınır
            // koysaydık 600 katlık bir varlık çubuğu taşırırdı.
            const top = Math.max(
              multiples.inflationMultiple,
              ...multiples.assets.map((a) => a.multiple),
            );

            return (
              <>
                {multiples.assets.slice(0, 6).map((item) => (
                  <View key={item.symbol} style={styles.bar}>
                    <Text style={styles.barName} numberOfLines={1}>
                      {item.name}
                    </Text>

                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${Math.max((item.multiple / top) * 100, 1)}%`,
                            backgroundColor:
                              item.multiple < multiples.inflationMultiple
                                ? colors.inkDisabled
                                : colors.gain,
                          },
                        ]}
                      />
                    </View>

                    <Text style={styles.barValue}>
                      {formatMultiple(item.multiple)}
                    </Text>
                  </View>
                ))}

                {/* Enflasyon aynı ölçekte, kırmızı — kıyas çizgisi bu. */}
                <View style={[styles.bar, styles.barInflation]}>
                  <Text style={[styles.barName, { color: colors.inkMuted }]}>
                    Enflasyon
                  </Text>

                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.max((multiples.inflationMultiple / top) * 100, 1)}%`,
                          backgroundColor: colors.loss,
                        },
                      ]}
                    />
                  </View>

                  <Text style={[styles.barValue, { color: colors.loss }]}>
                    {formatMultiple(multiples.inflationMultiple)}
                  </Text>
                </View>
              </>
            );
          })()}
        </View>
      )}

      {/* --- hesabın tamamı --- */}
      <TouchableOpacity
        style={styles.detailRow}
        onPress={() => setShowQuantity((open) => !open)}
        accessibilityRole="button"
      >
        <Text style={styles.detailKey}>Hesabın tamamı</Text>
        <Text style={styles.detailValue}>
          {result.purchasedQuantity} {result.symbol}
        </Text>
        <Text style={styles.detailCaret}>{showQuantity ? '⌃' : '⌄'}</Text>
      </TouchableOpacity>

      {showQuantity && (
        <View style={styles.detailBox}>
          {/*
            ⚠️ O GÜN VE BUGÜN, HER BİRİ KENDİ GÜNÜNÜN KURUYLA.

            İki dolar fiyatı iki AYRI kurdan hesaplanıyor. Tek kur
            kullansaydık ikisinden biri mutlaka saçmalardı: bugünkü kurla
            12 Mart 2020'nin bitcoin'i 620 dolar çıkardı (gerçeği 4.800).
          */}
          <DetailLine
            label="O günkü fiyat"
            value={
              result.startPriceUsd === null
                ? result.startPriceTry
                : `${result.startPriceTry}  ·  ${result.startPriceUsd} $`
            }
          />

          <DetailLine
            label="Bugünkü fiyat"
            value={
              result.currentPriceUsd === null
                ? result.currentPriceTry
                : `${result.currentPriceTry}  ·  ${result.currentPriceUsd} $`
            }
          />
          <DetailLine label="Yatırılan" value={result.initialInvestmentTry} />
          <DetailLine label="Bugünkü değer" value={result.currentValueTry} />
          <DetailLine label="Nominal kâr" value={result.nominalProfitTry} />

          {result.startUsdTryRate !== null && (
            <Text style={styles.footnote}>
              ⚠️ Her fiyat KENDİ GÜNÜNÜN kuruyla dolara çevrildi:
              {' '}o gün 1 $ = {result.startUsdTryRate}, bugün 1 $ ={' '}
              {result.currentUsdTryRate ?? '—'}. Tek kur kullansaydık
              geçmiş fiyat bambaşka bir sayı gösterirdi.
            </Text>
          )}
        </View>
      )}

      {/* --- alt düğmeler --- */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.secondary}
          onPress={() =>
            void Share.share({
              message:
                `${humanDate(result.startDate)} · ${result.assetName} ` +
                `${formatMultiple(nominalMultiple)} — alım gücünde ` +
                `${formatMultiple(realMultiple)}`,
            })
          }
        >
          <Text style={styles.secondaryText}>Paylaş</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primary} onPress={onAnotherDay}>
          <Text style={styles.primaryText}>Başka gün</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLineKey}>{label}</Text>
      <Text style={styles.detailLineValue}>{value}</Text>
    </View>
  );
}

/**
 * Alan grafiği: varlığın nominal seyri + enflasyon eşiği.
 *
 * ⚠️ İKİ ÇİZGİ AYNI ÖLÇEKTE OLMAK ZORUNDA, yoksa karşılaştırma yalan olur.
 * Her ikisi de BAŞLANGICA GÖRE KAT olarak çiziliyor: varlık için
 * `fiyat(t) ÷ fiyat(0)`, enflasyon için başlangıçtan bugüne doğrusal
 * artan bir çizgi.
 *
 * ⚠️ Enflasyon çizgisi DOĞRUSAL — gerçekte aylık endeksle basamaklı
 * artıyor. Aylık endeksi noktası noktasına çizmek daha doğru olurdu ama
 * TÜFE ayda bir yayımlanıyor; günlük fiyat serisiyle hizalamak ayrı bir
 * iş. Bu bir YAKLAŞIM ve öyle işaretli.
 */
function AreaChart({
  points,
  inflationMultiple,
  amountTry,
}: {
  points: PricePoint[];
  inflationMultiple: number;
  /** Yatırılan tutar — dokunulan andaki değeri hesaplamak için. */
  amountTry: string;
}) {
  const [width, setWidth] = useState(0);

  /** Dokunulan noktanın indisi. `null` = dokunulmuyor. */
  const [active, setActive] = useState<number | null>(null);

  /**
   * ⚠️ NOKTALAR VE GENİŞLİK REF'TE TUTULUYOR.
   *
   * `PanResponder` BİR KEZ kuruluyor ve o andaki değerleri kapanışına
   * hapsediyor. State'i doğrudan okusaydı, yeni bir seri geldiğinde bile
   * eskisine göre hesap yapardı — parmak doğru yerde, okunan sayı yanlış
   * olurdu. Ref her zaman güncel değeri veriyor.
   */
  const pointsRef = useRef(points);
  const widthRef = useRef(width);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    widthRef.current = width;
  }, [width]);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (event) => locate(event.nativeEvent.locationX),
      onPanResponderMove: (event) => locate(event.nativeEvent.locationX),

      // Parmak kalkınca okuma kayboluyor. Kalıcı bırakmak o noktanın
      // "seçili" olduğu izlenimini verirdi; oysa geçici bir bakış.
      onPanResponderRelease: () => setActive(null),
      onPanResponderTerminate: () => setActive(null),
    }),
  ).current;

  function locate(touchX: number) {
    const series = pointsRef.current;
    const w = widthRef.current;

    if (series.length < 2 || w === 0) return;

    /**
     * ⚠️ `Math.round`, `Math.floor` DEĞİL.
     *
     * Floor kullansaydık parmak iki nokta arasındayken hep SOLDAKİNİ
     * seçerdi ve imleç parmağın gerisinde sürüklenirdi. Round en yakını
     * seçiyor, imleç parmakla birlikte yürüyor.
     */
    const index = Math.round((touchX / w) * (series.length - 1));

    setActive(Math.min(Math.max(index, 0), series.length - 1));
  }

  if (points.length < 2 || width === 0) {
    return (
      <View
        style={styles.chartBox}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {points.length < 2 && (
          <Text style={styles.chartEmpty}>Grafik için yeterli veri yok</Text>
        )}
      </View>
    );
  }

  const base = Number(points[0]?.price ?? 0);

  if (!Number.isFinite(base) || base <= 0) {
    return <View style={styles.chartBox} />;
  }

  // Kat cinsinden seri. Piksel geometrisi float — para değil.
  const multiples = points.map((p) => Number(p.price) / base);
  const top = Math.max(...multiples, inflationMultiple) * 1.05;

  const x = (i: number) => (i / (multiples.length - 1)) * width;
  // ⚠️ y TERS ÇEVRİLİYOR: SVG'de y aşağı büyür, fiyat yukarı büyümeli.
  const y = (m: number) => CHART_HEIGHT - (m / top) * CHART_HEIGHT;

  const line = multiples
    .map((m, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(m).toFixed(1)}`)
    .join(' ');

  const area = `${line} L${width},${CHART_HEIGHT} L0,${CHART_HEIGHT} Z`;

  const activeMultiple = active === null ? undefined : multiples[active];
  const activePoint = active === null ? undefined : points[active];

  return (
    <View>
      {/*
        Okuma satırı grafiğin ÜSTÜNDE, içinde değil.

        İçine koysaydık balon parmağın altında kalırdı — kullanıcı okumak
        istediği sayıyı kendi parmağıyla kapatırdı. Sabit bir satır aynı
        bilgiyi hep aynı yerde veriyor.
      */}
      <View style={styles.scrubRow}>
        {activePoint !== undefined && activeMultiple !== undefined ? (
          <>
            <Text style={styles.scrubDate}>
              {humanDate(activePoint.ts.slice(0, 10))}
            </Text>

            <Text style={styles.scrubValue}>
              {formatCentsString(
                // Tutar × kat = o gündeki değer. Tutar tam TL olduğu için
                // kuruşa çevirmek yüzle çarpmak kadar basit.
                String(Math.round(Number(amountTry) * 100 * activeMultiple)),
              )}
            </Text>

            <Text style={styles.scrubMultiple}>
              {formatMultiple(activeMultiple)}
            </Text>
          </>
        ) : (
          <Text style={styles.scrubHint}>
            Grafiğe dokun — o günkü değeri gör
          </Text>
        )}
      </View>

      <View
        style={styles.chartBox}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        {...responder.panHandlers}
      >
        <Svg width={width} height={CHART_HEIGHT}>
          <Defs>
            <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.gain} stopOpacity="0.35" />
              <Stop offset="1" stopColor={colors.gain} stopOpacity="0.02" />
            </LinearGradient>
          </Defs>

          <Path d={area} fill="url(#fill)" />
          <Path d={line} stroke={colors.gain} strokeWidth={2} fill="none" />

          {/* Enflasyon eşiği — kesikli, çünkü bu bir sınır, bir seri değil. */}
          <Line
            x1={0}
            y1={y(1)}
            x2={width}
            y2={y(inflationMultiple)}
            stroke={colors.inkMuted}
            strokeWidth={1.2}
            strokeDasharray="4 4"
          />

          {active !== null && activeMultiple !== undefined && (
            <>
              <Line
                x1={x(active)}
                y1={0}
                x2={x(active)}
                y2={CHART_HEIGHT}
                stroke={colors.inkFaint}
                strokeWidth={1}
              />

              {/* Nokta zemin renginde bir halkayla çevrili: çizginin
                  üstünde durduğu net olsun, içinde kaybolmasın. */}
              <Circle
                cx={x(active)}
                cy={y(activeMultiple)}
                r={5}
                fill={colors.gain}
                stroke={colors.surface}
                strokeWidth={2}
              />
            </>
          )}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.screen, paddingBottom: 40 },

  centered: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  error: { fontFamily: fonts.regular, fontSize: 14, color: colors.error },
  retry: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  retryText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.inkBright },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 17, color: colors.inkBright },
  topTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' },
  topTitleText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },

  hero: { alignItems: 'center', marginTop: 26 },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10 },
  heroValue: {
    fontFamily: fonts.bold,
    fontSize: 64,
    color: colors.ink,
    letterSpacing: -3,
    lineHeight: 70,
  },
  heroTimes: { fontFamily: fonts.semibold, fontSize: 26, color: colors.inkFaint },
  heroSub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.inkMuted,
    marginTop: 10,
  },
  heroSubStrong: { fontFamily: fonts.monoBold, color: colors.ink },

  mathBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  mathCell: { flex: 1, alignItems: 'center', gap: 5 },
  mathValue: { fontFamily: fonts.monoBold, fontSize: 19, color: colors.ink },
  mathLabel: {
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 1.2,
    color: colors.inkFaint,
  },
  mathOperator: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkDisabled },

  mathNote: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: 14,
  },

  chartBox: {
    height: CHART_HEIGHT,
    marginTop: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartEmpty: { fontFamily: fonts.regular, fontSize: 12, color: colors.inkFaint },

  scrubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    // Sabit yükseklik: okuma çıkıp kaybolurken grafik zıplamasın.
    minHeight: 20,
  },
  scrubDate: { fontFamily: fonts.mono, fontSize: 12, color: colors.inkMuted },
  scrubValue: {
    flex: 1,
    fontFamily: fonts.monoSemibold,
    fontSize: 13,
    color: colors.ink,
  },
  scrubMultiple: {
    fontFamily: fonts.monoSemibold,
    fontSize: 13,
    color: colors.gain,
  },
  scrubHint: { fontFamily: fonts.regular, fontSize: 11, color: colors.inkFaint },

  legend: { flexDirection: 'row', gap: 18, marginTop: 12, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendLine: { width: 16, height: 2, borderRadius: 1 },
  legendDashed: { backgroundColor: colors.inkMuted, opacity: 0.6 },
  legendText: { fontFamily: fonts.regular, fontSize: 11, color: colors.inkFaint },

  compare: { marginTop: 26 },
  compareHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  compareUnit: { fontFamily: fonts.regular, fontSize: 10, color: colors.inkFaint },

  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  barInflation: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  barName: { width: 88, fontFamily: fonts.semibold, fontSize: 12, color: colors.ink },
  barTrack: {
    flex: 1,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 5 },
  barValue: {
    width: 54,
    textAlign: 'right',
    fontFamily: fonts.monoBold,
    fontSize: 12,
    color: colors.gain,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 22,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailKey: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted },
  detailValue: { fontFamily: fonts.mono, fontSize: 12, color: colors.inkBright },
  detailCaret: { fontSize: 13, color: colors.inkFaint },

  detailBox: {
    backgroundColor: colors.surfaceSunken,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  detailLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  detailLineKey: { fontFamily: fonts.regular, fontSize: 12, color: colors.inkMuted },
  detailLineValue: { fontFamily: fonts.monoSemibold, fontSize: 12, color: colors.inkBright },
  footnote: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
    color: colors.inkFaint,
    marginTop: 6,
  },

  actions: { flexDirection: 'row', gap: 10, marginTop: 26 },
  secondary: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.inkBright },
  primary: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.inverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.onInverse },
});
