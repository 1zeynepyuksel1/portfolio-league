const fs = require('fs');
let service = fs.readFileSync('apps/api/src/posts/service.ts', 'utf8');

service = service.replace(
  "const isPinned = !payload.isPinned;",
  "const isPinned = !(payload as any).isPinned;"
);

fs.writeFileSync('apps/api/src/posts/service.ts', service, 'utf8');
