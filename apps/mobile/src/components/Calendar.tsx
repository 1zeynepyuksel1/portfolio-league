import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts } from '../theme';

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
] as const;

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
  value: string | null;
  onChange: (iso: string) => void;
  min?: string | undefined;
  max?: string | undefined;
  onRejected?: (iso: string, reason: 'early' | 'late') => void;
}) {
  const [activeDropdown, setActiveDropdown] = useState<'day' | 'month' | 'year' | null>(null);

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    if (value) {
      const [y, m, d] = value.split('-');
      setSelectedYear(Number(y));
      setSelectedMonth(Number(m) - 1);
      setSelectedDay(Number(d));
    } else {
      setSelectedYear(null);
      setSelectedMonth(null);
      setSelectedDay(null);
    }
  }, [value]);

  const yearsList = useMemo(() => {
    const startY = min ? Number(min.slice(0, 4)) : 2017;
    const endY = max ? Number(max.slice(0, 4)) : new Date().getUTCFullYear();
    const list = [];
    for (let y = startY; y <= endY; y++) {
      list.push(y);
    }
    return list;
  }, [min, max]);

  function updateDate(newYear: number | null, newMonth: number | null, newDay: number | null) {
    if (newYear === null || newMonth === null || newDay === null) {
      if (newYear !== null) setSelectedYear(newYear);
      if (newMonth !== null) setSelectedMonth(newMonth);
      if (newDay !== null) setSelectedDay(newDay);
      return;
    }
    const maxDays = new Date(Date.UTC(newYear, newMonth + 1, 0)).getUTCDate();
    const clampedDay = Math.min(newDay, maxDays);
    const mm = String(newMonth + 1).padStart(2, '0');
    const dd = String(clampedDay).padStart(2, '0');
    const iso = `${newYear}-${mm}-${dd}`;

    if (min && iso < min) {
      onRejected?.(iso, 'early');
      return;
    }
    if (max && iso > max) {
      onRejected?.(iso, 'late');
      return;
    }

    setSelectedYear(newYear);
    setSelectedMonth(newMonth);
    setSelectedDay(clampedDay);
    onChange(iso);
  }

  const currentYear = selectedYear ?? new Date().getUTCFullYear();
  const currentMonth = selectedMonth ?? 0;
  const daysCount = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>TARİH SEÇİN</Text>
      <View style={styles.selectorRow}>
        {/* Gün Seçici */}
        <TouchableOpacity
          style={[styles.dropdownButton, activeDropdown === 'day' && styles.dropdownButtonActive]}
          onPress={() => setActiveDropdown(activeDropdown === 'day' ? null : 'day')}
        >
          <Text style={styles.dropdownButtonLabel}>GÜN</Text>
          <Text style={styles.dropdownButtonValue}>
            {selectedDay !== null ? selectedDay : 'Seç'}
          </Text>
          <Text style={styles.dropdownButtonCaret}>⌄</Text>
        </TouchableOpacity>

        {/* Ay Seçici */}
        <TouchableOpacity
          style={[styles.dropdownButton, activeDropdown === 'month' && styles.dropdownButtonActive]}
          onPress={() => setActiveDropdown(activeDropdown === 'month' ? null : 'month')}
        >
          <Text style={styles.dropdownButtonLabel}>AY</Text>
          <Text style={styles.dropdownButtonValue}>
            {selectedMonth !== null ? MONTHS[selectedMonth] : 'Seç'}
          </Text>
          <Text style={styles.dropdownButtonCaret}>⌄</Text>
        </TouchableOpacity>

        {/* Yıl Seçici */}
        <TouchableOpacity
          style={[styles.dropdownButton, activeDropdown === 'year' && styles.dropdownButtonActive]}
          onPress={() => setActiveDropdown(activeDropdown === 'year' ? null : 'year')}
        >
          <Text style={styles.dropdownButtonLabel}>YIL</Text>
          <Text style={styles.dropdownButtonValue}>
            {selectedYear !== null ? selectedYear : 'Seç'}
          </Text>
          <Text style={styles.dropdownButtonCaret}>⌄</Text>
        </TouchableOpacity>
      </View>

      {/* Seçenekler Paneli */}
      {activeDropdown !== null && (
        <View style={styles.optionsContainer}>
          {activeDropdown === 'day' && (
            <ScrollView
              contentContainerStyle={styles.gridOptions}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {Array.from({ length: daysCount }, (_, i) => i + 1).map((d) => {
                const isSel = d === selectedDay;
                const iso = isoOf(currentYear, currentMonth, d);
                const disabled = !!((min && iso < min) || (max && iso > max));
                return (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.optionCell,
                      isSel && styles.optionCellSelected,
                      disabled && styles.optionDisabled,
                    ]}
                    disabled={disabled}
                    onPress={() => {
                      updateDate(selectedYear, selectedMonth, d);
                      setActiveDropdown(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isSel && styles.optionTextSelected,
                        disabled && styles.optionTextDisabled,
                      ]}
                    >
                      {d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {activeDropdown === 'month' && (
            <ScrollView
              contentContainerStyle={styles.listOptions}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {MONTHS.map((mName, mIdx) => {
                const isSel = mIdx === selectedMonth;
                const tempIso = isoOf(currentYear, mIdx, 1);
                const maxDaysOfM = new Date(Date.UTC(currentYear, mIdx + 1, 0)).getUTCDate();
                const disabled = !!(
                  (min && isoOf(currentYear, mIdx, maxDaysOfM) < min) ||
                  (max && tempIso > max)
                );

                return (
                  <TouchableOpacity
                    key={mName}
                    style={[
                      styles.optionRow,
                      isSel && styles.optionRowSelected,
                      disabled && styles.optionDisabled,
                    ]}
                    disabled={disabled}
                    onPress={() => {
                      updateDate(selectedYear, mIdx, selectedDay);
                      setActiveDropdown(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        isSel && styles.optionTextSelected,
                        disabled && styles.optionTextDisabled,
                      ]}
                    >
                      {mName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {activeDropdown === 'year' && (
            <ScrollView
              contentContainerStyle={styles.gridOptions}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            >
              {yearsList.map((y) => {
                const isSel = y === selectedYear;
                return (
                  <TouchableOpacity
                    key={y}
                    style={[styles.optionCell, isSel && styles.optionCellSelected]}
                    onPress={() => {
                      updateDate(y, selectedMonth, selectedDay);
                      setActiveDropdown(null);
                    }}
                  >
                    <Text style={[styles.optionText, isSel && styles.optionTextSelected]}>
                      {y}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.inkFaint,
    marginBottom: 8,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dropdownButton: {
    flex: 1,
    height: 52,
    borderRadius: 10,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownButtonActive: {
    borderColor: colors.inverse,
    backgroundColor: colors.surface,
  },
  dropdownButtonLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.inkFaint,
    position: 'absolute',
    left: 12,
    top: 6,
  },
  dropdownButtonValue: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.inkBright,
    marginTop: 10,
  },
  dropdownButtonCaret: {
    fontSize: 14,
    color: colors.inkFaint,
    marginTop: 10,
  },
  optionsContainer: {
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 180,
    overflow: 'hidden',
  },
  gridOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 6,
    justifyContent: 'center',
  },
  listOptions: {
    padding: 6,
    gap: 4,
  },
  optionCell: {
    width: 44,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCellSelected: {
    backgroundColor: colors.inverse,
    borderColor: colors.inverse,
  },
  optionRow: {
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  optionRowSelected: {
    backgroundColor: colors.inverse,
    borderColor: colors.inverse,
  },
  optionDisabled: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    opacity: 0.45,
  },
  optionText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.inkMuted,
  },
  optionTextSelected: {
    color: colors.onInverse,
  },
  optionTextDisabled: {
    color: colors.inkDisabled,
  },
});
