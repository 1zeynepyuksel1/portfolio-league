const fs = require('fs');
let router = fs.readFileSync('apps/api/src/posts/router.ts', 'utf8');

const patchRoute = 
postsRouter.patch('/:id', requireAccessToken, async (req: Request, res: Response) => {
  try {
    const userId = res.locals.userId as string;
    const { caption } = req.body;
    const { updatePostCaption } = await import('./service.js');
    const updated = await updatePostCaption(req.params.id, userId, caption);
    return res.json({ post: updated });
  } catch (err: any) {
    return res.status(400).json({ error: { message: err.message } });
  }
});
;

router = router.replace(
  "postsRouter.patch('/:id/visibility'",
  patchRoute + "\npostsRouter.patch('/:id/visibility'"
);

fs.writeFileSync('apps/api/src/posts/router.ts', router, 'utf8');
