const fs = require('fs');
let pc = fs.readFileSync('apps/mobile/src/components/PostCard.tsx', 'utf8');

pc = pc.replace("currentUsername?: string;", "currentUserId?: string;");
if (!pc.includes("currentUserId?: string;")) {
  pc = pc.replace("export type Props = {", "export type Props = {\n  currentUserId?: string;");
}

fs.writeFileSync('apps/mobile/src/components/PostCard.tsx', pc, 'utf8');
