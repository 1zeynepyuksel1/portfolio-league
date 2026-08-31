import { Router } from 'express';
import { requireAccessToken } from '../auth/middleware.js';
import {
  friendshipIdParamSchema,
  sendFriendRequestSchema,
} from './friends.schema.js';
import {
  acceptFriendRequest,
  FriendshipError,
  listFriends,
  listPendingRequests,
  rejectFriendRequest,
  removeFriendOrRequest,
  sendFriendRequest,
} from './service.js';

export const friendsRouter = Router();

friendsRouter.post('/by-username/:username/accept', async (req, res) => {
  const userId = res.locals.userId as string;
  const username = req.params.username;
  try {
    const { db } = await import('../db/client.js');
    const { eq } = await import('drizzle-orm');
    const { users } = await import('../db/schema.js');
    const [sender] = await db.select({ id: users.id }).from(users).where(eq(users.username, username));
    if (!sender) return res.status(404).json({ error: 'User not found' });
    
    // Find the pending request
    const { friendships } = await import('../db/schema.js');
    const { and } = await import('drizzle-orm');
    const [request] = await db.select().from(friendships).where(
      and(
        eq(friendships.requesterId, sender.id),
        eq(friendships.addresseeId, userId),
        eq(friendships.status, 'pending')
      )
    );
    if (!request) return res.status(404).json({ error: 'No pending request found from this user' });
    
    const { acceptFriendRequest } = await import('./service.js');
    const updated = await acceptFriendRequest(userId, request.id);
    res.json({ message: 'Accepted', friendship: updated });
  } catch (error) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});


// Tüm arkadaşlık rotaları giriş yapmayı (Bearer token) zorunlu kılar
friendsRouter.use(requireAccessToken);

// 1. Arkadaşlık İsteği Gönderme: POST /friends/requests
friendsRouter.post('/requests', async (req, res) => {
  const parseResult = sendFriendRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      error: 'Geçersiz veri formatı',
      details: parseResult.error.flatten().fieldErrors,
    });
    return;
  }

  const userId = res.locals.userId as string;

  try {
    const result = await sendFriendRequest(
      userId,
      parseResult.data.addressee,
    );
    res.status(201).json({
      message: 'Arkadaşlık isteği başarıyla gönderildi.',
      ...result,
    });
  } catch (error) {
    if (error instanceof FriendshipError) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
      return;
    }
    console.error('Arkadaşlık isteği gönderme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// 2. Bekleyen İstekleri Listeleme (Gelen / Giden): GET /friends/requests
friendsRouter.get('/requests', async (_req, res) => {
  const userId = res.locals.userId as string;

  try {
    const requests = await listPendingRequests(userId);
    res.json(requests);
  } catch (error) {
    console.error('Bekleyen istekleri listeleme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// 3. İsteği Kabul Etme: POST /friends/requests/:id/accept
friendsRouter.post('/requests/:id/accept', async (req, res) => {
  const paramResult = friendshipIdParamSchema.safeParse(req.params);
  if (!paramResult.success) {
    res.status(400).json({
      error: 'Geçersiz istek ID formatı',
      details: paramResult.error.flatten().fieldErrors,
    });
    return;
  }

  const userId = res.locals.userId as string;

  try {
    const updated = await acceptFriendRequest(userId, paramResult.data.id);
    res.json({
      message: 'Arkadaşlık isteği kabul edildi.',
      friendship: updated,
    });
  } catch (error) {
    if (error instanceof FriendshipError) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
      return;
    }
    console.error('İstek kabul hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// 4. İsteği Reddetme: POST /friends/requests/:id/reject
friendsRouter.post('/requests/:id/reject', async (req, res) => {
  const paramResult = friendshipIdParamSchema.safeParse(req.params);
  if (!paramResult.success) {
    res.status(400).json({
      error: 'Geçersiz istek ID formatı',
      details: paramResult.error.flatten().fieldErrors,
    });
    return;
  }

  const userId = res.locals.userId as string;

  try {
    await rejectFriendRequest(userId, paramResult.data.id);
    res.json({
      message: 'Arkadaşlık isteği reddedildi.',
    });
  } catch (error) {
    if (error instanceof FriendshipError) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
      return;
    }
    console.error('İstek reddetme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// 5. Arkadaş Listesi: GET /friends
friendsRouter.get('/', async (_req, res) => {
  const userId = res.locals.userId as string;

  try {
    const friends = await listFriends(userId);
    res.json({
      friends,
      count: friends.length,
    });
  } catch (error) {
    console.error('Arkadaş listeleme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});

// 6. Arkadaşlıktan Çıkarma veya İsteği İptal Etme: DELETE /friends/:id
friendsRouter.delete('/:id', async (req, res) => {
  const paramResult = friendshipIdParamSchema.safeParse(req.params);
  if (!paramResult.success) {
    res.status(400).json({
      error: 'Geçersiz ID formatı',
      details: paramResult.error.flatten().fieldErrors,
    });
    return;
  }

  const userId = res.locals.userId as string;

  try {
    await removeFriendOrRequest(userId, paramResult.data.id);
    res.json({
      message: 'Arkadaşlık kaydı başarıyla silindi.',
    });
  } catch (error) {
    if (error instanceof FriendshipError) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
      return;
    }
    console.error('Arkadaşlık silme hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası oluştu.' });
  }
});
