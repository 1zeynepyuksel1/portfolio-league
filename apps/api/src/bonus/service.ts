import {
  getCashMovementsByUserId,
  getLastDailyBonus,
  grantDailyBonus,
  getAbsoluteLastDailyBonus,
} from './repository.js';

export class DailyBonusAlreadyClaimedError extends Error {
  constructor() {
    super('Bugünkü günlük bonusunuzu zaten aldınız. Bir sonraki bonus için 24 saat bekleyin.');
  }
}

export async function claimDailyBonus(userId: string) {
  // Son 24 saatteki bonusu kontrol et
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existingBonus = await getLastDailyBonus(userId, twentyFourHoursAgo);

  if (existingBonus) {
    throw new DailyBonusAlreadyClaimedError();
  }

  return grantDailyBonus(userId, 100000n); // 1.000 TL = 100.000 kuruş
}

export async function getDailyBonusStatus(userId: string) {
  const lastBonus = await getAbsoluteLastDailyBonus(userId);

  if (!lastBonus) {
    return {
      canClaim: true,
      lastClaimedAt: null,
      nextClaimAt: null,
      remainingSeconds: 0,
    };
  }

  const nextClaimAt = new Date(lastBonus.createdAt.getTime() + 24 * 60 * 60 * 1000);
  const remainingSeconds = Math.max(
    0,
    Math.floor((nextClaimAt.getTime() - Date.now()) / 1000)
  );

  return {
    canClaim: remainingSeconds === 0,
    lastClaimedAt: lastBonus.createdAt,
    nextClaimAt,
    remainingSeconds,
  };
}

export async function getUserCashHistory(userId: string) {
  return getCashMovementsByUserId(userId);
}
