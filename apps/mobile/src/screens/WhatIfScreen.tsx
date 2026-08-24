import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiFetch } from '../api/client';

type WhatIfResult = {
  symbol: string;
  assetName: string;
  startDate: string;
  startPriceTry: string;
  currentDate: string;
  currentPriceTry: string;
  purchasedQuantity: string;
  initialInvestmentTry: string;
  currentValueTry: string;
  nominalProfitTry: string;
  nominalReturnPercentFormatted: string;
  cumulativeInflationPercentFormatted: string;
  realReturnPercentFormatted: string;
  summary: string;
};

const ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', icon: '🟡' },
  { symbol: 'ETH', name: 'Ethereum', icon: '🔷' },
  { symbol: 'GRAM_ALTIN', name: 'Gram Altın', icon: '🪙' },
  { symbol: 'USD', name: 'Amerikan Doları', icon: '💵' },
  { symbol: 'EUR', name: 'Euro', icon: '💶' },
];

const YEARS = ['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];

const MONTHS = [
  { num: '01', label: 'Oca' },
  { num: '02', label: 'Şub' },
  { num: '03', label: 'Mar' },
  { num: '04', label: 'Nis' },
  { num: '05', label: 'May' },
  { num: '06', label: 'Haz' },
  { num: '07', label: 'Tem' },
  { num: '08', label: 'Ağu' },
  { num: '09', label: 'Eyl' },
  { num: '10', label: 'Eki' },
  { num: '11', label: 'Kas' },
  { num: '12', label: 'Ara' },
];

const PRESET_DATES = [
  { label: '🦠 2020 Pandemi', date: '2020-03-12', year: '2020', month: '03' },
  { label: '🚀 2021 Zirve', date: '2021-11-10', year: '2021', month: '11' },
  { label: '❄️ 2023 Dip', date: '2023-01-01', year: '2023', month: '01' },
];

export function WhatIfScreen() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [selectedYear, setSelectedYear] = useState('2020');
  const [selectedMonth, setSelectedMonth] = useState('03');
  const [selectedDay, setSelectedDay] = useState('12');

  const [amountTry, setAmountTry] = useState('10000');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentAsset = ASSETS.find((a) => a.symbol === selectedSymbol) || ASSETS[0]!;
  const dateString = `${selectedYear}-${selectedMonth}-${selectedDay.padStart(2, '0')}`;

  async function handleCalculate() {
    setError(null);
    setLoading(true);

    try {
      const tryNum = parseFloat(amountTry);
      if (isNaN(tryNum) || tryNum <= 0) {
        throw new Error('Lütfen geçerli bir TL tutarı giriniz.');
      }

      const amountKurus = BigInt(Math.round(tryNum * 100)).toString();

      const data = await apiFetch<WhatIfResult>(
        `/what-if?symbol=${selectedSymbol}&date=${dateString}&amountKurus=${amountKurus}`,
      );

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hesaplama başarısız.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.title}>🔮 Ya Alsaydın?</Text>
        <Text style={styles.subtitle}>
          Geçmiş Yatırım & Enflasyondan Arındırılmış Reel Getiri Simülatörü
        </Text>
      </View>

      {/* BUZLU CAM PARAMETRE KARTI */}
      <View style={styles.glassCard}>
        {/* 1. VARLIK SEÇİMİ (DROPDOWN MENÜ) */}
        <Text style={styles.sectionLabel}>1. Varlık Seçin</Text>
        <View style={styles.dropdownWrapper}>
          <TouchableOpacity
            style={styles.dropdownHeader}
            onPress={() => setDropdownOpen(!dropdownOpen)}
            activeOpacity={0.8}
          >
            <View style={styles.selectedAssetRow}>
              <Text style={styles.assetIcon}>{currentAsset.icon}</Text>
              <Text style={styles.selectedAssetText}>
                {currentAsset.name} ({currentAsset.symbol})
              </Text>
            </View>
            <Text style={styles.dropdownArrow}>{dropdownOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {dropdownOpen && (
            <View style={styles.dropdownList}>
              {ASSETS.map((item) => (
                <TouchableOpacity
                  key={item.symbol}
                  style={[
                    styles.dropdownItem,
                    selectedSymbol === item.symbol && styles.dropdownItemActive,
                  ]}
                  onPress={() => {
                    setSelectedSymbol(item.symbol);
                    setDropdownOpen(false);
                  }}
                >
                  <Text style={styles.assetIcon}>{item.icon}</Text>
                  <Text
                    style={[
                      styles.dropdownItemText,
                      selectedSymbol === item.symbol && styles.dropdownItemTextActive,
                    ]}
                  >
                    {item.name} ({item.symbol})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* 2. KAYDIRMALI TARİH SEÇİMİ */}
        <Text style={styles.sectionLabel}>2. Tarih Seçin</Text>

        <View style={styles.presetDates}>
          {PRESET_DATES.map((p) => (
            <TouchableOpacity
              key={p.date}
              style={[
                styles.presetButton,
                dateString === p.date && styles.presetButtonActive,
              ]}
              onPress={() => {
                setSelectedYear(p.year);
                setSelectedMonth(p.month);
                setSelectedDay(p.date.slice(8, 10));
              }}
            >
              <Text
                style={[
                  styles.presetText,
                  dateString === p.date && styles.presetTextActive,
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Yıl Kaydırma Çubuğu */}
        <Text style={styles.subLabel}>🗓️ Yıl Seçin:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          {YEARS.map((y) => (
            <TouchableOpacity
              key={y}
              style={[styles.yearChip, selectedYear === y && styles.yearChipActive]}
              onPress={() => setSelectedYear(y)}
            >
              <Text style={[styles.yearChipText, selectedYear === y && styles.yearChipTextActive]}>
                {y}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Ay Kaydırma Çubuğu */}
        <Text style={styles.subLabel}>📅 Ay Seçin:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
          {MONTHS.map((m) => (
            <TouchableOpacity
              key={m.num}
              style={[styles.monthChip, selectedMonth === m.num && styles.monthChipActive]}
              onPress={() => setSelectedMonth(m.num)}
            >
              <Text style={[styles.monthChipText, selectedMonth === m.num && styles.monthChipTextActive]}>
                {m.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Seçilen Tarih Özeti Kartı */}
        <View style={styles.datePreviewCard}>
          <Text style={styles.datePreviewLabel}>🎯 Simülasyon Tarihi:</Text>
          <Text style={styles.datePreviewValue}>{dateString}</Text>
        </View>

        {/* 3. Tutar Girişi */}
        <Text style={styles.sectionLabel}>3. Yatırılan Tutar (TL)</Text>
        <TextInput
          style={styles.pillInput}
          placeholder="Örn: 10000"
          placeholderTextColor="#64748B"
          value={amountTry}
          onChangeText={setAmountTry}
          keyboardType="numeric"
        />

        {/* Hesapla Butonu */}
        <TouchableOpacity
          style={[styles.glowingPillButton, loading && styles.buttonDisabled]}
          onPress={handleCalculate}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#022C22" />
          ) : (
            <Text style={styles.glowingPillButtonText}>🚀 Simülasyonu Hesapla</Text>
          )}
        </TouchableOpacity>

        {/* Hata Kutusu */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}
      </View>

      {/* 4. SİMÜLASYON SONUÇ KARTI */}
      {result && (
        <View style={styles.resultGlassCard}>
          <Text style={styles.resultCardTitle}>📊 Simülasyon Sonucu</Text>
          
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>O Günki Fiyat:</Text>
            <Text style={styles.priceValue}>{result.startPriceTry}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Bugünkü Canlı Fiyat:</Text>
            <Text style={styles.priceValue}>{result.currentPriceTry}</Text>
          </View>

          <View style={styles.divider} />

          {/* Bugünkü Toplam Para */}
          <Text style={styles.totalValueLabel}>Bugünkü Toplam Değeriniz:</Text>
          <Text style={styles.totalValueAmount}>{result.currentValueTry}</Text>
          <Text style={styles.profitText}>Net Kâr: {result.nominalProfitTry}</Text>

          {/* Rozetler */}
          <View style={styles.badgeContainer}>
            <View style={styles.nominalBadge}>
              <Text style={styles.badgeLabel}>Nominal Getiri</Text>
              <Text style={styles.nominalBadgeValue}>
                {result.nominalReturnPercentFormatted}
              </Text>
            </View>

            <View style={styles.inflationBadge}>
              <Text style={styles.badgeLabel}>TÜFE Enflasyonu</Text>
              <Text style={styles.inflationBadgeValue}>
                {result.cumulativeInflationPercentFormatted}
              </Text>
            </View>
          </View>

          {/* REEL GETİRİ VURGUSU */}
          <View style={styles.realBadge}>
            <Text style={styles.realBadgeTitle}>🏆 ENFLASYONDAN ARINDIRILMIŞ REEL GETİRİ</Text>
            <Text style={styles.realBadgeValue}>
              {result.realReturnPercentFormatted}
            </Text>
          </View>

          {/* Özet Hikâye */}
          <Text style={styles.summaryText}>{result.summary}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#081226',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  glassCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1.5,
    borderRadius: 26,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
  },
  sectionLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 14,
    marginBottom: 8,
  },
  subLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 10,
    marginBottom: 6,
  },
  dropdownWrapper: {
    position: 'relative',
    zIndex: 10,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderColor: '#10B981',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectedAssetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  assetIcon: {
    fontSize: 18,
  },
  selectedAssetText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  dropdownArrow: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dropdownList: {
    backgroundColor: '#0F172A',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 6,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    borderBottomWidth: 1,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  dropdownItemText: {
    color: '#CBD5E1',
    fontSize: 14,
  },
  dropdownItemTextActive: {
    color: '#10B981',
    fontWeight: 'bold',
  },
  presetDates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  presetButton: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  presetButtonActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  presetText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  presetTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  horizontalScroll: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  yearChip: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginRight: 8,
  },
  yearChipActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  yearChipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  yearChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  monthChip: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 6,
  },
  monthChipActive: {
    backgroundColor: '#38BDF8',
    borderColor: '#38BDF8',
  },
  monthChipText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  monthChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  datePreviewCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderColor: 'rgba(56, 189, 248, 0.4)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
    marginBottom: 4,
  },
  datePreviewLabel: {
    color: '#7DD3FC',
    fontSize: 12,
    fontWeight: '600',
  },
  datePreviewValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  pillInput: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1.2,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
  },
  glowingPillButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  glowingPillButtonText: {
    color: '#022C22',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
  },
  resultGlassCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: '#10B981',
    borderWidth: 1.5,
    borderRadius: 26,
    padding: 20,
    marginTop: 20,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
  },
  resultCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  priceLabel: {
    color: '#94A3B8',
    fontSize: 13,
  },
  priceValue: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginVertical: 12,
  },
  totalValueLabel: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
  },
  totalValueAmount: {
    color: '#10B981',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 4,
  },
  profitText: {
    color: '#34D399',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 14,
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  nominalBadge: {
    flex: 1,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  inflationBadge: {
    flex: 1,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  badgeLabel: {
    color: '#94A3B8',
    fontSize: 11,
  },
  nominalBadgeValue: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 2,
  },
  inflationBadgeValue: {
    color: '#FB923C',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 2,
  },
  realBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38BDF8',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  realBadgeTitle: {
    color: '#7DD3FC',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  realBadgeValue: {
    color: '#38BDF8',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  summaryText: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 6,
  },
});
