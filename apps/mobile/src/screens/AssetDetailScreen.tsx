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

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await apiFetch<SeriesResponse>(
        `/assets/${symbol}/prices?range=${range}`,
      );
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Grafik yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [symbol, range]);

  useEffect(() => {
    void load();
  }, [load]);

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
      <ScrollView contentContainerStyle={styles.content}>
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
                { color: rising ? '#43b56f' : '#ec3013' },
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
              <ActivityIndicator color="#10B981" />
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
            />
          )}
        </View>

        <Text style={styles.hint}>
          Grafiğe dokunup parmağınızı kaydırarak o andaki fiyatı görebilirsiniz.
        </Text>

        {/* Aralık seçici */}
        <View style={styles.rangeRow}>
          {RANGES.map((r) => (
            <Pressable
              key={r.value}
              onPress={() => setRange(r.value)}
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

        <Pressable style={styles.tradeButton} onPress={onTrade}>
          <Text style={styles.tradeButtonText}>Al / Sat</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B132B' },
  content: { padding: 20, paddingBottom: 40 },

  header: { gap: 8, marginBottom: 16 },
  back: { color: '#10B981', fontSize: 15, fontWeight: '600' },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' },

  priceBlock: { marginBottom: 12 },
  price: { color: '#FFFFFF', fontSize: 30, fontWeight: 'bold' },
  change: { fontSize: 15, fontWeight: '600', marginTop: 2 },
  changeLabel: { color: '#64748B', fontWeight: '400', fontSize: 13 },
  asOf: { color: '#64748B', fontSize: 12, marginTop: 2 },

  chartBox: { marginVertical: 8 },
  chartPlaceholder: {
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { color: '#F87171', fontSize: 13 },

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
    backgroundColor: '#1C2541',
  },
  rangeButtonActive: { backgroundColor: '#10B981' },
  rangeText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  rangeTextActive: { color: '#FFFFFF' },

  hint: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  sparse: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 14,
  },

  tradeButton: {
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  tradeButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: 'bold' },
});
