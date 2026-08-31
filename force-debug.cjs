const fs = require('fs');
let pc = fs.readFileSync('apps/mobile/src/components/PostCard.tsx', 'utf8');

pc = pc.replace(
  "const isOwnPost = currentUsername && user?.username === currentUsername;",
  "const isOwnPost = currentUsername && user?.username === currentUsername;\n  console.log('>>> MENU CHECK | CurrentUser: ' + currentUsername + ' | PostAuthor: ' + user?.username + ' | Match: ' + isOwnPost);"
);
fs.writeFileSync('apps/mobile/src/components/PostCard.tsx', pc, 'utf8');
