import { formatTwrPercent } from '@portfolio-league/contracts';
import {
  countLeagueParticipants,
  ensureCurrentLeaguePeriod,
  findEntryForResult,
  findLastClosedLeague,
  findLeagueChampion,
  markResultSeen,
  getFriendsLeaderboardByLeagueId,
  getLeaderboardByLeagueId,
} from './repository.js';
import type {
  LeaderboardEntryDto,
  LeaderboardQuery,
  LeagueInfoDto,
} from './leagues.schema.js';
import { syncAllLeagueEntriesAndRanks } from './twr-engine.js';

// Aktif lig bilgisini ve kalan süreyi döner
export async function getCurrentLeagueInfo(): Promise<LeagueInfoDto> {
  const period = await ensureCurrentLeaguePeriod();
  const totalParticipants = await countLeagueParticipants(period.id);

  const now = Date.now();
  const remainingSeconds = Math.max(
    0,
    Math.floor((period.endsAt.getTime() - now) / 1000),
  );

  return {
    id: period.id,
    name: period.name,
    startsAt: period.startsAt,
    endsAt: period.endsAt,
    status: period.status,
    remainingSeconds,
    totalParticipants,
  };
}

// Genel lig sıralamasını döner
export async function getGlobalLeaderboard(
  query: LeaderboardQuery,
): Promise<{ league: LeagueInfoDto; leaderboard: LeaderboardEntryDto[] }> {
  // Liderlik tablosu çağrıldığında tüm katılımcıların TWR hesaplarını ve derecelerini canlı senkronize et
  await syncAllLeagueEntriesAndRanks();

  const league = await getCurrentLeagueInfo();
  const rawEntries = await getLeaderboardByLeagueId(
    league.id,
    query.limit,
    query.offset,
  );

  const leaderboard: LeaderboardEntryDto[] = rawEntries.map((entry, index) => {
    const twrFloat = parseFloat(entry.twrPct);
    return {
      rank: entry.rank ?? query.offset + index + 1,
      userId: entry.userId,
      displayName: entry.displayName,
      // ⚠️ Profil ekranının adresi. Repository bunu seçiyordu ama servis
      // katmanı düşürüyordu — lig tablosundan profile geçiş bu yüzden
      // çalışmıyordu. Tek tek alan sayan eşlemelerin bilinen bedeli:
      // yeni alan eklemek İKİ yerde iş demek.
      username: entry.username,
      avatarStyle: entry.avatarStyle,
      avatarSeed: entry.avatarSeed,
      isPublic: entry.isPublic,
      twrPercentRaw: twrFloat,
      twrPercentFormatted: formatTwrPercent(twrFloat),
      startValueCents: entry.startValueCents.toString(),
      endValueCents: entry.endValueCents.toString(),
      updatedAt: entry.updatedAt,
    };
  });

  return {
    league,
    leaderboard,
  };
}

// Sadece arkadaşların olduğu mini lig sıralamasını döner
export async function getFriendsLeaderboard(
  userId: string,
): Promise<{ league: LeagueInfoDto; leaderboard: LeaderboardEntryDto[] }> {
  // Canlı TWR senkronizasyonu
  await syncAllLeagueEntriesAndRanks();

  const league = await getCurrentLeagueInfo();
  const rawEntries = await getFriendsLeaderboardByLeagueId(league.id, userId);

  const leaderboard: LeaderboardEntryDto[] = rawEntries.map((entry, index) => {
    const twrFloat = parseFloat(entry.twrPct);
    return {
      rank: index + 1, // Arkadaşlar arası göreceli sıralama
      userId: entry.userId,
      displayName: entry.displayName,
      // ⚠️ Profil ekranının adresi. Repository bunu seçiyordu ama servis
      // katmanı düşürüyordu — lig tablosundan profile geçiş bu yüzden
      // çalışmıyordu. Tek tek alan sayan eşlemelerin bilinen bedeli:
      // yeni alan eklemek İKİ yerde iş demek.
      username: entry.username,
      avatarStyle: entry.avatarStyle,
      avatarSeed: entry.avatarSeed,
      isPublic: entry.isPublic,
      twrPercentRaw: twrFloat,
      twrPercentFormatted: formatTwrPercent(twrFloat),
      startValueCents: entry.startValueCents.toString(),
      endValueCents: entry.endValueCents.toString(),
      updatedAt: entry.updatedAt,
    };
  });

  return {
    league,
    leaderboard,
  };
}

/**
 * Kullanıcının son kapanan ligdeki sonucu — kutlama ekranı için.
 *
 * ⚠️ "GÖRDÜ MÜ" BİLGİSİ SUNUCUDA. Telefonun yerel deposunda tutsaydık,
 * uygulamayı silip kuran ya da ikinci cihazdan giren kullanıcı aynı
 * kutlamayı tekrar görürdü.
 *
 * ⚠️ `null` DÖNMEK NORMAL VE SIK: kapanmış lig yoksa, kullanıcı o ligde
 * yer almadıysa ya da sonucu zaten gördüyse. Ekran bunu "hata" değil
 * "gösterilecek bir şey yok" diye ele almalı.
 */
export async function getMyLeagueResult(userId: string) {
  const period = await findLastClosedLeague();
  if (period === null) return null;

  const entry = await findEntryForResult(period.id, userId);
  if (entry === null) return null;

  // Zaten görüldüyse bir daha gösterilmiyor.
  if (entry.resultSeenAt !== null) return null;

  /*
    ⚠️ SIRALAMASI OLMAYAN KAYIT ATLANIYOR. `rank` null ise dönem
    mühürlenirken bu kullanıcı sıralanmamış demektir; "0. oldunuz"
    yazmaktansa hiç göstermemek doğru.
  */
  if (entry.rank === null) return null;

  const totalParticipants = await countLeagueParticipants(period.id);

  return {
    periodId: period.id,
    periodName: period.name,
    rank: entry.rank,
    totalParticipants,
    // Yüzdeye çevir — depoda oran olarak duruyor.
    twrPercent: (parseFloat(entry.twrPct) * 100).toFixed(2),
  };
}

/** Kutlama gösterildi — bir daha çıkmasın. */
export async function markLeagueResultSeen(userId: string, periodId: string) {
  await markResultSeen(periodId, userId);
}

/**
 * Son kapanan ligin şampiyonu — profil fotoğrafındaki taç için.
 *
 * ⚠️ KULLANICI ADI DÖNÜYOR, KİMLİK DEĞİL. Taç ekranda kullanıcı adına
 * göre çiziliyor (profil, sıralama, gönderi kartı); kimlik döndürseydik
 * her ekranın ayrıca kimlik bilmesi gerekirdi.
 */
export async function getLeagueChampion() {
  const period = await findLastClosedLeague();
  if (period === null) return null;

  const champion = await findLeagueChampion(period.id);
  if (champion === null) return null;

  return { username: champion.username, periodName: period.name };
}
