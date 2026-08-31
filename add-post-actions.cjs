const fs = require('fs');

// 1. Update service.ts
let service = fs.readFileSync('apps/api/src/posts/service.ts', 'utf8');
const newFns = \
export async function deletePost(userId: string, postId: string) {
  const { eq, and } = await import('drizzle-orm');
  const [deleted] = await db.delete(posts).where(and(eq(posts.id, postId), eq(posts.userId, userId))).returning();
  if (!deleted) throw new Error('Post not found or unauthorized');
  return deleted;
}

export async function updatePostVisibility(userId: string, postId: string, visibility: 'public' | 'friends_only') {
  const { eq, and } = await import('drizzle-orm');
  const [updated] = await db.update(posts)
    .set({ visibility })
    .where(and(eq(posts.id, postId), eq(posts.userId, userId)))
    .returning();
  if (!updated) throw new Error('Post not found or unauthorized');
  return updated;
}
\;
service += '\n' + newFns;
fs.writeFileSync('apps/api/src/posts/service.ts', service, 'utf8');

// 2. Update router.ts
let router = fs.readFileSync('apps/api/src/posts/router.ts', 'utf8');
const newRoutes = \
postsRouter.delete('/:id', requireAccessToken, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId as string;
    const { deletePost } = await import('./service.js');
    await deletePost(userId, req.params.id);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message } });
  }
});

postsRouter.patch('/:id/visibility', requireAccessToken, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId as string;
    const { visibility } = req.body;
    const { updatePostVisibility } = await import('./service.js');
    const updated = await updatePostVisibility(userId, req.params.id, visibility);
    return res.json({ post: updated });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message } });
  }
});
\;
router += '\n' + newRoutes;
fs.writeFileSync('apps/api/src/posts/router.ts', router, 'utf8');
