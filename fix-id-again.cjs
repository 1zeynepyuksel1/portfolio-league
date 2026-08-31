const fs = require('fs');
let pc = fs.readFileSync('apps/mobile/src/components/PostCard.tsx', 'utf8');

pc = pc.replace(
  "export function PostCard({ post, user, isPreview, onPressUser, currentUsername }: Props)",
  "export function PostCard({ post, user, isPreview, onPressUser, currentUserId }: Props)"
);
pc = pc.replace(
  "const isOwnPost = currentUsername && user?.username === currentUsername;",
  "const isOwnPost = currentUserId && post?.userId === currentUserId;"
);

fs.writeFileSync('apps/mobile/src/components/PostCard.tsx', pc, 'utf8');
