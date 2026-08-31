const fs = require('fs');
let pc = fs.readFileSync('apps/mobile/src/components/PostCard.tsx', 'utf8');

// Inject console logs and a temporary UI debug block
pc = pc.replace(
  "const isOwnPost = currentUsername && user?.username === currentUsername;",
  "const isOwnPost = currentUsername && user?.username === currentUsername;\n  console.log('DEBUG POST:', { currentUsername, postUser: user?.username, isOwnPost });"
);

pc = pc.replace(
  "{isOwnPost && !isPreview && (",
  "{(true) && !isPreview && (\n            <Text style={{color: 'red', fontSize: 10}}>{currentUsername || 'YOK'} vs {user?.username || 'YOK'}</Text>\n          )}\n          {isOwnPost && !isPreview && ("
);

fs.writeFileSync('apps/mobile/src/components/PostCard.tsx', pc, 'utf8');
