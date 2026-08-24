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
import { colors, fonts } from '../theme';
import { SectionLabel } from '../components/DesignKit';

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
  isPublic: boolean;
  twrPercentRaw: number;
  twrPercentFormatted: string;
  startValueCents: string;
  endValueCents: string;
};

export function LeaderboardScreen() {
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
          {leagueInfo && <SectionLabel>BİTİŞE</SectionLabel>}
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
            🌍 Genel Süper Lig
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'friends' && styles.tabButtonActive]}
          onPress={() => setActiveTab('friends')}
        >
          <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
            👥 Arkadaşlarım
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
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyTitle}>Henüz Sıralama Oluşmadı</Text>
          <Text style={styles.emptyText}>
            {activeTab === 'friends'
              ? 'Arkadaşlarınız henüz işlem yapmadı veya arkadaş listeniz boş.'
              : 'Bu haftaki ligde henüz yarışmacı skoru girilmedi.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={restEntries}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.listContent}
          // Podyumu Listenin Başına (Header) Koyuyoruz
          ListHeaderComponent={
            top1 || top2 || top3 ? (
              <View style={styles.podiumContainer}>
                {/* 2. Sıra (Gümüş Podyum) */}
                <View style={[styles.podiumColumn, styles.podiumCol2]}>
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
                </View>

                {/* 1. Sıra (Altın Podyum - En Yüksek) */}
                <View style={[styles.podiumColumn, styles.podiumCol1]}>
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
                </View>

                {/* 3. Sıra (Bronz Podyum) */}
                <View style={[styles.podiumColumn, styles.podiumCol3]}>
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
                </View>
              </View>
            ) : null
          }
          // 4., 5., 6... Sıradaki Kullanıcı Satırları
          renderItem={({ item }) => {
            const isPositive = item.twrPercentRaw >= 0;
            return (
              <View style={styles.userRow}>
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
              </View>
            );
          }}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
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
    backgroundColor: colors.fieldFill,
    borderRadius: 10,
    padding: 4,
    marginHorizontal: 20,
    marginVertical: 10,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: colors.gain,
  },
  tabText: {
    color: colors.inkMuted,
    fontFamily: fonts.semibold,
    fontSize: 13,
  },
  tabTextActive: {
    color: colors.ink,
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
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 10,
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
    borderColor: colors.warn,
    borderWidth: 2.5,
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  silverBorder: {
    borderColor: colors.inkMuted,
    borderWidth: 2,
  },
  bronzeBorder: {
    borderColor: colors.warn,
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
    backgroundColor: colors.warn,
  },
  silverBadge: {
    backgroundColor: colors.inkFaint,
  },
  bronzeBadge: {
    backgroundColor: colors.warn,
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
    backgroundColor: colors.warnSoft,
    borderColor: colors.warn,
    borderWidth: 1.5,
  },
  silverStand: {
    height: 55,
    backgroundColor: colors.border,
    borderColor: colors.inkMuted,
    borderWidth: 1.5,
  },
  bronzeStand: {
    height: 40,
    backgroundColor: colors.warnSoft,
    borderColor: colors.warn,
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
