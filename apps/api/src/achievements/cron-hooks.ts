import { db } from '../db/client.js';
import { leagueEntries, leaguePeriods, orders, holdings } from '../db/schema.js';
import { eq, desc, and, gt } from 'drizzle-orm';
import { checkAndAward } from './service.js';

export async function checkLeagueAchievements(leagueId: string, entries: any[]) {
  if (entries.length === 0) return;

  await checkAndAward(entries[0].userId, 'first_place', { leagueId });

  for (let i = 0; i < Math.min(3, entries.length); i++) {
    const userId = entries[i].userId;
    
    const recentLeagues = await db
      .select({ rank: leagueEntries.rank })
      .from(leagueEntries)
      .innerJoin(leaguePeriods, eq(leagueEntries.periodId, leaguePeriods.id))
      .where(and(
        eq(leagueEntries.userId, userId),
        eq(leaguePeriods.status, 'closed')
      ))
      .orderBy(desc(leaguePeriods.endsAt))
      .limit(3);

    if (recentLeagues.length === 3) {
      const allTop3 = recentLeagues.every(l => l.rank && l.rank <= 3);
      if (allTop3) {
        await checkAndAward(userId, 'top3_streak_3');
      }
    }
  }
}

export async function checkDiamondHands() {
  const allHoldings = await db.select({ userId: holdings.userId }).from(holdings).groupBy(holdings.userId);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  for (const h of allHoldings) {
    const userId = h.userId;
    const sells = await db.select({ id: orders.id }).from(orders).where(
      and(
        eq(orders.userId, userId),
        eq(orders.side, 'sell'),
        gt(orders.executedAt, thirtyDaysAgo)
      )
    ).limit(1);

    if (sells.length === 0) {
      await checkAndAward(userId, 'diamond_hands');
    }
  }
}
