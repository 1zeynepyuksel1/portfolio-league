import { Router, type Request, type Response } from 'express';
import { requireAccessToken } from '../auth/middleware.js';
import { requireAdmin } from './middleware.js';
import {
  AdminTargetError,
  adminDeletePost,
  banUser,
  findUserIdByUsername,
  getAdminStats,
  listBannedUsers,
  listRecentPosts,
  listUsers,
  unbanUser,
} from './service.js';

/**
 * admin/router.ts — yönetim uçları.
 *
 * ⚠️ İKİ ARA KATMAN, SIRASI ÖNEMLİ VE ROUTER SEVİYESİNDE:
 *
 *     requireAccessToken  ->  kim olduğunu belirler
 *     requireAdmin        ->  yetkisini doğrular
 *
 * `adminRouter.use(...)` ile TÜM uçlara birden takılıyorlar. Her uca tek
 * tek yazsaydık, yarın eklenen bir uçta biri unutulur ve o uç yetkisiz
 * kalırdı — güvenlikte en sık yapılan hata bu. Burada unutmak MÜMKÜN
 * DEĞİL: yeni uç otomatik olarak korunuyor.
 */
export const adminRouter = Router();

adminRouter.use(requireAccessToken, requireAdmin);

/** Panel başlığı. */
adminRouter.get('/stats', async (_req: Request, res: Response) => {
  return res.json(await getAdminStats());
});

/** Kullanıcı listesi / arama. */
adminRouter.get('/users', async (req: Request, res: Response) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  return res.json({ users: await listUsers(q) });
});

/** Banlı kullanıcılar. */
adminRouter.get('/users/banned', async (_req: Request, res: Response) => {
  return res.json({ users: await listBannedUsers() });
});

adminRouter.post('/users/:id/ban', async (req: Request, res: Response) => {
  try {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : '';

    /*
      ⚠️ SEBEP ZORUNLU. İsteğe bağlı olsaydı çoğu ban sebepsiz kalırdı ve
      kullanıcı neden engellendiğini öğrenemezdi; itiraz eden birine
      bakacak bir kayıt da olmazdı.
    */
    if (reason.trim().length < 3) {
      return res.status(400).json({
        error: { code: 'REASON_REQUIRED', message: 'Ban sebebi yazmalısın.' },
      });
    }

    await banUser(res.locals.userId as string, req.params.id as string, reason);
    return res.json({ success: true });
  } catch (err) {
    return hata(err, res);
  }
});

adminRouter.post('/users/:id/unban', async (req: Request, res: Response) => {
  try {
    await unbanUser(req.params.id as string);
    return res.json({ success: true });
  } catch (err) {
    return hata(err, res);
  }
});

/*
  ⚠️ KULLANICI ADIYLA BAN — kimlikle olanın YANINDA, yerine değil.

  Yönetim paneli kimlikle çalışıyor (listede zaten var). Profil ekranı
  ise başkasının kimliğini bilmiyor ve bilmemeli. İki giriş, tek
  uygulama: ikisi de `banUser`'a düşüyor, kurallar (kendini banlama,
  yöneticiyi banlama, sebep zorunlu) tek yerde kalıyor.
*/
adminRouter.post('/users/by-username/:username/ban', async (req: Request, res: Response) => {
  try {
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : '';
    if (reason.trim().length < 3) {
      return res.status(400).json({
        error: { code: 'REASON_REQUIRED', message: 'Ban sebebi yazmalısın.' },
      });
    }
    const targetId = await findUserIdByUsername(req.params.username as string);
    await banUser(res.locals.userId as string, targetId, reason);
    return res.json({ success: true });
  } catch (err) {
    return hata(err, res);
  }
});

adminRouter.post('/users/by-username/:username/unban', async (req: Request, res: Response) => {
  try {
    const targetId = await findUserIdByUsername(req.params.username as string);
    await unbanUser(targetId);
    return res.json({ success: true });
  } catch (err) {
    return hata(err, res);
  }
});

/** Moderasyon için son gönderiler. */
adminRouter.get('/posts', async (_req: Request, res: Response) => {
  return res.json({ posts: await listRecentPosts() });
});

adminRouter.delete('/posts/:id', async (req: Request, res: Response) => {
  try {
    await adminDeletePost(req.params.id as string);
    return res.json({ success: true });
  } catch (err) {
    return hata(err, res);
  }
});

function hata(err: unknown, res: Response) {
  if (err instanceof AdminTargetError) {
    return res.status(400).json({
      error: { code: 'ADMIN_TARGET_ERROR', message: err.message },
    });
  }

  console.error('[admin]', err);
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Beklenmeyen bir hata oluştu.' },
  });
}
