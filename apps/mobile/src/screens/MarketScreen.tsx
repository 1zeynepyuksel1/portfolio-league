import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  RefreshControl,
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
  kind: 'crypto' | 'fx' | 'metal' | 'bist';
  /** ⚠️ STRING. Number'a çevirme — backend'deki bigint zinciri kırılır. */
  priceTry: string | null;
  priceUsd: string | null;
  /** Son 24 saatteki yüzde değişim. `null` = bilinmiyor, sıfır değil. */
  changePercent24h: string | null;
  asOf: string | null;
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
  { key: 'crypto', label: 'Kripto' },
  { key: 'fx', label: 'Döviz' },
  { key: 'metal', label: 'Metal' },
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

  return (
    <View style={styles.screen}>
      {/* --- başlık --- */}
      <View style={styles.header}>
        <Text style={styles.title}>Piyasa</Text>

        <View style={styles.liveRow}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>
            {formatRelativeTime(assets[0]?.asOf ?? null)}
          </Text>
        </View>
      </View>

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
          <View style={styles.chipRow}>
            {KINDS.map((item) => (
              <Chip
                key={item.key}
                label={item.label}
                count={counts[item.key] ?? 0}
                selected={kind === item.key}
                onPress={() => setKind(item.key)}
              />
            ))}
          </View>
        )}

        <CurrencyToggle />
      </View>

      {error !== null && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={visible}
        keyExtractor={(item) => item.symbol}
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
              <Text style={styles.rowMeta} numberOfLines={1}>
                {item.symbol} · {formatRelativeTime(item.asOf)}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingTop: 18,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 26,
    color: colors.ink,
    letterSpacing: -0.6,
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Yeşil nokta "veri akıyor" demek — fiyatın yönüyle ilgisi yok.
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gain,
  },
  liveText: { fontFamily: fonts.mono, fontSize: 11, color: colors.inkMuted },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.screen,
    marginTop: 14,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
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
    paddingTop: 14,
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
  rowName: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  rowMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 2,
  },
  rowRight: { alignItems: 'flex-end' },
  rowPrice: { fontFamily: fonts.monoBold, fontSize: 15, color: colors.ink },
  chevron: { fontSize: 18, color: colors.inkDisabled },

  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkFaint },

  banner: {
    margin: spacing.screen,
    padding: 14,
    borderRadius: 12,
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
