const fs = require('fs');
let disc = fs.readFileSync('apps/mobile/src/screens/DiscoveryScreen.tsx', 'utf8');

// The PostCard component in DiscoveryScreen is missing currentUserId and onPressUser!
const target = "user={item.user || { username: 'Gizli Kullan\\u0131c\\u0131', avatarStyle: 'shapes', avatarSeed: 'default' }} \n            isPreview={false}";
const targetCRLF = "user={item.user || { username: 'Gizli Kullan\\u0131c\\u0131', avatarStyle: 'shapes', avatarSeed: 'default' }} \r\n            isPreview={false}";

const replacement = "user={item.user || { username: 'Gizli Kullanıcı', avatarStyle: 'shapes', avatarSeed: 'default' }} \n            isPreview={false}\n            currentUserId={currentUser?.id}\n            onPressUser={onSelectUser}";

// We'll just do a more robust regex replacement
const regex = /user=\{item\.user \|\| \{ username: 'Gizli Kullanı.*?\} \r?\n\s*isPreview=\{false\}/;
disc = disc.replace(regex, replacement);

fs.writeFileSync('apps/mobile/src/screens/DiscoveryScreen.tsx', disc, 'utf8');
