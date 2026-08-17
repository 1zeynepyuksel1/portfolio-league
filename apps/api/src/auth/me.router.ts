import { Router } from 'express';
import { requireAccessToken } from './middleware.js';
import { findUserById } from './repository.js';

export const meRouter = Router();

meRouter.get('/', requireAccessToken, async (_request, response) => {
  const userId = response.locals.userId as string;
  const user = await findUserById(userId);

  if (!user) {
    return response.status(404).json({
      error: {
        code: 'USER_NOT_FOUND',
        message: 'Kullanıcı bulunamadı.',
      },
    });
  }

  return response.json({ user });
});
