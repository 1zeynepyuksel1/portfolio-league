import { Router } from 'express';
import { db } from '../db/client.js';
import { activities, users } from '../db/schema.js';
import { desc, eq } from 'drizzle-orm';
import { requireAccessToken } from '../auth/middleware.js';

export const feedRouter = Router();

// GET /feed - Arkadaşların veya global akışı getir
feedRouter.get('/', requireAccessToken, async (_req, res) => {
  try {
    const posts = await db
      .select({
        id: activities.id,
        type: activities.type,
        title: activities.title,
        content: activities.content,
        profitPct: activities.profitPct,
        assetSymbol: activities.assetSymbol,
        metadata: activities.metadata,
        likesCount: activities.likesCount,
        commentsCount: activities.commentsCount,
        createdAt: activities.createdAt,
        user: {
          id: users.id,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          avatarSeed: users.avatarSeed,
          avatarStyle: users.avatarStyle,
        }
      })
      .from(activities)
      .innerJoin(users, eq(activities.userId, users.id))
      .orderBy(desc(activities.createdAt))
      .limit(50);

    res.json({ posts });
  } catch (error) {
    console.error('Feed error:', error);
    res.status(500).json({ message: 'Akış yüklenemedi' });
  }
});

// POST /feed - Yeni bir paylaşım oluştur
feedRouter.post('/', requireAccessToken, async (req, res) => {
  try {
    const userId = res.locals.userId as string;
    const { type, title, content, profitPct, assetSymbol, metadata } = req.body;

    if (!type || !title) {
      return res.status(400).json({ message: 'Type ve title zorunludur' });
    }

    const [newPost] = await db.insert(activities).values({
      userId,
      type,
      title,
      content,
      profitPct: profitPct ? String(profitPct) : null,
      assetSymbol,
      metadata: metadata || null,
    }).returning();

    res.status(201).json({ post: newPost });
  } catch (error) {
    console.error('Create feed error:', error);
    res.status(500).json({ message: 'Paylaşım yapılamadı' });
  }
});
