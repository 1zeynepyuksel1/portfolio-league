import { Router } from 'express';
import { z } from 'zod';
import { requireAccessToken } from '../auth/middleware.js';
import { setProfileVisibility } from './repository.js';
import { getPublicProfile, ProfileNotFoundError } from './service.js';
import { and, eq, ilike, not, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';

/**
 * profile/router.ts — herkese açık profil ve gizlilik ayarı.
 *
 * ⚠️ HER İKİ UÇ DA GİRİŞ İSTİYOR.
 *
 * Profil "herkese açık" olsa bile anonim erişime kapalı. Sebep: kim
 * baktığını bilmeden görünürlük kuralı uygulanamaz — arkadaşlık kontrolü
 * bir görüntüleyen kimliği gerektiriyor. Ayrıca giriş şartı, profilleri
 * dışarıdan toplu taramaya karşı da ilk bariyer.
 */
export const profileRouter = Router();

profileRouter.use(requireAccessToken);

/**
 * GET /users/search — kullanıcıları arama (arkadaş ekleme ekranı için otomatik tamamlama)
 */
profileRouter.get('/search', async (request, response) => {
  const requesterId = response.locals.userId as string;
  const q = (request.query.q as string || '').trim();

  if (!q) {
    return response.json({ users: [] });
  }

  try {
    const list = await db
      .select({
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(
        and(
          not(eq(users.id, requesterId)),
          or(
            ilike(users.username, `%${q}%`),
            ilike(users.firstName, `%${q}%`),
            ilike(users.lastName, `%${q}%`)
          )
        )
      )
      .limit(10);

    const mapped = list.map(u => ({
      id: u.id,
      username: u.username,
      displayName: `${u.firstName} ${u.lastName}`,
    }));

    return response.json({ users: mapped });
  } catch (error) {
    console.error('[GET /users/search] başarısız:', error);
    return response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Arama gerçekleştirilemedi.' },
    });
  }
});

/**
 * GET /users/:username — bir kullanıcının herkese açık profili.
 *
 * Yanıt her zaman aynı ŞEKİLDE dönüyor; kapalı profilde yalnızca alanlar
 * boşalıyor (`visible: false`). Farklı şekiller döndürseydik istemci iki
 * ayrı ekran çizmek zorunda kalırdı.
 */
profileRouter.get('/:username', async (request, response) => {
  const viewerId = response.locals.userId as string;
  const { username } = request.params;

  try {
    const profile = await getPublicProfile(viewerId, username);
    return response.json({ profile });
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      return response.status(404).json({
        error: { code: 'PROFILE_NOT_FOUND', message: error.message },
      });
    }

    console.error(`[GET /users/${username}] başarısız:`, error);
    return response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Profil okunamadı.' },
    });
  }
});

/**
 * Gizlilik tercihi.
 *
 * ⚠️ ZOD İLE DOĞRULANIYOR, `Boolean(body.isPublic)` DEĞİL.
 *
 * `Boolean("false")` JavaScript'te `true` döner. İstemci yanlışlıkla metin
 * gönderirse kullanıcı profilini KAPATTIĞINI sanır, açılır. Gizlilik
 * ayarında sessiz bir tip hatası, kullanıcının bilmediği bir açıklık
 * demek — o yüzden katı doğrulama.
 */
const visibilitySchema = z.object({
  isPublic: z.boolean({
    required_error: 'isPublic alanı zorunlu.',
    invalid_type_error: 'isPublic true ya da false olmalı.',
  }),
});

/** PATCH /users/me/visibility — kendi profilini aç/kapat. */
profileRouter.patch('/me/visibility', async (request, response) => {
  const userId = response.locals.userId as string;

  const parsed = visibilitySchema.safeParse(request.body);

  if (!parsed.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message ?? 'Geçersiz istek.',
      },
    });
  }

  try {
    await setProfileVisibility(userId, parsed.data.isPublic);
    return response.json({ isPublic: parsed.data.isPublic });
  } catch (error) {
    console.error('[PATCH /users/me/visibility] başarısız:', error);
    return response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Ayar kaydedilemedi.' },
    });
  }
});
