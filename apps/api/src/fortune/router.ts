import { Router } from 'express';
import { requireAccessToken } from '../auth/middleware.js';
import {
  FortuneContentUnavailableError,
  getTodayFortune,
} from './service.js';

export const fortuneRouter = Router();

fortuneRouter.get('/today', requireAccessToken, async (_request, response) => {
  const userId = response.locals.userId as string;

  try {
    return response.json({ fortune: await getTodayFortune(userId) });
  } catch (error) {
    if (error instanceof FortuneContentUnavailableError) {
      return response.status(503).json({
        error: { code: 'FORTUNE_CONTENT_UNAVAILABLE', message: error.message },
      });
    }

    console.error('[GET /fortune/today] başarısız:', error);
    return response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Falın okunamadı.' },
    });
  }
});
