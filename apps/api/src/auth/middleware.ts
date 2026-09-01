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

  /*
    ⚠️ JETON DOĞRULAMASI VE VERİTABANI SORGUSU AYRI `try` BLOKLARINDA —
    VE BU BİR HATAYI DÜZELTİYOR.

    İkisini tek blokta bırakmıştım. Sonuç: veritabanı bir an erişilemez
    olsa (bağlantı kopması, Docker'ın kapanması) sorgu fırlatıyor, dıştaki
    `catch` onu yakalıyor ve kullanıcıya **401 INVALID_ACCESS_TOKEN**
    dönüyordu.

    Yani "veritabanı çöktü" hatası "jetonun geçersiz" diye görünürdü.
    İstemci de doğru davranıp oturumu kapatır ve kullanıcıyı giriş
    ekranına atardı — herkes sebepsiz yere çıkış yapmış olurdu ve
    loglarda bunun izi "geçersiz jeton" olarak durur, veritabanı hatası
    olarak DEĞİL. Aranması en zor hata türü.

    Artık ayrı: jeton hatası 401, altyapı hatası 503.
  */
  let userId: string;
  try {
    userId = await verifyAccessToken(token);
  } catch {
    return response.status(401).json({
      error: {
        code: 'INVALID_ACCESS_TOKEN',
        message: 'Access token geçersiz veya süresi dolmuş.',
      },
    });
  }

  try {

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
  } catch (error) {
    /*
      ⚠️ 503, 401 DEĞİL. Kimlik doğrulandı; başarısız olan ban sorgusu.
      401 dönseydik istemci oturumu kapatırdı — geçici bir veritabanı
      kesintisi bütün kullanıcıları çıkış yaptırırdı.

      ⚠️ Ban kontrolü YAPILAMADIĞINDA isteği GEÇİRMİYORUZ. Geçirmek
      "emin değilsek izin ver" demek olurdu ve banlı kullanıcı,
      veritabanı sarsıldığı her an içeri girerdi.
    */
    console.error('[auth/middleware] ban kontrolü başarısız:', error);
    return response.status(503).json({
      error: {
        code: 'AUTH_CHECK_UNAVAILABLE',
        message: 'Sunucu şu an doğrulama yapamıyor, birazdan tekrar dene.',
      },
    });
  }
};
