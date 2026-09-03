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
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { PriceChart } from '../components/PriceChart';
import { apiFetch } from '../api/client';
import {
  centsToDecimal,
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
import { colors, fonts, gradients, radius, rowMetrics, shadows, spacing, type } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';

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
  /** Sunucu hesaplıyor: bu varlık ŞU AN işlem görür mü. */
  tradable?: boolean;
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
  twrPercent: string | null;
  hasIncompletePrices: boolean;
  positions: Position[];
};

type BonusStatus = {
  canClaim: boolean;
  lastClaimedAt: string | null;
  nextClaimAt: string | null;
  remainingSeconds: number;
};

/** Piyasa ekranıyla aynı sebeple cron aralığından farklı — faz kilitlenmesin. */
const REFRESH_MS = 10_000;
const CHART_WIDTH = Dimensions.get('window').width - 32;
const CHART_HEIGHT = 160;
const PORTFOLIO_RANGES = [
  /*
    ⚠️ '1G' EKLENDİ — SUNUCU ZATEN DESTEKLİYORDU.

    `market/ranges.ts` altı aralık tanımlıyor ('1d' dahil) ve
    `/portfolio/history` hepsini kabul ediyor. Eksik olan tek şey
    ekrandaki düğmeydi: yazılmış bir yetenek, ona giden yol olmadığı
    için kullanılamıyordu. Bu projede aynı şekil beşinci kez.

    ⚠️ '1G' KOVASI 5 DAKİKA (288 nokta) — ama fiyat cron'u kaç
    saattir çalışıyorsa o kadar nokta gelir. Cron duraksadıysa
    grafik 288 değil 2-3 nokta çizer. Bu bir hata değil, verinin
    gerçek hâli.
  */
  { value: '1d', label: '1G', getiri: 'GÜNLÜK GETİRİ' },
  { value: '1w', label: '1H', getiri: 'HAFTALIK GETİRİ' },
  { value: '1m', label: '1A', getiri: 'AYLIK GETİRİ' },
  { value: '3m', label: '3A', getiri: '3 AYLIK GETİRİ' },
  { value: '1y', label: '1Y', getiri: 'YILLIK GETİRİ' },
] as const;

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
  feeCents: string;
  netCents: string;
  executedAt: string;
  /**
   * Kullanıcının emri verirken yazdığı gerekçe.
   *
   * ⚠️ `null` OLABİLİR — ve çoğunlukla öyle. Not isteğe bağlı; boş
   * gelen satırda hiçbir şey ÇİZİLMEMELİ. Boş bir alan bırakmak, her
   * işlem satırını "eksik" gösterirdi.
   */
  note?: string | null;
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
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [bonusStatus, setBonusStatus] = useState<BonusStatus | null>(null);
  const [claiming, setClaiming] = useState(false);

  const [historyPoints, setHistoryPoints] = useState<{ ts: string; price: string }[]>([]);

  /*
    SEÇİLİ ARALIĞIN GETİRİSİ — büyük yüzde ve tutar bundan geliyor.

    ⚠️ ESKİDEN İKİ FARKLI DÖNEM YAN YANA DURUYORDU:

      -3.416,99 ₺   ->  `portfolio.profitCents`  = TÜM ZAMANLAR kâr/zarar
      -%2,71        ->  `portfolio.twrPercent`   = HAFTALIK TWR
      HAFTALIK GETİRİ                            = etiket ikisini de
                                                   haftalık sanıyordu

    Yani tutar ile yüzde farklı soruların cevabıydı ve etiket
    yalnızca birine uyuyordu. Aralık filtresine bağlanınca bu
    kendiliğinden çıktı ortaya.
  */
  const [rangeReturn, setRangeReturn] = useState<{ twrPercent: string | null; changeCents: string | null } | null>(null);
  /*
    ⚠️ TİP ELLE YAZILIYORDU VE '1G' EKLENİNCE TUTMADI.

    Eskiden: `useState<'1w' | '1m' | '3m' | '1y'>` — yani aralık
    listesi bir yerde, tipi BAŞKA bir yerde. `PORTFOLIO_RANGES`'e
    '1d' eklendiğinde tip güncellenmediği için TypeScript hata
    verdi.

    ⚠️ Hata VERMESİ iyi haber. İki ayrı doğruluk kaynağı tutulduğunda
    olağan sonuç sessiz bir kayıptır: düğme çizilir, basılır, istek
    yanlış gider. Burada derleyici yakaladı.

    Şimdi tip listeden TÜRETİLİYOR — yeni bir aralık eklemek tek
    satır ve tip kendiliğinden genişliyor.
  */
  const [selectedRange, setSelectedRange] =
    useState<(typeof PORTFOLIO_RANGES)[number]['value']>('1w');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [scrubbed, setScrubbed] = useState<{ ts: string; price: string } | null>(null);

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
      const [data, orderData, bonusData] = await Promise.all([
        apiFetch<Portfolio>(`/portfolio${queryRef.current}`),
        apiFetch<{ orders: Order[] }>('/orders?limit=20').catch(() => ({
          orders: [] as Order[],
        })),
        apiFetch<BonusStatus>('/bonus/daily/status').catch(() => ({
          canClaim: false,
          lastClaimedAt: null,
          nextClaimAt: null,
          remainingSeconds: 0,
        })),
      ]);

      setPortfolio(data);
      setOrders(orderData.orders);
      setBonusStatus(bonusData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Portföy alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Sayaç etkisi: Kalan saniyeleri saniyede bir azaltır.
  useEffect(() => {
    if (!bonusStatus || bonusStatus.remainingSeconds <= 0) return;

    const timer = setInterval(() => {
      setBonusStatus((prev) => {
        if (!prev || prev.remainingSeconds <= 0) {
          clearInterval(timer);
          return prev ? { ...prev, canClaim: true, remainingSeconds: 0 } : null;
        }
        return {
          ...prev,
          remainingSeconds: prev.remainingSeconds - 1,
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [bonusStatus?.remainingSeconds]);

  // Günlük bonusu talep etme işlemi
  async function handleClaimBonus() {
    if (claiming) return;
    setClaiming(true);
    try {
      const res = await apiFetch<{ message: string; newBalanceCents: string }>('/bonus/daily', {
        method: 'POST',
      });
      // Portföy ve bonus durumunu yeniden yükle
      await load(false);
      Alert.alert('Başarılı', res.message);
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Bonus alınamadı.');
    } finally {
      setClaiming(false);
    }
  }

  // Saniye bilgisini HH:MM:SS formatına dönüştürür
  function formatCountdown(sec: number): string {
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

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
    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const res = await apiFetch<{
          points: { ts: string; value: string }[];
          twrPercent: string | null;
          changeCents: string | null;
        }>(
          `/portfolio/history?range=${selectedRange}&currency=${currency}`
        );

        /*
          ⚠️ GETİRİ AYNI İSTEKTEN GELİYOR, İKİNCİ BİR ÇAĞRIYLA DEĞİL.

          Ayrı bir uçtan çekseydik iki istek ayrı anlarda dönerdi ve
          grafik bir aralığa, üstteki yüzde başka bir aralığa ait
          olabilirdi — kullanıcı "grafik 1 gün ama yüzde haftalık"
          diye görürdü ve hangisine inanacağını bilemezdi.
        */
        setRangeReturn({ twrPercent: res.twrPercent, changeCents: res.changeCents });
        /*
          ⚠️ KURUŞ -> LİRA ÇEVRİMİ ŞART.

          Uç `value`'yu KURUŞ olarak döndürüyor (projenin kuralı: para
          her yerde kuruş). `PriceChart` ise ondalıklı bir FİYAT metni
          bekliyor — varlık grafiklerinde "117491.35" gibi.

          Çevirmeden geçirilince eksen 100 kat büyük yazıyordu: bakiye
          101.329,59 ₺ iken etiket "10.18M" diyordu. Çizginin şekli
          doğruydu (hepsi aynı oranda büyük), o yüzden grafik
          "çalışıyor" görünüyor ve hata yalnızca etiketlerde kalıyordu.

          ⚠️ USD görünümünde de aynı: sunucu orada da `Penny` döndürüyor
          (sent), yani ölçek aynı ve tek çevrim ikisini de kapsıyor.
        */
        const mapped = (res.points || []).map((p) => ({
          ts: p.ts,
          price: centsToDecimal(p.value),
        }));
        setHistoryPoints(mapped);
      } catch (err) {
        console.error('Portföy geçmişi yüklenemedi:', err);
      } finally {
        setHistoryLoading(false);
      }
    }
    void loadHistory();
  }, [selectedRange, currency]);

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

  const visibleOrders = orders.slice(0, 3);

  /**
   * ÇUBUK SIRASI — paydan BÜYÜKTEN KÜÇÜĞE.
   *
   * Hem dilimlerin çizim sırası hem de renk atamasının kaynağı. İkisi
   * de buradan türediği için satır rozeti ile çubuk dilimi her zaman
   * aynı renkte.
   *
   * ⚠️ TABLO SIRALAMASINDAN BAĞIMSIZ — ve bu bir tutarsızlığın
   * düzeltmesi. Dilimler `sorted` üzerinden kuruluyordu (kullanıcının
   * seçtiği sıra), renkler ise sunucunun sırasından. Kullanıcı tabloyu
   * "değişime göre" sıralayınca çubuktaki renkler satırlardakiyle
   * UYUŞMUYORDU: mor dilim BTC, mor rozet ETH oluyordu.
   *
   * Çubuk bir kompozisyon gösteriyor; tablo nasıl sıralanırsa
   * sıralansın en büyük dilim solda olmalı.
   */
  const barPositions = portfolio.positions
    .filter((p) => p.sharePercent !== null && p.valueCents !== null)
    .slice()
    .sort((a, b) => Number(b.sharePercent) - Number(a.sharePercent));

  const sliceOrder = barPositions.map((p) => p.symbol);

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

  /*
   * ⚠️ `positions` DEĞİL `sorted` — VE BU GERÇEK BİR HATANIN DÜZELTMESİ.
   *
   * `positions` ekranda GÖRÜNEN satırlar: liste kapalıyken yalnızca
   * ilk 4. Dilimleri ondan kursaydık — kurulmuştu — çubuk portföyün
   * tamamını değil, dört varlığı gösterirdi.
   *
   * Asıl zararı aşağıdaki nakit hesabındaydı: nakit yüzdesi
   * `100 - (dilimlerin toplamı)` ile bulunuyor. Dilimler eksik olunca
   * GİZLİ VARLIKLARIN PAYI NAKDE EKLENİYORDU.
   *
   * Ölçülen sonuç: 6.083 TL nakit (portföyün %6'sı) çubuğun yarısından
   * fazlasını kaplıyordu. Sayı doğru yazılıyordu, çubuk yalan
   * söylüyordu — en sinsi hata türü.
   *
   * Çubuk her zaman TÜM portföyü gösteriyor; "tümünü gör" yalnızca
   * satır listesini açıyor.
   */
  for (const p of barPositions) {
    if (p.sharePercent === null || p.valueCents === null) continue;

    slices.push({
      label: p.name,
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
    <View style={styles.screen}>
      <FlatList
        showsVerticalScrollIndicator={false}
        style={styles.flatList}
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

            {/*
              ⚠️ EKRANDA "+—" YAZIYORDU.

              İşaret koşulsuz basılıyordu: `gaining ? '+' : ''`. Dolar
              görünümünde sunucu `profitUsdCents` göndermediğinde `money`
              tire döndürüyor ve ekranda `+—` çıkıyordu — bir sayı değil,
              bozuk bir dizgi.

              ⚠️ "BİLİNMİYOR" İLE "SIFIR" AYRI ŞEYLER. Tire "hesaplanamadı"
              demek; başına artı koymak ona olmayan bir yön atfediyordu.
              Değer yoksa renk de nötr: yeşil/kırmızı bir İDDİADIR.
            */}
            {(() => {
              /*
                ⚠️ ÜÇÜ DE ARTIK AYNI ARALIĞA AİT: tutar, yüzde ve etiket.

                Önceden tutar tüm zamanların kâr/zararıydı, yüzde
                haftalık TWR'ydi, etiket "HAFTALIK GETİRİ" diyordu.
                Üç parçadan ikisi etiketle uyuşmuyordu.

                ⚠️ VERİ GELMEDEN ESKİSİNE DÜŞMÜYORUZ. `rangeReturn`
                yokken portföyün haftalık değerini göstermek, kullanıcı
                "1G" seçmişken haftalık sayıyı GÜNLÜK etiketiyle
                sunmak olurdu — sessiz ve inandırıcı bir yalan.
                Gelene kadar tire.
              */
              const aralik =
                PORTFOLIO_RANGES.find((r) => r.value === selectedRange) ??
                PORTFOLIO_RANGES[1];

              const tutar =
                rangeReturn?.changeCents == null
                  ? '—'
                  : formatCentsString(rangeReturn.changeCents);

              const bilinmiyor = tutar === '—';
              const yukselen = Number(rangeReturn?.twrPercent ?? 0) >= 0;

              return (
                <View style={styles.deltaRow}>
                  <Text
                    style={[
                      styles.delta,
                      {
                        color: bilinmiyor
                          ? colors.inkFaint
                          : yukselen
                            ? colors.gain
                            : colors.loss,
                      },
                    ]}
                  >
                    {bilinmiyor ? '' : yukselen ? '+' : ''}
                    {tutar}
                  </Text>

                  <ChangeText percent={rangeReturn?.twrPercent ?? null} />

                  <Text style={styles.deltaLabel}>{aralik.getiri}</Text>
                </View>
              );
            })()}

            {currency === 'usd' && portfolio.usdTryRate != null && (
              <Text style={styles.rateNote}>
                1 $ = {formatPrice(portfolio.usdTryRate)} · bugünün kuruyla
              </Text>
            )}
          </View>

          {/* --- portföy geçmiş grafiği --- */}
          <View style={styles.chartSection}>
            {historyLoading ? (
              <View style={styles.chartPlaceholder}>
                <ActivityIndicator color={colors.gain} />
              </View>
            ) : historyPoints.length === 0 ? (
              /*
                ⚠️ ESKİ METİN: "Gösterilecek grafik verisi bulunamadı."

                Bu bir HATA cümlesiydi ve hiçbir şey bulunamamış
                değildi — kullanıcı henüz işlem yapmamıştı. Profesör
                boş durumları YEDİ KAYITTA İKİ KEZ sordu; iki kez
                sorduğu tek şey buydu.

                ⚠️ BOŞ DURUMUN ÜÇ TÜRÜ VAR VE DİLLERİ AYRI:
                  ilk kullanım -> öğret, davet et
                  temizlendi   -> tebrik et
                  hata         -> açıkla, çözüm ver     <- yanlışlıkla bu kullanılıyordu

                Buradaki 1. tür. "bulunamadı" kelimesi artık yasak
                (K6 kuralı); yerine ne yok, neden yok, ne yapmalıyım.
              */
              <View style={styles.chartPlaceholder}>
                <Text style={styles.chartEmptyTitle}>
                  {sorted.length === 0 ? 'Grafik ilk alımınla başlıyor' : 'Bu aralıkta hareket yok'}
                </Text>
                <Text style={styles.chartEmptyText}>
                  {sorted.length === 0
                    ? 'Bir varlık aldığında portföyünün seyri burada çizilecek.'
                    : 'Daha geniş bir aralık seç.'}
                </Text>
              </View>
            ) : (
              <PriceChart
                points={historyPoints}
                width={CHART_WIDTH}
                height={CHART_HEIGHT}
                onScrub={setScrubbed}
                currency={currency}
              />
            )}

            <View style={styles.rangeRow}>
              {PORTFOLIO_RANGES.map((r) => {
                const on = selectedRange === r.value;
                return (
                  <TouchableOpacity
                    key={r.value}
                    onPress={() => setSelectedRange(r.value)}
                    style={[
                      styles.rangeButton,
                      on && styles.rangeButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rangeText,
                        on && styles.rangeTextActive,
                      ]}
                    >
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* --- dağılım --- */}
          <View style={styles.allocation}>
            <AllocationBar slices={slices} />
          </View>

          {/* --- günlük bonus banner --- */}
          {bonusStatus && (
            <View style={styles.bonusBanner}>
              <View style={styles.bonusInfo}>
                <Text style={styles.bonusTitle}>Günlük Giriş Bonusu</Text>
                <Text style={styles.bonusSubtitle}>Her gün 1.000 ₺ hediye bakiye kazanın.</Text>
              </View>
              {bonusStatus.canClaim ? (
                <TouchableOpacity
                  style={styles.bonusButton}
                  onPress={handleClaimBonus}
                  disabled={claiming}
                >
                  <Text style={styles.bonusButtonText}>
                    {claiming ? 'Alınıyor...' : 'Bonus Al (1.000 ₺)'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.bonusDisabledButton}>
                  <Text style={styles.bonusDisabledButtonText}>
                    {formatCountdown(bonusStatus.remainingSeconds)}
                  </Text>
                </View>
              )}
            </View>
          )}

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
            {/*
              ⚠️ "15 sa" DEĞİL "piyasa kapalı".

              ABD borsası kapalıyken son fiyat saatler öncesine ait
              olur ve satır "AAPL · 15 sa" diye görünüyordu — ARIZA
              gibi. Oysa hiçbir şey bozuk değil, seans kapalı.

              Bu ayrım Piyasa ekranında zaten vardı; cüzdanda yoktu
              çünkü sunucu bu uçta `tradable` göndermiyordu. Aynı
              düzeltmenin bir ekranda olup ötekinde olmaması, bu
              projede tekrar eden bir şekil.
            */}
            <Text style={[styles.rowAsOf, item.tradable === false && styles.rowClosed]}>
              {item.tradable === false ? 'piyasa kapalı' : formatRelativeTime(item.asOf)}
            </Text>
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
              </View>

              {visibleOrders.map((order) => (
                <View key={order.id} style={styles.orderRow}>
                  <View style={styles.orderTopRow}>
                    <View
                      style={[
                        styles.orderSideBadge,
                        {
                          backgroundColor:
                            /*
                              ⚠️ ELLE YAZILMIŞ RENKLER TOKEN'A ÇEKİLDİ.
                              rgba(52,194,138) ve rgba(229,72,77) temanın
                              yeşil/kırmızısı DEĞİLDİ — yakın ama farklı
                              tonlar. Aynı ekranda iki ayrı yeşil vardı ve
                              tema değişse bunlar değişmezdi.
                            */
                            order.side === 'buy'
                              ? colors.gainSoft
                              : colors.lossSoft,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.orderSideText,
                          {
                            color:
                              order.side === 'buy'
                                ? colors.gain
                                : colors.loss,
                          },
                        ]}
                      >
                        {order.side === 'buy' ? 'AL' : 'SAT'}
                      </Text>
                    </View>

                    <Text style={styles.orderName} numberOfLines={1}>
                      {order.name}
                    </Text>

                    <Text style={styles.orderTime}>
                      {formatRelativeTime(order.executedAt)}
                    </Text>
                  </View>

                  <View style={styles.orderBottomRow}>
                    <Text style={styles.orderDetailsText}>
                      {formatQuantity(order.quantity)} {order.symbol}  ·  {formatCentsString(order.netCents)}  ·  komisyon: {formatCentsString(order.feeCents)}
                    </Text>
                  </View>

                  {/*
                    KARAR NOTU — varsa.

                    ⚠️ TIRNAK İÇİNDE VE İTALİK: bu metin sunucunun
                    hesabı değil, KULLANICININ kendi cümlesi. Diğer
                    satırlarla aynı biçimde yazsaydık ölçülmüş bir veri
                    gibi okunurdu.

                    ⚠️ Sol şerit, kartın kendi kararını taşıdığını
                    gösteriyor — alıntı bloğu geleneği.
                  */}
                  {order.note ? (
                    <View style={styles.noteBox}>
                      <Text style={styles.noteText}>"{order.note}"</Text>
                    </View>
                  ) : null}
                </View>
              ))}

              {orders.length > 3 && (
                <TouchableOpacity
                  style={[styles.expand, { borderTopWidth: 0, paddingVertical: 12 }]}
                  onPress={() => setShowAllOrders(true)}
                  accessibilityRole="button"
                >
                  <Text style={styles.expandText}>Tüm işlemleri gör →</Text>
                </TouchableOpacity>
              )}
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

    {/* Tüm İşlemler Modal */}
    <Modal
      visible={showAllOrders}
      animationType="slide"
      onRequestClose={() => setShowAllOrders(false)}
    >
      <View style={[styles.screen, { paddingTop: 20 }]}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowAllOrders(false)} hitSlop={12}>
            <Text style={styles.backText}>‹ Geri</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Tüm İşlemler</Text>
          <View style={{ width: 44 }} />
        </View>

        <FlatList
          showsVerticalScrollIndicator={false}
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: order }) => (
            <View style={[styles.orderRow, { paddingHorizontal: 16 }]}>
              <View style={styles.orderTopRow}>
                <View
                  style={[
                    styles.orderSideBadge,
                    {
                      backgroundColor:
                        // Yukarıdaki ile aynı gerekçe: tema rengine bağlandı.
                        order.side === 'buy'
                          ? colors.gainSoft
                          : colors.lossSoft,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.orderSideText,
                      {
                        color:
                          order.side === 'buy'
                            ? colors.gain
                            : colors.loss,
                      },
                    ]}
                  >
                    {order.side === 'buy' ? 'AL' : 'SAT'}
                  </Text>
                </View>

                <Text style={styles.orderName} numberOfLines={1}>
                  {order.name}
                </Text>

                <Text style={styles.orderTime}>
                  {formatRelativeTime(order.executedAt)}
                </Text>
              </View>

              <View style={styles.orderBottomRow}>
                <Text style={styles.orderDetailsText}>
                  {formatQuantity(order.quantity)} {order.symbol}  ·  {formatCentsString(order.netCents)}  ·  komisyon: {formatCentsString(order.feeCents)}
                </Text>
              </View>
            </View>
          )}
        />
      </View>
    </Modal>
  </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  flatList: { flex: 1 },
  backText: { color: colors.gain, fontSize: 16, fontFamily: fonts.semibold },
  listContent: { paddingBottom: 20 },
  chartSection: {
    paddingHorizontal: spacing.screen,
    marginTop: 16,
  },
  chartPlaceholder: {
    height: CHART_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceSunken,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartEmptyTitle: {
    fontFamily: fonts.semibold,
    fontSize: type.emphasis,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  chartEmptyText: {
    fontFamily: fonts.regular,
    fontSize: type.body,
    color: colors.inkFaint,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 24,
  },
  chartErrorText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.inkMuted,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  rangeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rangeButtonActive: {
    backgroundColor: colors.border,
    borderColor: colors.borderStrong,
  },
  rangeText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.inkMuted,
  },
  rangeTextActive: {
    color: colors.ink,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.ink,
    textAlign: 'center',
  },

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
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  retryText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.inkBright },

  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screen,
    paddingTop: 20,
  },

  /*
    ⚠️ BAKİYE BLOĞU BİRİNCİL — ALTINDAKİ BOŞLUK BUNU SÖYLÜYOR.

    Eskiden bölümler arası boşluklar 14 / 18 / 18 / 20 idi; sekiz bölüm
    de eşit ağırlıkta duruyordu. Kullanıcı bu ekrana "param ne durumda"
    diye geliyor — bakiye ve getiri birincil, gerisi destek.

    `spacing.section` (30) hero'yu geri kalandan ayırıyor; grafik ile
    dağılım `spacing.group` (12) ile birbirine yapışıyor çünkü ikisi
    aynı soruyu cevaplıyor: "portföyüm nasıl dağılmış ve nasıl gitti".
  */
  totalBlock: {
    /*
      ⚠️ KENARDAN KENARA — VE BU BİR HİZA HATASINI DÜZELTİYOR.

      Önce `marginHorizontal: 22` + `paddingHorizontal: 20` yazmıştım.
      Sonuç: kartın içindeki bakiye ekran kenarından 42 piksel içerde
      başlıyordu, oysa altındaki bölüm başlıkları 22 pikselde. Aynı
      dikey çizgide olması gereken iki şey 20 piksel kaymıştı.

      Kart tam genişlikte olunca iç dolgusu `spacing.screen` oluyor ve
      bakiye, altındaki her şeyle AYNI çizgiden başlıyor. Yan kenarlık
      da kalktı: kenardan kenara giden bir yüzeyin yan çizgisi görünmez,
      yalnızca alt çizgi anlamlı.
    */
    paddingHorizontal: spacing.screen,
    paddingTop: 16,
    paddingBottom: 24,
    marginBottom: spacing.section,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    /*
      ⚠️ GÖLGE KOYU TEMADA GÖRÜNMEZ SANILIR AMA GÖRÜNÜR. Kartın kendisi
      zeminden bir ton açık; altındaki koyu halka o farkı büyütüyor ve
      kart "yüzüyor". `elevation` Android için AYRI verilmek zorunda —
      `shadow*` özellikleri Android'de hiçbir şey yapmıyor.
    */
    ...shadows.card,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 12,
  },
  delta: { fontFamily: fonts.monoBold, fontSize: 14 },
  deltaLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    letterSpacing: 1.1,
    color: colors.inkFaint,
  },
  rateNote: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.inkFaint,
    marginTop: 8,
  },

  // Grafikle aynı gruba ait: dar boşluk.
  allocation: { paddingHorizontal: spacing.screen, paddingTop: spacing.group },

  bonusBanner: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: spacing.screen,
    // Yeni bölüm başlıyor: geniş boşluk.
    marginTop: spacing.section,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  bonusInfo: {
    flex: 1,
  },
  bonusTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.ink,
  },
  bonusSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: 4,
  },
  bonusButton: {
    backgroundColor: colors.gain,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bonusButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.onInverse,
  },
  bonusDisabledButton: {
    backgroundColor: colors.surfacePressed,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  bonusDisabledButtonText: {
    fontFamily: fonts.monoSemibold,
    fontSize: 12,
    color: colors.inkDisabled,
  },

  chipRow: {
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: spacing.screen,
    paddingTop: 20,
  },

  statGrid: {
    flexDirection: 'row',
    marginTop: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  statCell: { flex: 1, paddingHorizontal: spacing.screen, paddingVertical: 12 },
  statDivider: { borderRightWidth: 1, borderRightColor: colors.border },
  statValue: {
    fontFamily: fonts.monoSemibold,
    fontSize: 16,
    color: colors.ink,
    marginTop: 4,
  },

  warning: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.warn,
    paddingHorizontal: spacing.screen,
    paddingTop: 12,
  },

  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headCell: {
    fontFamily: fonts.bold,
    fontSize: 10,
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
    fontSize: 12,
    color: colors.inkFaint,
    marginTop: 2,
  },
  rowNetText: { fontFamily: fonts.mono, fontSize: 12, marginTop: 2 },
  netUp: { color: colors.gain },
  netDown: { color: colors.loss },

  // Genişletildi: artık yüzde VE net tutar burada, alt alta.
  rowChange: { width: rowMetrics.changeWidth + 34, alignItems: 'flex-end' },
  rowValue: { width: rowMetrics.valueWidth, alignItems: 'flex-end' },
  rowValueText: { fontFamily: fonts.monoSemibold, fontSize: 14, color: colors.ink },
  // Kapalı seans nötr renkte — bir hata değil, bir durum.
  rowClosed: { color: colors.inkFaint, fontStyle: 'italic' },
  rowAsOf: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.inkDisabled,
    marginTop: 2,
  },

  empty: { alignItems: 'center', paddingVertical: 48, gap: 6 },
  emptyTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.inkBright },
  emptyText: { fontFamily: fonts.regular, fontSize: 12, color: colors.inkFaint },

  expand: {
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  expandText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.inkMuted },

  section: { marginTop: 24, paddingHorizontal: spacing.screen },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionAction: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.inkBright,
  },
  orderRow: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  orderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  orderBottomRow: {
    paddingLeft: 44,
  },
  noteBox: {
    marginTop: 8,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
  noteText: {
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
  },
  orderDetailsText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkMuted,
  },
  orderSideBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    width: 34,
  },
  orderSideText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  orderName: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  orderTime: { fontFamily: fonts.regular, fontSize: 10, color: colors.inkDisabled },

});
