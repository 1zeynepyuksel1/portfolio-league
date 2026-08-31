import { Router, Request, Response, NextFunction } from 'express';
import { requireAccessToken } from '../auth/middleware.js';
import { getMyAchievements } from './service.js';

export const achievementsRouter = Router();

achievementsRouter.get('/me', requireAccessToken, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = res.locals.userId as string;
    const result = await getMyAchievements(userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
