const fs = require('fs');
let disc = fs.readFileSync('apps/mobile/src/screens/DiscoveryScreen.tsx', 'utf8');

disc = disc.replace(
  "onPressUser={onSelectUser}\\n            onPressUser={(username) => { if (onSelectUser) onSelectUser(username); }}",
  "onPressUser={onSelectUser}"
);
disc = disc.replace(
  "onPressUser={onSelectUser}\\r\\n            onPressUser={(username) => { if (onSelectUser) onSelectUser(username); }}",
  "onPressUser={onSelectUser}"
);

// Fallback regex if above didn't match due to exact spacing
disc = disc.replace(/onPressUser=\{onSelectUser\}\s*onPressUser=\{\(username\) => \{ if \(onSelectUser\) onSelectUser\(username\); \}\}/, "onPressUser={onSelectUser}");

fs.writeFileSync('apps/mobile/src/screens/DiscoveryScreen.tsx', disc, 'utf8');
