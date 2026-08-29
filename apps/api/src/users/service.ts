import { db } from '../db/client.js';
import { users, leagueEntries } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { findFriendshipBetweenUsers } from '../friends/repository.js';
import { findCurrentOpenLeague, countLeagueParticipants } from '../leagues/repository.js';
import { syncUserLeagueEntry } from '../leagues/twr-engine.js';

export async function getUserProfileByUsername(requesterId: string, targetUsername: string) {
  // 1. Kullanıcıyı bul
  const [targetUser] = await db
    .select({
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      isPublic: users.isPublic,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.username, targetUsername.toLowerCase().trim()))
    .limit(1);

  if (!targetUser) {
    return null;
  }

  // 2. Kendi profili mi yoksa başkasının mı?
  const isSelf = requesterId === targetUser.id;

  // 3. Arkadaşlık durumunu kontrol et
  let areFriends = false;
  if (!isSelf) {
    const relation = await findFriendshipBetweenUsers(requesterId, targetUser.id);
    areFriends = relation?.status === 'accepted';
  }

  // 4. Gizlilik maskelemesi uygulayalım
  // Eğer profil gizli ise (isPublic = false) ve kendisi ya da arkadaşı değilse, isimleri maskele
  const shouldMask = !targetUser.isPublic && !isSelf && !areFriends;

  const maskName = (name: string) => {
    if (!name) return '';
    return name[0] + '***';
  };

  const displayName = shouldMask
    ? `${maskName(targetUser.firstName)} ${maskName(targetUser.lastName)}`
    : `${targetUser.firstName} ${targetUser.lastName}`;

  // 5. Lig performansı ve sıralaması oku
  const currentLeague = await findCurrentOpenLeague();
  let rank: number | null = null;
  let twrPercent: string | null = null;
  let totalParticipants: number | null = null;

  if (currentLeague) {
    if (process.env.NODE_ENV !== 'test') {
      // Canlı TWR verisini senkronize et
      await syncUserLeagueEntry(targetUser.id).catch((err) => {
        console.error(`[users/service] TWR senkronizasyon hatası:`, err);
      });
      totalParticipants = await countLeagueParticipants(currentLeague.id);
    }

    const [entry] = await db
      .select({
        rank: leagueEntries.rank,
        twrPct: leagueEntries.twrPct,
      })
      .from(leagueEntries)
      .where(
        and(
          eq(leagueEntries.periodId, currentLeague.id),
          eq(leagueEntries.userId, targetUser.id),
        )
      )
      .limit(1);

    if (entry) {
      rank = entry.rank;
      const twrFloat = parseFloat(entry.twrPct);
      twrPercent = (twrFloat * 100).toFixed(2);
    }
  }

  return {
    id: targetUser.id,
    username: targetUser.username,
    displayName,
    isPublic: targetUser.isPublic,
    createdAt: targetUser.createdAt,
    rank,
    twrPercent,
    totalParticipants,
    isSelf,
    areFriends,
  };
}
