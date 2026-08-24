import { calculateTwr, type TwrSubPeriod } from '@portfolio-league/contracts';
import { db } from '../db/client.js';
import { cashMovements, portfolioSnapshots, users } from '../db/schema.js';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { getPortfolio } from '../portfolio/service.js';
import {
  ensureCurrentLeaguePeriod,
  getLeaderboardByLeagueId,
  updateEntryRank,
  upsertLeagueEntry,
} from './repository.js';

/**
 * Portföy anlık değer kaydı (snapshot) oluşturur.
 */
export async function createPortfolioSnapshot(
  userId: string,
  totalValueCents: bigint,
  reason: 'daily' | 'pre_flow' | 'post_flow' | 'league' = 'daily',
  timestamp: Date = new Date(),
) {
  const [snapshot] = await db
    .insert(portfolioSnapshots)
    .values({
      userId,
      ts: timestamp,
      totalValueCents,
      reason,
    })
    .returning();

  return snapshot;
}

/**
 * Belirli bir kullanıcı için aktif ligdeki Zaman Ağırlıklı Getiri (TWR) oranını hesaplar.
 */
export async function calculateTwrForUser(
  userId: string,
  _leagueId?: string,
): Promise<{
  twrPct: string;
  twrFloat: number;
  startValueCents: bigint;
  endValueCents: bigint;
}> {
  const league = await ensureCurrentLeaguePeriod();

  // 1. Kullanıcının şu anki portföy özetini al
  let portfolio;
  try {
    portfolio = await getPortfolio(userId);
  } catch {
    // Portföyü yoksa 100.000 TL varsayalım
    return {
      twrPct: '0.0000',
      twrFloat: 0,
      startValueCents: 10000000n,
      endValueCents: 10000000n,
    };
  }

  const currentTotalValue = portfolio.totalValueCents;

  // 2. Kullanıcının lig dönemi içindeki snapshot'larını getir
  const snapshots = await db
    .select({
      ts: portfolioSnapshots.ts,
      totalValueCents: portfolioSnapshots.totalValueCents,
      reason: portfolioSnapshots.reason,
    })
    .from(portfolioSnapshots)
    .where(
      and(
        eq(portfolioSnapshots.userId, userId),
        gte(portfolioSnapshots.ts, league.startsAt),
        lte(portfolioSnapshots.ts, league.endsAt),
      ),
    )
    .orderBy(asc(portfolioSnapshots.ts));

  // 3. Kullanıcının lig dönemi içindeki dış para akışlarını (günlük bonus vs.) getir
  const flows = await db
    .select({
      createdAt: cashMovements.createdAt,
      amountCents: cashMovements.amountCents,
      kind: cashMovements.kind,
    })
    .from(cashMovements)
    .where(
      and(
        eq(cashMovements.userId, userId),
        gte(cashMovements.createdAt, league.startsAt),
        lte(cashMovements.createdAt, league.endsAt),
      ),
    )
    .orderBy(asc(cashMovements.createdAt));

  // Lig başlangıç değeri (İlk snapshot veya varsayılan 100.000 TL)
  const firstSnapshot = snapshots[0];
  const startValueCents = firstSnapshot?.totalValueCents ?? 10000000n;

  // Alt dönemleri oluştur
  const subPeriods: TwrSubPeriod[] = [];

  // Dış nakit akışı yoksa: Başlangıç değeri -> Bugünkü değer
  if (flows.length === 0) {
    subPeriods.push({
      startValueKurus: startValueCents,
      endValueKurus: currentTotalValue,
    });
  } else {
    // Nakit akışları ile bölünmüş alt dönemler:
    let periodStartValue = startValueCents;

    for (const flow of flows) {
      // Akış öncesi snapshot bul (pre_flow) veya tahmin et
      const preSnap = snapshots.find(
        (s) => s.reason === 'pre_flow' && Math.abs(s.ts.getTime() - flow.createdAt.getTime()) < 5000,
      );

      const postSnap = snapshots.find(
        (s) => s.reason === 'post_flow' && Math.abs(s.ts.getTime() - flow.createdAt.getTime()) < 5000,
      );

      const preValue = preSnap?.totalValueCents ?? periodStartValue;

      subPeriods.push({
        startValueKurus: periodStartValue,
        endValueKurus: preValue,
      });

      // Akış sonrası yeni başlangıç değeri (pre_flow + nakit bonusu)
      periodStartValue = postSnap?.totalValueCents ?? (preValue + flow.amountCents);
    }

    // Son nakit akışından şu anki değere kadar olan son alt dönem
    subPeriods.push({
      startValueKurus: periodStartValue,
      endValueKurus: currentTotalValue,
    });
  }

  // TWR Oranını hesapla
  const twrFloat = calculateTwr(subPeriods);
  const twrPct = twrFloat.toFixed(4);

  return {
    twrPct,
    twrFloat,
    startValueCents,
    endValueCents: currentTotalValue,
  };
}

/**
 * Tek bir kullanıcının lig kaydını günceller ve TWR'sini hesaplar.
 */
export async function syncUserLeagueEntry(userId: string) {
  const league = await ensureCurrentLeaguePeriod();
  const twrInfo = await calculateTwrForUser(userId, league.id);

  const entry = await upsertLeagueEntry({
    periodId: league.id,
    userId,
    startValueCents: twrInfo.startValueCents,
    endValueCents: twrInfo.endValueCents,
    twrPct: twrInfo.twrPct,
  });

  return entry;
}

/**
 * Tüm kullanıcıların lig TWR değerlerini ve sıralamalarını (Rank 1, 2, 3...) günceller.
 */
export async function syncAllLeagueEntriesAndRanks() {
  const league = await ensureCurrentLeaguePeriod();

  // Tüm kullanıcıları getir
  const allUsers = await db.select({ id: users.id }).from(users);

  // Her kullanıcı için TWR hesapla ve upsert yap
  for (const user of allUsers) {
    try {
      const twrInfo = await calculateTwrForUser(user.id, league.id);
      await upsertLeagueEntry({
        periodId: league.id,
        userId: user.id,
        startValueCents: twrInfo.startValueCents,
        endValueCents: twrInfo.endValueCents,
        twrPct: twrInfo.twrPct,
      });
    } catch (err) {
      console.error(`[twr-engine] Kullanıcı ${user.id} TWR hesaplama hatası:`, err);
    }
  }

  // TWR getirisine göre sıralayıp rank'leri güncelle
  const entries = await getLeaderboardByLeagueId(league.id, 10000, 0);
  let rank = 1;
  for (const entry of entries) {
    await updateEntryRank(league.id, entry.userId, rank);
    rank++;
  }
}
