import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiFetch } from '../api/client';
import { Calendar } from '../components/Calendar';
import { AssetBadge, Chip, SectionLabel } from '../components/DesignKit';
import { WhatIfResultScreen } from './WhatIfResultScreen';
import { colors, fonts, spacing } from '../theme';

/**
 * WhatIfScreen — `docs/export/7a (1).png` sol ekran.
 *
 * Tasarımın iki büyük fikri var:
 *
 * 1. **Ekran bir form değil, bir CÜMLE.**
 *    "10.000 ₺"yi "12 Mart 2020"de hangi varlığa koysaydım?
 *    Altı çizili iki parça dokunulabilir. Etiketli kutular aynı bilgiyi
 *    toplardı ama kullanıcı ne SORDUĞUNU değil neyi doldurduğunu görürdü.
 *
 * 2. **Cevap listede, sonuçta değil.**
 *    Her varlığın yanında "kaç kat arttığı" yazıyor. Kullanıcı hesapla
 *    demeden önce cevabı görüyor; "hesapla" artık ayrıntıya geçiş.
 *
 * ⚠️ VE LİSTENİN ORTASINDAN BİR ÇİZGİ GEÇİYOR: ENFLASYON EŞİĞİ.
 * Üstündekiler alım gücü kazandırmış, altındakiler nominal olarak
 * kazandırmış görünüp gerçekte KAYBETTİRMİŞTİR. Bu çizgi olmadan
 * "13 kat arttı" gurur verici bir sayı; çizgiyle birlikte 9,1 katlık
 * enflasyonun ancak biraz üstünde olduğu görünüyor.
 */

type Multiple = {
  symbol: string;
  name: string;
  kind: string;
  multiple: number;
  realMultiple: number;
  startPriceTry: string;
  currentPriceTry: string;
};

type MultiplesResponse = {
  date: string;
  inflationMultiple: number;
  tufeStartMonth: string;
  tufeEndMonth: string;
  assets: Multiple[];
};

type Asset = {
  symbol: string;
  name: string;
  kind: string;
  firstAvailable: string | null;
};

/** Hazır tutarlar — tasarımdaki dört düğme. */
const AMOUNTS = ['1000', '5000', '10000', '50000'] as const;

/**
 * Hazır tarihler — gerçek olaylara denk geliyor.
 *
 * Rastgele tarihler seçseydik sonuçlar "ilginç" olmazdı. Kat değerleri
 * sunucudan geliyor, koda gömülmüyor: piyasa değiştikçe rakam da değişir.
 */
const EVENTS = [
  { date: '2020-03-12', label: 'Pandemi dibi' },
  { date: '2021-11-10', label: 'Kasım zirvesi' },
  { date: '2023-01-02', label: '2023 dibi' },
] as const;

const KINDS = [
  { key: 'all', label: 'Tümü' },
  { key: 'crypto', label: 'Kripto' },
  { key: 'fx', label: 'Döviz' },
  { key: 'metal', label: 'Metal' },
] as const;

const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
] as const;

function humanDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${Number(d)} ${MONTH_NAMES[Number(m) - 1] ?? m} ${y}`;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** 104.3 -> "104×" · 12.83 -> "12,8×" — büyük sayıda ondalık gereksiz. */
export function formatMultiple(value: number): string {
  if (value >= 100) return `${Math.round(value)}×`;
  return `${value.toFixed(1).replace('.', ',')}×`;
}

export function WhatIfScreen() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [symbol, setSymbol] = useState('BTC');
  const [date, setDate] = useState('2020-03-12');
  const [amount, setAmount] = useState('10000');
  const [kind, setKind] = useState<string>('all');

  const [multiples, setMultiples] = useState<MultiplesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Sonuç ekranı açıksa hangi varlık için. `null` = kapalı. */
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    apiFetch<{ assets: Asset[] }>('/assets')
      .then((data) => setAssets(data.assets))
      .catch(() => setAssets([]));
  }, []);

  /**
   * Kat listesi tarih değişince yeniden çekiliyor — tutar değişince DEĞİL.
   *
   * Kat, tutardan bağımsız: 1.000 ₺ de 50.000 ₺ de aynı oranda artar.
   * Tutara bağlasaydık her düğmeye dokunuşta 20 varlıklık sorgu tekrarlanırdı.
   */
  const loadMultiples = useCallback(async (forDate: string) => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<MultiplesResponse>(
        `/what-if/multiples?date=${forDate}`,
      );
      setMultiples(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kat listesi alınamadı.');
      setMultiples(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMultiples(date);
  }, [date, loadMultiples]);

  const asset = useMemo(
    () => assets.find((a) => a.symbol === symbol) ?? null,
    [assets, symbol],
  );

  const minDate = asset?.firstAvailable?.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  /**
   * Varlık değişince seçili tarih sınırın dışında kalabilir.
   * Sessizce bırakırsak sorgu hata döner ve kullanıcı nedenini anlamaz.
   */
  useEffect(() => {
    if (minDate !== undefined && date < minDate) {
      setDate(minDate);
      setNotice(
        `${symbol} verisi ${humanDate(minDate)} tarihinde başlıyor, tarih oraya çekildi.`,
      );
    }
  }, [minDate, date, symbol]);

  /** Görünen liste — tür filtresi uygulanmış, kata göre sıralı (sunucudan). */
  const visible = useMemo(() => {
    const list = multiples?.assets ?? [];
    return kind === 'all' ? list : list.filter((a) => a.kind === kind);
  }, [multiples, kind]);

  const inflation = multiples?.inflationMultiple ?? null;

  /** Özel gün düğmelerinin kat değerleri — seçili varlık için. */
  const selectedMultiple = visible.find((a) => a.symbol === symbol) ?? null;

  const selectedName =
    selectedMultiple?.name ?? asset?.name ?? symbol;

  if (showResult) {
    return (
      <WhatIfResultScreen
        symbol={symbol}
        date={date}
        amountTry={amount}
        onBack={() => setShowResult(false)}
        onAnotherDay={() => setShowResult(false)}
      />
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionLabel>YA ALSAYDIN</SectionLabel>

      {/* --- soru cümlesi --- */}
      <Text style={styles.question}>
        <Text style={styles.underlined}>{groupThousands(amount)} ₺</Text>
        <Text>'yi </Text>
        <Text style={styles.underlined}>{humanDate(date)}</Text>
        <Text>'de{'\n'}hangi varlığa koysaydım?</Text>
      </Text>

      {/* --- özel günler --- */}
      <View style={styles.block}>
        <SectionLabel>ÖZEL GÜNLER</SectionLabel>

        <View style={styles.eventGrid}>
          {[
            ...EVENTS,
            // "En eski gün" hazır tarih değil, varlığın kendi başlangıcı.
            ...(minDate !== undefined
              ? [{ date: minDate, label: 'En eski gün' } as const]
              : []),
          ].map((event) => {
            const blocked = minDate !== undefined && event.date < minDate;
            const on = date === event.date;

            return (
              <TouchableOpacity
                key={event.label}
                style={[styles.eventChip, on && styles.eventChipOn]}
                onPress={() => {
                  if (blocked) {
                    setNotice(
                      `${symbol} verisi ${humanDate(minDate)} tarihinde başlıyor — ${event.label} daha eski.`,
                    );
                    return;
                  }
                  setNotice(null);
                  setDate(event.date);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.eventLabel, on && styles.eventLabelOn]}>
                  {event.label}
                </Text>

                {/*
                  ⚠️ KAT DEĞERİ SEÇİLİ GÜN İÇİN GEÇERLİ, düğmenin kendi
                  günü için değil. Her düğme için ayrı sorgu atmak dört
                  kat maliyet demekti; sadece seçili olanda gösteriyoruz.
                */}
                {on && selectedMultiple !== null && (
                  <Text style={[styles.eventMultiple, on && styles.eventMultipleOn]}>
                    {formatMultiple(selectedMultiple.multiple)}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* --- takvim --- */}
      <View style={styles.block}>
        <Calendar
          value={date}
          onChange={(iso) => {
            setNotice(null);
            setDate(iso);
          }}
          min={minDate}
          max={today}
          onRejected={(iso, reason) =>
            setNotice(
              reason === 'early'
                ? `${symbol} için ${humanDate(iso)} tarihinde veri yok — en eskisi ${minDate === undefined ? '?' : humanDate(minDate)}.`
                : 'Gelecekteki bir tarih seçilemez.',
            )
          }
        />
      </View>

      {/* --- tutar --- */}
      <View style={styles.amountRow}>
        {AMOUNTS.map((value) => {
          const on = value === amount;

          return (
            <TouchableOpacity
              key={value}
              style={[styles.amountButton, on && styles.amountButtonOn]}
              onPress={() => setAmount(value)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.amountText, on && styles.amountTextOn]}>
                {groupThousands(value)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* --- tür filtresi + sıralama başlığı --- */}
      <View style={styles.filterRow}>
        <View style={styles.chipRow}>
          {KINDS.map((item) => (
            <Chip
              key={item.key}
              label={item.label}
              selected={kind === item.key}
              onPress={() => setKind(item.key)}
            />
          ))}
        </View>

        <Text style={styles.sortLabel}>KAT ⌄</Text>
      </View>

      {notice !== null && <Text style={styles.notice}>{notice}</Text>}
      {error !== null && <Text style={styles.error}>{error}</Text>}

      {/* --- varlık listesi + enflasyon eşiği --- */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.inkMuted} />
        </View>
      ) : (
        <View style={styles.list}>
          {visible.map((item, index) => {
            const previous = visible[index - 1];

            /**
             * Enflasyon çizgisi TAM BURAYA mı düşüyor?
             *
             * Liste büyükten küçüğe sıralı. Çizgi, katı enflasyonun
             * üstünde olan son varlıkla altında olan ilk varlığın ARASINA
             * giriyor. Sabit bir konuma koysaydık sıralama değiştiğinde
             * yanlış yerde kalırdı.
             */
            const crossesHere =
              inflation !== null &&
              item.multiple < inflation &&
              (previous === undefined || previous.multiple >= inflation);

            const on = item.symbol === symbol;

            return (
              <View key={item.symbol}>
                {crossesHere && (
                  <View style={styles.threshold}>
                    <Text style={styles.thresholdLabel}>ENFLASYON EŞİĞİ</Text>
                    <View style={styles.thresholdLine} />
                    <Text style={styles.thresholdValue}>
                      {formatMultiple(inflation)}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.row, on && styles.rowOn]}
                  onPress={() => setSymbol(item.symbol)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <AssetBadge symbol={item.symbol} />

                  <View style={styles.rowNames}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {item.symbol} · {item.kind}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.rowMultiple,
                      {
                        // Enflasyonun altında kalan kat YEŞİL DEĞİL.
                        // Nominal artış var ama alım gücü kaybı var.
                        color:
                          inflation !== null && item.multiple < inflation
                            ? colors.inkMuted
                            : colors.gain,
                      },
                    ]}
                  >
                    {formatMultiple(item.multiple)}
                  </Text>

                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* --- dinamik buton --- */}
      <TouchableOpacity
        style={styles.cta}
        onPress={() => setShowResult(true)}
        disabled={loading}
        accessibilityRole="button"
      >
        <Text style={styles.ctaText}>{selectedName}'i gör →</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: 20,
    paddingBottom: 32,
  },

  question: {
    fontFamily: fonts.semibold,
    fontSize: 21,
    lineHeight: 31,
    color: colors.inkFaint,
    marginTop: 9,
    letterSpacing: -0.2,
  },
  underlined: {
    fontFamily: fonts.bold,
    color: colors.ink,
    textDecorationLine: 'underline',
  },

  block: { marginTop: 20, gap: 10 },

  eventGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  eventChip: {
    // İki sütunlu ızgara: `%50 − yarım boşluk`.
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eventChipOn: { backgroundColor: colors.inverse, borderColor: colors.inverse },
  eventLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.inkBright },
  eventLabelOn: { fontFamily: fonts.bold, color: colors.onInverse },
  eventMultiple: { fontFamily: fonts.monoSemibold, fontSize: 11, color: colors.inkFaint },
  eventMultipleOn: { fontFamily: fonts.monoBold, color: colors.onInverse },

  amountRow: { flexDirection: 'row', gap: 7, marginTop: 10 },
  amountButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amountButtonOn: { backgroundColor: colors.inverse, borderColor: colors.inverse },
  amountText: { fontFamily: fonts.monoSemibold, fontSize: 11, color: colors.inkMuted },
  amountTextOn: { fontFamily: fonts.monoBold, color: colors.onInverse },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  chipRow: { flexDirection: 'row', gap: 6, flex: 1 },
  sortLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.inkFaint,
  },

  notice: { fontFamily: fonts.regular, fontSize: 12, color: colors.warn, marginTop: 12 },
  error: { fontFamily: fonts.regular, fontSize: 12, color: colors.error, marginTop: 12 },

  loadingBox: { paddingVertical: 40, alignItems: 'center' },

  list: { marginTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowOn: { backgroundColor: colors.surfaceRaised },
  rowNames: { flex: 1 },
  rowName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  rowMeta: { fontFamily: fonts.mono, fontSize: 11, color: colors.inkFaint, marginTop: 2 },
  rowMultiple: { fontFamily: fonts.monoBold, fontSize: 15 },
  chevron: { fontSize: 17, color: colors.inkDisabled },

  threshold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  thresholdLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.loss,
  },
  // Kesikli çizgi: RN'de `borderStyle: 'dashed'` tek kenarda güvenilir
  // değil, o yüzden ince bir çizgi + düşük opaklık.
  thresholdLine: { flex: 1, height: 1, backgroundColor: colors.loss, opacity: 0.45 },
  thresholdValue: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.loss },

  cta: {
    marginTop: 24,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.inverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontFamily: fonts.semibold, fontSize: 17, color: colors.onInverse },
});
