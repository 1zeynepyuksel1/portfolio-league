import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiFetch } from '../api/client';
import { formatPrice, formatRelativeTime } from '../lib/format';
import { useCurrency } from '../lib/currency';
import { CurrencyToggle } from '../components/CurrencyToggle';
import { AssetBadge, ChangeText, Chip, SectionLabel } from '../components/DesignKit';
import { colors, fonts, rowMetrics, spacing } from '../theme';
import { WhatIfScreen } from './WhatIfScreen';

/**
 * MarketScreen — `docs/export/9a-piyasa.html`
 *
 * Tasarımın üç eklediği şey: arama, tür filtresi, ve her satırda YÖN.
 *
 * Yön en önemlisi. Eski listede fiyat vardı ama "yükseliyor mu düşüyor
 * mu" bilgisi yoktu — kullanıcı 3.107.273 ₺ rakamına bakıp hiçbir şey
 * anlayamıyordu. Rakam tek başına bağlamsız; asıl soru "dün neredeydi".
 */

type Asset = {
  symbol: string;
  name: string;
  kind: 'crypto' | 'fx' | 'metal' | 'bist' | 'stock';
  /** ⚠️ STRING. Number'a çevirme — backend'deki bigint zinciri kırılır. */
  priceTry: string | null;
  priceUsd: string | null;
  /** Son 24 saatteki yüzde değişim. `null` = bilinmiyor, sıfır değil. */
  changePercent24h: string | null;
  asOf: string | null;
  /**
   * İşlem görebilir mi. Sunucudan geliyor; hisse dışındaki her varlıkta
   * `true`.
   *
   * ⚠️ `?` İLE İSTEĞE BAĞLI ve aşağıda `!== false` ile okunuyor: alan
   * dönmeyen bir sunucuya bağlanıldığında liste "her şey kapalı" gibi
   * görünmesin.
   */
  tradable?: boolean;
  firstAvailable: string | null;
};

type AssetsResponse = {
  currency: 'try' | 'usd';
  usdTryRate: string | null;
  rateAsOf: string | null;
  assets: Asset[];
};

/**
 * Ekranın sorma aralığı — cron'un YAZMA aralığından (15 sn) bilerek FARKLI.
 *
 * İkisi de 15 saniye olsaydı faz kilitlenirdi: ekran her seferinde cron'un
 * bir önceki turunu görürdü ve fiyat sürekli bir tur geride kalırdı.
 */
const REFRESH_MS = 5_000;

/** Tür filtreleri. `null` = tümü. */
const KINDS = [
  { key: 'all', label: 'Tümü' },
  { key: 'stock', label: 'ABD Hissesi' },
  { key: 'crypto', label: 'Kripto' },
  { key: 'fx', label: 'Döviz' },
  /*
    ⚠️ `metal` ÇİPİ BİLEREK YOK — ve bedeli kayda geçsin.

    Satıra beş çip sığmıyor (yatay, sabit genişlik). Seçim yapmak
    gerekti: 30 hisse mi 2 maden mi. Sayı hisseden yana.

    Bedeli: gram altın ve gümüş artık yalnızca "Tümü" altında ya da
    ARAMA ile bulunuyor. Kaybolmuyorlar, sadece bir tık uzaktalar.

    ⚠️ `bist` de yok, ama farklı sebeple: şemada duruyor, hiç varlığı
    yok. Çipi boş liste açardı.
  */
] as const;

type KindKey = (typeof KINDS)[number]['key'];

type Props = {
  onSelectAsset?: (symbol: string, name: string) => void;
};

export function MarketScreen({ onSelectAsset }: Props = {}) {
  const { currency, query } = useCurrency();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [rate, setRate] = useState<string | null>(null);
  const [rateAsOf, setRateAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /*
    ⚠️ ALSAYDIN KEŞFET'TEN BURAYA TAŞINDI.

    Gerekçe "yer mi araç mı" ayrımı: Alsaydın bir ARAÇ — kimse
    "Alsaydın'a bakayım" diye uygulamayı açmaz; bir merak gelir,
    hesaplatır, çıkar. Araca kalıcı bir sekme vermek yer israfı,
    ama boşlukta da duramaz.

    Piyasa'nın içi doğru yer çünkü ikisi de aynı şeyle ilgili:
    varlıklar. Kullanıcı bir coin'e bakarken "peki 2020'de
    alsaydım?" diye düşünür — o soru Keşfet'te değil BURADA doğuyor.
  */
  const [view, setView] = useState<'market' | 'whatif'>('market');
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<KindKey>('all');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * ⚠️ SORGU PARÇASI REF'TE — bayat kapanış (stale closure) tuzağı.
   *
   * `load` aşağıda `useCallback(..., [])` ile bir kez üretilip
   * `setInterval`'a veriliyor. `query`'yi doğrudan okusaydı kurulduğu
   * andaki değeri sonsuza kadar hatırlardı: kullanıcı dolara geçse bile
   * zamanlayıcı TL istemeye devam ederdi. Elle yenilemede doğru,
   * otomatik yenilemede yanlış — fark edilmesi zor bir hata.
   */
  const queryRef = useRef(query);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  const load = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) setRefreshing(true);

    try {
      const data = await apiFetch<AssetsResponse>(`/assets${queryRef.current}`);
      setAssets(data.assets);
      setRate(data.usdTryRate);
      setRateAsOf(data.rateAsOf);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fiyatlar alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Para birimi değişince hemen tazele — 5 saniye bekletme.
  useEffect(() => {
    void load();
  }, [query, load]);

  useEffect(() => {
    function startPolling() {
      if (intervalRef.current !== null) return;
      intervalRef.current = setInterval(() => void load(), REFRESH_MS);
    }

    function stopPolling() {
      if (intervalRef.current === null) return;
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    void load();
    startPolling();

    // Arka planda durdurulmazsa pil yakar ve sunucuya boşuna yük biner.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void load();
        startPolling();
      } else {
        stopPolling();
      }
    });

    return () => {
      stopPolling();
      subscription.remove();
    };
  }, [load]);

  /**
   * Görünen liste: önce tür, sonra arama.
   *
   * ⚠️ ARAMA HEM ADA HEM SEMBOLE BAKIYOR ve Türkçe küçültme kullanıyor.
   * `toLowerCase()` tek başına yetmez: "ALTIN" içindeki `I` harfi
   * Türkçe'de `ı` olur, İngilizce kuralıyla `i`. Kullanıcı "altın"
   * yazdığında "GRAM_ALTIN" bulunmalı — `toLocaleLowerCase('tr')` bunu
   * çözüyor.
   */
  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('tr');

    return assets.filter((asset) => {
      if (kind !== 'all' && asset.kind !== kind) return false;
      if (needle === '') return true;

      return (
        asset.name.toLocaleLowerCase('tr').includes(needle) ||
        asset.symbol.toLocaleLowerCase('tr').includes(needle)
      );
    });
  }, [assets, kind, search]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: assets.length };

    for (const asset of assets) {
      map[asset.kind] = (map[asset.kind] ?? 0) + 1;
    }

    return map;
  }, [assets]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.inkMuted} />
      </View>
    );
  }

  const searching = search.trim() !== '';

  const sekmeler = (
    /*
      ⚠️ SEGMENTLİ DENETİM (segmented control) — iki pili yan yana
      koymak yerine ortak bir kabın içine aldık.

      Ayrı iki pil, seçili olmayanı "yok" gibi gösteriyordu; kap
      ikisinin de var olduğunu ve AYNI GRUBA ait olduğunu söylüyor.
      Kullanıcı burada iki seçenek arasında geçiş yaptığını
      biçimden anlıyor, metni okumadan.
    */
    <View style={styles.subTabs}>
      {([
        { key: 'market' as const, label: 'Piyasa' },
        { key: 'whatif' as const, label: 'Ya Alsaydın' },
      ]).map((s) => (
        <TouchableOpacity
          key={s.key}
          onPress={() => setView(s.key)}
          style={[styles.subTab, view === s.key && styles.subTabOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: view === s.key }}
        >
          <Text style={[styles.subTabText, view === s.key && styles.subTabTextOn]}>
            {s.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  /*
    ⚠️ ERKEN DÖNÜŞ — mevcut çizimi SARMADIK.

    `{view === 'market' && (...)}` diye tüm gövdeyi sarmak da olurdu
    ama 160 satırlık JSX'i bir koşulun içine almak, yalnızca girinti
    değiştiği için okunamaz bir fark üretirdi. Erken dönüş iki bloğu
    da düz tutuyor.
  */
  if (view === 'whatif') {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>{sekmeler}</View>
        <WhatIfScreen embedded />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/*
        --- başlık ---

        ⚠️ ÜÇ SÜTUNLU DÜZEN DENENDİ VE KIRILDI.

        Sekmeler + sağdaki "22 sa önce" satırı, ekran genişliğini
        birlikte AŞIYORDU. Orta blokta `flexShrink` engeli olmadığı
        için sıkışan taraf sekmeler oldu: "Ya Alsaydın" yazısının
        başı kırpıldı.

        ⚠️ Asıl hata düzen değil, İÇERİK FAZLALIĞIYDI. "22 sa önce"
        bilgisi zaten AŞAĞIDA, her varlık satırının içinde yazıyor
        (Bitcoin · 22 sa önce). Aynı bilgi ekranda elli bir kez
        görünüyordu; başlıktaki kopyası hiçbir şey eklemiyordu.

        Onu kaldırınca sekmeler tek başına kaldı ve gerçekten
        ortalanabildi — sıkıştırma hilesine gerek kalmadan.
      */}
      <View style={styles.header}>{sekmeler}</View>

      {/*
        ⚠️ ARAMA VE ÇİPLER LİSTENİN BAŞLIĞINA TAŞINDI.

        Önce hepsi `FlatList`'in KARDEŞİYDİ, yani sabitti: başlık +
        arama + çipler + para birimi ekranın üstünde ~330 piksel yer
        kaplıyor ve hiç kaybolmuyordu. Küçük bir telefonda listeye
        kalan alan yarıdan azdı.

        ⚠️ NE SABİT KALMALI, NE KAYMALI — AYRIM ŞU:
          sabit  -> nerede olduğunu söyleyen şey (sekmeler)
          kayan  -> içeriğe AİT olan şey (arama, filtre, liste)

        Arama ve filtre listenin araçları; liste kayarken onların
        ekranı işgal etmesi için sebep yok. Kullanıcı yukarı
        kaydırdığında geri geliyorlar.

        ⚠️ `ListHeaderComponent` bir FONKSİYON DEĞİL, ELEMAN olarak
        veriliyor. Fonksiyon versek her çizimde yeni bir bileşen tipi
        üretilir, React onu "başka bir bileşen" sanar ve TextInput
        her harfte odağını kaybederdi.
      */}
      <FlatList
        showsVerticalScrollIndicator={false}
        data={visible}
        keyExtractor={(item) => item.symbol}
        ListHeaderComponent={
          <>
      {/* --- arama --- */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Varlık ara"
          placeholderTextColor={colors.inkDisabled}
          autoCorrect={false}
          // ⚠️ Otomatik büyük harf KAPALI: "Bitcoin" yazmaya başlayınca
          // klavye "B" yapıyor ve arama Türkçe küçültmeyle eşleşse de
          // kullanıcı yazdığını farklı görüyor.
          autoCapitalize="none"
          returnKeyType="search"
        />
        {searching && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={styles.searchClear}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* --- filtre / sonuç sayısı --- */}
      <View style={styles.filterRow}>
        {searching ? (
          <SectionLabel>{visible.length} SONUÇ</SectionLabel>
        ) : (
          /*
            ⚠️ KAYDIRILABİLİR — düz `View` DEĞİL.

            Etiketler büyüdükçe (ör. "ABD Hissesi") sabit genişlikli bir
            satırda çipler sıkışıp yazıları kırpılıyordu. Kırpılan bir
            etiket hata vermiyor, sadece okunmaz oluyor — sessiz bozulma.

            `ScrollView` ile taşan çip kaybolmuyor, kaydırılıyor. Şu an
            dördü sığıyor; ileride biri eklenirse düzen yine bozulmayacak.
          */
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {KINDS.map((item) => (
              <Chip
                key={item.key}
                label={item.label}
                count={counts[item.key] ?? 0}
                selected={kind === item.key}
                onPress={() => setKind(item.key)}
              />
            ))}
          </ScrollView>
        )}

        <CurrencyToggle />
      </View>

      {/*
        ⚠️ HATA SATIRI DA BAŞLIKTA — taşıma sırasında düşürmüştüm.
        Listenin üstünde durmalı: hata listeyle ilgili ("fiyatlar
        okunamadı") ve liste kayınca onunla birlikte kaymalı.
      */}
      {error !== null && <Text style={styles.error}>{error}</Text>}
          </>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.inkMuted}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {searching ? 'Eşleşen varlık yok.' : 'Varlık listesi boş.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => onSelectAsset?.(item.symbol, item.name)}
            disabled={onSelectAsset === undefined}
            accessibilityRole="button"
            accessibilityLabel={`${item.name} detayını aç`}
          >
            <AssetBadge symbol={item.symbol} />

            <View style={styles.rowNames}>
              <Text style={styles.rowName} numberOfLines={1}>
                {item.name}
              </Text>
              {/*
                ⚠️ KAPALI PİYASADA SAAT YERİNE "kapalı" YAZIYOR.

                Alt yazı normalde "AAPL · 9 sn önce" diyor. ABD borsası
                kapalıyken son fiyat saatler, hafta sonu ise günler öncesine
                ait olur ve satır "AAPL · 16 sa önce" diye görünürdü —
                yani ARIZA gibi. Oysa hiçbir şey bozuk değil, piyasa kapalı.

                Aynı ayrım emir motorunda da var: `MARKET_CLOSED` ile
                `STALE_PRICE` ayrı hata kodları (orders/repository.ts).
                Ekranın da aynı ayrımı yapması gerekiyordu.
              */}
              <Text style={styles.rowMeta} numberOfLines={1}>
                {item.symbol} ·{' '}
                {item.tradable === false ? (
                  <Text style={styles.rowClosed}>piyasa kapalı</Text>
                ) : (
                  formatRelativeTime(item.asOf, true)
                )}
              </Text>
            </View>

            <View style={styles.rowRight}>
              <Text style={styles.rowPrice}>
                {/* ⚠️ Dolar alanı boşsa TL'ye DÜŞÜLMÜYOR: TL rakamını $
                    simgesiyle yazmak sessiz bir yalan olurdu. */}
                {currency === 'usd'
                  ? item.priceUsd == null
                    ? '—'
                    : formatPrice(item.priceUsd, 'usd')
                  : item.priceTry == null
                    ? '—'
                    : formatPrice(item.priceTry)}
              </Text>

              <ChangeText percent={item.changePercent24h} size={12} />
            </View>

            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
      />

      {/* --- dolar dipnotu --- */}
      {currency === 'usd' && rate !== null && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Dolar fiyatını sunucu çeviriyor. USDTRY kuru{' '}
            <Text style={styles.bannerStrong}>{formatPrice(rate)}</Text> ile
            hesaplandı, {formatRelativeTime(rateAsOf)} güncellendi.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  centered: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: {
    flexDirection: 'row',
    // Tek çocuk var ve o ortalanıyor — hile yok.
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingTop: 20,
  },
  /*
    ⚠️ BÜYÜK "Piyasa" BAŞLIĞI SEKMELERLE DEĞİŞTİ. İkisini birden
    tutsaydık "Piyasa" kelimesi ekranda iki kez görünürdü — biri
    başlık, biri sekme. Aynı kelimeyi iki kez yazmak, kullanıcıya
    ikisinin farklı şeyler olduğunu düşündürür.
  */
  subTabs: {
    flexDirection: 'row',
    gap: 4,
    // Ortak kap: iki seçeneğin aynı gruba ait olduğunu gösteriyor.
    backgroundColor: colors.surfaceRaised,
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subTab: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    /*
      ⚠️ SEÇİLİ OLMAYAN DA AYNI DOLGUYU TAŞIYOR (zemini saydam).
      Dolguyu yalnızca seçiliye verseydik seçim değiştiğinde
      pilin genişliği değişir ve satır her dokunuşta oynardı.
    */
    backgroundColor: 'transparent',
  },
  /*
    ⚠️ AKTİF PİL VURGU RENGİNDE — ama yazı BEYAZ, `colors.ink` değil.

    Mavi zemin üstünde tema mürekkebi yeterli karşıtlık vermiyor.
    Erişilebilirlik eşiği (WCAG AA) normal metin için 4.5:1; beyaz
    bunu sağlıyor, kırık beyaz sağlamıyor.
  */
  subTabOn: { backgroundColor: colors.accent },
  subTabText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.inkMuted,
  },
  subTabTextOn: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Yeşil nokta "veri akıyor" demek — fiyatın yönüyle ilgisi yok.
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 6,
    backgroundColor: colors.gain,
  },
  liveText: { fontFamily: fonts.mono, fontSize: 12, color: colors.inkMuted },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.screen,
    marginTop: 16,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: { fontSize: 16, color: colors.inkFaint },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink,
    // Android'de TextInput'un kendi dikey boşluğu satırı kaydırıyor.
    padding: 0,
  },
  searchClear: { fontSize: 14, color: colors.inkFaint, paddingHorizontal: 4 },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingTop: 16,
    paddingBottom: 12,
  },
  chipRow: { flexDirection: 'row', gap: 7, flex: 1 },

  error: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.error,
    paddingHorizontal: spacing.screen,
    paddingBottom: 8,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: spacing.screen,
    paddingVertical: rowMetrics.paddingVertical,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowNames: { flex: 1 },
  rowName: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  // Kapalı işareti soluk sarı: uyarı değil DURUM bilgisi. Kırmızı
  // yapsaydık "hata" gibi, yeşil yapsaydık "iyi" gibi okunurdu.
  rowClosed: { color: colors.warn },

  rowMeta: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkFaint,
    marginTop: 2,
  },
  rowRight: { alignItems: 'flex-end' },
  rowPrice: { fontFamily: fonts.monoBold, fontSize: 16, color: colors.ink },
  chevron: { fontSize: 20, color: colors.inkDisabled },

  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkFaint },

  banner: {
    margin: spacing.screen,
    padding: 16,
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.inkMuted,
  },
  bannerStrong: { fontFamily: fonts.monoSemibold, color: colors.inkBright },
});
