import type { RequestHandler } from 'express';
import { verifyAccessToken } from './token.js';

export const requireAccessToken: RequestHandler = async (
  request,
  response,
  next,
) => {
  const authorization = request.get('authorization');
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : undefined;

  if (!token) {
    return response.status(401).json({
      error: {
        code: 'MISSING_ACCESS_TOKEN',
        message: 'Access token gereklidir.',
      },
    });
  }

  try {
    response.locals.userId = await verifyAccessToken(token);
    return next();
  } catch {
    return response.status(401).json({
      error: {
        code: 'INVALID_ACCESS_TOKEN',
        message: 'Access token geçersiz veya süresi dolmuş.',
      },
    });
  }
};
