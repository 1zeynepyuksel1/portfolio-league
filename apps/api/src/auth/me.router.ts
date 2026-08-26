import { Router } from 'express';
import { requireAccessToken } from './middleware.js';
import { findUserById } from './repository.js';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

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

meRouter.patch('/', requireAccessToken, async (request, response) => {
  const userId = response.locals.userId as string;
  const { firstName, lastName, username, isPublic } = request.body;

  const updateFields: Record<string, any> = {};

  if (firstName !== undefined) {
    if (typeof firstName !== 'string' || firstName.trim().length < 2 || firstName.trim().length > 50) {
      return response.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Ad alanı en az 2, en fazla 50 karakter olmalıdır.',
        },
      });
    }
    updateFields.firstName = firstName.trim();
  }

  if (lastName !== undefined) {
    if (typeof lastName !== 'string' || lastName.trim().length < 2 || lastName.trim().length > 50) {
      return response.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Soyad alanı en az 2, en fazla 50 karakter olmalıdır.',
        },
      });
    }
    updateFields.lastName = lastName.trim();
  }

  if (username !== undefined) {
    if (typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 30) {
      return response.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Kullanıcı adı en az 3, en fazla 30 karakter olmalıdır.',
        },
      });
    }
    
    // Check spaces
    if (/\s/.test(username)) {
      return response.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'Kullanıcı adı boşluk içeremez.',
        },
      });
    }

    const cleanUsername = username.trim().toLowerCase();

    // Check uniqueness
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, cleanUsername))
      .limit(1);

    if (existing && existing.id !== userId) {
      return response.status(409).json({
        error: {
          code: 'USERNAME_ALREADY_TAKEN',
          message: 'Bu kullanıcı adı zaten başka bir üye tarafından alınmış.',
        },
      });
    }

    updateFields.username = cleanUsername;
  }

  if (isPublic !== undefined) {
    if (typeof isPublic !== 'boolean') {
      return response.status(400).json({
        error: {
          code: 'INVALID_INPUT',
          message: 'isPublic alanı boolean (true/false) olmalıdır.',
        },
      });
    }
    updateFields.isPublic = isPublic;
  }

  if (Object.keys(updateFields).length === 0) {
    return response.status(400).json({
      error: {
        code: 'MISSING_FIELDS',
        message: 'Güncellenecek en az bir alan belirtilmelidir.',
      },
    });
  }

  try {
    await db
      .update(users)
      .set(updateFields)
      .where(eq(users.id, userId));

    return response.json({ success: true, updatedFields: Object.keys(updateFields) });
  } catch (error) {
    console.error('[PATCH /auth/me] hata:', error);
    return response.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Profil güncellenirken beklenmeyen bir hata oluştu.',
      },
    });
  }
});
