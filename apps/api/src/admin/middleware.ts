import type { RequestHandler } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';

/**
 * admin/middleware.ts — yetki ve ban kontrolü.
 *
 * ⚠️ İKİ AYRI SORU, İKİ AYRI ARA KATMAN:
 *
 *   requireNotBanned -> "bu kullanıcı hâlâ girebiliyor mu?"   (herkese)
 *   requireAdmin     -> "bu kullanıcı yönetici mi?"           (admin uçları)
 *
 * Tek bir katmanda birleştirmek cazipti; birleştirmedik çünkü ilkinin
 * HER istekte, ikincisinin yalnızca yönetim uçlarında çalışması gerekiyor.
 */

/**
 * Yetki kontrolü — `requireAccessToken`'DAN SONRA gelmek zorunda.
 *
 * ⚠️ ROL TOKEN'DAN DEĞİL VERİTABANINDAN OKUNUYOR, VE BU BİLİNÇLİ.
 *
 * Rolü access token'ın içine gömmek bir sorgu tasarrufu sağlardı ama
 * yetkiyi token'ın ömrü boyunca DONDURURDU: yöneticiliği alınan bir
 * kullanıcı, elindeki token süresi dolana kadar yönetici kalırdı. Yetki
 * kaybı gecikmeli olmamalı — kötüye kullanım tam o pencerede olur.
 *
 * Bedeli istek başına bir sorgu; yalnızca yönetim uçlarında.
 */
export const requireAdmin: RequestHandler = async (_request, response, next) => {
  const userId = response.locals.userId as string | undefined;

  if (userId === undefined) {
    /*
      ⚠️ BU DAL BİR KURULUM HATASINI YAKALIYOR, kullanıcı hatasını değil.
      Buraya düşmek "requireAdmin, requireAccessToken olmadan takılmış"
      demek. Sessizce geçirseydik yetkisiz erişim açılırdı.
    */
    return response.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Giriş gerekli.' },
    });
  }

  const [row] = await db
    .select({ role: users.role, bannedAt: users.bannedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (row === undefined || row.role !== 'admin' || row.bannedAt !== null) {
    /*
      ⚠️ 404 DEĞİL 403, ama mesaj AYRINTI VERMİYOR. "Yönetici değilsin"
      demek yeterli; hangi uçların var olduğunu ya da kimin yönetici
      olduğunu açık etmiyoruz.

      ⚠️ Banlı yönetici de reddediliyor: ban her şeyin üstünde.
    */
    return response.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Bu işlem için yetkin yok.' },
    });
  }

  return next();
};

/**
 * Banlı kullanıcıyı durdurur.
 *
 * ⚠️ BAN'IN TOKEN'I GEÇERSİZ KILMASI GEREKİYOR.
 *
 * Yalnızca girişte kontrol etseydik, ban anında elinde geçerli token
 * olan kullanıcı o token'ın ömrü boyunca uygulamayı kullanmaya devam
 * ederdi — emir verir, paylaşım yapar, ligde yarışırdı. Ban ancak
 * "bir sonraki girişte" işe yarardı ve zaten girmiş olan kimse bir daha
 * girmek zorunda değil.
 *
 * Bu yüzden kontrol HER istekte. Bedeli bir sorgu; ödenmesi gereken bir
 * bedel, çünkü alternatifi "ban çalışmıyor".
 */
export const requireNotBanned: RequestHandler = async (_request, response, next) => {
  const userId = response.locals.userId as string | undefined;
  if (userId === undefined) return next(); // kimliksiz istek — başka katman ilgilenir

  const [row] = await db
    .select({ bannedAt: users.bannedAt, banReason: users.banReason })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (row?.bannedAt != null) {
    return response.status(403).json({
      error: {
        code: 'ACCOUNT_BANNED',
        /*
          ⚠️ SEBEP KULLANICIYA GÖSTERİLİYOR. Sebepsiz ban, itiraz
          edilemeyen bir bandır; kullanıcı neyi yanlış yaptığını
          bilmeden düzeltemez.
        */
        message: row.banReason ?? 'Hesabın askıya alındı.',
      },
    });
  }

  return next();
};
