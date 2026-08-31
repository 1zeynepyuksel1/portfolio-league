import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { achievements, userAchievements } from '../db/schema.js';

export async function getAllAchievements() {
  return db.select().from(achievements);
}

export async function getAchievementByKey(key: string) {
  const result = await db.select().from(achievements).where(eq(achievements.key, key)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getUserAchievements(userId: string) {
  return db
    .select({
      id: userAchievements.id,
      achievementId: userAchievements.achievementId,
      earnedAt: userAchievements.earnedAt,
      metadata: userAchievements.metadata,
      achievement: achievements,
    })
    .from(userAchievements)
    .innerJoin(achievements, eq(userAchievements.achievementId, achievements.id))
    .where(eq(userAchievements.userId, userId));
}

export async function awardAchievement(userId: string, achievementId: string, metadata?: any) {
  const existing = await db
    .select()
    .from(userAchievements)
    .where(
      and(
        eq(userAchievements.userId, userId),
        eq(userAchievements.achievementId, achievementId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const result = await db
    .insert(userAchievements)
    .values({
      userId,
      achievementId,
      metadata,
    })
    .returning();

  return result[0];
}

