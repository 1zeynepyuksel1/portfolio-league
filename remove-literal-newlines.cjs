const fs = require('fs');
let pc = fs.readFileSync('apps/mobile/src/components/PostCard.tsx', 'utf8');

// The literal '\n' string (slash then n)
pc = pc.replace(/\\n/g, '');

fs.writeFileSync('apps/mobile/src/components/PostCard.tsx', pc, 'utf8');
