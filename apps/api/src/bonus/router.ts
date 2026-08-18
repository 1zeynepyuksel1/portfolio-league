import { Router } from 'express';
import { requireAccessToken } from '../auth/middleware.js';
import {
  claimDailyBonus,
  DailyBonusAlreadyClaimedError,
  getUserCashHistory,
} from './service.js';

export const bonusRouter = Router();

// Günlük 1.000 TL bonus talep etme
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
      return response.status(409).json({
        error: {
          code: 'DAILY_BONUS_ALREADY_CLAIMED',
          message: error.message,
        },
      });
    }

    return response.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Günlük bonus eklenirken beklenmeyen bir hata oluştu.',
      },
    });
  }
});

// Kullanıcının nakit geçmişini / ekstrelerini listeleme
bonusRouter.get('/movements', requireAccessToken, async (_request, response) => {
  const userId = response.locals.userId as string;
  const movements = await getUserCashHistory(userId);

  return response.status(200).json({
    movements: movements.map((m) => ({
      ...m,
      amountCents: m.amountCents.toString(),
    })),
  });
});
