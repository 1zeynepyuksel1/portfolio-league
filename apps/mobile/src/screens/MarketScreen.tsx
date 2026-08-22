import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { apiFetch } from '../api/client';
import { formatPrice, formatRelativeTime } from '../lib/format';

/**
 * PİYASA EKRANI — GET /assets
 *
 * Fiyatlar sunucudaki cron tarafından 15 saniyede bir tazeleniyor
 * (apps/api/src/market/scheduler.ts). Bu ekran da 15 saniyede bir okuyor.
 *
 * Daha sık sormanın anlamı yok — aynı değeri tekrar alırdık.
 */

type Asset = {
  symbol: string;
  name: string;
  /** ⚠️ STRING. Number'a çevirme — backend'deki bigint zinciri kırılır. */
  priceTry: string | null;
  asOf: string | null;
};

/**
 * Ekranın sorma aralığı — cron'un YAZMA aralığından (15 sn) bilerek FARKLI.
 *
 * İkisi de 15 saniye olsaydı faz kilitlenirdi: ekran her seferinde cron'un
 * yazma anının hemen öncesinde sorar, hep bir önceki turun verisini alır ve
 * "x sn önce" yazısı 15'in altına hiç inmezdi.
 *
 * 5 saniye seçilince periyotlar birbirini kaydırıyor, yaş 0-20 arasında
 * geziniyor. Maliyeti yok — bu istek Binance'e gitmiyor, kendi
 * veritabanımızdan tek satır okuyor. Dış API yükü değişmiyor.
 */
const REFRESH_MS = 5_000;

/** Fiyat bu süreden eskiyse kullanıcıyı uyar. Cron 15 sn'de bir yazıyor. */
const STALE_AFTER_MS = 60_000;

function isStale(asOf: string | null): boolean {
  if (asOf === null) return false; // fiyat hiç yok — zaten "—" gösteriliyor
  return Date.now() - new Date(asOf).getTime() > STALE_AFTER_MS;
}

type Props = {
  /**
   * Satıra dokununca çağrılır — Al/Sat ekranını açar.
   *
   * İSTEĞE BAĞLI: verilmezse satırlar dokunulamaz kalır ve sağdaki ok
   * çıkmaz. Böylece bu ekran ileride emir vermenin anlamsız olduğu bir
   * yerde (örneğin salt görüntüleme kipinde) de kullanılabilir.
   */
  onSelectAsset?: (symbol: string, name: string) => void;
};

export function MarketScreen({ onSelectAsset }: Props = {}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // useRef: değeri değiştiğinde YENİDEN ÇİZİM tetiklemeyen kutu.
  // Zamanlayıcı kimliğini state'te tutsaydık her kurulumda ekran yeniden
  // çizilir, o da yeni bir zamanlayıcı kurardı — sonsuz döngü.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) setRefreshing(true);

    try {
      const data = await apiFetch<Asset[]>('/assets');
      setAssets(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fiyatlar alınamadı.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Otomatik yenileme — sadece uygulama ÖN PLANDAYKEN.
  //
  // ⚠️ Arka planda durdurmazsak pil yakar ve sunucuya boşuna yük bineriz.
  // Kullanıcı uygulamayı cebine koydu diye fiyat çekmeye devam etmenin
  // hiçbir faydası yok.
  useEffect(() => {
    function startPolling() {
      if (intervalRef.current !== null) return; // zaten çalışıyor
      intervalRef.current = setInterval(() => void load(), REFRESH_MS);
    }

    function stopPolling() {
      if (intervalRef.current === null) return;
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    void load(); // ilk yükleme, zamanlayıcıyı bekleme
    startPolling();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void load(); // geri dönünce HEMEN tazele, 15 sn bekletme
        startPolling();
      } else {
        stopPolling();
      }
    });

    // Temizlik: ekran kapanınca zamanlayıcı ve dinleyici bırakılır.
    // Yapmazsak sekme değiştirildikçe zamanlayıcılar birikir.
    return () => {
      stopPolling();
      subscription.remove();
    };
  }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.mutedText}>Fiyatlar yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📈 Piyasa</Text>
        {/* 15 sn: sunucudaki cron'un yazma aralığı. Ekranın sorma aralığı
            (REFRESH_MS) ayrı bir şey — kullanıcıyı ilgilendiren fiyatın
            ne sıklıkta TAZELENDİĞİ. */}
        <Text style={styles.subtitle}>
          Fiyatlar 15 saniyede bir güncellenir
        </Text>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      <FlatList
        data={assets}
        keyExtractor={(item) => item.symbol}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor="#10B981"
          />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyTitle}>Varlık yok</Text>
            <Text style={styles.mutedText}>
              Veritabanına henüz varlık eklenmemiş.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onSelectAsset?.(item.symbol, item.name)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={styles.symbolCircle}>
              <Text style={styles.symbolText}>{item.symbol.slice(0, 3)}</Text>
            </View>

            <View style={styles.nameColumn}>
              <Text style={styles.symbol}>{item.symbol}</Text>
              <Text style={styles.name}>{item.name}</Text>
            </View>

            <View style={styles.priceColumn}>
              {/* Fiyatı hiç çekilmemiş varlık olabilir — uydurma değer
                  göstermek yerine tire koyuyoruz. */}
              <Text style={styles.price}>
                {item.priceTry === null ? '—' : formatPrice(item.priceTry)}
              </Text>
              {/* Tazelik göstergesi sadece veri BAYATLADIĞINDA çıkıyor.
                  Her satırın altında ilerleyen bir sayaç görsel gürültü;
                  ama fiyat gerçekten eskidiyse kullanıcı bilmeli — yoksa
                  eski veriyi güncel sanır. Eşik 60 sn: cron 15 saniyede
                  bir yazıyor, 60'ı geçtiyse gerçekten bir sorun var. */}
              {isStale(item.asOf) && (
                <Text style={styles.staleWarning}>
                  ⚠️ {formatRelativeTime(item.asOf)}
                </Text>
              )}
            </View>

            {/* Dokunulabilir olduğunu gösteren işaret. Olmasaydı satırın
                bir şey yaptığı hiçbir yerden anlaşılmazdı. */}
            {onSelectAsset !== undefined && (
              <Text style={styles.chevron}>›</Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B132B',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 20,
    marginTop: 10,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C2541',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginVertical: 4,
  },
  rowPressed: {
    backgroundColor: '#243154',
  },
  chevron: {
    color: '#64748B',
    fontSize: 22,
    marginLeft: 10,
  },
  symbolCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0B132B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  symbolText: {
    color: '#10B981',
    fontWeight: 'bold',
    fontSize: 12,
  },
  nameColumn: {
    flex: 1,
  },
  symbol: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  name: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  priceColumn: {
    alignItems: 'flex-end',
  },
  price: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  staleWarning: {
    color: '#FBBF24',
    fontSize: 11,
    marginTop: 3,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  mutedText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
});
