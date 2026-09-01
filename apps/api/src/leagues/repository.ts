import { and, count, desc, eq, gte, inArray, isNull, sql, lte } from 'drizzle-orm';
import { db } from '../db/client.js';
import { friendships, leagueEntries, leaguePeriods, users } from '../db/schema.js';

// Açık olan aktif ligi getir
export async function findCurrentOpenLeague() {
  const now = new Date();
  const [period] = await db
    .select()
    .from(leaguePeriods)
    .where(
      and(
        eq(leaguePeriods.status, 'open'),
        lte(leaguePeriods.startsAt, now),
        /*
          ⚠️ `endsAt >= now` EKLENDİ — ÖNCE YOKTU VE DÖNEM ÜRETİYORDU.

          Koşulsuz hâlinde "şu anki açık lig" tanımı yalnızca BAŞLAMIŞ
          olmayı arıyordu; bitmiş ama mühürlenmemiş bir dönem de bu
          sorguya takılıyordu.

          Zinciri şöyle işliyordu: sunucu açılışta
          `checkAndCloseExpiredLeagues` çalıştırıyor, süresi geçmiş dönemi
          kapatıp yenisini `eski.endsAt + 1sn`'den başlatıyor. Eski dönem
          çok geride kaldıysa YENİ dönem de geçmişte doğuyor — yani zaten
          süresi dolmuş. Bir sonraki açılışta o da kapanıyor ve bir yenisi
          daha açılıyor. Her yeniden başlatma bir dönem ekliyordu.

          Ölçüldü: 77 dönem, aynı hafta adı 25 kez.
        */
        gte(leaguePeriods.endsAt, now),
      ),
    )
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

  // Türkiye saatine (UTC+3) göre bu haftanın başlangıç ve bitişini hesapla
  const nowTsi = new Date(Date.now() + 3 * 3600 * 1000);
  const dayOfWeek = nowTsi.getUTCDay(); // 0: Pazar, 1: Pazartesi, ...
  const diffToMonday = (dayOfWeek + 6) % 7;

  // Pazartesi 00:00:00 TSİ
  const startsAtTsi = new Date(nowTsi);
  startsAtTsi.setUTCDate(nowTsi.getUTCDate() - diffToMonday);
  startsAtTsi.setUTCHours(0, 0, 0, 0);
  const startsAt = new Date(startsAtTsi.getTime() - 3 * 3600 * 1000);

  // Pazar 23:59:59.999 TSİ
  const endsAtTsi = new Date(startsAtTsi);
  endsAtTsi.setUTCDate(startsAtTsi.getUTCDate() + 6);
  endsAtTsi.setUTCHours(23, 59, 59, 999);
  const endsAt = new Date(endsAtTsi.getTime() - 3 * 3600 * 1000);

  // Yıl ve hafta numarası (TSİ zamanına göre)
  const yearTsi = startsAtTsi.getUTCFullYear();
  const yearStartTsi = new Date(Date.UTC(yearTsi, 0, 1));
  const weekNumber = Math.ceil(
    ((startsAtTsi.getTime() - yearStartTsi.getTime()) / 86400000 + 1) / 7,
  );
  const name = `${yearTsi} - ${weekNumber}. Hafta Ligi`;

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
  const rows = await db
    .select({
      periodId: leagueEntries.periodId,
      userId: leagueEntries.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarStyle: users.avatarStyle,
      avatarSeed: users.avatarSeed,
      // Profil ekranının adresi — /users/:username buna göre çalışıyor.
      username: users.username,
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
    /**
     * ⚠️ ÖNCE TWR, SONRA rank — ESKİDEN TERSİYDİ VE SIRALAMA DONUYORDU.
     *
     * Eski hâli `COALESCE(rank, 999999) ASC, twr DESC` idi: yani sıralama
     * MEVCUT sıralamaya göre yapılıyordu. `syncAllLeagueEntriesAndRanks`
     * de bu listeyi alıp sırayla 1, 2, 3 diye yeniden yazıyordu.
     *
     * Sonuç dairesel: ilk atanan sıra sonsuza kadar kalıyordu. Ölçüldü —
     * TWR %0,00 olan kullanıcı 1., %0,40 olan 3. sıradaydı ve hiçbir
     * fiyat hareketi bunu değiştirmiyordu.
     *
     * Doğrusu: canlı sıralama HER ZAMAN TWR'den türetilir. Saklanan
     * `rank` yalnızca lig kapandığında mühürlenen değer; eşitlik
     * durumunda tie-break olarak kullanılıyor.
     */
    .orderBy(desc(leagueEntries.twrPct), sql`COALESCE(${leagueEntries.rank}, 999999) ASC`)
    .limit(limit)
    .offset(offset);

  return rows.map((row) => ({
    periodId: row.periodId,
    userId: row.userId,
    displayName: `${row.firstName} ${row.lastName}`,
    username: row.username,
    avatarStyle: row.avatarStyle,
    avatarSeed: row.avatarSeed,
    isPublic: row.isPublic,
    startValueCents: row.startValueCents,
    endValueCents: row.endValueCents,
    twrPct: row.twrPct,
    rank: row.rank,
    updatedAt: row.updatedAt,
  }));
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

  const rows = await db
    .select({
      periodId: leagueEntries.periodId,
      userId: leagueEntries.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarStyle: users.avatarStyle,
      avatarSeed: users.avatarSeed,
      // Profil ekranının adresi — /users/:username buna göre çalışıyor.
      username: users.username,
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

  return rows.map((row) => ({
    periodId: row.periodId,
    userId: row.userId,
    displayName: `${row.firstName} ${row.lastName}`,
    username: row.username,
    avatarStyle: row.avatarStyle,
    avatarSeed: row.avatarSeed,
    isPublic: row.isPublic,
    startValueCents: row.startValueCents,
    endValueCents: row.endValueCents,
    twrPct: row.twrPct,
    rank: row.rank,
    updatedAt: row.updatedAt,
  }));
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

/**
 * En son KAPANMIŞ lig dönemi.
 *
 * ⚠️ `status = 'closed'` ŞART, "bitiş tarihi geçmiş" YETMEZ.
 *
 * Bitiş tarihi geçmiş ama henüz mühürlenmemiş bir dönemin sıralaması
 * hesaplanmamış olabilir — cron çalışana kadar `rank` eski değerdedir.
 * Tarihe baksaydık şampiyonluk tacı, cron ile gerçek kapanış arasındaki
 * boşlukta YANLIŞ kişiye takılırdı ve sonra sessizce değişirdi.
 */
export async function findLastClosedLeague() {
  const [period] = await db
    .select({
      id: leaguePeriods.id,
      name: leaguePeriods.name,
      endsAt: leaguePeriods.endsAt,
    })
    .from(leaguePeriods)
    .where(eq(leaguePeriods.status, 'closed'))
    .orderBy(desc(leaguePeriods.endsAt))
    .limit(1);

  return period ?? null;
}


/** Kullanıcının bir dönemdeki kaydı — sonuç ekranı için. */
export async function findEntryForResult(periodId: string, userId: string) {
  const [row] = await db
    .select({
      rank: leagueEntries.rank,
      twrPct: leagueEntries.twrPct,
      resultSeenAt: leagueEntries.resultSeenAt,
    })
    .from(leagueEntries)
    .where(
      and(eq(leagueEntries.periodId, periodId), eq(leagueEntries.userId, userId)),
    )
    .limit(1);

  return row ?? null;
}

/**
 * Sonucu "görüldü" diye işaretler.
 *
 * ⚠️ `isNull` KOŞULU BİLİNÇLİ: ilk görülme anı korunuyor, her çağrıda
 * üzerine yazılmıyor. Üzerine yazsaydık "ne zaman gördü" bilgisi her
 * açılışta tazelenir ve hiçbir işe yaramazdı.
 */
export async function markResultSeen(periodId: string, userId: string) {
  await db
    .update(leagueEntries)
    .set({ resultSeenAt: new Date() })
    .where(
      and(
        eq(leagueEntries.periodId, periodId),
        eq(leagueEntries.userId, userId),
        isNull(leagueEntries.resultSeenAt),
      ),
    );
}
