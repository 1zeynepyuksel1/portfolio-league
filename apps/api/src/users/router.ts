import { Router } from 'express';
import { requireAccessToken } from '../auth/middleware.js';
import { getUserProfileByUsername } from './service.js';

export const usersRouter = Router();

// GET /users/:username
usersRouter.get('/:username', requireAccessToken, async (request, response) => {
  const requesterId = response.locals.userId as string;
  const targetUsername = request.params.username as string;

  if (!targetUsername) {
    return response.status(400).json({
      error: {
        code: 'MISSING_USERNAME',
        message: 'Kullanıcı adı belirtilmelidir.',
      },
    });
  }

  try {
    const profile = await getUserProfileByUsername(requesterId, targetUsername);

    if (!profile) {
      return response.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Belirtilen kullanıcı adına sahip bir üye bulunamadı.',
        },
      });
    }

    return response.json({ profile });
  } catch (error) {
    console.error('[GET /users/:username] hata:', error);
    return response.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Profil bilgisi sorgulanırken bir hata oluştu.',
      },
    });
  }
});
