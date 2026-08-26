import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiFetch } from '../api/client';
import {
  formatCentsString,
  formatPrice,
  formatQuantity,
  formatRelativeTime,
} from '../lib/format';
import { useCurrency } from '../lib/currency';
import { CurrencyToggle } from '../components/CurrencyToggle';
import {
  AllocationBar,
  colorForLabel,
  type Slice,
} from '../components/AllocationBar';
import {
  AssetBadge,
  BigAmount,
  ChangeText,
  Chip,
  SectionLabel,
} from '../components/DesignKit';
import { colors, fonts, rowMetrics, spacing } from '../theme';

/**
 * PortfolioScreen — `docs/export/5a-filtre-logo.html`
 *
 * Tasarımın adı "Filtreli liste + logo yuvaları" ama asıl kararı şu:
 * **cüzdan bir kart yığını değil, bir VERİ TABLOSU.**
 *
 * Eski hâlde her pozisyon gölgeli bir kartın içindeydi. Tasarım kartları
 * atıp satırları ince ayraçlarla ayırıyor ve üstlerine sütun başlığı
 * koyuyor. Sebebi: kullanıcı burada tek tek varlıklara bakmıyor, onları
 * KARŞILAŞTIRIYOR. Kart karşılaştırmayı zorlaştırır — her kartın kendi
 * çerçevesi göz için bir duraktır. Hizalı sütunlar gözü aşağı akıtır.
 */

type Position = {
  symbol: string;
  name: string;
  quantity: string;
  priceTry: string | null;
  priceUsd: string | null;
  valueCents: string | null;
  valueUsdCents: string | null;
  sharePercent: string | null;
  asOf: string | null;

  costCents: string;
  costUsdCents: string | null;
  profitCents: string;
  profitUsdCents: string | null;
  /**
   * ⚠️ `null` "sıfır" DEĞİL: fiyat okunamamış ya da maliyet sıfır olduğu
   * için hesaplanamamış demek. Sıfır göstermek "kâr yok" derdi.
   */
  profitPercent: string | null;
};

type Portfolio = {
  currency: 'try' | 'usd';
  usdTryRate: string | null;
  rateAsOf: string | null;

  cashCents: string;
  positionsValueCents: string;
  totalValueCents: string;
  depositedCents: string;
  profitCents: string;

  cashUsdCents: string | null;
  positionsValueUsdCents: string | null;
  totalValueUsdCents: string | null;
  depositedUsdCents: string | null;
  profitUsdCents: string | null;

  profitPercent: string | null;
  hasIncompletePrices: boolean;
  positions: Position[];
};

/** Piyasa ekranıyla aynı sebeple cron aralığından farklı — faz kilitlenmesin. */
const REFRESH_MS = 10_000;

/**
 * Katlanmış hâlde kaç satır görünüyor.
 *
 * ⚠️ NEDEN KATLANIYOR: cüzdanda yirmi pozisyon varsa liste ekranı
 * doldurur ve "son işlemler" bloğu görünmez olur. Kullanıcı onun var
 * olduğunu bile bilmez. Dört satır "burada bir liste var" demeye yetiyor.
 */
const COLLAPSED_ROWS = 4;

type Order = {
  id: string;
  symbol: string;
  name: string;
  side: 'buy' | 'sell';
  quantity: string;
  priceTry: string;
  netCents: string;
  executedAt: string;
};

/**
 * Sıralama durumu.
 *
 * ⚠️ `null` = SUNUCUNUN SIRASI. Üçüncü bir durum olarak duruyor: kullanıcı
 * aynı başlığa üçüncü kez dokununca kendi sıralamasından çıkıp varsayılana
 * dönebiliyor. İki durumlu yapsaydık (artan/azalan) varsayılana dönmenin
 * yolu kalmazdı.
 */
type SortKey = 'change' | 'value';
type SortState = { key: SortKey; desc: boolean } | null;

/**
 * Filtre çipleri.
 *
 * ⚠️ `kind` sunucudan GELMİYOR — `/portfolio` varlık türünü döndürmüyor.
 * Sembolden çıkarım yapmak ("GRAM_ ile başlıyorsa maden") kırılgan olurdu:
 * yeni bir maden farklı adlansa sessizce yanlış kutuya düşerdi.
 *
 * Bu yüzden şimdilik yalnızca "Tümü" var. Sunucu `kind` alanını
 * eklediğinde diğer çipler açılacak — tasarımdaki hâlleriyle.
 */
type Filter = 'all';

export function PortfolioScreen({
  onSelectAsset,
}: {
  /**
   * Pozisyona dokununca piyasa detayına götürür.
   *
   * İsteğe bağlı: ekran bu prop olmadan da çalışıyor, satırlar sadece
   * tıklanamaz oluyor. Zorunlu yapsaydık ekranı tek başına denemek
   * imkânsızlaşırdı.
   */
  onSelectAsset?: (symbol: string, name: string) => void;
}) {
  const { currency, query } = useCurrency();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter] = useState<Filter>('all');

  const [sort, setSort] = useState<SortState>(null);
  const [expandedPositions, setExpandedPositions] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Zamanlayıcının içindeki `load` kurulduğu andaki `query`'yi hatırlar;
  // ref bunu kırıyor (bkz. MarketScreen'deki aynı desen).
  const queryRef = useRef(query);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  const load = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) setRefreshing(true);

    try {
      /**
       * Portföy ve işlemler PARALEL çekiliyor.
       *
       * Sırayla atsaydık iki gidiş-dönüş süresi toplanırdı; ikisi de
       * diğerinin sonucuna ihtiyaç duymuyor.
       *
       * ⚠️ İşlem listesi hata verirse portföy YİNE de gösteriliyor:
       * `catch` ile boş diziye düşüyor. `Promise.all` kullansaydık
       * işlem sorgusundaki bir hata bütün ekranı düşürürdü.
       */
      const [data, orderData] = await Promise.all([
        apiFetch<Portfolio>(`/portfolio${queryRef.current}`),
        apiFetch<{ orders: Order[] }>('/orders?limit=20').catch(() => ({
          orders: [] as Order[],
        })),
      ]);

      setPortfolio(data);
      setOrders(orderData.orders);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Portföy alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /**
   * Seçili para birimine göre doğru alanı seçip biçimlendirir.
   *
   * ⚠️ `== null` bilerek: alan sunucudan hiç gelmezse `undefined` olur ve
   * `=== null` onu kaçırır; sonra `BigInt(undefined)` çizim sırasında
   * hata fırlatır ve React bütün ağacı söker (ekran kararır).
   */
  const money = useCallback(
    (tryCents: string, usdCents: string | null): string => {
      if (currency === 'try') return formatCentsString(tryCents);

      return usdCents == null ? '—' : formatCentsString(usdCents, 'usd');
    },
    [currency],
  );

  useEffect(() => {
    void load();
  }, [query, load]);

  useEffect(() => {
    function start() {
      if (intervalRef.current !== null) return;
      intervalRef.current = setInterval(() => void load(), REFRESH_MS);
    }

    function stop() {
      if (intervalRef.current === null) return;
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    void load();
    start();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void load();
        start();
      } else {
        stop();
      }
    });

    return () => {
      stop();
      subscription.remove();
    };
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.inkMuted} />
      </View>
    );
  }

  if (error || !portfolio) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Portföy okunamadı.'}</Text>
        <TouchableOpacity style={styles.retry} onPress={() => void load()}>
          <Text style={styles.retryText}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  /**
   * Sıralanmış pozisyonlar.
   *
   * ⚠️ KOPYA ÜZERİNDE SIRALANIYOR (`[...]`). `sort` diziyi YERİNDE
   * değiştiriyor; doğrudan `portfolio.positions.sort()` yazsaydık state
   * içindeki diziyi mutasyona uğratırdık ve React değişikliği fark
   * etmediği için ekran bazen güncellenmezdi.
   */
  const sorted = (() => {
    const list = [...portfolio.positions];

    if (sort === null) return list;

    const direction = sort.desc ? -1 : 1;

    return list.sort((a, b) => {
      if (sort.key === 'change') {
        // ⚠️ `null` yüzdeler HER ZAMAN SONA. Sıfır sayıp araya
        // karıştırsaydık "bilinmiyor" ile "değişmedi" aynı yere düşerdi.
        const av = a.profitPercent === null ? null : Number(a.profitPercent);
        const bv = b.profitPercent === null ? null : Number(b.profitPercent);

        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;

        return (av - bv) * direction;
      }

      // Değer kuruş cinsinden bigint metni — `Number` yerine `BigInt`
      // karşılaştırılıyor ki büyük portföylerde hassasiyet kaybolmasın.
      const av = a.valueCents === null ? null : BigInt(a.valueCents);
      const bv = b.valueCents === null ? null : BigInt(b.valueCents);

      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;

      if (av === bv) return 0;

      return (av < bv ? -1 : 1) * direction;
    });
  })();

  const positions = expandedPositions ? sorted : sorted.slice(0, COLLAPSED_ROWS);

  const visibleOrders = expandedOrders ? orders : orders.slice(0, 3);

  /** Dilim renklerinin sabit sırası — satır rozetleri çubukla eşleşsin. */
  const sliceOrder = portfolio.positions
    .filter((p) => p.sharePercent !== null)
    .map((p) => p.symbol);

  /**
   * Sütun başlığına dokunulunca: azalan -> artan -> varsayılan.
   *
   * ⚠️ ÜÇÜNCÜ DOKUNUŞ SIRALAMAYI KALDIRIYOR. İki durumlu yapsaydık
   * kullanıcı sunucunun sırasına bir daha dönemezdi.
   */
  function toggleSort(key: SortKey) {
    setSort((current) => {
      if (current === null || current.key !== key) return { key, desc: true };
      if (current.desc) return { key, desc: false };
      return null;
    });
  }

  function sortMark(key: SortKey): string {
    if (sort === null || sort.key !== key) return '';
    return sort.desc ? ' ↓' : ' ↑';
  }

  /**
   * Dağılım dilimleri — pozisyonlar + nakit.
   *
   * ⚠️ NAKİT DE BİR DİLİM. Atlasaydık yüzdeler toplamı 100 etmez ve çubuk
   * "hepsi yatırımda" yalanını söylerdi. Nakitte durmak da bir pozisyon.
   */
  const slices: Slice[] = [];

  for (const p of positions) {
    if (p.sharePercent === null || p.valueCents === null) continue;

    slices.push({
      label: p.symbol,
      percent: Number(p.sharePercent),
      detail: `${money(p.valueCents, p.valueUsdCents)} · ${formatQuantity(p.quantity)} adet`,
    });
  }

  // Nakit yüzdesi: toplamdan pozisyonların payı düşülerek. Ayrıca
  // hesaplamıyoruz — sunucunun payda kullandığı toplamla aynı kalsın.
  const cashPercent =
    100 - slices.reduce((sum, s) => sum + s.percent, 0);

  if (cashPercent > 0.05) {
    slices.push({
      label: 'NAKİT',
      percent: cashPercent,
      detail: money(portfolio.cashCents, portfolio.cashUsdCents),
    });
  }

  const gaining = !portfolio.profitCents.startsWith('-');

  return (
    <FlatList
        showsVerticalScrollIndicator={false}
      style={styles.screen}
      data={positions}
      keyExtractor={(item) => item.symbol}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load(true)}
          tintColor={colors.inkMuted}
        />
      }
      ListHeaderComponent={
        <View>
          {/* --- başlık --- */}
          <View style={styles.topRow}>
            <SectionLabel>
              CÜZDAN · {currency === 'usd' ? 'USD' : 'TRY'}
            </SectionLabel>
            <CurrencyToggle />
          </View>

          {/* --- toplam --- */}
          <View style={styles.totalBlock}>
            <BigAmount
              value={money(
                portfolio.totalValueCents,
                portfolio.totalValueUsdCents,
              )}
            />

            <View style={styles.deltaRow}>
              <Text
                style={[
                  styles.delta,
                  { color: gaining ? colors.gain : colors.loss },
                ]}
              >
                {gaining ? '+' : ''}
                {money(portfolio.profitCents, portfolio.profitUsdCents)}
              </Text>

              <ChangeText percent={portfolio.profitPercent} />

              <Text style={styles.deltaLabel}>TÜM ZAMANLAR</Text>
            </View>

            {currency === 'usd' && portfolio.usdTryRate != null && (
              <Text style={styles.rateNote}>
                1 $ = {formatPrice(portfolio.usdTryRate)} · bugünün kuruyla
              </Text>
            )}
          </View>

          {/* --- dağılım --- */}
          <View style={styles.allocation}>
            <AllocationBar slices={slices} />
          </View>

          {/* --- filtre --- */}
          <View style={styles.chipRow}>
            <Chip label="Tümü" count={positions.length} selected={filter === 'all'} />
          </View>

          {/* --- nakit / varlık --- */}
          <View style={styles.statGrid}>
            <View style={[styles.statCell, styles.statDivider]}>
              <SectionLabel>NAKİT</SectionLabel>
              <Text style={styles.statValue}>
                {money(portfolio.cashCents, portfolio.cashUsdCents)}
              </Text>
            </View>

            <View style={styles.statCell}>
              <SectionLabel>VARLIK</SectionLabel>
              <Text style={styles.statValue}>
                {money(
                  portfolio.positionsValueCents,
                  portfolio.positionsValueUsdCents,
                )}
              </Text>
            </View>
          </View>

          {portfolio.hasIncompletePrices && (
            <Text style={styles.warning}>
              Bazı varlıkların fiyatı okunamadı — toplam eksik olabilir.
            </Text>
          )}

          {/* --- tablo başlığı --- */}
          {positions.length > 0 && (
            <View style={styles.tableHead}>
              <Text style={[styles.headCell, styles.headAsset]}>VARLIK</Text>

              <TouchableOpacity
                style={styles.headChange}
                onPress={() => toggleSort('change')}
                accessibilityRole="button"
                accessibilityLabel="Değişime göre sırala"
              >
                <Text
                  style={[
                    styles.headCell,
                    styles.headRight,
                    sort?.key === 'change' && styles.headActive,
                  ]}
                >
                  DEĞİŞİM{sortMark('change')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.headValue}
                onPress={() => toggleSort('value')}
                accessibilityRole="button"
                accessibilityLabel="Değere göre sırala"
              >
                <Text
                  style={[
                    styles.headCell,
                    styles.headRight,
                    sort?.key === 'value' && styles.headActive,
                  ]}
                >
                  DEĞER{sortMark('value')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Henüz varlığın yok</Text>
          <Text style={styles.emptyText}>
            Piyasa sekmesinden ilk alımını yapabilirsin.
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
          <View style={styles.rowAsset}>
            <AssetBadge
              symbol={item.symbol}
              tint={colorForLabel(item.symbol, sliceOrder)}
            />

            <View style={styles.rowNames}>
              <Text style={styles.rowName} numberOfLines={1}>
                {item.name}
              </Text>
              {/*
                ⚠️ numberOfLines={1}: miktar uzun ondalıklı olabiliyor
                (0,00606200) ve sarınca satır yüksekliğini bozuyordu.
                Sığmazsa kesilsin — asıl bilgi ad, miktar ikincil.
              */}
              <Text style={styles.rowQuantity} numberOfLines={1}>
                {formatQuantity(item.quantity)}
              </Text>
            </View>
          </View>

          {/*
            ⚠️ BU SÜTUN "24 SAATLİK DEĞİŞİM" DEĞİL, "ALIMDAN BERİ".
            Tasarımda günlük değişim var ama sunucu onu hesaplamıyor.
            Elimizdeki gerçek sayıyı göstermek, olmayan bir sayıyı
            uydurmaktan iyidir. Sunucu 24s değişimi eklediğinde burası
            değişecek — başlık da.
          */}
          {/*
            NET TUTAR — yüzdenin SOLUNDA.

            ⚠️ NEDEN İKİSİ BİRDEN: yüzde tek başına ölçeği gizliyor.
            "+%0,85" hem 20 liralık hem 20.000 liralık bir kâr olabilir;
            kullanıcı hangisi olduğunu anlamak için değer sütunuyla zihinden
            çarpmak zorunda kalıyordu.

            ⚠️ Para birimi ₺/$ düğmesine UYUYOR: dolar görünümündeyken
            `profitUsdCents` gösteriliyor, TL tutarına $ işareti konmuyor.
            `money()` bu kuralı zaten tek yerde tutuyor.

            ⚠️ `profitCents` sunucudan geliyor — burada hesaplanmıyor.
            Kuruş aritmetiği sunucunun işi; ekranda çarpma yapsaydık
            float'a düşerdi.
          */}
          {/*
            YÜZDE + NET TUTAR — tek sütun, alt alta.

            ⚠️ ÖNCE AYRI SÜTUN DENENDİ, EKRANA SIĞMADI. Dört sütun
            (ad · net · yüzde · değer) 390 piksellik telefonda ad sütununa
            ~59 piksel bırakıyordu; "Bitcoin" bile "Bitc..." diye kesiliyor,
            miktar iki satıra taşıyordu. Sütun eklemek yatay bütçeyi
            büyütmüyor, sadece paylaştırıyor.

            Alt alta koymak ikisini de tam gösteriyor ve ad sütununu geri
            veriyor. Dikeyde zaten boşluk vardı.

            ⚠️ NEDEN İKİSİ BİRDEN: yüzde tek başına ölçeği gizliyor.
            "+%1,16" hem 20 liralık hem 20.000 liralık kâr olabilir.

            ⚠️ Para birimi ₺/$ düğmesine uyuyor — money() o kuralı tek
            yerde tutuyor. profitCents SUNUCUDAN geliyor, burada
            hesaplanmıyor: çarpma yapsaydık float'a düşerdi.
          */}
          <View style={styles.rowChange}>
            <ChangeText percent={item.profitPercent} />
            <Text
              style={[
                styles.rowNetText,
                BigInt(item.profitCents) >= 0n ? styles.netUp : styles.netDown,
              ]}
              numberOfLines={1}
            >
              {BigInt(item.profitCents) >= 0n ? '+' : ''}
              {money(item.profitCents, item.profitUsdCents)}
            </Text>
          </View>

          <View style={styles.rowValue}>
            <Text style={styles.rowValueText}>
              {item.valueCents === null
                ? '—'
                : money(item.valueCents, item.valueUsdCents)}
            </Text>
            <Text style={styles.rowAsOf}>{formatRelativeTime(item.asOf)}</Text>
          </View>
        </TouchableOpacity>
      )}
      ListFooterComponent={
        <View>
          {/* --- tümünü gör --- */}
          {sorted.length > COLLAPSED_ROWS && (
            <TouchableOpacity
              style={styles.expand}
              onPress={() => setExpandedPositions((open) => !open)}
              accessibilityRole="button"
            >
              <Text style={styles.expandText}>
                {expandedPositions
                  ? 'Daha az göster'
                  : `Tümünü gör (${sorted.length})`}
              </Text>
            </TouchableOpacity>
          )}

          {/* --- son işlemler --- */}
          {orders.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <SectionLabel>SON İŞLEMLER</SectionLabel>

                {orders.length > 3 && (
                  <TouchableOpacity
                    onPress={() => setExpandedOrders((open) => !open)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.sectionAction}>
                      {expandedOrders ? 'DAHA AZ' : 'TÜMÜ'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {visibleOrders.map((order) => (
                <View key={order.id} style={styles.orderRow}>
                  {/*
                    AL yeşil, SAT kırmızı — yön renkleriyle aynı dil.
                    Burada "yön" fiyatın değil işlemin yönü ama kullanıcı
                    için ikisi de aynı sezgiye oturuyor.
                  */}
                  <Text
                    style={[
                      styles.orderSide,
                      {
                        color: order.side === 'buy' ? colors.gain : colors.loss,
                      },
                    ]}
                  >
                    {order.side === 'buy' ? 'AL' : 'SAT'}
                  </Text>

                  <Text style={styles.orderName} numberOfLines={1}>
                    {order.name}
                  </Text>

                  <Text style={styles.orderQuantity}>
                    {formatQuantity(order.quantity)}
                  </Text>

                  <Text style={styles.orderTime}>
                    {formatRelativeTime(order.executedAt)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/*
            ⚠️ ÇIKIŞ DÜĞMESİ BURADAN KALDIRILDI — Profil sekmesine taşındı.

            Cüzdanın altındaydı çünkü o zaman başka bir yer yoktu. Ama
            çıkış yapmak bir HESAP işi, bir portföy işi değil; kullanıcı
            onu ararken cüzdanın en dibine bakmak zorunda kalıyordu.
            Profil sekmesi açılınca doğru evi bulundu.
          */}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },

  centered: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  errorText: { fontFamily: fonts.regular, fontSize: 14, color: colors.error },
  retry: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  retryText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.inkBright },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingTop: 20,
  },

  totalBlock: { paddingHorizontal: spacing.screen, paddingTop: 14 },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 12,
  },
  delta: { fontFamily: fonts.monoBold, fontSize: 13 },
  deltaLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.inkFaint,
  },
  rateNote: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 8,
  },

  allocation: { paddingHorizontal: spacing.screen, paddingTop: 18 },

  chipRow: {
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: spacing.screen,
    paddingTop: 18,
  },

  statGrid: {
    flexDirection: 'row',
    marginTop: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  statCell: { flex: 1, paddingHorizontal: spacing.screen, paddingVertical: 13 },
  statDivider: { borderRightWidth: 1, borderRightColor: colors.border },
  statValue: {
    fontFamily: fonts.monoSemibold,
    fontSize: 16,
    color: colors.ink,
    marginTop: 5,
  },

  warning: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.warn,
    paddingHorizontal: spacing.screen,
    paddingTop: 12,
  },

  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingTop: 14,
    paddingBottom: 8,
  },
  headCell: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.inkFaint,
  },
  headAsset: { flex: 1 },
  headChange: { width: rowMetrics.changeWidth },
  headValue: { width: rowMetrics.valueWidth },
  headRight: { textAlign: 'right' },
  // Etkin sıralama sütunu beyaz: kullanıcı hangi ölçüte göre baktığını
  // ok işaretine bakmadan da görsün.
  headActive: { color: colors.ink },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingVertical: rowMetrics.paddingVertical,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowAsset: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  rowNames: { flex: 1 },
  rowName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  rowQuantity: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 2,
  },
  rowNetText: { fontFamily: fonts.mono, fontSize: 11, marginTop: 2 },
  netUp: { color: colors.gain },
  netDown: { color: colors.loss },

  // Genişletildi: artık yüzde VE net tutar burada, alt alta.
  rowChange: { width: rowMetrics.changeWidth + 34, alignItems: 'flex-end' },
  rowValue: { width: rowMetrics.valueWidth, alignItems: 'flex-end' },
  rowValueText: { fontFamily: fonts.monoSemibold, fontSize: 14, color: colors.ink },
  rowAsOf: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.inkDisabled,
    marginTop: 2,
  },

  empty: { alignItems: 'center', paddingVertical: 48, gap: 6 },
  emptyTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.inkBright },
  emptyText: { fontFamily: fonts.regular, fontSize: 12, color: colors.inkFaint },

  expand: {
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  expandText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.inkMuted },

  section: { marginTop: 22, paddingHorizontal: spacing.screen },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionAction: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.inkBright,
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  orderSide: { width: 30, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.8 },
  orderName: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  orderQuantity: { fontFamily: fonts.mono, fontSize: 12, color: colors.inkMuted },
  orderTime: { fontFamily: fonts.regular, fontSize: 10, color: colors.inkDisabled },

});
