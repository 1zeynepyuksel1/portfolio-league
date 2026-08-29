import { Router } from 'express';
import { requireAccessToken } from '../auth/middleware.js';
import { db } from '../db/client.js';
import { accounts } from '../db/schema.js';
import { findAssetIdBySymbol, latestPrice, insertPrice } from '../market/repository.js';
import { closeAndRotateLeague } from '../leagues/cron.js';
import { ensureCurrentLeaguePeriod, upsertLeagueEntry } from '../leagues/repository.js';
import { eq } from 'drizzle-orm';
import { createUserWithAccount } from '../auth/repository.js';

export const demoRouter = Router();

// Tüm demo/sandbox rotaları oturum açmış bir kullanıcı gerektirir
demoRouter.use(requireAccessToken);

/**
 * POST /demo/prices/manipulate
 * Varlık fiyatını yüzde oranında artırır veya düşürür.
 * Gövde: { symbol: string, percentChange: number }
 */
demoRouter.post('/prices/manipulate', async (req, res) => {
  const { symbol, percentChange } = req.body;

  if (!symbol || typeof percentChange !== 'number') {
    return res.status(400).json({ error: 'Geçersiz parametreler. Beklenen: { symbol, percentChange }' });
  }

  try {
    const asset = await findAssetIdBySymbol(symbol);
    if (!asset) {
      return res.status(404).json({ error: `Varlık bulunamadı: ${symbol}` });
    }

    const latest = await latestPrice(asset.id);
    if (!latest) {
      return res.status(400).json({ error: 'Bu varlığa ait geçmiş fiyat bulunamadı, manipüle edilemez.' });
    }

    const currentPriceNum = Number(latest.priceTry);
    const multiplier = 1 + percentChange / 100;
    const newPrice = (currentPriceNum * multiplier).toFixed(8);

    await insertPrice(asset.id, new Date(), newPrice);

    return res.json({
      message: `${symbol} fiyatı güncellendi.`,
      oldPrice: latest.priceTry,
      newPrice,
    });
  } catch (error) {
    console.error('[DEMO /prices/manipulate] hatası:', error);
    return res.status(500).json({ error: 'Fiyat manipüle edilemedi.' });
  }
});

/**
 * POST /demo/leagues/close-now
 * Aktif ligi anında kapatır ve yeni haftanın ligini açar.
 */
demoRouter.post('/leagues/close-now', async (_req, res) => {
  try {
    const result = await closeAndRotateLeague();
    return res.json({
      message: 'Haftalık lig dönemi kapatıldı ve yeni dönem başlatıldı.',
      ...result,
    });
  } catch (error) {
    console.error('[DEMO /leagues/close-now] hatası:', error);
    return res.status(500).json({ error: 'Lig kapatılamadı.' });
  }
});

/**
 * POST /demo/accounts/adjust-balance
 * İstek atan kullanıcının nakit bakiyesine ekleme veya çıkarma yapar.
 * Gövde: { amountCents: string } (Örn: 1000000 = 10.000 TL)
 */
demoRouter.post('/accounts/adjust-balance', async (req, res) => {
  const { amountCents } = req.body;
  const userId = res.locals.userId as string;

  if (!amountCents || isNaN(Number(amountCents))) {
    return res.status(400).json({ error: 'Geçersiz miktar. Beklenen: { amountCents }' });
  }

  try {
    const account = await db.select().from(accounts).where(eq(accounts.userId, userId)).limit(1);
    const firstAcc = account[0];
    if (!firstAcc) {
      return res.status(404).json({ error: 'Bakiye hesabı bulunamadı.' });
    }

    const currentCash = BigInt(firstAcc.cashCents);
    const adjust = BigInt(amountCents);
    const newCash = currentCash + adjust;

    if (newCash < 0n) {
      return res.status(400).json({ error: 'Bakiye sıfırın altına düşemez.' });
    }

    await db.update(accounts).set({ cashCents: newCash }).where(eq(accounts.userId, userId));

    return res.json({
      message: 'Bakiye güncellendi.',
      oldBalance: currentCash.toString(),
      newBalance: newCash.toString(),
    });
  } catch (error) {
    console.error('[DEMO /accounts/adjust-balance] hatası:', error);
    return res.status(500).json({ error: 'Bakiye güncellenemedi.' });
  }
});

const FIRST_NAMES = ['Can', 'Deniz', 'Elif', 'Burak', 'Zeynep', 'Mert', 'Aslı', 'Emre', 'Gamze', 'Hakan', 'Selin', 'Oğuz', 'Buse', 'Kaan'];
const LAST_NAMES = ['Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Yıldız', 'Öztürk', 'Aydın', 'Özdemir', 'Arslan', 'Doğan', 'Kılıç', 'Koç'];

/**
 * POST /demo/leagues/seed-participants
 * Lig sıralamasını hareketlendirmek için sahte yarışmacılar ekler.
 * Gövde: { count: number }
 */
demoRouter.post('/leagues/seed-participants', async (req, res) => {
  const count = Number(req.body.count || 5);

  try {
    const league = await ensureCurrentLeaguePeriod();
    const seeded = [];

    for (let i = 0; i < count; i++) {
      const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)] || 'Can';
      const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)] || 'Yılmaz';
      const randNum = Math.floor(100 + Math.random() * 900);
      const email = `demo_${first.toLowerCase()}_${randNum}@portfolioyun.com`;
      const username = `${first.toLowerCase()}_${randNum}`;

      // Create mock user
      const user = await createUserWithAccount({
        email,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dGVzdF9zYWx0$demo_hashed_password', // placeholder hash
        firstName: first,
        lastName: last,
        username,
        verificationCode: '111111',
        refreshTokenHash: 'demo_token_hash',
        refreshTokenExpiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      });

      // Generate a random TWR return between -15.00% and +40.00%
      const randomTwr = (-15 + Math.random() * 55).toFixed(4);

      // Insert directly into league entries
      await upsertLeagueEntry({
        periodId: league.id,
        userId: user.id,
        startValueCents: 10000000n, // 100.000 TL
        endValueCents: BigInt(Math.floor(10000000 * (1 + Number(randomTwr) / 100))),
        twrPct: randomTwr,
      });

      seeded.push({ username: user.username, displayName: user.displayName, twrPct: randomTwr });
    }

    return res.json({
      message: `${count} adet sahte yarışmacı başarıyla oluşturuldu ve lige eklendi.`,
      seeded,
    });
  } catch (error) {
    console.error('[DEMO /leagues/seed-participants] hatası:', error);
    return res.status(500).json({ error: 'Sahte yarışmacılar eklenemedi.' });
  }
});
