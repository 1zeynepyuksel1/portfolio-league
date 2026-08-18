import { Router } from 'express';
import { requireAccessToken } from '../auth/middleware.js';
import { leaderboardQuerySchema } from './leagues.schema.js';
import {
  getCurrentLeagueInfo,
  getFriendsLeaderboard,
  getGlobalLeaderboard,
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
