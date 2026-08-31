const fs = require('fs');
let service = fs.readFileSync('apps/api/src/posts/service.ts', 'utf8');

// Update getMyPosts to sort by pinned first
const oldOrderBy = "orderBy: [desc(posts.createdAt)],";
const newOrderBy = "orderBy: [desc(sql\\->>'isPinned'\), desc(posts.createdAt)],";

if (service.includes(oldOrderBy)) {
  service = service.replace(oldOrderBy, newOrderBy);
}

fs.writeFileSync('apps/api/src/posts/service.ts', service, 'utf8');
