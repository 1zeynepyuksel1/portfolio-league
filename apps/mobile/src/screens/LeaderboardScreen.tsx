import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { createAvatar } from '@dicebear/core';
import { shapes } from '@dicebear/collection';


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

const localAvatars: Record<string, any> = {
  meerkat: require('../../assets/avatars/meerkat.png'),
  chicken: require('../../assets/avatars/chicken.png'),
  bear: require('../../assets/avatars/bear.png'),
  cat: require('../../assets/avatars/cat.png'),
  rabbit: require('../../assets/avatars/rabbit.png'),
  panda: require('../../assets/avatars/panda.png'),
};

const bgColors = ['facc15', 'fb923c', 'f87171', 'c084fc', '818cf8', '38bdf8', '4ade80', 'a3e635'];
const shapeColors = ['ffffff', '000000', '1e293b', '334155'];

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

/**
 * Bir TWR yuzdesinin metin rengi — ARTI yeşil, EKSİ kırmızı.
 *
 * ⚠️ KURAL TEK YERDE OLMAK ZORUNDA — VE HATA TAM DA BU YÜZDEN ÇIKTI.
 *
 * Eskiden aynı kural ekranda İKİ KEZ yazılıydı:
 *   • liste satırı  -> `item.twrPercentRaw >= 0` diye işareti KONTROL ediyordu
 *   • podyum       -> `color: colors.gain` diye SABİT yeşil yazıyordu
 *
 * Sonuç: 2. ve 3. sıradaki eksi getiriler yeşil görünüyordu. Alttaki aynı
 * sayılar kırmızıydı — yani ekran aynı bilgiyi iki farklı renkte gösteriyordu.
 * Fark edilmesi zordu çünkü "podyumdakiler kazanıyor" varsayımı doğal
 * görünüyor; halbuki podyum SIRALAMAYI gösteriyor, karı değil. Herkesin
 * zararda olduğu bir haftada birinci de eksidedir.
 *
 * ⚠️ `loss` KULLANILIYOR, `accent` DEĞİL — ikisi de kırmızı ama işleri farklı:
 *   `loss`   #E5484D  "para eridi" demek. Cüzdan, Profil ve Alsaydın
 *                     ekranlarının hepsi bunu kullanıyor.
 *   `accent` #ec3013  marka rengi: düğmeler, bağlantılar, grafik çizgisi.
 *
 * Lig ekranı tüm uygulamada `accent`'i eksi sayı için kullanan TEK yerdi.
 * Aynı anlamı iki farklı kırmızıyla göstermek, kullanıcıya aradaki farkın
 * bir şey ifade ettiğini düşündürür.
 *
 * ⚠️ `>= 0` — tam sıfır yeşile sayılıyor. Ne kazanç ne kayıp ama bir renk
 * seçmek zorunlu; liste satırı zaten böyle davranıyordu, aynı kaldı.
 */
function twrColor(twrPercentRaw: number) {
  const isZero = Math.abs(twrPercentRaw * 100) < 0.005;
  if (isZero) {
    return { color: colors.inkMuted };
  }
  return { color: twrPercentRaw > 0 ? colors.gain : colors.loss };
}


function renderAvatar(user: any) {
  if (user?.avatarStyle === 'local' && user?.avatarSeed && localAvatars[user.avatarSeed as keyof typeof localAvatars]) {
    return <Image source={localAvatars[user.avatarSeed as keyof typeof localAvatars]} style={{width: '100%', height: '100%', borderRadius: 100}} resizeMode="contain" />;
  } else if (user?.avatarSeed) {
    return <SvgXml xml={createAvatar(shapes, { seed: user.avatarSeed, backgroundColor: bgColors, shape1Color: shapeColors, shape2Color: shapeColors, shape3Color: shapeColors }).toString()} width="100%" height="100%" style={{borderRadius: 100}} />;
  } else {
    return <Text style={styles.avatarText}>{user?.displayName?.slice(0, 2).toUpperCase()}</Text>;
  }
}

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

  /**
   * Aşağı çekip yenileme göstergesi — `loading`'den AYRI.
   *
   * `loading` tüm ekranı boşaltıp spinner gösteriyor; ilk açılışta doğru
   * ama yenilemede liste bir an kaybolur ve kullanıcı yerini şaşırır.
   * Yenilemede içerik ekranda kalmalı.
   */
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verileri Çekme Fonksiyonu
  async function loadData(isRefresh = false) {
    setError(null);
    // Yenilemede ekranı boşaltma — yukarıdaki gerekçe.
    if (!isRefresh) setLoading(true);

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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadData(true).finally(() => setRefreshing(false));
              }}
              tintColor={colors.inkMuted}
            />
          }
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
                        {renderAvatar(top2)}
                        <View style={[styles.medalBadge, styles.silverBadge]}>
                          <Text style={styles.medalText}>2</Text>
                        </View>
                      </View>
                      <Text style={styles.podiumName} numberOfLines={1}>{top2.displayName}</Text>
                      <Text style={[styles.podiumTwr, twrColor(top2.twrPercentRaw)]}>{top2.twrPercentFormatted}</Text>
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
                        {renderAvatar(top1)}
                        <View style={[styles.medalBadge, styles.goldBadge]}>
                          <Text style={styles.medalText}>👑</Text>
                        </View>
                      </View>
                      <Text style={styles.podiumName} numberOfLines={1}>{top1.displayName}</Text>
                      <Text style={[styles.podiumTwr, styles.goldTwr, twrColor(top1.twrPercentRaw)]}>{top1.twrPercentFormatted}</Text>
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
                        {renderAvatar(top3)}
                        <View style={[styles.medalBadge, styles.bronzeBadge]}>
                          <Text style={styles.medalText}>3</Text>
                        </View>
                      </View>
                      <Text style={styles.podiumName} numberOfLines={1}>{top3.displayName}</Text>
                      <Text style={[styles.podiumTwr, twrColor(top3.twrPercentRaw)]}>{top3.twrPercentFormatted}</Text>
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
            const isZero = Math.abs(item.twrPercentRaw * 100) < 0.005;
            const isPositive = !isZero && item.twrPercentRaw > 0;

            const badgeStyle = isZero
              ? styles.twrBadgeNeutral
              : isPositive
                ? styles.twrBadgePositive
                : styles.twrBadgeNegative;

            const textStyle = isZero
              ? styles.twrTextNeutral
              : isPositive
                ? styles.twrTextPositive
                : styles.twrTextNegative;

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

                <View style={{ width: 36, height: 36, borderRadius: 20, backgroundColor: colors.surfacePressed, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' }}>
                    {renderAvatar(item)}
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.displayName}</Text>
                  </View>

                <View style={[styles.twrBadge, badgeStyle]}>
                  <Text style={[styles.twrBadgeText, textStyle]}>
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
    marginTop: 8,
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
    paddingTop: 20,
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
    marginTop: 8,
  },
  countdownBadge: {
    backgroundColor: colors.fieldFill,
    borderColor: colors.warn,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
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
    marginTop: 2,
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
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 14,
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
    fontSize: 14,
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
    marginTop: 12,
    fontSize: 14,
  },
  errorBox: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    margin: 20,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.ink,
  },
  emptyText: {
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
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
    fontSize: 20,
  },
  medalBadge: {
    position: 'absolute',
    bottom: -6,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
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
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  podiumTwr: {
    // Renk YOK - twrColor() veriyor. Buraya sabit renk yazmak hatanin ta kendisiydi.
    fontFamily: fonts.bold,
    fontSize: 14,
    marginTop: 2,
  },
  goldTwr: {
    // Sadece boyut. Renk twrColor()'dan geliyor; birinci de ekside olabilir.
    fontSize: 16,
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
    borderRadius: 14,
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
    marginRight: 16,
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
    fontSize: 16,
  },
  twrBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  twrBadgePositive: {
    backgroundColor: colors.gainSoft,
  },
  twrBadgeNegative: {
    backgroundColor: colors.lossSoft,
  },
  twrBadgeNeutral: {
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
  },
  twrBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  twrTextPositive: {
    color: colors.gain,
  },
  twrTextNegative: {
    color: colors.loss,
  },
  twrTextNeutral: {
    color: colors.inkMuted,
  },
});
