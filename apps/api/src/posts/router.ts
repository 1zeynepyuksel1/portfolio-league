import { Router, type Request, type Response } from 'express';
import { requireAccessToken } from '../auth/middleware.js';
import { getSingleAssetPreview, getPortfolioPreview, createPost, getMyPosts, getFeed, getTradedAssets } from './service.js';

export const postsRouter = Router();

postsRouter.get('/user/:username', requireAccessToken, async (req: Request, res: Response) => {
  try {
    const viewerId = res.locals.userId as string;
    const username = req.params.username as string;
    const offset = parseInt(req.query.offset as string) || 0;
    
    // Check privacy
    const { getPublicProfile } = await import('../profile/service.js');
    const profile = await getPublicProfile(viewerId, username);
    if (!profile.visible) {
      return res.json({ posts: [] });
    }
    
    // Get target userId
    const { db } = await import('../db/client.js');
    const { eq } = await import('drizzle-orm');
    const { users } = await import('../db/schema.js');
    const [target] = await db.select({ id: users.id }).from(users).where(eq(users.username, username));
    
    if (!target) return res.json({ posts: [] });
    
    // Fetch their posts
    const { getMyPosts } = await import('./service.js');
    const userPosts = await getMyPosts(target.id, 20, offset);
    return res.json({ posts: userPosts });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message } });
  }
});


postsRouter.get('/traded-assets', requireAccessToken, async (_req: Request, res: Response) => {
  try {
    const userId = res.locals.userId as string;
    const assets = await getTradedAssets(userId);
    return res.json({ assets });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message } });
  }
});

postsRouter.get('/share-preview/asset/:assetKey', requireAccessToken, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId as string;
    const assetKey = req.params.assetKey as string;
    const preview = await getSingleAssetPreview(userId, assetKey);
    return res.json({ preview });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message } });
  }
});

postsRouter.get('/share-preview/portfolio', requireAccessToken, async (_req: Request, res: Response) => {
  try {
    const userId = res.locals.userId as string;
    
    const preview = await getPortfolioPreview(userId);
    return res.json({ preview });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message } });
  }
});

postsRouter.post('/', requireAccessToken, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId as string;
    const { type, scope, targetKey, periodParams, caption, visibility, payload: clientPayload } = req.body;
    
    const newPost = await createPost(userId, type, scope, targetKey, periodParams, caption, visibility, clientPayload);
    return res.json({ post: newPost });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message } });
  }
});

postsRouter.get('/me', requireAccessToken, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId as string;
    const offset = parseInt(req.query.offset as string) || 0;
    const myPosts = await getMyPosts(userId, 20, offset);
    return res.json({ posts: myPosts });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message } });
  }
});

postsRouter.get('/feed', requireAccessToken, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId as string;
    const offset = parseInt(req.query.offset as string) || 0;
    const feed = await getFeed(userId, 20, offset);
    return res.json({ posts: feed });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message } });
  }
});






postsRouter.delete('/:id', requireAccessToken, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId as string;
    const { deletePost } = await import('./service.js');
    // `/:id` rotasi id'nin varligini garanti ediyor; ayni cast bu
    // dosyada `togglePostPin` cagrisinda da kullanilmis.
    await deletePost(userId, req.params.id as string);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message } });
  }
});



postsRouter.patch('/:id/pin', requireAccessToken, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId as string;
    const { togglePostPin } = await import('./service.js');
    const updated = await togglePostPin(req.params.id as string, userId);
    return res.json({ post: updated });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message } });
  }
});

postsRouter.patch('/:id', requireAccessToken, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId as string;
    const { caption } = req.body;
    const { updatePostCaption } = await import('./service.js');
    const updated = await updatePostCaption(
      req.params.id as string,
      userId,
      caption,
    );
    return res.json({ post: updated });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message } });
  }
});

postsRouter.patch('/:id/visibility', requireAccessToken, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId as string;
    const { visibility } = req.body;
    /*
      `updatePostCaption` bu bloktan cikarildi -- burada
      kullanilmiyor. Bir ustteki PATCH /:id isleyicisi onu kendi
      import'uyla zaten aliyor; buradaki kopya olu bir bagdi.
    */
    const { updatePostVisibility } = await import('./service.js');
    const updated = await updatePostVisibility(
      userId,
      req.params.id as string,
      visibility,
    );
    return res.json({ post: updated });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message } });
  }
});
