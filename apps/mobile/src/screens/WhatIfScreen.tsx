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
import { colors, fonts, spacing } from '../theme';

/**
 * WhatIfScreen — `docs/export/7a-varlik-secimi.html`
 *
 * Tasarımın açılış hamlesi ekranı bir FORM olmaktan çıkarıp bir CÜMLE
 * yapmak:
 *
 *     "10.000 ₺"yi "12 Mart 2020"de hangi varlığa koysaydım?
 *
 * Altı çizili iki parça dokunulabilir. Etiketli giriş kutuları da aynı
 * bilgiyi toplardı ama kullanıcı ne sorduğunu değil neyi doldurduğunu
 * görürdü. Cümle sorunun kendisini gösteriyor.
 */

type WhatIfResult = {
  symbol: string;
  assetName: string;
  startDate: string;
  startPriceTry: string;
  /** O günün fiyatının dolar karşılığı. `null` = USD serisi o kadar geriye gitmiyor. */
  startPriceUsd: string | null;
  /** Çevrimde kullanılan O GÜNKÜ kur. */
  startUsdTryRate: string | null;
  currentDate: string;
  currentPriceTry: string;
  purchasedQuantity: string;
  initialInvestmentTry: string;
  currentValueTry: string;
  nominalProfitTry: string;
  nominalReturnPercentFormatted: string;
  cumulativeInflationPercentFormatted: string;
  realReturnPercentFormatted: string;
  tufeStartMonth: string;
  tufeEndMonth: string;
  summary: string;
};

type Asset = {
  symbol: string;
  name: string;
  kind?: string;
  /** Bu varlığın en eski fiyat kaydı — takvimin alt sınırı. */
  firstAvailable: string | null;
};

/** Hazır tutarlar — tasarımdaki dört düğme. */
const AMOUNTS = ['1000', '5000', '10000', '50000'] as const;

/**
 * Hazır tarihler.
 *
 * ⚠️ TARİHLER GERÇEK OLAYLARA DENK GELİYOR ve bu ekranın anlattığı hikâye
 * bu. Rastgele tarihler seçseydik sonuçlar "ilginç" olmazdı.
 *   2020-03-12  Kara Perşembe, kriptonun pandemi dibi
 *   2021-11-10  BTC'nin tarihi zirvesi
 *   2022-11-09  FTX çöküşü
 */
const EVENTS = [
  { date: '2020-03-12', label: 'Pandemi dibi' },
  { date: '2021-11-10', label: 'Kasım zirvesi' },
  { date: '2022-11-09', label: 'FTX çöküşü' },
] as const;

/** "2020-03-12" -> "12 Mart 2020" */
const MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
] as const;

function humanDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const monthIndex = Number(m) - 1;
  return `${Number(d)} ${MONTH_NAMES[monthIndex] ?? m} ${y}`;
}

/** "10000" -> "10.000" */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function WhatIfScreen() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [symbol, setSymbol] = useState('BTC');
  const [date, setDate] = useState('2020-03-12');
  const [amount, setAmount] = useState('10000');

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ assets: Asset[] }>('/assets')
      .then((data) => setAssets(data.assets))
      .catch(() => setAssets([]));
  }, []);

  const asset = useMemo(
    () => assets.find((a) => a.symbol === symbol) ?? null,
    [assets, symbol],
  );

  /** Takvimin alt sınırı — bu varlığın ilk fiyat kaydı. */
  const minDate = asset?.firstAvailable?.slice(0, 10);

  /** Üst sınır bugün. Gelecekte bir tarih seçmenin anlamı yok. */
  const today = new Date().toISOString().slice(0, 10);

  /**
   * Varlık değişince seçili tarih sınırın dışında kalabilir.
   *
   * ⚠️ Kullanıcı BTC'de 2018'i seçip SOL'e geçerse tarih artık geçersiz.
   * Sessizce bırakırsak sorgu hata döner ve kullanıcı neden olduğunu
   * anlamaz — tarihi sınıra ÇEKİP söylüyoruz.
   */
  useEffect(() => {
    if (minDate !== undefined && date < minDate) {
      setDate(minDate);
      setNotice(
        `${symbol} verisi ${humanDate(minDate)} tarihinde başlıyor, tarih oraya çekildi.`,
      );
    }
  }, [minDate, date, symbol]);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      // ⚠️ Kuruş çevrimi: tutar tam sayı TL olarak tutuluyor, ondalık yok.
      // Hazır düğmeler ve elle giriş hep tam TL — `Number` burada güvenli.
      const amountKurus = `${amount}00`;

      const data = await apiFetch<WhatIfResult>(
        `/what-if?symbol=${symbol}&date=${date}&amountKurus=${amountKurus}`,
      );

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hesaplanamadı.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [symbol, date, amount]);

  const gaining = !result?.nominalProfitTry.startsWith('-');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SectionLabel>YA ALSAYDIN</SectionLabel>

      {/* --- soru cümlesi --- */}
      <Text style={styles.question}>
        <Text
          style={styles.underlined}
          onPress={() => setCalendarOpen(false)}
        >
          {groupThousands(amount)} ₺
        </Text>
        <Text>'yi </Text>
        <Text
          style={styles.underlined}
          onPress={() => setCalendarOpen((open) => !open)}
        >
          {humanDate(date)}
        </Text>
        <Text>'de{'\n'}hangi varlığa koysaydım?</Text>
      </Text>

      {/* --- özel günler --- */}
      <View style={styles.block}>
        <SectionLabel>ÖZEL GÜNLER</SectionLabel>

        <View style={styles.chipWrap}>
          {EVENTS.map((event) => {
            // Varlığın verisi o tarihe gitmiyorsa düğme kapalı.
            const blocked = minDate !== undefined && event.date < minDate;

            return (
              <Chip
                key={event.date}
                label={event.label}
                selected={date === event.date}
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
              />
            );
          })}
        </View>
      </View>

      {/* --- takvim --- */}
      <View style={styles.block}>
        <TouchableOpacity
          style={styles.calendarToggle}
          onPress={() => setCalendarOpen((open) => !open)}
        >
          <Text style={styles.calendarToggleText}>
            {calendarOpen ? 'Takvimi kapat' : 'Takvimden seç'}
          </Text>
        </TouchableOpacity>

        {calendarOpen && (
          <View style={styles.calendarBox}>
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
        )}
      </View>

      {/* --- tutar --- */}
      <View style={styles.block}>
        <SectionLabel>TUTAR</SectionLabel>

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
      </View>

      {/* --- varlık --- */}
      <View style={styles.block}>
        <SectionLabel>VARLIK</SectionLabel>

        <View style={styles.assetWrap}>
          {assets.map((item) => (
            <TouchableOpacity
              key={item.symbol}
              style={[
                styles.assetRow,
                item.symbol === symbol && styles.assetRowOn,
              ]}
              onPress={() => setSymbol(item.symbol)}
              accessibilityRole="button"
              accessibilityState={{ selected: item.symbol === symbol }}
            >
              <AssetBadge symbol={item.symbol} />

              <View style={styles.assetNames}>
                <Text style={styles.assetName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.assetMeta}>
                  {item.symbol}
                  {item.firstAvailable !== null &&
                    ` · ${item.firstAvailable.slice(0, 4)}'ten beri`}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {notice !== null && <Text style={styles.notice}>{notice}</Text>}

      <TouchableOpacity
        style={styles.submit}
        onPress={() => void run()}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.onInverse} />
        ) : (
          <Text style={styles.submitText}>Hesapla</Text>
        )}
      </TouchableOpacity>

      {error !== null && <Text style={styles.error}>{error}</Text>}

      {/* --- sonuç --- */}
      {result !== null && (
        <View style={styles.result}>
          <SectionLabel>SONUÇ</SectionLabel>

          <Text style={styles.resultValue}>{result.currentValueTry}</Text>

          <View style={styles.resultRow}>
            <Text
              style={[
                styles.resultProfit,
                { color: gaining ? colors.gain : colors.loss },
              ]}
            >
              {result.nominalProfitTry}
            </Text>
            <Text
              style={[
                styles.resultProfit,
                { color: gaining ? colors.gain : colors.loss },
              ]}
            >
              {result.nominalReturnPercentFormatted}
            </Text>
            <Text style={styles.resultLabel}>NOMİNAL</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statRow}>
            <Text style={styles.statKey}>Enflasyon</Text>
            <Text style={styles.statValue}>
              {result.cumulativeInflationPercentFormatted}
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statKey}>Reel getiri</Text>
            <Text style={[styles.statValue, styles.statStrong]}>
              {result.realReturnPercentFormatted}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statRow}>
            <Text style={styles.statKey}>O günkü fiyat</Text>
            <Text style={styles.statValue}>
              {result.startPriceTry}
              {result.startPriceUsd !== null && `  ·  ${result.startPriceUsd} $`}
            </Text>
          </View>

          <View style={styles.statRow}>
            <Text style={styles.statKey}>Aldığın miktar</Text>
            <Text style={styles.statValue}>{result.purchasedQuantity}</Text>
          </View>

          {/*
            ⚠️ DİPNOT — kullanıcının sorduğu soru buydu.
            Dolar fiyatı BUGÜNKÜ kurla değil O GÜNKÜ kurla hesaplanıyor.
            Söylemezsek kullanıcı doğal olarak bugünkü kuru varsayar ve
            sayıyı yanlış sanar.
          */}
          {result.startUsdTryRate !== null && (
            <Text style={styles.footnote}>
              Dolar fiyatı o tarihteki TCMB kuruyla hesaplandı
              (1 $ = {result.startUsdTryRate}), bugünkü kurla değil.
              Reel getiri {result.tufeStartMonth} → {result.tufeEndMonth} TÜFE
              endeksine dayanıyor.
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.screen, paddingTop: 20, paddingBottom: 40 },

  question: {
    fontFamily: fonts.semibold,
    fontSize: 21,
    lineHeight: 30,
    color: colors.inkFaint,
    marginTop: 9,
    letterSpacing: -0.2,
  },
  underlined: {
    fontFamily: fonts.bold,
    color: colors.ink,
    // Tasarımda altı çizili: dokunulabilir olduğunu söyleyen tek işaret.
    textDecorationLine: 'underline',
  },

  block: { marginTop: 20, gap: 10 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },

  calendarToggle: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  calendarToggleText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.inkMuted,
  },
  calendarBox: { marginTop: 4 },

  amountRow: { flexDirection: 'row', gap: 7 },
  amountButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amountButtonOn: { backgroundColor: colors.inverse, borderColor: colors.inverse },
  amountText: { fontFamily: fonts.monoSemibold, fontSize: 11, color: colors.inkMuted },
  amountTextOn: { fontFamily: fonts.monoBold, color: colors.onInverse },

  assetWrap: { borderTopWidth: 1, borderTopColor: colors.surfacePressed },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfacePressed,
  },
  assetRowOn: { backgroundColor: colors.surfaceRaised },
  assetNames: { flex: 1 },
  assetName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  assetMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 2,
  },

  notice: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.warn,
    marginTop: 16,
  },

  submit: {
    marginTop: 20,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.inverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.onInverse },

  error: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.error,
    marginTop: 14,
  },

  result: { marginTop: 26 },
  resultValue: {
    fontFamily: fonts.monoBold,
    fontSize: 32,
    color: colors.ink,
    marginTop: 8,
    letterSpacing: -1,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  resultProfit: { fontFamily: fonts.monoBold, fontSize: 13 },
  resultLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    letterSpacing: 1.1,
    color: colors.inkFaint,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  statKey: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted },
  statValue: { fontFamily: fonts.monoSemibold, fontSize: 13, color: colors.inkBright },
  statStrong: { color: colors.ink, fontSize: 15 },

  footnote: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 17,
    color: colors.inkFaint,
    marginTop: 14,
  },
});
