const fs = require('fs');
let pc = fs.readFileSync('apps/mobile/src/components/PostCard.tsx', 'utf8');

// 1. Remove the early return from its current position
pc = pc.replace("if (deleted) return null;", "");
pc = pc.replace("if (deleted) return null;\\n", "");
pc = pc.replace("if (deleted) return null;\\r\\n", "");

// 2. Put it just before the final return
const returnRegex = /return \(\s*<View style=\{styles\.card\}>/;
const safeReturnRegex = /return \(\s*<View style=\{styles\.card\}>/;

if (pc.match(returnRegex)) {
  pc = pc.replace(returnRegex, "if (deleted) return null;\n\n  return (\n    <View style={styles.card}>");
}

fs.writeFileSync('apps/mobile/src/components/PostCard.tsx', pc, 'utf8');
