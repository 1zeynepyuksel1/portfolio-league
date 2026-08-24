import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts } from '../theme';

/**
 * Calendar — `docs/export/7a` takvim ızgarası.
 *
 * ⚠️ VARLIĞIN VERİSİ OLMAYAN GÜN SEÇİLEMEZ.
 *
 * Asıl mesele bu. Eskiden kullanıcı SOL için 2017'yi seçebiliyor ve
 * "o tarihli geçmiş kayıt bulunamadı" hatası alıyordu. Hata mesajı
 * doğruydu ama YANLIŞ ÇÖZÜMDÜ: doğru davranış hatayı güzelleştirmek
 * değil, o günü en baştan seçtirmemek.
 *
 * Seçilemeyen gün silinmiyor, SOLUK gösteriliyor. Silseydik ay ızgarası
 * bozulur, kullanıcı "12 Mart nerede" diye arardı. Soluk hâli "burada
 * ama sana kapalı" diyor.
 */

/**
 * ⚠️ HAFTA PAZAR'DAN BAŞLIYOR — tasarımın seçimi (`Pa Pt Sa Ça Pe Cu Ct`).
 *
 * Türkiye'de takvimler genelde PAZARTESİ'den başlar. Tasarıma sadık
 * kalındı ama bu muhtemelen bir dalgınlık; değiştirmek isterseniz
 * yalnızca bu dizi ve `firstWeekday` yeterli, ızgara mantığı aynı kalıyor.
 */
const WEEKDAYS = ['Pa', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'] as const;

/** 0 = Pazar. Pazartesi'ye geçmek için 1 yapmak yeterli. */
const FIRST_WEEKDAY = 0;

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
] as const;

/** "YYYY-MM-DD" üretir. ⚠️ `toISOString` DEĞİL — o UTC'ye kaydırır. */
function isoOf(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function Calendar({
  value,
  onChange,
  /** Bu tarihten öncesi seçilemez ("YYYY-MM-DD"). */
  min,
  /** Bu tarihten sonrası seçilemez ("YYYY-MM-DD"). */
  max,
  /** Kapalı bir güne dokunulduğunda çağrılır — ekran uyarı gösterir. */
  onRejected,
}: {
  value: string;
  onChange: (iso: string) => void;
  min?: string | undefined;
  max?: string | undefined;
  onRejected?: (iso: string, reason: 'early' | 'late') => void;
}) {
  // Görünen ay — seçili tarihten başlıyor, oklarla geziliyor.
  const [cursor, setCursor] = useState(() => {
    const [y = '2020', m = '01'] = value.split('-');
    return { year: Number(y), month: Number(m) - 1 };
  });

  const grid = useMemo(() => {
    const { year, month } = cursor;

    // Ayın ilk gününün haftanın hangi gününe düştüğü.
    // `getDay()` 0=Pazar döndürüyor; başlangıç gününe göre kaydırıyoruz.
    const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const lead = (firstDay - FIRST_WEEKDAY + 7) % 7;

    // ⚠️ Ayın gün sayısı: bir sonraki ayın 0. günü = bu ayın son günü.
    // Elle 28/30/31 tablosu yazmak artık yılı kaçırırdı.
    const dayCount = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    const cells: (number | null)[] = [];

    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= dayCount; d++) cells.push(d);
    // Son satırı tamamla — yoksa hücreler sağa yaslanır.
    while (cells.length % 7 !== 0) cells.push(null);

    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

    return rows;
  }, [cursor]);

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const next = c.month + delta;
      // Yıl sınırını elle taşımak yerine Date'e bırakıyoruz: -1 ay
      // Ocak'tan Aralık'a doğru geçmeli ve yıl azalmalı.
      const d = new Date(Date.UTC(c.year, next, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });
  }

  return (
    <View>
      {/* --- ay gezinme --- */}
      <View style={styles.navRow}>
        <Text style={styles.navLabel}>TAKVİMDEN SEÇ</Text>

        <View style={styles.nav}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => shiftMonth(-1)}
            accessibilityRole="button"
            accessibilityLabel="Önceki ay"
          >
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.navMonth}>
            {MONTHS[cursor.month]} {cursor.year}
          </Text>

          <TouchableOpacity
            style={styles.navButton}
            onPress={() => shiftMonth(1)}
            accessibilityRole="button"
            accessibilityLabel="Sonraki ay"
          >
            <Text style={[styles.navArrow, styles.navArrowBright]}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* --- ızgara --- */}
      <View style={styles.grid}>
        <View style={styles.weekRow}>
          {WEEKDAYS.map((w) => (
            <Text key={w} style={styles.weekday}>
              {w}
            </Text>
          ))}
        </View>

        {grid.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.week}>
            {row.map((day, cellIndex) => {
              if (day === null) {
                return <View key={cellIndex} style={styles.cell} />;
              }

              const iso = isoOf(cursor.year, cursor.month, day);
              const tooEarly = min !== undefined && iso < min;
              const tooLate = max !== undefined && iso > max;
              const blocked = tooEarly || tooLate;
              const selected = iso === value;

              return (
                <View key={cellIndex} style={styles.cell}>
                  <TouchableOpacity
                    style={[styles.day, selected && styles.daySelected]}
                    onPress={() => {
                      if (blocked) {
                        // ⚠️ SESSİZCE YUTMUYORUZ. Dokunup hiçbir şey
                        // olmaması "uygulama dondu" gibi okunur; kullanıcı
                        // neden olmadığını bilmeli.
                        onRejected?.(iso, tooEarly ? 'early' : 'late');
                        return;
                      }
                      onChange(iso);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: blocked }}
                    accessibilityLabel={`${day} ${MONTHS[cursor.month]} ${cursor.year}`}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        blocked && styles.dayBlocked,
                        selected && styles.dayTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  navLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.inkFaint,
  },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navButton: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrow: { fontSize: 15, color: colors.inkFaint, lineHeight: 18 },
  navArrowBright: { color: colors.inkBright },
  navMonth: {
    fontFamily: fonts.monoSemibold,
    fontSize: 11,
    color: colors.inkBright,
  },

  grid: {
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.surfacePressed,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  weekRow: { flexDirection: 'row', paddingHorizontal: 2, paddingBottom: 8 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 9,
    color: colors.inkDisabled,
  },
  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center' },
  day: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: { backgroundColor: colors.inverse },
  dayText: {
    fontFamily: fonts.monoSemibold,
    fontSize: 13,
    color: colors.inkMuted,
  },
  // Kapalı gün: silinmiyor, soluklaşıyor. "Burada ama sana kapalı."
  dayBlocked: { color: colors.inkDisabled, opacity: 0.45 },
  dayTextSelected: { fontFamily: fonts.monoBold, color: colors.onInverse },
});
