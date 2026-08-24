import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { accounts, cashMovements, portfolioSnapshots } from '../db/schema.js';
import { getPortfolio } from '../portfolio/service.js';

export async function getLastDailyBonus(userId: string, sinceDate: Date) {
  const [bonus] = await db
    .select({
      id: cashMovements.id,
      createdAt: cashMovements.createdAt,
    })
    .from(cashMovements)
    .where(
      and(
        eq(cashMovements.userId, userId),
        eq(cashMovements.kind, 'daily_bonus'),
        gte(cashMovements.createdAt, sinceDate),
      ),
    )
    .limit(1);

  return bonus;
}

export async function grantDailyBonus(userId: string, bonusCents = 100000n) {
  // 1. Akış öncesi portföy değerini al (pre_flow)
  let preValue = 10000000n;
  try {
    const portfolio = await getPortfolio(userId);
    preValue = portfolio.totalValueCents;
  } catch {
    // Portföy okunamadıysa varsayılan hesabı koru
  }

  const now = new Date();

  return db.transaction(async (transaction) => {
    // 2. Akış öncesi snapshot ekle (pre_flow)
    await transaction.insert(portfolioSnapshots).values({
      userId,
      ts: now,
      totalValueCents: preValue,
      reason: 'pre_flow',
    });

    // 3. Hesap bakiyesini artır (1.000 TL = 100.000 kuruş)
    const [updatedAccount] = await transaction
      .update(accounts)
      .set({
        cashCents: sql`${accounts.cashCents} + ${bonusCents}`,
      })
      .where(eq(accounts.userId, userId))
      .returning({ cashCents: accounts.cashCents });

    if (!updatedAccount) {
      throw new Error('Kullanıcı hesabı bulunamadı.');
    }

    // 4. Cüzdan hareketine ekle (audit trail)
    const [movement] = await transaction
      .insert(cashMovements)
      .values({
        userId,
        kind: 'daily_bonus',
        amountCents: bonusCents,
        createdAt: now,
      })
      .returning();

    if (!movement) {
      throw new Error('Nakit hareketi oluşturulamadı.');
    }

    // 5. Akış sonrası snapshot ekle (post_flow)
    const postValue = preValue + bonusCents;
    await transaction.insert(portfolioSnapshots).values({
      userId,
      ts: new Date(now.getTime() + 10), // Mikro zaman farkı ile sıralamayı koru
      totalValueCents: postValue,
      reason: 'post_flow',
    });

    return {
      newBalanceCents: updatedAccount.cashCents,
      movement,
    };
  });
}

export async function getCashMovementsByUserId(userId: string, limit = 50) {
  return db
    .select({
      id: cashMovements.id,
      kind: cashMovements.kind,
      amountCents: cashMovements.amountCents,
      orderId: cashMovements.orderId,
      createdAt: cashMovements.createdAt,
    })
    .from(cashMovements)
    .where(eq(cashMovements.userId, userId))
    .orderBy(sql`${cashMovements.createdAt} DESC`)
    .limit(limit);
}
