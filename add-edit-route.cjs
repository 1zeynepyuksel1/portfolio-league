const fs = require('fs');
let router = fs.readFileSync('apps/api/src/posts/router.ts', 'utf8');

// We need to add the PATCH route for caption if it doesn't exist.
if (!router.includes('router.patch('/:id'')) {
  // Add it before the visibility route
  const patchRoute = 
// G\\u00f6nderi metnini g\\u00fcncelle (Sadece g\\u00f6nderi sahibi)
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const { caption } = req.body;
    const post = await updatePostCaption(req.params.id, req.user!.id, caption);
    res.json({ success: true, post });
  } catch (error: any) {
    res.status(error.message === 'G\\u00f6nderi bulunamad\\u0131 veya yetkiniz yok' ? 403 : 500).json({ error: error.message });
  }
});
;
  
  router = router.replace(
    "// G\\u00f6nderi gizlili\\u011fini de\\u011fi\\u015ftir",
    patchRoute + "\\n// G\\u00f6nderi gizlili\\u011fini de\\u011fi\\u015ftir"
  );
  
  fs.writeFileSync('apps/api/src/posts/router.ts', router, 'utf8');
}
