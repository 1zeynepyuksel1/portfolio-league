import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiFetch } from '../api/client';

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

  useEffect(() => {
    loadData();
  }, [activeTab]);

  function formatRemainingTime(seconds: number): string {
    if (seconds <= 0) return 'Bitti';
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}g ${hours}s`;
    if (hours > 0) return `${hours}s ${mins}dk`;
    return `${mins}dk`;
  }

  const top1 = entries.find((e) => e.rank === 1);
  const top2 = entries.find((e) => e.rank === 2);
  const top3 = entries.find((e) => e.rank === 3);

  const restEntries = entries.filter((e) => e.rank > 3);

  return (
    <View style={styles.container}>
      {/* 1. Üst Başlık & Geri Sayım Rozeti */}
      <View style={styles.headerContainer}>
        <View style={styles.headerMain}>
          <Text style={styles.title} numberOfLines={1}>
            🏆 {leagueInfo?.name || 'Haftalık Şampiyonluk Ligi'}
          </Text>
          <Text style={styles.participantCount}>
            👥 {leagueInfo?.totalParticipants || entries.length} Aktif Yarışmacı
          </Text>
        </View>

        {leagueInfo && (
          <View style={styles.countdownBadge}>
            <Text style={styles.countdownLabel}>BİTİŞE KALAN</Text>
            <Text style={styles.countdownValue}>
              ⏱️ {formatRemainingTime(leagueInfo.remainingSeconds)}
            </Text>
          </View>
        )}
      </View>

      {/* 2. Sekmeler (Genel Lig / Arkadaşlarım) */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'global' && styles.tabButtonActive]}
          onPress={() => setActiveTab('global')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'global' && styles.tabTextActive]}>
            🌍 Genel Süper Lig
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'friends' && styles.tabButtonActive]}
          onPress={() => setActiveTab('friends')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
            👥 Arkadaşlarım
          </Text>
        </TouchableOpacity>
      </View>

      {/* Yükleniyor Göstergesi */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Liderlik tablosu yükleniyor...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.glassCard}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyTitle}>Henüz Sıralama Oluşmadı</Text>
            <Text style={styles.emptyText}>
              {activeTab === 'friends'
                ? 'Arkadaşlarınız henüz işlem yapmadı veya arkadaş listeniz boş.'
                : 'Bu haftaki ligde henüz yarışmacı skoru girilmedi.'}
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={restEntries}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={styles.listContent}
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

                {/* 1. Sıra (Altın Podyum) */}
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
          renderItem={({ item }) => {
            const isPositive = item.twrPercentRaw >= 0;
            return (
              <View style={styles.glassUserRow}>
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
    backgroundColor: '#081226',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 12,
  },
  headerMain: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  participantCount: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 3,
  },
  countdownBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  countdownLabel: {
    color: '#F59E0B',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  countdownValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 14,
    padding: 4,
    marginHorizontal: 20,
    marginVertical: 8,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#10B981',
  },
  tabText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 13,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 10,
    fontSize: 14,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    margin: 20,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  glassCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1.5,
    borderRadius: 26,
    padding: 24,
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
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
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  goldBorder: {
    borderColor: '#F59E0B',
    borderWidth: 2.5,
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  silverBorder: {
    borderColor: '#94A3B8',
    borderWidth: 2,
  },
  bronzeBorder: {
    borderColor: '#D97706',
    borderWidth: 2,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
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
    backgroundColor: '#F59E0B',
  },
  silverBadge: {
    backgroundColor: '#64748B',
  },
  bronzeBadge: {
    backgroundColor: '#D97706',
  },
  medalText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  podiumName: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },
  podiumTwr: {
    color: '#10B981',
    fontWeight: 'bold',
    fontSize: 14,
    marginTop: 2,
  },
  goldTwr: {
    fontSize: 16,
    color: '#34D399',
  },
  podiumStand: {
    width: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  goldStand: {
    height: 75,
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderColor: '#F59E0B',
    borderWidth: 1.5,
  },
  silverStand: {
    height: 55,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    borderColor: '#94A3B8',
    borderWidth: 1.5,
  },
  bronzeStand: {
    height: 40,
    backgroundColor: 'rgba(217, 119, 6, 0.2)',
    borderColor: '#D97706',
    borderWidth: 1.5,
  },
  standRank: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    opacity: 0.8,
  },
  podiumPlaceholder: {
    height: 40,
  },
  glassUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1.2,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 4,
  },
  rankCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rankText: {
    color: '#94A3B8',
    fontWeight: 'bold',
    fontSize: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  twrBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  twrBadgePositive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  twrBadgeNegative: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  twrBadgeText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  twrTextPositive: {
    color: '#10B981',
  },
  twrTextNegative: {
    color: '#EF4444',
  },
});
