import { Router } from 'express';
import { requireAccessToken } from '../auth/middleware.js';
import { leaderboardQuerySchema } from './leagues.schema.js';
import {
  getCurrentLeagueInfo,
  getFriendsLeaderboard,
  getGlobalLeaderboard,
  getMyLeagueResult,
  markLeagueResultSeen,
  getLeagueChampion,
} from './service.js';

export const leaguesRouter = Router();

// 1. Aktif lig bilgisi ve kalan süre: GET /leagues/current
leaguesRouter.get('/current', async (_req, res) => {
  try {
    const league = await getCurrentLeagueInfo();
    res.json({ league });
  } catch (error) {
    console.error('Lig bilgisi getirme hatası:', error);
    res.status(500).json({ error: 'Lig bilgisi alınamadı.' });
  }
});

// 2. Genel Liderlik Sıralaması: GET /leagues/current/leaderboard
leaguesRouter.get('/current/leaderboard', async (req, res) => {
  const queryResult = leaderboardQuerySchema.safeParse(req.query);
  if (!queryResult.success) {
    res.status(400).json({
      error: 'Geçersiz sayfalama parametreleri.',
      details: queryResult.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const result = await getGlobalLeaderboard(queryResult.data);
    res.json(result);
  } catch (error) {
    console.error('Liderlik tablosu hatası:', error);
    res.status(500).json({ error: 'Liderlik tablosu alınamadı.' });
  }
});

// 3. Sadece Arkadaşların Olduğu Mini Lig Tablosu: GET /leagues/current/friends
leaguesRouter.get('/current/friends', requireAccessToken, async (_req, res) => {
  const userId = res.locals.userId as string;

  try {
    const result = await getFriendsLeaderboard(userId);
    res.json(result);
  } catch (error) {
    console.error('Arkadaş ligi hatası:', error);
    res.status(500).json({ error: 'Arkadaş lig sıralaması alınamadı.' });
  }
});

/**
 * Son kapanan ligdeki sonucum — kutlama için.
 *
 * ⚠️ `requireAccessToken` ZORUNLU: bu uç kullanıcının kendi sırasını
 * dönüyor. Kimliksiz olsaydı `?userId=` gibi bir parametre gerekirdi ve
 * herkes herkesin sonucunu okuyabilirdi.
 */
leaguesRouter.get('/my-result', requireAccessToken, async (_req, res) => {
  try {
    const result = await getMyLeagueResult(res.locals.userId as string);
    return res.json({ result });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message } });
  }
});

/** Kutlamayı gördüm — bir daha gösterme. */
leaguesRouter.post('/my-result/seen', requireAccessToken, async (req, res) => {
  try {
    const periodId = (req.body?.periodId ?? '') as string;
    if (periodId === '') {
      return res.status(400).json({ error: { message: 'periodId gerekli.' } });
    }
    await markLeagueResultSeen(res.locals.userId as string, periodId);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message } });
  }
});

/**
 * Son kapanan ligin şampiyonu — herkese açık.
 *
 * ⚠️ Kimlik istemiyor çünkü şampiyonluk zaten herkese görünen bir sonuç;
 * sıralama ekranı da girişsiz açılabiliyor. Yalnızca kullanıcı adı ve
 * dönem adı dönüyor, başka hiçbir alan yok.
 */
leaguesRouter.get('/champion', async (_req, res) => {
  try {
    const champion = await getLeagueChampion();
    return res.json({ champion });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message } });
  }
});
