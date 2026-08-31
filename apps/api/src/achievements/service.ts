import { getAllAchievements, getUserAchievements, awardAchievement, getAchievementByKey } from './repository.js';

export async function getMyAchievements(userId: string) {
  const all = await getAllAchievements();
  const earned = await getUserAchievements(userId);

  const earnedMap = new Map();
  for (const ea of earned) {
    earnedMap.set(ea.achievementId, ea);
  }

  const mapped = all.map((ach) => {
    const isEarned = earnedMap.has(ach.id);
    return {
      ...ach,
      isEarned,
      earnedAt: isEarned ? earnedMap.get(ach.id).earnedAt : null,
      metadata: isEarned ? earnedMap.get(ach.id).metadata : null,
    };
  });

  return {
    total: all.length,
    earnedCount: earned.length,
    achievements: mapped,
  };
}

export async function checkAndAward(userId: string, achievementKey: string, metadata?: any) {
  const ach = await getAchievementByKey(achievementKey);
  if (!ach) {
    console.warn(`[achievements] ${achievementKey} adında bir rozet bulunamadı.`);
    return null;
  }
  return await awardAchievement(userId, ach.id, metadata);
}
