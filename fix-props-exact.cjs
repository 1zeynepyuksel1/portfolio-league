const fs = require('fs');

let pc = fs.readFileSync('apps/mobile/src/components/PostCard.tsx', 'utf8');
pc = pc.replace(
  "type Props = {",
  "export type Props = {\n  currentUsername?: string;"
);
fs.writeFileSync('apps/mobile/src/components/PostCard.tsx', pc, 'utf8');
