import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Calendar } from '../components/Calendar';
import { AssetBadge, Chip, SectionLabel } from '../components/DesignKit';
import { WhatIfResultScreen } from './WhatIfResultScreen';
import { colors, fonts, spacing } from '../theme';

/**
 * WhatIfScreen — "o gün alsaydım ne olurdu".
 *
 * ⚠️ DÜZENİN TEK KURALI: CEVAP ÖNCE, KONTROLLER SONRA.
 *
 * Ekran daha önce altı blok üst üsteydi — takvim, tutar kartı, hazır
 * tutarlar, özel günler, tür filtresi, sonra liste. Yani kullanıcı TEK
 * BİR SAYI görmek için dört kontrol bloğunu kaydırmak zorundaydı, ve
 * `date` başlangıçta `null` olduğu için ilk açılışta hiçbir cevap yoktu.
 *
 * Bir soruyu cevaplamak için var olan bir ekranın cevapsız açılması,
 * düzeltilmesi gereken şeydi. Şimdi:
 *
 *   1. Soru TEK SATIR   ->  "10.000 ₺ · 12 Mart 2020  ⌄"
 *   2. Cevap HEMEN ALTI ->  en çok kazandıran üç varlık, para olarak
 *   3. Kontroller       ->  o satıra dokununca açılan panelde
 *
 * ⚠️ HİÇBİR KONTROL SİLİNMEDİ. Takvim, tutar alanı, hazır tutarlar ve
 * özel günler aynen duruyor — sadece varsayılan olarak katlı. Kaldırmak
 * ile katlamak arasındaki fark önemli: kullanıcının yapabildiği şeyler
 * aynı kaldı, yalnızca sırası değişti.
 *
 * ⚠️ LİSTENİN ORTASINDAN BİR ÇİZGİ GEÇİYOR: ENFLASYON EŞİĞİ.
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
  { key: 'stock', label: 'Hisse' },
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
  /**
   * ⚠️ VARSAYILAN TARİH VAR — `null` DEĞİL. Bilinçli bir geri alma.
   *
   * Önce `null`'dı ve ekran BOŞ açılıyordu: "Hesaplama yapmak için
   * yukarıdan bir tarih seçin." Yani kullanıcı hiçbir cevap görmeden
   * önce iki karar vermek zorundaydı (tarih + tutar).
   *
   * Bu ekranın işi bir SORUYU CEVAPLAMAK. Cevapsız açılan bir ekran o
   * işi yapmıyor. Pandemi dibi seçildi çünkü hem tanıdık bir tarih hem
   * de sonuçları çarpıcı — kullanıcı ekranın ne işe yaradığını ilk
   * saniyede anlıyor, sonra kendi tarihini seçiyor.
   */
  const [date, setDate] = useState<string | null>(EVENTS[0].date);

  /**
   * Kontrol paneli açık mı.
   *
   * ⚠️ VARSAYILAN KAPALI — ve düzenin tamamı buna dayanıyor. Takvim,
   * tutar alanı ve özel günler ekranın dört bloğunu kaplıyordu; cevap
   * listesi ekranın DIŞINA taşıyordu. Panel kapalıyken hepsi tek bir
   * özet satırına iniyor ve cevap ilk ekranda görünüyor.
   */
  const [panelOpen, setPanelOpen] = useState(false);
  const [amount, setAmount] = useState('10000');
  const [kind, setKind] = useState<string>('all');
  const amountInputRef = useRef<TextInput>(null);

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
  const loadMultiples = useCallback(async (forDate: string | null) => {
    if (!forDate) {
      setLoading(false);
      setMultiples(null);
      return;
    }
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
    if (date && minDate !== undefined && date < minDate) {
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

  if (showResult && date) {
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

  /**
   * Vitrin: en çok kazandıran üç varlık.
   *
   * ⚠️ FİLTREYE TABİ — `visible` kullanılıyor, ham liste değil. Kullanıcı
   * "Hisse" filtresini seçtiyse vitrin de hisse göstermeli; yoksa filtre
   * uygulanmış gibi görünüp üstte hâlâ BTC durur.
   */
  const top3 = visible.slice(0, 3);

  /**
   * "10.000 ₺ koysaydım ne olurdu" — YAKLAŞIK değer.
   *
   * ⚠️ FLOAT KULLANILIYOR VE BU BİLİNÇLİ BİR İSTİSNA. Projenin kuralı
   * "para bigint kuruş, float yasak". Burada izin veriliyor çünkü bu sayi
   * BİR ÖNİZLEME: başına `≈` konuyor ve kullanıcı varlığa dokunduğunda
   * sunucudan gelen KESİN değeri görüyor.
   *
   * Sınır şurada: bu sayiyla hesap yapılmıyor, emir verilmiyor, hiçbir
   * yere yazılmıyor. Yalnızca ekrana basılıyor. Bir kuruş sapması olsa
   * bile kimse para kaybetmiyor.
   *
   * `multiple` zaten sunucudan `number` olarak geliyor (what-if servisinin
   * bilinen float borcu, docs/batuhan.md'de işaretli) — yani zinciri
   * burada kırmıyoruz, zaten kırık geliyor.
   */
  function approxResult(multiple: number): string {
    return groupThousands(String(Math.round(Number(amount) * multiple)));
  }

  return (
    <View style={styles.screen}>
      {/* --- başlık --- */}
      <View style={styles.header}>
        <Text style={styles.title}>Ya Alsaydın</Text>

        <View style={styles.liveRow}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>şimdi</Text>
        </View>
      </View>

      {/*
        --- ÖZET ÇUBUĞU: sorunun tamamı tek satırda ---

        ⚠️ BU SATIR EKRANIN OMURGASI. Eskiden aynı bilgi dört ayrı blokta
        dağınıktı (takvim · tutar kartı · hazır tutarlar · özel günler) ve
        toplamda ekranın yaklaşık üçte ikisini kaplıyordu. Kullanıcı tek
        bir sayı görmek için hepsini geçmek zorundaydı.

        Şimdi soru tek satır, cevap hemen altında. Kontroller kaybolmadı —
        dokununca aşağıdaki panel açılıyor.
      */}
      <TouchableOpacity
        style={styles.summaryBar}
        onPress={() => setPanelOpen((open) => !open)}
        accessibilityRole="button"
        accessibilityLabel="Tutar ve tarihi değiştir"
        accessibilityState={{ expanded: panelOpen }}
      >
        <View style={styles.summaryTexts}>
          <Text style={styles.summaryAmount}>{groupThousands(amount)} ₺</Text>
          <Text style={styles.summarySep}>·</Text>
          <Text style={styles.summaryDate}>
            {date === null ? 'tarih seç' : humanDate(date)}
          </Text>
        </View>

        <Text style={styles.summaryCaret}>{panelOpen ? '⌃' : '⌄'}</Text>
      </TouchableOpacity>

      {notice !== null && <Text style={styles.notice}>{notice}</Text>}
      {error !== null && <Text style={styles.error}>{error}</Text>}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* --- KONTROL PANELİ: yalnızca özet çubuğuna dokununca --- */}
        {panelOpen && (
          <View style={styles.panel}>
            <SectionLabel>TUTAR (₺)</SectionLabel>
            <TextInput
              ref={amountInputRef}
              style={styles.textInput}
              keyboardType="numeric"
              value={amount === '0' ? '' : amount}
              onChangeText={(val) => {
                const clean = val.replace(/[^0-9]/g, '');
                setAmount(clean || '0');
              }}
              placeholder="Örn: 10000"
              placeholderTextColor={colors.inkDisabled}
            />

            <View style={styles.amountRowGrid}>
              {AMOUNTS.map((val) => {
                const on = val === amount;

                return (
                  <TouchableOpacity
                    key={val}
                    style={[styles.amountButton, on && styles.amountButtonOn]}
                    onPress={() => setAmount(val)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.amountText, on && styles.amountTextOn]}>
                      {groupThousands(val)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/*
              --- ÖZEL GÜNLER, TAKVİMİN ÜSTÜNDE ---

              ⚠️ SIRA DEĞİŞTİ. Eskiden takvim önce, özel günler sonraydı ve
              aralarında tutar kartı vardı — yani tarihi ayarlamanın iki yolu
              birbirinden koparılmıştı. Çoğu kullanıcı zaten hazır bir güne
              dokunuyor; takvim ancak o listede olmayan bir tarih için
              gerekiyor. Sık kullanılan önce.
            */}
            <SectionLabel>ÖZEL GÜNLER</SectionLabel>

            <View style={styles.eventGrid}>
              {[
                ...EVENTS,
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
                          `${symbol} için o tarihte veri yok — en eskisi ${minDate === undefined ? '?' : humanDate(minDate)}.`,
                        );
                        return;
                      }
                      setNotice(null);
                      setDate(event.date);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on, disabled: blocked }}
                  >
                    <Text style={[styles.eventLabel, on && styles.eventLabelOn]}>
                      {event.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <SectionLabel>BAŞKA BİR GÜN</SectionLabel>

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

        {date === null ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Bir tarih seç, o günden bugüne ne olduğunu göstereyim.
            </Text>
          </View>
        ) : loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.inkMuted} />
          </View>
        ) : (
          <>
            {/*
              --- VİTRİN: en çok kazandıran üç ---

              ⚠️ SAYI DEĞİL, PARA GÖSTERİYOR. Liste "13,4×" diyor; burası
              "≈ 134.000 ₺" diyor. Kat oranı doğru bilgi ama soyut —
              kullanıcının aklındaki soru "param ne olurdu". Çarpanı paraya
              çevirmek cevabı somutlaştırıyor.
            */}
            {top3.length > 0 && (
              <View style={styles.hero}>
                {top3.map((item, index) => {
                  const beatsInflation =
                    inflation === null || item.multiple >= inflation;

                  return (
                    <TouchableOpacity
                      key={item.symbol}
                      style={[
                        styles.heroCard,
                        item.symbol === symbol && styles.heroCardOn,
                      ]}
                      onPress={() => setSymbol(item.symbol)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: item.symbol === symbol }}
                    >
                      <View style={styles.heroTop}>
                        <AssetBadge symbol={item.symbol} />
                        <Text style={styles.heroName} numberOfLines={1}>
                          {item.name}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.heroMultiple,
                          index === 0 && styles.heroMultipleFirst,
                          // Enflasyonun altındaki kat yeşil DEĞİL — nominal
                          // artış var ama alım gücü kaybı var.
                          { color: beatsInflation ? colors.gain : colors.inkMuted },
                        ]}
                      >
                        {formatMultiple(item.multiple)}
                      </Text>

                      <Text style={styles.heroAmount} numberOfLines={1}>
                        ≈ {approxResult(item.multiple)} ₺
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* --- tür filtresi --- */}
            <View style={styles.filterRow}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {KINDS.map((item) => (
                  <Chip
                    key={item.key}
                    label={item.label}
                    selected={kind === item.key}
                    onPress={() => setKind(item.key)}
                  />
                ))}
              </ScrollView>
            </View>

            {/* --- tam liste + enflasyon eşiği --- */}
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
                        {/*
                          ⚠️ ALT SATIR ARTIK "BTC · crypto" DEĞİL, PARA.
                          Sembol zaten logoda ve adın yanında; türü de üstteki
                          filtre söylüyor. O satır bilgi tekrar ediyordu.
                          Yerine cevabın kendisi kondu.
                        */}
                        <Text style={styles.rowMeta}>
                          ≈ {approxResult(item.multiple)} ₺
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.rowMultiple,
                          {
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
          </>
        )}

      </ScrollView>

      {/*
        --- dinamik buton: SABİT, kaydırmıyor ---

        ⚠️ ÖNCE LİSTENİN ALTINDAYDI ve bildirilen sorun buydu: kullanıcı
        BNB'yi seçtikten sonra onu görmek için yirmi varlık boyunca aşağı
        kaydırmak zorundaydı. Seçim yukarıda, eylem aşağıdaydı.
      */}
      <View style={styles.ctaBar}>
        <TouchableOpacity
          style={styles.cta}
          onPress={() => setShowResult(true)}
          disabled={loading || date === null}
          accessibilityRole="button"
        >
          <Text style={styles.ctaText}>{selectedName}'i gör →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /*
    ================= YENİ DÜZENİN STİLLERİ =================
    Özet çubuğu · katlanır panel · vitrin kartları.
    Eski stiller aşağıda olduğu gibi duruyor; hiçbiri silinmedi çünkü
    panel açıldığında aynı kontroller aynı görünümle kullanılıyor.
  */

  /**
   * Özet çubuğu — tutar ve tarih tek satırda.
   *
   * ⚠️ KART GİBİ DEĞİL, ÇUBUK GİBİ duruyor: kenarlığı var, dolgusu az.
   * Kart yapsaydık ekrandaki üçüncü büyük kutu olurdu ve "kontrol" değil
   * "içerik" gibi okunurdu. Burası bir kontrol; göze çarpmalı ama
   * cevabın önüne geçmemeli.
   */
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.screen,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTexts: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  // Tutar VURGULU, tarih sakin: ikisi eşit ağırlıkta olsaydı göz nereye
  // bakacağını bilemezdi. Değiştirilen asıl şey tutar.
  summaryAmount: { fontFamily: fonts.monoBold, fontSize: 16, color: colors.ink },
  summarySep: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkDisabled },
  summaryDate: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkMuted },
  summaryCaret: { fontSize: 16, color: colors.inkFaint, paddingLeft: 8 },

  /**
   * Katlanır kontrol paneli.
   *
   * Kendi zemini var ki açıldığında "bu bir katman" hissi versin —
   * zeminsiz olsaydı liste ile panel birbirine karışırdı.
   */
  panel: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 10,
    marginBottom: 6,
  },

  /**
   * Vitrin — en çok kazandıran üç varlık, yan yana.
   *
   * ⚠️ ÜÇ SÜTUN, LİSTE DEĞİL. Alt alta koysaydık listenin ilk üç satırının
   * tekrarı gibi görünürdü. Yan yana durduklarında "bunlar seçilmiş"
   * mesajı veriyor ve dikeyde yalnızca bir satır yer kaplıyorlar.
   */
  hero: { flexDirection: 'row', gap: 8, marginTop: 4 },
  heroCard: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 8,
    alignItems: 'center',
  },
  heroCardOn: { borderColor: colors.accent },
  heroTop: { alignItems: 'center', gap: 6 },
  heroName: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  heroMultiple: { fontFamily: fonts.monoBold, fontSize: 20 },
  // Birinci sıra biraz daha büyük — sıralamayı renk yerine BOYUTLA
  // anlatıyoruz, çünkü renk zaten enflasyon eşiğini anlatmakla meşgul.
  heroMultipleFirst: { fontSize: 26 },
  heroAmount: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkFaint,
    textAlign: 'center',
  },

  /* ================= ESKİ STİLLER ================= */
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingTop: 18,
    paddingBottom: 10,
    backgroundColor: colors.surface,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 26,
    color: colors.ink,
    letterSpacing: -0.6,
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 6,
    backgroundColor: colors.gain,
  },
  liveText: { fontFamily: fonts.mono, fontSize: 12, color: colors.inkMuted },
  content: {
    paddingHorizontal: spacing.screen,
    paddingTop: 10, // Üstteki header ile uyumlu olması için 20'den 10'a düşürdük
    // Sabit düğmenin altında kalan son satır görünsün diye ek boşluk.
    paddingBottom: 24,
  },
  ctaBar: {
    paddingHorizontal: spacing.screen,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },



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
    borderRadius: 10,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eventChipOn: { backgroundColor: colors.inverse, borderColor: colors.inverse },
  eventLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.inkBright },
  eventLabelOn: { fontFamily: fonts.bold, color: colors.onInverse },


  amountRowGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  textInput: {
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    fontFamily: fonts.monoSemibold,
    fontSize: 14,
    color: colors.inkBright,
  },
  amountButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  amountButtonOn: { backgroundColor: colors.inverse, borderColor: colors.inverse },
  amountText: { fontFamily: fonts.monoSemibold, fontSize: 12, color: colors.inkMuted },
  amountTextOn: { fontFamily: fonts.monoBold, color: colors.onInverse },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  chipRow: { flexDirection: 'row', gap: 6, flex: 1 },

  notice: { fontFamily: fonts.regular, fontSize: 12, color: colors.warn, marginTop: 12 },
  error: { fontFamily: fonts.regular, fontSize: 12, color: colors.error, marginTop: 12 },

  loadingBox: { paddingVertical: 40, alignItems: 'center' },
  infoBox: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 14,
    padding: 20,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  infoText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 18,
  },

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
  rowMeta: { fontFamily: fonts.mono, fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  rowMultiple: { fontFamily: fonts.monoBold, fontSize: 16 },
  chevron: { fontSize: 16, color: colors.inkDisabled },

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
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.loss,
  },
  // Kesikli çizgi: RN'de `borderStyle: 'dashed'` tek kenarda güvenilir
  // değil, o yüzden ince bir çizgi + düşük opaklık.
  thresholdLine: { flex: 1, height: 1, backgroundColor: colors.loss, opacity: 0.45 },
  thresholdValue: { fontFamily: fonts.monoBold, fontSize: 14, color: colors.loss },

  cta: {
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.inverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.onInverse },
});
