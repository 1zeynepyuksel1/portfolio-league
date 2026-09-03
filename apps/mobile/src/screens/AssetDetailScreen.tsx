/**
 * AssetDetailScreen — bir varlığın fiyat grafiği ve geçmişi.
 *
 * Piyasa listesinden bir satıra dokununca açılır. Buradan Al/Sat ekranına
 * geçilir; yani akış: liste -> detay -> emir.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { History } from 'lucide-react-native';
import { apiFetch } from '../api/client';
import { useCurrency } from '../lib/currency';
import {
  formatChartDate,
  PriceChart,
  type ChartPoint,
} from '../components/PriceChart';
import { EVENTS } from './WhatIfScreen';
import { formatPrice, formatRelativeTime, formatPercent } from '../lib/format';
import { colors, fonts, radius, spacing, type } from '../theme';

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
  /**
   * ⚠️ ÇEVRİM SUNUCUDA, BURADA DEĞİL.
   *
   * Ekranda çevirseydik elimizde yalnızca GÜNCEL kur olurdu ve bütün
   * eğriyi ona bölerdik — her nokta aynı sayıya bölününce grafiğin
   * ŞEKLİ hiç değişmez, sadece etiketler değişir. Liranın değer kaybı
   * dolar kazancı gibi görünürdü.
   *
   * Ölçüldü (BTC, 90 gün): TL +%12,2 · dolar +%6,6.
   *
   * Sunucu her noktaya O ANIN kurunu uyguluyor. Buradaki iş sadece
   * tercihi soruya eklemek ve gelen sayıyı doğru simgeyle yazmak.
   */
  const { currency } = useCurrency();
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
    /** Sunucu hesaplıyor: bu varlık ŞU AN işlem görür mü. */
    tradable?: boolean;
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
        `/assets/${symbol}/prices?${query}&currency=${currency}`,
      );
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Grafik yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [symbol, range, zoom, currency]);

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
    }>(`/assets/${symbol}/stats?currency=${currency}`)
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
      ? ((Number(last.price) - Number(first.price)) /
          Number(first.price)) *
        100
      : null;

  const rising = changePercent !== null && changePercent >= 0;

  return (
    <View style={styles.container}>
      {/*
        Başlık ScrollView'un DIŞINDA — SABİT.

        ⚠️ ÖNCEDEN İÇİNDEYDİ VE BU BİR ÇIKMAZ SOKAKTI. Kullanıcı grafiğe
        veya 24 saat özetine bakmak için aşağı kaydırınca "‹ Geri" ekrandan
        çıkıyordu. Buton vardı, görünmüyordu; geri dönmek için ta yukarı
        kaydırmak gerekiyordu ve bunu bilmek imkânsızdı.

        Kaçış yolu her zaman görünür olmalı. Ekranın geri kalanı kayar,
        başlık kaymaz.
      */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.back}>‹ Geri</Text>
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>
            {name} ({symbol})
          </Text>
        </View>

        {/*
          ⚠️ NEDEN VAR — profesörün UX incelemesindeki en somut bulgu:
          Ya Alsaydın'ı keşfedilebilir kılmak. Önce Discovery akışında bir
          karosel denendi, ürün sahibi bunun yerine BURAYI istedi:
          kullanıcı zaten bu varlıkla ilgileniyorken soru ("peki 2020'de
          alsaydım?") tam olarak burada doğuyor, akışta değil.

          ⚠️ TARİH SABİT — 2023-01-02 ("2023 dibi", `EVENTS[2]`),
          Pandemi dibi (`EVENTS[0]`) DEĞİL. Ölçüldü: uygulamadaki 48
          varlığın en genci AVAX (`firstAvailable` 2020-09-22). Pandemi
          dibini (2020-03-12) varsayılan seçseydik SOL ve AVAX için
          "geçmiş fiyat kaydı bulunamadı" hatasıyla karşılaşılırdı —
          onlar henüz listelenmemişti. 2023 dibi her varlık için güvenli.

          ⚠️ `onClose()` ÖNCE ÇAĞRILIYOR. Bu ekran bir katman (App.tsx'te
          `detailAsset` state'i); Piyasa'ya geçerken katmanın kendisini
          kapatmazsak kullanıcı geri döndüğünde hâlâ bu ekranın üstünde
          bulur kendini.

          ⚠️ `setTimeout(..., 100)` — `GlobalShareMenu`'deki aynı desen.
          `switchTab` App.tsx'te `activeTab`'ı değiştiriyor; MarketScreen
          o an mount bile olmamış olabilir (kullanıcı Cüzdan'dan geldiyse).
          Gecikme olmadan `openWhatIf` MarketScreen'in dinleyicisi daha
          KURULMADAN ateşlenir ve kaybolur — sessizce, hatasız.
        */}
        <Pressable
          onPress={() => {
            onClose();
            DeviceEventEmitter.emit('switchTab', 'market');
            setTimeout(() => {
              DeviceEventEmitter.emit('openWhatIf', { date: EVENTS[2].date, symbol });
            }, 100);
          }}
          style={styles.whatIfBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${name} için Ya Alsaydın hesabını aç`}
        >
          <History size={16} color={colors.gain} strokeWidth={2.25} />
          {/*
            ⚠️ "Ya Alsaydın" YERİNE VARLIĞA ÖZEL CÜMLE. Genel etiket
            hangi varlığa dokunduğunu söylemiyordu; "Geçmişte Bitcoin
            alsaydın" hem düğmenin ne yapacağını hem HANGİ varlık için
            yapacağını tek bakışta veriyor.

            ⚠️ `numberOfLines={2}` — bazı varlık adları uzun ("Avustralya
            Doları", 18 harf). Sabit kısaltma yazmadım (`name.slice(0,N)`
            gibi); React Native kendi satır kırma/üç nokta mantığıyla
            hallediyor, kelimeyi ortasından kesmiyor.
          */}
          <Text style={styles.whatIfBtnText} numberOfLines={2}>
            Geçmişte {name} alsaydın
          </Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Güncel fiyat ve değişim */}
        <View style={styles.priceBlock}>
          <Text style={styles.price}>
            {scrubbed !== null
              ? formatPrice(scrubbed.price, currency)
              : last !== undefined
                ? formatPrice(last.price, currency)
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
              {formatPercent(changePercent, false)} 
              <Text style={styles.changeLabel}>
                ({RANGES.find((r) => r.value === range)?.label})
              </Text>
            </Text>
          )}
          {scrubbed !== null ? (
            <Text style={styles.asOf}>{formatChartDate(scrubbed.ts)}</Text>
          ) : last !== undefined ? (
            /*
              ⚠️ BORSA KAPALIYKEN SAAT YERİNE "piyasa kapalı".
              "16 sa" yazması arıza gibi okunuyordu; oysa hiçbir şey
              bozuk değil, seans kapalı. Aynı ayrım Piyasa listesinde
              ve cüzdanda da var.
            */
            <Text style={styles.asOf}>
              {stats?.tradable === false
                ? 'piyasa kapalı'
                : formatRelativeTime(last.ts)}
            </Text>
          ) : null}

          {/*
            ⚠️ NEDEN VAR — Batuhan'ın bir oturumda üç kez sorduğu soru:
            "Binance'te / Google'da farklı sayı görüyorum, bug mu bu?"
            Değil — TL fiyatı HER ZAMAN TCMB'nin resmi kuruyla hesaplanıyor
            (kripto ve maden USD → TL bu kurla çevriliyor, döviz varlıkları
            zaten bu kurun kendisi). Binance'in kendi USDT/TRY piyasası ya
            da Google'ın gösterdiği piyasa ortalaması FARKLI bir referans —
            "yanlış" değil, ölçtüğü şey farklı (bkz. docs/batuhan.md #46).

            ⚠️ KIND'A GÖRE DALLANMADI — bilerek. Kripto/döviz/maden'in
            üçü de aynı TCMB kuruna bağlı; ayrı metin yazmak `kind` alanını
            App.tsx → MarketScreen/PortfolioScreen → bu ekrana kadar
            taşımayı gerektirirdi (PortfolioScreen'in `Position` tipinde
            `kind` hiç yok — eklemek sunucu tarafını da değiştirirdi).
            Tek, genel bir cümle üç durumu da doğru şekilde kapsıyor.
          */}
          <Text style={styles.disclosure}>
            TL fiyatı TCMB'nin resmi kuruyla hesaplanır — borsalardaki
            anlık fiyattan küçük farklar (~%0,3-0,5) olması normaldir.
          </Text>
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
              currency={currency}
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

            <StatLine label="Yüksek" value={formatPrice(stats.high, currency)} />
            {stats.low !== null && (
              <StatLine label="Düşük" value={formatPrice(stats.low, currency)} />
            )}
            {stats.open !== null && (
              <StatLine label="Açılış" value={formatPrice(stats.open, currency)} />
            )}
            {stats.close !== null && (
              <StatLine label="Kapanış" value={formatPrice(stats.close, currency)} />
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

      </ScrollView>

      {/*
        AL/SAT ÇUBUĞU — ScrollView'un DIŞINDA, sabit.

        ⚠️ İÇERİDEYDİ VE EN ALTTAYDI. Grafiğe, aralık düğmelerine ve
        24 saat özetine baktıktan sonra ancak görünüyordu; oysa bu
        ekranın VAR OLMA sebebi o düğme. Kullanıcı fiyata bakıp
        "alayım" dediğinde kaydırmak zorunda kalıyordu.

        Başlık gibi bu da sabit: ekranın iki ucu duruyor, ortası kayıyor.
        Aynı desen — kaçış yolu ve asıl eylem her zaman görünür.
      */}
      <View style={styles.tradeBar}>
        <Pressable style={styles.tradeButton} onPress={onTrade}>
          <Text style={styles.tradeButtonText}>Al / Sat</Text>
        </Pressable>
      </View>
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
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
  },
  statsTitle: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.inkFaint,
    marginBottom: 8,
  },
  statLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statKey: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkMuted },
  statValue: { fontFamily: fonts.monoSemibold, fontSize: 14, color: colors.ink },

  container: { flex: 1, backgroundColor: colors.surface },
  // Başlık artık dışarıda, o yüzden üst boşluk ona ait.
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  // Sabit başlık: yatay boşluğu kendi taşıyor, alt kenarı içeriği ayırıyor.
  /*
    ⚠️ `alignItems: 'flex-start'` YALNIZCA VARSAYILAN — `whatIfBtn`
    kendi `alignSelf: 'stretch'`'iyle bunu EZİYOR (flexbox'ta bir
    çocuğun `alignSelf`'i ebeveynin `alignItems`'ini geçersiz kılar).
    Sonuç: `headerLeft` (Geri + başlık) yukarı yapışık kendi
    yüksekliğinde kalırken, düğme satırın TAMAMINI (o yüksekliği)
    dolduruyor — ilk sürümde düğme küçük bir hap gibi köşede
    yüzüyordu, kutunun geri kalanı boş kalıyordu.
  */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  /* `minWidth: 0` olmadan uzun varlık adı sağdaki düğmeyi ekran dışına iter. */
  headerLeft: { flex: 1, minWidth: 0, gap: 8 },
  /*
    ⚠️ SATIR DEĞİL SÜTUN OLDU. Etiket artık tek kelime değil, tam bir
    cümle ("Geçmişte Ethereum alsaydın") — ikonu metnin YANINA koysaydık,
    iki satıra sarılan yazının yanında ikon ya üstte ya altta kalır,
    hiçbir hizada iyi durmazdı. İkon üstte, metin altta, ikisi de ortalı.

    ⚠️ `maxWidth: '58%'` ŞART. "Avustralya Doları" gibi uzun bir ad
    sınırsız genişleseydi soldaki başlığı ("Geri" + varlık adı) neredeyse
    tamamen iterdi — `headerLeft`'in `minWidth: 0`'ı onu sıfıra kadar
    daraltabilir. Sınır, uzun adlarda metnin SARILMASINI zorluyor
    (`numberOfLines={2}` + bu genişlik), başlığı ezmek yerine.
  */
  whatIfBtn: {
    alignSelf: 'stretch',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    maxWidth: '58%',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    /*
      ⚠️ MAVİYDİ (`accent`), YEŞİLE ÇEVRİLDİ — kopuk durduğu için.
      Bu ekranda vurgu rengi zaten yeşil: "‹ Geri", Al/Sat düğmesi,
      seçili aralık düğmesi hepsi `colors.gain`. Mavi tek başına bu
      ekranda YABANCI bir renk ailesiydi.

      ⚠️ NORMALDE `gain`/`loss` bu projede YÖN taşır (kâr/zarar), süs
      değil — Segmented ve DesignKit'teki kural bu. Burada istisna:
      AssetDetailScreen'in KENDİSİ zaten yeşili "birincil eylem" rengi
      olarak kullanıyor (Geri, Al/Sat), bu düğme o dile katılıyor —
      yeni bir anlam eklemiyor, var olanı takip ediyor.
    */
    backgroundColor: colors.gainSoft,
  },
  whatIfBtnText: {
    fontFamily: fonts.semibold,
    fontSize: type.micro,
    color: colors.gain,
    textAlign: 'center',
  },
  back: { color: colors.gain, fontSize: 16, fontFamily: fonts.semibold },
  title: { color: colors.ink, fontSize: 26, fontFamily: fonts.bold },

  priceBlock: { marginBottom: 12 },
  price: { color: colors.ink, fontSize: 34, fontFamily: fonts.bold },
  change: { fontSize: 16, fontFamily: fonts.semibold, marginTop: 2 },
  changeLabel: { color: colors.inkFaint, fontFamily: fonts.regular, fontSize: 14 },
  asOf: { color: colors.inkFaint, fontSize: 12, marginTop: 2 },
  disclosure: {
    color: colors.inkFaint,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 6,
  },

  chartBox: { marginVertical: 8 },
  chartPlaceholder: {
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: { color: colors.error, fontSize: 14 },

  rangeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
  },
  rangeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    /* ⚠️ 8pt dolgu ~32pt veriyordu, taban 44pt. */
    minHeight: 44,
    justifyContent: 'center',
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
    marginTop: 8,
  },
  reset: {
    color: colors.gain,
    fontSize: 12,
    fontFamily: fonts.semibold,
  },
  zoomInfo: {
    color: colors.inkMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  hint: {
    color: colors.inkFaint,
    fontSize: 12,
    textAlign: 'center',
  },
  sparse: {
    color: colors.inkFaint,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 16,
  },

  // Sabit alt çubuk: kendi yatay boşluğu ve üst ayırıcı çizgisi var.
  tradeBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  tradeButton: {
    backgroundColor: colors.gain,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  tradeButtonText: { color: colors.ink, fontSize: 16, fontFamily: fonts.bold },
});
