import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useCurrency } from '../lib/currency';
import { CurrencyToggle } from '../components/CurrencyToggle';
import {
  formatCentsString,
  formatPrice,
  formatQuantity,
  formatRelativeTime,
} from '../lib/format';
import { colors, fonts } from '../theme';

/**
 * PORTFÖY EKRANI — GET /portfolio
 *
 * Sunucudaki hesap: toplam değer = nakit + Σ(miktar × güncel fiyat)
 * (apps/api/src/portfolio/calculate.ts)
 *
 * ⚠️ Toplamı BURADA hesaplamıyoruz. Sunucu zaten hesaplayıp gönderiyor.
 * Burada toplasaydık aynı formül iki yerde olurdu ve bir gün ayrışırlardı —
 * üstelik istemcide `number` ile toplamak float hatası demek olurdu.
 * Bu ekranın işi sadece BİÇİMLENDİRMEK.
 */

type Position = {
  symbol: string;
  name: string;
  quantity: string;
  priceTry: string | null;
  /** Dolar görünümünde dolu, TL görünümünde null — çevrimi sunucu yapar. */
  priceUsd: string | null;
  valueCents: string | null;
  valueUsdCents: string | null;
  sharePercent: string | null;
  asOf: string | null;

  /** Bu pozisyona ödenen toplam para (komisyon dahil), kuruş. */
  costCents: string;
  /** Güncel değer − maliyet. Negatif olabilir. */
  profitCents: string;
  profitUsdCents: string | null;
  costUsdCents: string | null;
  /**
   * Yüzde getiri, iki ondalıklı metin ("12.34" / "-5.10").
   *
   * ⚠️ `null` OLABİLİR ve bu "sıfır" demek DEĞİL: fiyat okunamamış ya da
   * maliyet sıfır olduğu için hesaplanamamış demek. Sıfır göstermek
   * "kâr yok" derdi; oysa bilmiyoruz.
   */
  profitPercent: string | null;
};

type Portfolio = {
  currency: 'try' | 'usd';
  /** Çevrimde kullanılan kur. TL görünümünde null. */
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

  /**
   * ⚠️ YÜZDE İKİ GÖRÜNÜMDE DE AYNI — ve bu doğru.
   *
   * Hem pay hem payda aynı kurla bölününce kur sadeleşir. Ayrı bir
   * "dolar yüzdesi" beklemek yanlış: o ancak her işlemin KENDİ GÜNÜNDEKİ
   * kurla hesaplanırsa anlamlı olurdu, bu ise TL bazlı getirinin dolar
   * gösterimidir.
   */
  profitPercent: string | null;
  hasIncompletePrices: boolean;
  positions: Position[];
};

/** Piyasa ekranıyla aynı sebeple cron aralığından farklı — faz kilitlenmesin. */
const REFRESH_MS = 10_000;

export function PortfolioScreen({ onLogout }: { onLogout?: () => void }) {
  const { currency, query } = useCurrency();

  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Bkz. MarketScreen'deki aynı ref — zamanlayıcının içindeki `load`
  // kurulduğu andaki `query`'yi hatırlar, ref bunu kırıyor.
  const queryRef = useRef(query);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  const load = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) setRefreshing(true);

    try {
      const data = await apiFetch<Portfolio>(`/portfolio${queryRef.current}`);
      setPortfolio(data);
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
   * NEDEN YARDIMCI FONKSİYON: ekranda on ayrı yerde para yazıyor. Her
   * birine `currency === 'usd' ? ... : ...` üçlüsü yazsaydık biri
   * atlanır ve o tek satır TL rakamını $ simgesiyle gösterirdi — sayı
   * makul görünür, kimse fark etmez.
   *
   * ⚠️ Dolar alanı boşsa TL'ye DÜŞÜLMÜYOR, '—' gösteriliyor. Düşmek
   * sessiz bir yalan olurdu.
   */
  const money = useCallback(
    (tryCents: string, usdCents: string | null): string => {
      if (currency === 'try') return formatCentsString(tryCents);

      /**
       * ⚠️ `=== null` DEĞİL, `== null` — VE BU FARK BİR ÇÖKME DEMEK.
       *
       * Alan sunucudan hiç GELMEZSE değeri `null` değil `undefined` olur.
       * `undefined === null` yanlıştır, yani kontrol geçilir ve
       * `BigInt(undefined)` çağrılır — bu bir TypeError fırlatır, React
       * bütün ağacı söker ve ekran KAPKARA kalır. Hata mesajı hiçbir
       * yerde görünmez.
       *
       * `== null` ikisini birden yakalıyor. Tip sistemi sunucunun alanı
       * her zaman göndereceğini SÖYLÜYOR ama bu bir söz, garanti değil:
       * eski bir sunucu sürümü ya da yarım dağıtım bu sözü bozar.
       */
      return usdCents == null ? '—' : formatCentsString(usdCents, 'usd');
    },
    [currency],
  );

  // Para birimi değişince hemen tazele — 10 saniye bekletme.
  useEffect(() => {
    void load();
  }, [query, load]);

  // Fiyatlar değiştikçe portföy değeri de değişiyor -> periyodik yenileme.
  // Arka planda durur (pil + sunucu yükü), öne gelince hemen tazeler.
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
        <ActivityIndicator size="large" color={colors.gain} />
        <Text style={styles.mutedText}>Portföy yükleniyor...</Text>
      </View>
    );
  }

  if (error || !portfolio) {
    return (
      <View style={styles.centered}>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error ?? 'Portföy okunamadı.'}</Text>
        </View>
        <TouchableOpacity style={styles.retryButton} onPress={() => void load()}>
          <Text style={styles.retryText}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Kâr mı zarar mı — string'den bigint'e, number'a DEĞİL.
  const isProfit = BigInt(portfolio.profitCents) >= 0n;

  return (
    <View style={styles.container}>
      <FlatList
        data={portfolio.positions}
        keyExtractor={(item) => item.symbol}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.gain}
          />
        }
        ListHeaderComponent={
          <View>
            {/* Toplam değer kartı */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryLabelRow}>
                <Text style={styles.summaryLabel}>💼 Toplam Portföy Değeri</Text>
                <CurrencyToggle />
              </View>

              {/* Kur görünür olmalı: kullanıcı dolar tutarını kendi
                  doğrulayabilsin. */}
              {currency === 'usd' && portfolio.usdTryRate != null && (
                <Text style={styles.disclaimer}>
                  1 $ = {formatPrice(portfolio.usdTryRate)} · bugünün kuruyla
                </Text>
              )}
              <Text style={styles.summaryValue}>
                {money(portfolio.totalValueCents, portfolio.totalValueUsdCents)}
              </Text>

              <View
                style={[
                  styles.profitBadge,
                  isProfit ? styles.profitBadgePositive : styles.profitBadgeNegative,
                ]}
              >
                <Text
                  style={[
                    styles.profitText,
                    isProfit ? styles.profitTextPositive : styles.profitTextNegative,
                  ]}
                >
                  {isProfit ? '▲' : '▼'}{' '}
                  {money(portfolio.profitCents, portfolio.profitUsdCents)}
                  {portfolio.profitPercent !== null &&
                    `  (%${portfolio.profitPercent})`}
                </Text>
              </View>

              {/* ⚠️ Bu kâr/zarar LİG SIRALAMASI DEĞİL. Lig TWR ile hesaplanıyor
                  ve para girişlerinin zamanını da hesaba katıyor. Buradaki sayı
                  "toplam ne kazandım" sorusunun cevabı. */}
              <Text style={styles.disclaimer}>
                Yatırılan {money(portfolio.depositedCents, portfolio.depositedUsdCents)} · Lig
                sıralaması TWR ile hesaplanır
              </Text>
            </View>

            {/* Nakit / pozisyon dağılımı */}
            <View style={styles.splitRow}>
              <View style={styles.splitCard}>
                <Text style={styles.splitLabel}>💵 Nakit</Text>
                <Text style={styles.splitValue}>
                  {money(portfolio.cashCents, portfolio.cashUsdCents)}
                </Text>
              </View>
              <View style={styles.splitCard}>
                <Text style={styles.splitLabel}>📊 Varlıklar</Text>
                <Text style={styles.splitValue}>
                  {money(portfolio.positionsValueCents, portfolio.positionsValueUsdCents)}
                </Text>
              </View>
            </View>

            {/* ⚠️ Fiyatı okunamayan varlık varsa toplam EKSİK. Kullanıcı
                bunu bilmeli — sessizce düşük bir toplam göstermek yanıltıcı. */}
            {portfolio.hasIncompletePrices && (
              <View style={styles.warningBox}>
                <Text style={styles.warningText}>
                  ⚠️ Bazı varlıkların fiyatı alınamadı. Toplam değer eksik
                  hesaplanmış olabilir.
                </Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Pozisyonlar</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>🪙</Text>
            <Text style={styles.emptyTitle}>Henüz varlığın yok</Text>
            <Text style={styles.mutedText}>
              Piyasa sekmesinden ilk alımını yapabilirsin.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.positionRow}>
            <View style={styles.symbolCircle}>
              <Text style={styles.symbolText}>{item.symbol.slice(0, 3)}</Text>
            </View>

            <View style={styles.positionInfo}>
              <Text style={styles.positionSymbol}>{item.symbol}</Text>
              <Text style={styles.positionQuantity}>
                {formatQuantity(item.quantity)} adet
                {currency === 'usd'
                  ? item.priceUsd != null && ` · ${formatPrice(item.priceUsd, 'usd')}`
                  : item.priceTry != null && ` · ${formatPrice(item.priceTry)}`}
              </Text>
              <Text style={styles.positionAsOf}>
                {formatRelativeTime(item.asOf)}
              </Text>
            </View>

            <View style={styles.positionValueColumn}>
              <Text style={styles.positionValue}>
                {item.valueCents === null
                  ? '—'
                  : money(item.valueCents, item.valueUsdCents)}
              </Text>

              {/*
                Aldığından beri kâr/zarar.

                ⚠️ KARŞILAŞTIRMA `BigInt` İLE.
                `Number(item.profitCents) >= 0` yazmak çalışırdı ama
                projenin kuralını kırardı ve büyük tutarlarda hassasiyet
                kaybederdi. Metin doğrudan bigint'e çevriliyor.
              */}
              {item.profitPercent !== null && (
                <Text
                  style={[
                    styles.positionProfit,
                    {
                      color:
                        BigInt(item.profitCents) >= 0n ? colors.gain : colors.accent,
                    },
                  ]}
                >
                  {/* ⚠️ YEŞİL/KIRMIZI KARARI HER ZAMAN TL DEĞERİNE BAKIYOR.
                      Çevrim işareti koruduğu için sonuç aynı; dolar alanı
                      null gelse bile renk doğru kalsın diye TL okunuyor. */}
                  {BigInt(item.profitCents) >= 0n ? '+' : ''}
                  {money(item.profitCents, item.profitUsdCents)}
                  {'  '}
                  ({BigInt(item.profitCents) >= 0n ? '+' : ''}
                  %{item.profitPercent.replace('.', ',').replace('-', '')})
                </Text>
              )}

              {item.sharePercent !== null && (
                <Text style={styles.positionShare}>
                  Portföyün %{item.sharePercent}'i
                </Text>
              )}
            </View>
          </View>
        )}
        ListFooterComponent={
          onLogout ? (
            <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
              <Text style={styles.logoutText}>Çıkış Yap</Text>
            </TouchableOpacity>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 30,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 30,
  },
  summaryCard: {
    backgroundColor: colors.fieldFill,
    borderColor: colors.gain,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  summaryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: colors.inkMuted,
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  summaryValue: {
    color: colors.ink,
    fontSize: 30,
    fontFamily: fonts.bold,
    marginTop: 6,
  },
  profitBadge: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  profitBadgePositive: {
    backgroundColor: colors.gainSoft,
  },
  profitBadgeNegative: {
    backgroundColor: colors.accentSoft,
  },
  profitText: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  profitTextPositive: {
    color: colors.gain,
  },
  profitTextNegative: {
    color: colors.accent,
  },
  disclaimer: {
    color: colors.inkFaint,
    fontSize: 11,
    marginTop: 10,
    textAlign: 'center',
  },
  splitRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  splitCard: {
    flex: 1,
    backgroundColor: colors.fieldFill,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: 12,
    padding: 14,
  },
  splitLabel: {
    color: colors.inkMuted,
    fontSize: 12,
  },
  splitValue: {
    color: colors.ink,
    fontSize: 16,
    fontFamily: fonts.bold,
    marginTop: 4,
  },
  warningBox: {
    backgroundColor: colors.warnSoft,
    borderColor: colors.warn,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  warningText: {
    color: colors.warn,
    fontSize: 12,
    lineHeight: 17,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontFamily: fonts.bold,
    marginTop: 20,
    marginBottom: 6,
  },
  positionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.fieldFill,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginVertical: 4,
  },
  symbolCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  symbolText: {
    color: colors.gain,
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  positionInfo: {
    flex: 1,
  },
  positionSymbol: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  positionQuantity: {
    color: colors.inkMuted,
    fontSize: 12,
    marginTop: 2,
  },
  positionAsOf: {
    color: colors.inkFaint,
    fontSize: 10,
    marginTop: 2,
  },
  positionValueColumn: {
    alignItems: 'flex-end',
  },
  positionValue: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  positionProfit: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    marginTop: 2,
  },
  positionShare: {
    color: colors.inkMuted,
    fontSize: 11,
    marginTop: 3,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontFamily: fonts.bold,
  },
  mutedText: {
    color: colors.inkMuted,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 14,
    backgroundColor: colors.fieldFill,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryText: {
    color: colors.gain,
    fontFamily: fonts.semibold,
  },
  logoutButton: {
    marginTop: 24,
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutText: {
    color: colors.error,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
});
