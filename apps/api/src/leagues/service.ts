import { formatTwrPercent } from '@portfolio-league/contracts';
import {
  countLeagueParticipants,
  ensureCurrentLeaguePeriod,
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
