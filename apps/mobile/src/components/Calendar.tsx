import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts } from '../theme';

/**
 * Calendar — `docs/export/7a` tarih seçici.
 *
 * ⚠️ VARLIĞIN VERİSİ OLMAYAN GÜN SEÇİLEMEZ.
 *
 * Eskiden kullanıcı SOL için 2017'yi seçebiliyor ve "o tarihli geçmiş
 * kayıt bulunamadı" hatası alıyordu. Hata mesajı doğruydu ama YANLIŞ
 * ÇÖZÜMDÜ: doğru davranış hatayı güzelleştirmek değil, o günü en baştan
 * seçtirmemek.
 *
 * ⚠️ İKİ GÖRÜNÜM: HAFTA ŞERİDİ ve TAM AY.
 *
 * Tasarım tek bir hafta şeridi gösteriyor (9-15) — ekranda az yer kaplasın
 * diye. Ama yalnızca şerit olsaydı ayın 25'ine gitmek imkânsızlaşırdı.
 * Ay adına dokununca tam ay ızgarası açılıyor: tasarıma sadık, ama
 * çıkmaz sokak değil.
 */

const WEEKDAYS = ['Pa', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'] as const;

/** 0 = Pazar. Tasarımın sırası (`Pa Pt Sa...`) bunu gerektiriyor. */
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
  min,
  max,
  onRejected,
}: {
  value: string;
  onChange: (iso: string) => void;
  /** Bu tarihten öncesi seçilemez ("YYYY-MM-DD"). */
  min?: string | undefined;
  /** Bu tarihten sonrası seçilemez ("YYYY-MM-DD"). */
  max?: string | undefined;
  /** Kapalı bir güne dokunulduğunda çağrılır — ekran uyarı gösterir. */
  onRejected?: (iso: string, reason: 'early' | 'late') => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Yıl seçici listesi oluştur (min yılından max yılına kadar)
  const yearsList = useMemo(() => {
    const startY = min ? Number(min.slice(0, 4)) : 2017;
    const endY = max ? Number(max.slice(0, 4)) : new Date().getUTCFullYear();
    const list = [];
    for (let y = startY; y <= endY; y++) {
      list.push(y);
    }
    return list;
  }, [min, max]);

  const selected = useMemo(() => {
    const [y = '2020', m = '01', d = '01'] = value.split('-');
    return { year: Number(y), month: Number(m) - 1, day: Number(d) };
  }, [value]);

  /**
   * Görünen ay. Seçili tarihten türetiliyor ama ayrı state:
   * kullanıcı Mart'a bakarken henüz bir gün seçmemiş olabilir.
   */
  const [cursor, setCursor] = useState({
    year: selected.year,
    month: selected.month,
  });

  // Dışarıdan (örn. podyum veya hazır günlerden) tarih değiştiğinde takvimi oraya odakla
  useEffect(() => {
    setCursor({ year: selected.year, month: selected.month });
  }, [selected.year, selected.month]);

  /**
   * Ay ya da yıl kaydır.
   *
   * ⚠️ Yıl sınırını elle taşımıyoruz — `Date`'e bırakıyoruz. Ocak'tan bir
   * ay geri gitmek Aralık'a düşmeli VE yılı azaltmalı; elle yazılan
   * `month - 1` mantığı bunu her seferinde yeniden hatalı yapar.
   */
  function shift(months: number) {
    setCursor((c) => {
      const d = new Date(Date.UTC(c.year, c.month + months, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });
  }

  /** Görünen ayın hücreleri — tam ay ızgarası. */
  const monthRows = useMemo(() => {
    const { year, month } = cursor;

    const firstDay = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const lead = (firstDay - FIRST_WEEKDAY + 7) % 7;

    // ⚠️ Ayın gün sayısı: bir sonraki ayın 0. günü = bu ayın son günü.
    // Elle 28/30/31 tablosu yazmak artık yılı kaçırırdı.
    const dayCount = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= dayCount; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    const rows: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

    return rows;
  }, [cursor]);

  /**
   * Şerit görünümünde gösterilecek tek hafta.
   *
   * Seçili gün görünen ayda ise onun haftası; değilse ayın ilk haftası.
   * Böylece ay değiştirildiğinde şerit boş kalmıyor.
   */
  const stripRow = useMemo(() => {
    const inThisMonth =
      selected.year === cursor.year && selected.month === cursor.month;

    if (!inThisMonth) return monthRows[0] ?? [];

    return (
      monthRows.find((row) => row.includes(selected.day)) ?? monthRows[0] ?? []
    );
  }, [monthRows, selected, cursor]);

  function renderDay(day: number | null, key: number) {
    if (day === null) return <View key={key} style={styles.cell} />;

    const iso = isoOf(cursor.year, cursor.month, day);
    const tooEarly = min !== undefined && iso < min;
    const tooLate = max !== undefined && iso > max;
    const blocked = tooEarly || tooLate;
    const isSelected = iso === value;

    return (
      <View key={key} style={styles.cell}>
        <TouchableOpacity
          style={[styles.day, isSelected && styles.daySelected]}
          onPress={() => {
            if (blocked) {
              // ⚠️ SESSİZCE YUTMUYORUZ. Dokunup hiçbir şey olmaması
              // "uygulama dondu" gibi okunur; kullanıcı sebebini bilmeli.
              onRejected?.(iso, tooEarly ? 'early' : 'late');
              return;
            }
            onChange(iso);
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected, disabled: blocked }}
          accessibilityLabel={`${day} ${MONTHS[cursor.month]} ${cursor.year}`}
        >
          <Text
            style={[
              styles.dayText,
              blocked && styles.dayBlocked,
              isSelected && styles.dayTextSelected,
            ]}
          >
            {day}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      {/* --- gezinme --- */}
      <View style={styles.navRow}>
        <Text style={styles.navLabel}>TAKVİMDEN SEÇ</Text>

        <View style={styles.nav}>
          {/*
            ⚠️ ÇİFT OK = YIL, TEK OK = AY.
            Yalnızca ay okları varken 2017'ye inmek 100 dokunuş demekti.
            Yıl oku aynı yolu 9 dokunuşa indiriyor.
          */}
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => shift(-12)}
            accessibilityRole="button"
            accessibilityLabel="Önceki yıl"
          >
            <Text style={styles.navArrow}>«</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButton}
            onPress={() => shift(-1)}
            accessibilityRole="button"
            accessibilityLabel="Önceki ay"
          >
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>

          {/* Ay adına dokunmak tam ayı açıyor — şerit çıkmaz sokak olmasın. */}
          <TouchableOpacity
            onPress={() => setExpanded((open) => !open)}
            accessibilityRole="button"
            accessibilityLabel={
              expanded ? 'Ay görünümünü kapat' : 'Tüm ayı göster'
            }
          >
            <Text style={styles.navMonth}>
              {MONTHS[cursor.month]} {cursor.year}
              <Text style={styles.navCaret}>{expanded ? ' ⌃' : ' ⌄'}</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButton}
            onPress={() => shift(1)}
            accessibilityRole="button"
            accessibilityLabel="Sonraki ay"
          >
            <Text style={[styles.navArrow, styles.navArrowBright]}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButton}
            onPress={() => shift(12)}
            accessibilityRole="button"
            accessibilityLabel="Sonraki yıl"
          >
            <Text style={[styles.navArrow, styles.navArrowBright]}>»</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Yıl hızlı seçim alanı */}
      {expanded && (
        <View style={styles.yearSelectorRow}>
          {yearsList.map((y) => {
            const isSelectedYear = y === cursor.year;
            return (
              <TouchableOpacity
                key={y}
                style={[styles.yearChip, isSelectedYear && styles.yearChipSelected]}
                onPress={() => setCursor({ year: y, month: cursor.month })}
              >
                <Text style={[styles.yearChipText, isSelectedYear && styles.yearChipTextSelected]}>
                  {y}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* --- ızgara --- */}
      <View style={styles.grid}>
        <View style={styles.weekRow}>
          {WEEKDAYS.map((w) => (
            <Text key={w} style={styles.weekday}>
              {w}
            </Text>
          ))}
        </View>

        {expanded ? (
          monthRows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.week}>
              {row.map((day, i) => renderDay(day, i))}
            </View>
          ))
        ) : (
          <View style={styles.week}>
            {stripRow.map((day, i) => renderDay(day, i))}
          </View>
        )}
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
  nav: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  navButton: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrow: { fontSize: 14, color: colors.inkFaint, lineHeight: 17 },
  navArrowBright: { color: colors.inkBright },
  navMonth: {
    fontFamily: fonts.monoSemibold,
    fontSize: 11,
    color: colors.inkBright,
    paddingHorizontal: 4,
  },
  navCaret: { color: colors.inkFaint },

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
  dayBlocked: { color: colors.inkDisabled },
  dayTextSelected: { color: colors.onInverse },
  yearSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    marginBottom: 8,
    borderRadius: 8,
  },
  yearChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  yearChipSelected: {
    backgroundColor: colors.inverse,
    borderColor: colors.inverse,
  },
  yearChipText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.inkMuted,
  },
  yearChipTextSelected: {
    color: colors.onInverse,
  },
});
