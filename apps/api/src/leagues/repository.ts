import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { friendships, leagueEntries, leaguePeriods, users } from '../db/schema.js';

// Açık olan aktif ligi getir
export async function findCurrentOpenLeague() {
  const [period] = await db
    .select()
    .from(leaguePeriods)
    .where(eq(leaguePeriods.status, 'open'))
    .orderBy(desc(leaguePeriods.startsAt))
    .limit(1);

  return period;
}

// Yeni bir lig dönemi oluştur
export async function createLeaguePeriod(input: {
  name: string;
  startsAt: Date;
  endsAt: Date;
  status?: 'open' | 'closed';
}) {
  const [created] = await db
    .insert(leaguePeriods)
    .values({
      name: input.name,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      status: input.status ?? 'open',
    })
    .returning();

  if (!created) {
    throw new Error('Lig dönemi oluşturulamadı.');
  }

  return created;
}

// Lig durumunu güncelle (open -> closed)
export async function updateLeaguePeriodStatus(periodId: string, status: 'open' | 'closed') {
  const [updated] = await db
    .update(leaguePeriods)
    .set({ status })
    .where(eq(leaguePeriods.id, periodId))
    .returning();

  return updated;
}

// Aktif lig yoksa bu hafta için otomatik lig oluşturur
export async function ensureCurrentLeaguePeriod() {
  const existing = await findCurrentOpenLeague();
  if (existing) {
    return existing;
  }

  const now = new Date();
  // Bu haftanın Pazartesi 00:00:00
  const dayOfWeek = now.getUTCDay(); // 0: Pazar, 1: Pazartesi, ...
  const diffToMonday = (dayOfWeek + 6) % 7;
  const startsAt = new Date(now);
  startsAt.setUTCDate(now.getUTCDate() - diffToMonday);
  startsAt.setUTCHours(0, 0, 0, 0);

  // Bu haftanın Pazar 23:59:59
  const endsAt = new Date(startsAt);
  endsAt.setUTCDate(startsAt.getUTCDate() + 6);
  endsAt.setUTCHours(23, 59, 59, 999);

  // Yıl ve hafta numarası
  const weekNumber = Math.ceil(
    ((startsAt.getTime() - new Date(startsAt.getUTCFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7,
  );
  const name = `${startsAt.getUTCFullYear()} - ${weekNumber}. Hafta Ligi`;

  return createLeaguePeriod({
    name,
    startsAt,
    endsAt,
    status: 'open',
  });
}

// Genel lig sıralamasını getir
export async function getLeaderboardByLeagueId(
  leagueId: string,
  limit = 50,
  offset = 0,
) {
  return db
    .select({
      periodId: leagueEntries.periodId,
      userId: leagueEntries.userId,
      displayName: users.displayName,
      isPublic: users.isPublic,
      startValueCents: leagueEntries.startValueCents,
      endValueCents: leagueEntries.endValueCents,
      twrPct: leagueEntries.twrPct,
      rank: leagueEntries.rank,
      updatedAt: leagueEntries.updatedAt,
    })
    .from(leagueEntries)
    .innerJoin(users, eq(leagueEntries.userId, users.id))
    .where(eq(leagueEntries.periodId, leagueId))
    .orderBy(sql`COALESCE(${leagueEntries.rank}, 999999) ASC`, desc(leagueEntries.twrPct))
    .limit(limit)
    .offset(offset);
}

// Sadece arkadaşların (ve kendisinin) olduğu mini lig sıralamasını getir
export async function getFriendsLeaderboardByLeagueId(
  leagueId: string,
  userId: string,
) {
  // 1. Kullanıcının kabul edilmiş arkadaşlarının ID'lerini bul
  const asRequester = await db
    .select({ friendId: friendships.addresseeId })
    .from(friendships)
    .where(and(eq(friendships.requesterId, userId), eq(friendships.status, 'accepted')));

  const asAddressee = await db
    .select({ friendId: friendships.requesterId })
    .from(friendships)
    .where(and(eq(friendships.addresseeId, userId), eq(friendships.status, 'accepted')));

  const friendIds = new Set<string>([
    userId,
    ...asRequester.map((r) => r.friendId),
    ...asAddressee.map((a) => a.friendId),
  ]);

  if (friendIds.size === 0) {
    return [];
  }

  return db
    .select({
      periodId: leagueEntries.periodId,
      userId: leagueEntries.userId,
      displayName: users.displayName,
      isPublic: users.isPublic,
      startValueCents: leagueEntries.startValueCents,
      endValueCents: leagueEntries.endValueCents,
      twrPct: leagueEntries.twrPct,
      rank: leagueEntries.rank,
      updatedAt: leagueEntries.updatedAt,
    })
    .from(leagueEntries)
    .innerJoin(users, eq(leagueEntries.userId, users.id))
    .where(
      and(
        eq(leagueEntries.periodId, leagueId),
        inArray(leagueEntries.userId, Array.from(friendIds)),
      ),
    )
    .orderBy(desc(leagueEntries.twrPct));
}

// Lige katılımcı kaydı ekle / güncelle
export async function upsertLeagueEntry(input: {
  periodId: string;
  userId: string;
  startValueCents: bigint;
  endValueCents: bigint;
  twrPct: string;
  rank?: number;
}) {
  const [entry] = await db
    .insert(leagueEntries)
    .values({
      periodId: input.periodId,
      userId: input.userId,
      startValueCents: input.startValueCents,
      endValueCents: input.endValueCents,
      twrPct: input.twrPct,
      rank: input.rank,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [leagueEntries.periodId, leagueEntries.userId],
      set: {
        startValueCents: input.startValueCents,
        endValueCents: input.endValueCents,
        twrPct: input.twrPct,
        rank: input.rank,
        updatedAt: new Date(),
      },
    })
    .returning();

  return entry;
}

// Bir yarışmacının lig derecesini güncelle
export async function updateEntryRank(periodId: string, userId: string, rank: number) {
  const [updated] = await db
    .update(leagueEntries)
    .set({ rank })
    .where(and(eq(leagueEntries.periodId, periodId), eq(leagueEntries.userId, userId)))
    .returning();

  return updated;
}

// Ligdeki toplam katılımcı sayısını getir
export async function countLeagueParticipants(leagueId: string): Promise<number> {
  const [result] = await db
    .select({ total: count() })
    .from(leagueEntries)
    .where(eq(leagueEntries.periodId, leagueId));

  return result?.total ?? 0;
}
