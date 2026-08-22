import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

type Asset = {
  symbol: string;
  name: string;
  /** Bu varlığın en eski fiyat kaydı. Tarih seçici buradan sınırlanıyor. */
  firstAvailable: string | null;
};

/**
 * Sembole göre simge.
 *
 * ⚠️ VARLIK LİSTESİ ARTIK BURADA DEĞİL — API'den geliyor.
 * Eskiden bu dosyada beş varlıklık sabit bir dizi vardı. Sunucuya on üç
 * varlık daha eklendiğinde bu ekran hâlâ beş tanesini gösteriyordu; kimse
 * hata almadı, liste sessizce eskidi.
 *
 * Simge tablosu kalabilir çünkü yalnızca görsel: bilinmeyen bir sembol
 * gelirse aşağıdaki varsayılan kullanılır, liste yine de eksiksiz görünür.
 * Kural: veri sunucudan, süs istemciden.
 */
const ICONS: Record<string, string> = {
  BTC: '🟡', ETH: '🔷', BNB: '🟨', SOL: '🟣', XRP: '⚫',
  ADA: '🔵', DOGE: '🐕', AVAX: '🔺', LINK: '🔗', LTC: '⚪',
  USD: '💵', EUR: '💶', GBP: '💷', CHF: '🇨🇭',
  CAD: '🍁', AUD: '🇦🇺', SEK: '🇸🇪', JPY: '💴',
  GRAM_ALTIN: '🪙',
};

const DEFAULT_ICON = '📈';

function iconOf(symbol: string): string {
  return ICONS[symbol] ?? DEFAULT_ICON;
}

/**
 * Seçilebilir yıllar — varlığın ilk kaydından bu yıla kadar.
 *
 * ⚠️ BU FONKSİYON BİR HATA MESAJINI ORTADAN KALDIRIYOR.
 *
 * Eskiden liste sabitti: 2017-2026. SOL 11 Ağustos 2020'de listelendiği
 * için kullanıcı SOL + 2017 seçebiliyor ve "o tarihli kayıt bulunamadı"
 * hatası alıyordu. Hata mesajı DOĞRUYDU — ama asıl sorun o seçeneğin en
 * baştan sunulmuş olmasıydı.
 *
 * Doğru çözüm hatayı güzelleştirmek değil, imkânsız seçimi kaldırmak.
 */
function yearsFor(firstAvailable: string | null): string[] {
  const currentYear = new Date().getFullYear();

  // Varlığın ilk kaydı bilinmiyorsa elimizdeki en geniş aralığı ver.
  const startYear =
    firstAvailable === null
      ? 2017
      : new Date(firstAvailable).getFullYear();

  const years: string[] = [];
  for (let y = startYear; y <= currentYear; y++) {
    years.push(String(y));
  }

  return years;
}

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
  // 1. Varlık Seçimi ve Dropdown Menü Açık/Kapalı Durumu
  const [selectedSymbol, setSelectedSymbol] = useState('BTC');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Varlıklar sunucudan geliyor — bkz. ICONS üstündeki not.
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    // Liste bir kez çekiliyor: varlıklar fiyat gibi saniyede değişmiyor.
    // Hata durumunda ekranı kilitlemiyoruz — dizi boş kalır, kullanıcı
    // yine de seçili varlıkla hesap yapabilir.
    apiFetch<Asset[]>('/assets')
      .then(setAssets)
      .catch(() => setAssets([]));
  }, []);

  // 2. Kaydırmalı Tarih Seçimi (Yıl, Ay, Gün)
  const [selectedYear, setSelectedYear] = useState('2020');
  const [selectedMonth, setSelectedMonth] = useState('03');
  const [selectedDay, setSelectedDay] = useState('12');

  // 3. Tutar
  const [amountTry, setAmountTry] = useState('10000');

  // İstek Durumları
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WhatIfResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Seçilen Varlık Bilgisi
  // Liste henüz gelmediyse seçili sembolü yine de göster — ekran boş kalmasın.
  const currentAsset =
    assets.find((a) => a.symbol === selectedSymbol) ??
    { symbol: selectedSymbol, name: selectedSymbol, firstAvailable: null };

  // Seçilebilir yıllar seçili varlığa göre değişiyor.
  const years = yearsFor(currentAsset.firstAvailable);

  /** Varlığın işlem görmeye başladığı gün, "YYYY-MM-DD". */
  const earliest =
    currentAsset.firstAvailable !== null
      ? currentAsset.firstAvailable.slice(0, 10)
      : null;


  // Birleşik Tarih Stringi (YYYY-MM-DD)
  const dateString = `${selectedYear}-${selectedMonth}-${selectedDay.padStart(2, '0')}`;

  /**
   * Seçilen tarih varlığın başlangıcından önce mi?
   *
   * ⚠️ `dateString` TANIMLANDIKTAN SONRA hesaplanıyor. JS'te `const`
   * bildirimleri yukarı taşınır ama DEĞERLERİ taşınmaz — önce kullanılırsa
   * "used before being assigned" hatası alınır. TypeScript bunu derlemede
   * yakaladı; JavaScript'te çalışma anında ReferenceError olurdu.
   *
   * Metin karşılaştırması yeterli: "YYYY-MM-DD" biçiminde sözlük sırası
   * takvim sırasıyla aynı. Date nesnesi kurmaya gerek yok.
   */
  const tooEarly = earliest !== null && dateString < earliest;

  // Hesapla Butonuna Basıldığında
  async function handleCalculate() {
    setError(null);
    setLoading(true);

    try {
      const tryNum = parseFloat(amountTry);
      if (isNaN(tryNum) || tryNum <= 0) {
        throw new Error('Lütfen geçerli bir TL tutarı giriniz.');
      }

      // TL'yi Kuruşa çeviriyoruz (10.000 TL -> 1000000 kuruş)
      const amountKurus = BigInt(Math.round(tryNum * 100)).toString();

      // Backend'deki GET /what-if kapısına istek atıyoruz
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
      {/* Başlık */}
      <View style={styles.header}>
        <Text style={styles.title}>🔮 Ya Alsaydın?</Text>
        <Text style={styles.subtitle}>
          Geçmiş Yatırım & Enflasyondan Arındırılmış Reel Getiri
        </Text>
      </View>

      {/* 1. VARLIK SEÇİMİ (AÇILIR DROPDOWN MENÜ) */}
      <Text style={styles.sectionLabel}>1. Varlık Seçin (Dropdown)</Text>
      <View style={styles.dropdownWrapper}>
        <TouchableOpacity
          style={styles.dropdownHeader}
          onPress={() => setDropdownOpen(!dropdownOpen)}
        >
          <View style={styles.selectedAssetRow}>
            <Text style={styles.assetIcon}>{iconOf(currentAsset.symbol)}</Text>
            <Text style={styles.selectedAssetText}>
              {currentAsset.name} ({currentAsset.symbol})
            </Text>
          </View>
          <Text style={styles.dropdownArrow}>{dropdownOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {dropdownOpen && (
          <View style={styles.dropdownList}>
            {assets.map((item) => (
              <TouchableOpacity
                key={item.symbol}
                style={[
                  styles.dropdownItem,
                  selectedSymbol === item.symbol && styles.dropdownItemActive,
                ]}
                onPress={() => {
                  setSelectedSymbol(item.symbol);
                  setDropdownOpen(false);
                  setResult(null);
                  setError(null);

                  // ⚠️ Varlık değişince seçili yıl geçersiz kalabilir:
                  // BTC'de 2017 seçiliyken SOL'a geçilirse o yıl artık
                  // listede yok. Sessizce bırakırsak seçici boş bir
                  // seçeneği "seçili" gösterir. Sınırın içine çekiyoruz.
                  const validYears = yearsFor(item.firstAvailable);
                  if (!validYears.includes(selectedYear)) {
                    setSelectedYear(validYears[0] as string);
                  }
                }}
              >
                <Text style={styles.assetIcon}>{iconOf(item.symbol)}</Text>
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

      {/* 2. KAYDIRMALI TARİH SEÇİMİ (YATAY ZAMAN ÇİZELGESİ) */}
      <Text style={styles.sectionLabel}>2. Tarih Seçin (Kaydırmalı Çizelge)</Text>

      {/* Hızlı Atlayış Butonları */}
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
        {years.map((y) => (
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

      {/* Elle Tarih Girişi */}
      <Text style={styles.subLabel}>✍️ Ya da tarihi elle yazın:</Text>
      <TextInput
        style={styles.input}
        placeholder="YYYY-AA-GG (örn: 2020-03-12)"
        placeholderTextColor="#64748B"
        value={dateString}
        onChangeText={(text) => {
          // Girilen metni parçalara ayırıp state'e dağıtıyoruz; böylece
          // kaydırmalı seçici ile elle giriş TEK kaynaktan besleniyor ve
          // biri değişince diğeri de güncelleniyor.
          const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (m) {
            setSelectedYear(m[1] as string);
            setSelectedMonth(m[2] as string);
            setSelectedDay(m[3] as string);
            setError(null);
          }
        }}
        autoCapitalize="none"
      />

      {/* Seçilen Tarih Özeti Kartı */}
      <View style={styles.datePreviewCard}>
        <Text style={styles.datePreviewLabel}>🎯 Seçilen Simülasyon Tarihi:</Text>
        <Text style={styles.datePreviewValue}>{dateString}</Text>
      </View>

      {/*
        ⚠️ SINIR UYARISI — hatayı sunucudan beklemek yerine önden söylüyoruz.
        Sunucu zaten "kayıt bulunamadı" derdi ama kullanıcı o noktaya kadar
        formu doldurup düğmeye basmış olurdu.
      */}
      {tooEarly && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            ⚠️ {currentAsset.symbol} verisi {earliest} tarihinde başlıyor.
            Daha eski bir tarih seçilemez.
          </Text>
        </View>
      )}

      {/* 3. Tutar Girişi */}
      <Text style={styles.sectionLabel}>3. Ne Kadar Yatırsaydınız? (TL)</Text>
      <TextInput
        style={styles.input}
        placeholder="Örn: 10000"
        placeholderTextColor="#64748B"
        value={amountTry}
        onChangeText={setAmountTry}
        keyboardType="numeric"
      />

      {/* Hesapla Butonu */}
      <TouchableOpacity
        style={[
          styles.calculateButton,
          (loading || tooEarly) && styles.buttonDisabled,
        ]}
        onPress={handleCalculate}
        disabled={loading || tooEarly}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.calculateButtonText}>🚀 Simülasyonu Hesapla</Text>
        )}
      </TouchableOpacity>

      {/* Hata Kutusu */}
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* 4. SİMÜLASYON SONUÇ KARTI */}
      {result && (
        <View style={styles.resultCard}>
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
          <Text style={styles.totalValueLabel}>Bugünkü Toplam Paranız:</Text>
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
    backgroundColor: '#0B132B',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  sectionLabel: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 18,
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
    backgroundColor: '#1C2541',
    borderColor: '#10B981',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    backgroundColor: '#1C2541',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 6,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderBottomColor: '#334155',
    borderBottomWidth: 0.5,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  dropdownItemText: {
    color: '#E2E8F0',
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
    backgroundColor: '#1C2541',
    borderColor: '#334155',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  presetButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
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
    backgroundColor: '#1C2541',
    borderColor: '#334155',
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
    backgroundColor: '#1C2541',
    borderColor: '#334155',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 6,
  },
  monthChipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
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
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
    marginBottom: 4,
  },
  datePreviewLabel: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '500',
  },
  datePreviewValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#1C2541',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
  },
  calculateButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  calculateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
  },
  resultCard: {
    backgroundColor: '#1C2541',
    borderColor: '#10B981',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 18,
    marginTop: 24,
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
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  totalValueLabel: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
  },
  totalValueAmount: {
    color: '#10B981',
    fontSize: 28,
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
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  inflationBadge: {
    flex: 1,
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
    borderRadius: 8,
    padding: 8,
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
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: '#3B82F6',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  realBadgeTitle: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  realBadgeValue: {
    color: '#60A5FA',
    fontSize: 22,
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
