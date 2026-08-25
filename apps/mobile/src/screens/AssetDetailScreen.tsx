/**
 * AssetDetailScreen — bir varlığın fiyat grafiği ve geçmişi.
 *
 * Piyasa listesinden bir satıra dokununca açılır. Buradan Al/Sat ekranına
 * geçilir; yani akış: liste -> detay -> emir.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { apiFetch } from '../api/client';
import {
  formatChartDate,
  PriceChart,
  type ChartPoint,
} from '../components/PriceChart';
import { formatPrice, formatRelativeTime } from '../lib/format';
import { colors, fonts } from '../theme';

type Props = {
  symbol: string;
  name: string;
  onClose: () => void;
  onTrade: () => void;
};

type SeriesResponse = {
  symbol: string;
  name: string;
  range: string;
  bucketSeconds: number;
  points: ChartPoint[];
};

/**
 * Aralık düğmeleri.
 *
 * Etiketler Türkçe kısaltma, değerler sunucunun beklediği kodlar.
 * İkisini ayrı tutmak şart: etiketi değiştirmek istediğimizde API
 * sözleşmesine dokunmak zorunda kalmayalım.
 */
const RANGES = [
  { value: '1d', label: '1G' },
  { value: '1w', label: '1H' },
  { value: '1m', label: '1A' },
  { value: '3m', label: '3A' },
  { value: '1y', label: '1Y' },
  { value: 'max', label: 'Tümü' },
] as const;

type RangeValue = (typeof RANGES)[number]['value'];

/** Grafik ekran genişliğinden kenar boşlukları düşülerek hesaplanıyor. */
const CHART_WIDTH = Dimensions.get('window').width - 40;
// Eksenler (altta 22px zaman, sağda 62px fiyat) yer kaplıyor;
// çizim alanı eskisi kadar kalsın diye yükseklik artırıldı.
const CHART_HEIGHT = 250;

export function AssetDetailScreen({ symbol, name, onClose, onTrade }: Props) {
  const [range, setRange] = useState<RangeValue>('1m');
  const [data, setData] = useState<SeriesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /**
   * Grafikte dokunulan nokta. `null` = dokunulmuyor.
   *
   * Başlıktaki büyük fiyat bunu takip ediyor: parmak grafiğin üstündeyken
   * o anın fiyatını, bırakınca güncel fiyatı gösteriyor. Okuma kutusu
   * grafiğin içinde zaten var; başlığın da değişmesi "hangi ana bakıyorum"
   * sorusunu tek yerde cevaplıyor.
   */
  const [scrubbed, setScrubbed] = useState<ChartPoint | null>(null);

  /**
   * Yakınlaştırma penceresi. `null` = yakınlaştırma yok, `range` geçerli.
   *
   * ⚠️ AYRI BİR STATE, `range`'İN YERİNE GEÇMİYOR.
   * Kullanıcı bir aralık düğmesine bastığında pencere sıfırlanıyor;
   * yakınlaştırdığında düğme seçili kalıyor ama sorgu pencereden gidiyor.
   * İkisini tek state'te birleştirseydik "şu an hangisi geçerli" sorusu
   * her okumada yeniden sorulurdu.
   */
  const [zoom, setZoom] = useState<{ from: Date; to: Date } | null>(null);

  /** Son 24 saatin özeti — `GET /assets/:symbol/stats`. */
  const [stats, setStats] = useState<{
    high: string | null;
    low: string | null;
    open: string | null;
    close: string | null;
    volume: string | null;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      // Yakınlaştırılmışsa serbest pencere, değilse sabit aralık.
      // Sunucu pencere genişliğine göre kova boyutunu kendisi seçiyor.
      const query =
        zoom !== null
          ? `from=${zoom.from.toISOString()}&to=${zoom.to.toISOString()}`
          : `range=${range}`;

      const res = await apiFetch<SeriesResponse>(
        `/assets/${symbol}/prices?${query}`,
      );
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Grafik yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [symbol, range, zoom]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * ⚠️ FİYAT BURADA CANLI DEĞİLDİ — bildirilen hata buydu.
   *
   * Piyasa listesi 5 saniyede bir tazeleniyordu ama bu ekran bir kez
   * çekip bırakıyordu. Kullanıcı listede fiyatın oynadığını görüp
   * detaya girince donmuş bir sayıyla kalıyordu.
   *
   * ⚠️ YAKINLAŞTIRMA VARKEN TAZELEME YOK. Kullanıcı belirli bir pencereye
   * bakıyorsa altından veriyi çekmek grafiği zıplatır — incelediği yeri
   * kaybeder. Sabit aralıktayken tazeleniyor, yakınlaştırmada duruyor.
   */
  useEffect(() => {
    if (zoom !== null) return;

    const timer = setInterval(() => void load(), 5_000);
    return () => clearInterval(timer);
  }, [load, zoom]);

  /**
   * 24 saat özeti — aralık değişince DEĞİL, varlık değişince çekiliyor.
   *
   * "Son 24 saat" seçili aralıktan bağımsız bir bilgi: kullanıcı 1 yıllık
   * grafiğe baksa da günün en yükseği aynı sayı.
   */
  useEffect(() => {
    let cancelled = false;

    apiFetch<{
      high: string | null;
      low: string | null;
      open: string | null;
      close: string | null;
      volume: string | null;
    }>(`/assets/${symbol}/stats`)
      .then((res) => {
        if (!cancelled) setStats(res);
      })
      // Özet alınamazsa ekran çalışmaya devam etsin — grafik asıl içerik.
      .catch(() => {
        if (!cancelled) setStats(null);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const points = data?.points ?? [];
  const last = points[points.length - 1];
  const first = points[0];

  /**
   * Aralık boyunca yüzde değişim.
   *
   * ⚠️ BURADA FLOAT KULLANILIYOR VE BU BİLİNÇLİ.
   * Gösterilen şey para değil, bir ORAN — "%12,4" yazısında son basamağın
   * kuruş karşılığı yok. Para değeri olsaydı (kâr/zarar tutarı gibi)
   * bigint zorunlu olurdu; nitekim PortfolioScreen'de öyle yapılıyor.
   */
  const changePercent =
    first !== undefined && last !== undefined
      ? ((Number(last.priceTry) - Number(first.priceTry)) /
          Number(first.priceTry)) *
        100
      : null;

  const rising = changePercent !== null && changePercent >= 0;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Başlık */}
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.back}>‹ Geri</Text>
          </Pressable>
          <Text style={styles.title}>
            {name} ({symbol})
          </Text>
        </View>

        {/* Güncel fiyat ve değişim */}
        <View style={styles.priceBlock}>
          <Text style={styles.price}>
            {scrubbed !== null
              ? formatPrice(scrubbed.priceTry)
              : last !== undefined
                ? formatPrice(last.priceTry)
                : '—'}
          </Text>
          {changePercent !== null && (
            <Text
              style={[
                styles.change,
                { color: rising ? colors.gain : colors.accent },
              ]}
            >
              {/* Gerçek eksi işareti değil normal işaret: burada hizalama
                  değil okunabilirlik önemli. */}
              {rising ? '+' : ''}
              {changePercent.toFixed(2).replace('.', ',')}%{' '}
              <Text style={styles.changeLabel}>
                ({RANGES.find((r) => r.value === range)?.label})
              </Text>
            </Text>
          )}
          {scrubbed !== null ? (
            <Text style={styles.asOf}>{formatChartDate(scrubbed.ts)}</Text>
          ) : last !== undefined ? (
            <Text style={styles.asOf}>{formatRelativeTime(last.ts)}</Text>
          ) : null}
        </View>

        {/* Grafik */}
        <View style={styles.chartBox}>
          {loading ? (
            <View style={styles.chartPlaceholder}>
              <ActivityIndicator color={colors.gain} />
            </View>
          ) : error !== '' ? (
            <View style={styles.chartPlaceholder}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : (
            <PriceChart
              points={points}
              width={CHART_WIDTH}
              height={CHART_HEIGHT}
              // Zaman etiketlerinin biçimi buna göre seçiliyor:
              // saatlik kovada "14:30", günlükte "12 Ara".
              bucketSeconds={data?.bucketSeconds ?? 86400}
              onScrub={setScrubbed}
              onZoom={setZoom}
            />
          )}
        </View>

        <View style={styles.hintRow}>
          <Text style={styles.hint}>
            Dokunup kaydır: fiyat oku · İki parmakla sıkıştır: yakınlaştır
          </Text>

          {zoom !== null && (
            <Pressable onPress={() => setZoom(null)} hitSlop={8}>
              <Text style={styles.reset}>Sıfırla</Text>
            </Pressable>
          )}
        </View>

        {/*
          Yakınlaştırılmışken hangi pencerede olduğumuzu yazıyoruz.
          Aralık düğmesi hâlâ seçili görünüyor ama sorgu ondan gitmiyor —
          bunu söylemezsek kullanıcı "1A yazıyor ama bir ay göstermiyor"
          diye haklı olarak şaşırır.
        */}
        {zoom !== null && (
          <Text style={styles.zoomInfo}>
            🔍 Yakınlaştırılmış: {formatChartDate(zoom.from.toISOString())}
            {' → '}
            {formatChartDate(zoom.to.toISOString())}
          </Text>
        )}

        {/* Aralık seçici */}
        <View style={styles.rangeRow}>
          {RANGES.map((r) => (
            <Pressable
              key={r.value}
              onPress={() => {
                setRange(r.value);
                // Aralık seçmek yakınlaştırmayı iptal eder — aksi hâlde
                // düğmeye basıp hiçbir şeyin değişmediğini görürdü.
                setZoom(null);
              }}
              style={[
                styles.rangeButton,
                range === r.value && styles.rangeButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.rangeText,
                  range === r.value && styles.rangeTextActive,
                ]}
              >
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/*
          ⚠️ SEYREK VERİ UYARISI.
          15 saniyelik cron yalnızca çalıştığı andan itibaren yazıyor;
          öncesi için elimizde günlük geri doldurma var. Yani kısa aralıklar
          beklenenden az nokta döndürebilir. Bunu söylemezsek kullanıcı
          "grafik bozuk" sanır — oysa veri gerçekten o kadar.
        */}
        {!loading && error === '' && points.length > 0 && points.length < 20 && (
          <Text style={styles.sparse}>
            Bu aralıkta {points.length} veri noktası var. Kısa aralıklarda
            geçmiş veri henüz seyrek.
          </Text>
        )}

        {/* --- 24 saat özeti --- */}
        {stats !== null && stats.high !== null && (
          <View style={styles.statsBlock}>
            <Text style={styles.statsTitle}>24 SAAT</Text>

            <StatLine label="Yüksek" value={formatPrice(stats.high)} />
            {stats.low !== null && (
              <StatLine label="Düşük" value={formatPrice(stats.low)} />
            )}
            {stats.open !== null && (
              <StatLine label="Açılış" value={formatPrice(stats.open)} />
            )}
            {stats.close !== null && (
              <StatLine label="Kapanış" value={formatPrice(stats.close)} />
            )}

            {/*
              ⚠️ HACİM SAKLANMIYOR — bu satır bilerek burada.
              Binance mumlarında hacim var ama `price_history`'de kolonu
              yok. Satırı hiç göstermeseydik eksik olduğu unutulurdu;
              "—" göstermek eksiği görünür tutuyor.
            */}
            <StatLine label="Hacim" value={stats.volume ?? '—'} />
          </View>
        )}

        <Pressable style={styles.tradeButton} onPress={onTrade}>
          <Text style={styles.tradeButtonText}>Al / Sat</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/** 24 saat bloğundaki tek satır. */
function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statLine}>
      <Text style={styles.statKey}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statsBlock: {
    marginTop: 22,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 14,
  },
  statsTitle: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.inkFaint,
    marginBottom: 6,
  },
  statLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statKey: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted },
  statValue: { fontFamily: fonts.monoSemibold, fontSize: 13, color: colors.ink },

  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 20, paddingBottom: 40 },

  header: { gap: 8, marginBottom: 16 },
  back: { color: colors.gain, fontSize: 15, fontFamily: fonts.semibold },
  title: { color: colors.ink, fontSize: 22, fontFamily: fonts.bold },

  priceBlock: { marginBottom: 12 },
  price: { color: colors.ink, fontSize: 30, fontFamily: fonts.bold },
  change: { fontSize: 15, fontFamily: fonts.semibold, marginTop: 2 },
  changeLabel: { color: colors.inkFaint, fontFamily: fonts.regular, fontSize: 13 },
  asOf: { color: colors.inkFaint, fontSize: 12, marginTop: 2 },

  chartBox: { marginVertical: 8 },
  chartPlaceholder: {
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { color: colors.error, fontSize: 13 },

  rangeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
  },
  rangeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: colors.fieldFill,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
  },
  rangeButtonActive: { backgroundColor: colors.gain },
  rangeText: { color: colors.inkMuted, fontSize: 12, fontFamily: fonts.semibold },
  rangeTextActive: { color: colors.ink },

  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 6,
  },
  reset: {
    color: colors.gain,
    fontSize: 11,
    fontFamily: fonts.semibold,
  },
  zoomInfo: {
    color: colors.inkMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  hint: {
    color: colors.inkFaint,
    fontSize: 11,
    textAlign: 'center',
  },
  sparse: {
    color: colors.inkFaint,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 14,
  },

  tradeButton: {
    backgroundColor: colors.gain,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  tradeButtonText: { color: colors.ink, fontSize: 17, fontFamily: fonts.bold },
});
