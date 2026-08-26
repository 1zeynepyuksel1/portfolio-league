import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiFetch } from '../api/client';
import { colors, fonts, spacing } from '../theme';
import { SectionLabel } from '../components/DesignKit';
import { AddFriend } from '../components/AddFriend';

/**
 * Lig aralığını insan diline çevirir: "7-13 Ağustos".
 *
 * ⚠️ TASARIM LİG ADINI DEĞİL TARİH ARALIĞINI GÖSTERİYOR.
 * Sunucu "2026 - 33. Hafta Ligi" döndürüyor; kullanıcı hafta numarasını
 * bilmiyor ama tarihi biliyor. Aynı ay içindeyse ay bir kez yazılıyor.
 */
const AY = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
] as const;

function formatRange(startsAt: string, endsAt: string): string {
  const a = new Date(startsAt);
  const b = new Date(endsAt);

  const sameMonth = a.getUTCMonth() === b.getUTCMonth();
  const ay = AY[b.getUTCMonth()] ?? '';

  return sameMonth
    ? `${a.getUTCDate()}-${b.getUTCDate()} ${ay}`
    : `${a.getUTCDate()} ${AY[a.getUTCMonth()]} - ${b.getUTCDate()} ${ay}`;
}

type LeagueInfo = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: 'open' | 'closed';
  remainingSeconds: number;
  totalParticipants: number;
};

type LeaderboardEntry = {
  rank: number;
  userId: string;
  displayName: string;
  /** Profil ekranının adresi. Eski kayıtlarda eksik olabilir. */
  username?: string;
  isPublic: boolean;
  twrPercentRaw: number;
  twrPercentFormatted: string;
  startValueCents: string;
  endValueCents: string;
};

export function LeaderboardScreen({
  onOpenFriends,
  onSelectUser,
}: {
  /**
   * Bir yarışmacıya dokununca profilini açar.
   *
   * ⚠️ Kullanıcı adı olmayan satır dokunulamaz kalıyor: `undefined`
   * bir profil adresine gitmektense hiç tepki vermemek daha az
   * yanıltıcı. Bu durum yalnızca eski kayıtlarda olabilir.
   */
  onSelectUser?: (username: string) => void;
  /** Arkadaşlar katmanını açar. Verilmezse düğme çizilmez. */
  onOpenFriends?: () => void;
}) {
  // Aktif Sekme (Genel Lig vs Arkadaşlarım)
  const [activeTab, setActiveTab] = useState<'global' | 'friends'>('global');



  // Veri Durumları
  const [leagueInfo, setLeagueInfo] = useState<LeagueInfo | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verileri Çekme Fonksiyonu
  async function loadData() {
    setError(null);
    setLoading(true);

    try {
      // 1. Lig Bilgisi (Adı ve Kalan Süre)
      const infoRes = await apiFetch<{ league: LeagueInfo }>('/leagues/current');
      setLeagueInfo(infoRes.league);

      // 2. Sıralama Listesi (Sekmeye Göre)
      const endpoint =
        activeTab === 'global'
          ? '/leagues/current/leaderboard?limit=50'
          : '/leagues/current/friends';

      const listRes = await apiFetch<{ leaderboard: LeaderboardEntry[] }>(endpoint);
      setEntries(listRes.leaderboard || []);

      // ⚠️ Bekleyen istek sayacı BURADAN KALDIRILDI — Profil sekmesine
      // taşındı. Aynı sayıyı iki ekranda saymak, biri eskidiğinde
      // çelişkili rozet göstermek demekti.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lig verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  }

  // Sekme değiştiğinde veya sayfa ilk açıldığında veriyi yükle
  useEffect(() => {
    loadData();
  }, [activeTab]);

  // Kalan saniyeyi okunabilir saate/güne çeviren yardımcı
  function formatRemainingTime(seconds: number): string {
    if (seconds <= 0) return 'Bitti';
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}g ${hours}s`;
    if (hours > 0) return `${hours}s ${mins}dk`;
    return `${mins}dk`;
  }

  // Podyum için İlk 3 Yarışmacı
  const top1 = entries.find((e) => e.rank === 1);
  const top2 = entries.find((e) => e.rank === 2);
  const top3 = entries.find((e) => e.rank === 3);

  // 4. ve sonraki sıralamadaki yarışmacılar
  const restEntries = entries.filter((e) => e.rank > 3);

  return (
    <View style={styles.container}>
      {/* 1. Üst Başlık & Geri Sayım Rozeti */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <SectionLabel>HAFTALIK LİG</SectionLabel>
          {/*
            ⚠️ ETİKET DURUMA GÖRE DEĞİŞİYOR.
            Lig bittiğinde sayaç "Bitti" yazıyordu ve üstünde "BİTİŞE"
            etiketi duruyordu — "bitişe bitti" gibi okunuyordu. Bitmiş
            bir ligde geri sayım diye bir şey yok.
          */}
          {leagueInfo && (
            <SectionLabel>
              {leagueInfo.remainingSeconds > 0 ? 'BİTİŞE' : 'DURUM'}
            </SectionLabel>
          )}
        </View>

        <View style={styles.headerMain}>
          <Text style={styles.title}>
            {leagueInfo
              ? formatRange(leagueInfo.startsAt, leagueInfo.endsAt)
              : 'Haftalık Lig'}
          </Text>

          {leagueInfo && (
            <Text style={styles.countdown}>
              {formatRemainingTime(leagueInfo.remainingSeconds)}
            </Text>
          )}
        </View>

        <Text style={styles.participantCount}>
          {leagueInfo?.totalParticipants || entries.length} yarışmacı
        </Text>
      </View>

      {/* 2. Sekmeler (Genel Lig / Arkadaşlarım) */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'global' && styles.tabButtonActive]}
          onPress={() => setActiveTab('global')}
        >
          <Text style={[styles.tabText, activeTab === 'global' && styles.tabTextActive]}>
            Genel Lig
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'friends' && styles.tabButtonActive]}
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
            Arkadaşlarım
          </Text>
        </TouchableOpacity>
      </View>

      {/* Yükleniyor Göstergesi */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gain} />
          <Text style={styles.loadingText}>Liderlik tablosu yükleniyor...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Henüz sıralama oluşmadı</Text>
          <Text style={styles.emptyText}>
            {activeTab === 'friends'
              ? 'Arkadaşlarınız henüz işlem yapmadı veya arkadaş listeniz boş.'
              : 'Bu haftaki ligde henüz yarışmacı skoru girilmedi.'}
          </Text>

          {/*
            ⚠️ DAVET DÜĞMESİ BOŞ DURUMDA DA VAR — asıl gerekli olduğu yer
            burası. Yalnızca dolu listenin altına koysaydık, arkadaşı
            olmayan kullanıcı arkadaş EKLEYEMEZDİ; tam da eklemesi gereken
            kişi düğmeyi göremezdi.
          */}
          {activeTab === 'friends' && (
            <>
              <AddFriend onSent={() => void loadData()} />

            </>
          )}
        </View>
      ) : (
        <FlatList
        showsVerticalScrollIndicator={false}
          data={restEntries}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.listContent}
          // Podyumu Listenin Başına (Header) Koyuyoruz
          ListHeaderComponent={
            top1 || top2 || top3 ? (
              <View style={styles.podiumContainer}>
                {/* 2. Sıra (Gümüş Podyum) */}
                <TouchableOpacity
                  style={[styles.podiumColumn, styles.podiumCol2]}
                  disabled={top2?.username === undefined || onSelectUser === undefined}
                  onPress={() => {
                    if (top2?.username !== undefined) onSelectUser?.(top2.username);
                  }}
                  accessibilityRole="button"
                >
                  {top2 ? (
                    <>
                      <View style={[styles.avatarCircle, styles.silverBorder]}>
                        <Text style={styles.avatarText}>{top2.displayName.slice(0, 2).toUpperCase()}</Text>
                        <View style={[styles.medalBadge, styles.silverBadge]}>
                          <Text style={styles.medalText}>2</Text>
                        </View>
                      </View>
                      <Text style={styles.podiumName} numberOfLines={1}>{top2.displayName}</Text>
                      <Text style={styles.podiumTwr}>{top2.twrPercentFormatted}</Text>
                      <View style={[styles.podiumStand, styles.silverStand]}>
                        <Text style={styles.standRank}>2</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.podiumPlaceholder} />
                  )}
                </TouchableOpacity>

                {/* 1. Sıra (Altın Podyum - En Yüksek) */}
                <TouchableOpacity
                  style={[styles.podiumColumn, styles.podiumCol1]}
                  disabled={top1?.username === undefined || onSelectUser === undefined}
                  onPress={() => {
                    if (top1?.username !== undefined) onSelectUser?.(top1.username);
                  }}
                  accessibilityRole="button"
                >
                  {top1 ? (
                    <>
                      <View style={[styles.avatarCircle, styles.goldBorder]}>
                        <Text style={styles.avatarText}>{top1.displayName.slice(0, 2).toUpperCase()}</Text>
                        <View style={[styles.medalBadge, styles.goldBadge]}>
                          <Text style={styles.medalText}>👑</Text>
                        </View>
                      </View>
                      <Text style={styles.podiumName} numberOfLines={1}>{top1.displayName}</Text>
                      <Text style={[styles.podiumTwr, styles.goldTwr]}>{top1.twrPercentFormatted}</Text>
                      <View style={[styles.podiumStand, styles.goldStand]}>
                        <Text style={styles.standRank}>1</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.podiumPlaceholder} />
                  )}
                </TouchableOpacity>

                {/* 3. Sıra (Bronz Podyum) */}
                <TouchableOpacity
                  style={[styles.podiumColumn, styles.podiumCol3]}
                  disabled={top3?.username === undefined || onSelectUser === undefined}
                  onPress={() => {
                    if (top3?.username !== undefined) onSelectUser?.(top3.username);
                  }}
                  accessibilityRole="button"
                >
                  {top3 ? (
                    <>
                      <View style={[styles.avatarCircle, styles.bronzeBorder]}>
                        <Text style={styles.avatarText}>{top3.displayName.slice(0, 2).toUpperCase()}</Text>
                        <View style={[styles.medalBadge, styles.bronzeBadge]}>
                          <Text style={styles.medalText}>3</Text>
                        </View>
                      </View>
                      <Text style={styles.podiumName} numberOfLines={1}>{top3.displayName}</Text>
                      <Text style={styles.podiumTwr}>{top3.twrPercentFormatted}</Text>
                      <View style={[styles.podiumStand, styles.bronzeStand]}>
                        <Text style={styles.standRank}>3</Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.podiumPlaceholder} />
                  )}
                </TouchableOpacity>
              </View>
            ) : null
          }
          // 4., 5., 6... Sıradaki Kullanıcı Satırları
          renderItem={({ item }) => {
            const isPositive = item.twrPercentRaw >= 0;
            const openable = item.username !== undefined && onSelectUser !== undefined;

            return (
              /*
                Satır profile açılıyor.

                ⚠️ `disabled` KULLANILIYOR, satırı gizlemek değil: kullanıcı
                adı olmayan eski bir kayıt yine sıralamada görünmeli, sadece
                dokunulamaz olmalı. Listeden düşürseydik sıralama eksik
                görünürdü ve sebebi anlaşılmazdı.
              */
              <TouchableOpacity
                style={styles.userRow}
                disabled={!openable}
                onPress={() => {
                  if (item.username !== undefined) onSelectUser?.(item.username);
                }}
                accessibilityRole={openable ? 'button' : undefined}
                accessibilityLabel={`${item.displayName} profilini aç`}
              >
                <View style={styles.rankCircle}>
                  <Text style={styles.rankText}>{item.rank}</Text>
                </View>

                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.displayName}</Text>
                </View>

                <View style={[styles.twrBadge, isPositive ? styles.twrBadgePositive : styles.twrBadgeNegative]}>
                  <Text style={[styles.twrBadgeText, isPositive ? styles.twrTextPositive : styles.twrTextNegative]}>
                    {item.twrPercentFormatted}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            activeTab === 'friends' ? (
              // ⚠️ İki kardeş eleman parça ile sarılıyor: ListFooterComponent
              // TEK bir eleman bekliyor, sarmalayıcı olmadan sözdizimi hatası.
              <>
                <AddFriend onSent={() => void loadData()} />

              </>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  countdown: {
    fontFamily: fonts.monoBold,
    fontSize: 20,
    color: colors.ink,
    letterSpacing: -0.5,
  },
  header: {
    /*
     * ⚠️ `row` DEĞİL `column` — ve bozukluk tam buradaydı.
     *
     * Başlık eskiden iki parçalıydı ve yan yana diziliyordu. Tasarıma
     * geçerken içine ÜÇ satır kondu (etiket satırı, başlık+geri sayım,
     * yarışmacı sayısı) ama kapsayıcı hâlâ `row` olduğu için üç satır
     * yan yana sıkışıp üst üste bindi.
     *
     * Dersi şu: bir kapsayıcının İÇİNİ değiştirirken YÖNÜNÜ de kontrol
     * et. Stil dosyanın 200 satır aşağısında olduğu için gözden kaçtı.
     */
    flexDirection: 'column',
    paddingHorizontal: spacing.screen,
    paddingTop: 18,
    paddingBottom: 4,
  },
  title: {
    fontSize: 26,
    fontFamily: fonts.semibold,
    color: colors.ink,
    letterSpacing: -0.6,
  },
  participantCount: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.inkFaint,
    marginTop: 6,
  },
  countdownBadge: {
    backgroundColor: colors.fieldFill,
    borderColor: colors.warn,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  countdownLabel: {
    color: colors.warn,
    fontSize: 10,
    fontFamily: fonts.semibold,
  },
  countdownValue: {
    color: colors.ink,
    fontSize: 12,
    fontFamily: fonts.bold,
    marginTop: 1,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: spacing.screen,
    marginTop: 16,
    marginBottom: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  /*
   * ⚠️ AKTİF SEKME YEŞİL DEĞİL, TERS ZEMİN.
   *
   * Yeşil bu uygulamada YÜKSELİŞ demek. Aktif sekmeyi yeşile boyamak
   * "lig yükseliyor" gibi okunuyordu — hem yanlış hem tasarımın dilinin
   * dışında. Tasarım seçili durumu her yerde açık dolgu + koyu metinle
   * anlatıyor (çipler, aralık seçici, tutar düğmeleri).
   */
  tabButtonActive: {
    backgroundColor: colors.inverse,
    borderColor: colors.inverse,
  },
  tabText: {
    color: colors.inkMuted,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  tabTextActive: {
    // ⚠️ Açık zeminde beyaz metin okunmaz. Ters zemin ters metin ister.
    color: colors.onInverse,
    fontFamily: fonts.bold,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.inkMuted,
    marginTop: 10,
    fontSize: 14,
  },
  errorBox: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    margin: 20,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  emptyText: {
    fontSize: 13,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginVertical: 20,
    gap: 12,
  },
  podiumColumn: {
    alignItems: 'center',
    flex: 1,
  },
  podiumCol1: {
    zIndex: 3,
  },
  podiumCol2: {
    zIndex: 2,
  },
  podiumCol3: {
    zIndex: 1,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.fieldFill,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  goldBorder: {
    borderColor: colors.gold,
    borderWidth: 2.5,
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  silverBorder: {
    borderColor: colors.silver,
    borderWidth: 2,
  },
  bronzeBorder: {
    borderColor: colors.bronze,
    borderWidth: 2,
  },
  avatarText: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  medalBadge: {
    position: 'absolute',
    bottom: -6,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  goldBadge: {
    backgroundColor: colors.gold,
  },
  silverBadge: {
    backgroundColor: colors.silver,
  },
  bronzeBadge: {
    backgroundColor: colors.bronze,
  },
  medalText: {
    color: colors.ink,
    fontSize: 10,
    fontFamily: fonts.bold,
  },
  podiumName: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },
  podiumTwr: {
    color: colors.gain,
    fontFamily: fonts.bold,
    fontSize: 14,
    marginTop: 2,
  },
  goldTwr: {
    fontSize: 16,
    color: colors.gain,
  },
  podiumStand: {
    width: '100%',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  goldStand: {
    height: 75,
    backgroundColor: colors.goldSoft,
    borderColor: colors.gold,
    borderWidth: 1.5,
  },
  silverStand: {
    height: 55,
    backgroundColor: colors.silverSoft,
    borderColor: colors.silver,
    borderWidth: 1.5,
  },
  bronzeStand: {
    height: 40,
    backgroundColor: colors.bronzeSoft,
    borderColor: colors.bronze,
    borderWidth: 1.5,
  },
  standRank: {
    color: colors.ink,
    fontSize: 20,
    fontFamily: fonts.bold,
    opacity: 0.8,
  },
  podiumPlaceholder: {
    height: 40,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.fieldFill,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 4,
  },
  rankCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rankText: {
    color: colors.inkMuted,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: colors.ink,
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  twrBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  twrBadgePositive: {
    backgroundColor: colors.gainSoft,
  },
  twrBadgeNegative: {
    backgroundColor: colors.accentSoft,
  },
  twrBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  twrTextPositive: {
    color: colors.gain,
  },
  twrTextNegative: {
    color: colors.accent,
  },
});
