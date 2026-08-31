const fs = require('fs');
let disc = fs.readFileSync('apps/mobile/src/screens/DiscoveryScreen.tsx', 'utf8');

// Update FeedTab signature
disc = disc.replace(
  "function FeedTab({ onSelectUser }: { onSelectUser?: (username: string) => void }) {",
  "function FeedTab({ onSelectUser, currentUser }: { onSelectUser?: (username: string) => void; currentUser?: any }) {"
);

// Update FeedTab usage inside DiscoveryScreen
disc = disc.replace(
  "<FeedTab onSelectUser={onSelectUser} />",
  "<FeedTab onSelectUser={onSelectUser} currentUser={currentUser} />"
);

fs.writeFileSync('apps/mobile/src/screens/DiscoveryScreen.tsx', disc, 'utf8');
