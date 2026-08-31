import { Router } from 'express';
import { requireAccessToken } from '../auth/middleware.js';
import {
  claimDailyBonus,
  DailyBonusAlreadyClaimedError,
  getUserCashHistory,
  getDailyBonusStatus,
} from './service.js';
import {
  spinDailyWheel,
  WheelAlreadySpunError,
  getActiveWheelRewards,
  getLastWheelSpin,
  getWheelCooldownMs,
} from './wheelService.js';

export const bonusRouter = Router();

bonusRouter.post('/daily', requireAccessToken, async (_request, response) => {
  const userId = response.locals.userId as string;
  try {
    const result = await claimDailyBonus(userId);
    return response.status(200).json({
      message: '1.000 TL günlük bonus hesabınıza başarıyla eklendi.',
      bonusAmountCents: '100000',
      newBalanceCents: result.newBalanceCents.toString(),
      movement: {
        id: result.movement.id,
        kind: result.movement.kind,
        amountCents: result.movement.amountCents.toString(),
        createdAt: result.movement.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof DailyBonusAlreadyClaimedError) {
      return response.status(409).json({ error: { code: 'DAILY_BONUS_ALREADY_CLAIMED', message: error.message } });
    }
    return response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Beklenmeyen hata.' } });
  }
});

bonusRouter.get('/daily/status', requireAccessToken, async (_request, response) => {
  const userId = response.locals.userId as string;
  try {
    const status = await getDailyBonusStatus(userId);
    return response.status(200).json(status);
  } catch (error) {
    return response.status(500).json({ error: { code: 'INTERNAL_ERROR' } });
  }
});

bonusRouter.get('/movements', requireAccessToken, async (_request, response) => {
  const userId = response.locals.userId as string;
  const movements = await getUserCashHistory(userId);
  return response.status(200).json({
    movements: movements.map((m) => ({ ...m, amountCents: m.amountCents.toString() })),
  });
});

// ÇARK (WHEEL) API UÇ NOKTALARI
bonusRouter.get('/wheel', requireAccessToken, async (_request, response) => {
  const userId = response.locals.userId as string;
  try {
    const rewards = await getActiveWheelRewards();
    const lastSpin = await getLastWheelSpin(userId);
    const cooldownMs = getWheelCooldownMs();
    let canSpin = true;
    let nextSpinAt: Date | null = null;
    
    if (lastSpin) {
      const msSinceLast = Date.now() - lastSpin.wonAt.getTime();
      if (msSinceLast < cooldownMs) {
        canSpin = false;
        nextSpinAt = new Date(lastSpin.wonAt.getTime() + cooldownMs);
      }
    }
    
    return response.status(200).json({
      rewards,
      canSpin,
      nextSpinAt,
      cooldownSeconds: cooldownMs / 1000,
    });
  } catch (error) {
    return response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Çark verileri alınamadı.' } });
  }
});

bonusRouter.post('/wheel/spin', requireAccessToken, async (_request, response) => {
  const userId = response.locals.userId as string;
  try {
    const reward = await spinDailyWheel(userId);
    return response.status(200).json({ reward });
  } catch (error) {
    if (error instanceof WheelAlreadySpunError) {
      return response.status(409).json({ error: { code: 'WHEEL_ALREADY_SPUN', message: error.message } });
    }
    console.error('Spin error:', error);
    return response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Çark çevrilirken hata oluştu.' } });
  }
});
