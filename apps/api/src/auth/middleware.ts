import type { RequestHandler } from 'express';
import { eq } from 'drizzle-orm';
import { verifyAccessToken } from './token.js';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';

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
    const userId = await verifyAccessToken(token);

    /*
      ⚠️ BAN KONTROLÜ BURADA — VE BAŞKA HİÇBİR YERDE OLAMAZDI.

      Yalnızca girişte kontrol etseydik ban işe yaramazdı: ban anında
      elinde geçerli token olan kullanıcı, o token'ın ömrü boyunca emir
      verir, paylaşım yapar, ligde yarışırdı. Zaten giriş yapmış biri
      tekrar giriş yapmak zorunda değil.

      Her uca ayrı ayrı eklemek de olmazdı: yarın eklenen bir uçta
      unutulur ve o uç banlı kullanıcıya açık kalırdı. `requireAccessToken`
      korumalı her ucun TEK geçiş noktası — buraya koymak "unutmayı"
      imkânsız kılıyor.

      Bedeli: kimlik doğrulanan her istekte bir sorgu. Alternatifi
      "ban çalışmıyor" olduğu için ödenmeye değer. Ölçeklenirse doğru
      çözüm token'a kısa ömür verip banı bir önbellekte tutmak.
    */
    const [hesap] = await db
      .select({ bannedAt: users.bannedAt, banReason: users.banReason })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (hesap?.bannedAt != null) {
      return response.status(403).json({
        error: {
          code: 'ACCOUNT_BANNED',
          /*
            ⚠️ SEBEP GÖSTERİLİYOR. Sebepsiz ban, itiraz edilemeyen bir
            bandır: kullanıcı neyi yanlış yaptığını bilmeden düzeltemez.
          */
          message: hesap.banReason ?? 'Hesabın askıya alındı.',
        },
      });
    }

    response.locals.userId = userId;
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
