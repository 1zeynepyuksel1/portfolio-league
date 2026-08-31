const fs = require('fs');
let pc = fs.readFileSync('apps/mobile/src/components/PostCard.tsx', 'utf8');

pc = pc.replace(
  "{isOwnPost && !isPreview && (\\n            <TouchableOpacity onPress={() => setMenuVisible(true)} style={{ padding: 8, marginRight: -8 }}>\\n              <MoreVertical size={20} color={colors.inkMuted} />\\n            </TouchableOpacity>\\n          )}",
  "          <Text style={{color: 'red', fontSize: 16, backgroundColor: 'white'}}>{String(currentUsername)} vs {String(user?.username)}</Text>\n          {isOwnPost && !isPreview && (\n            <TouchableOpacity onPress={() => setMenuVisible(true)} style={{ padding: 8, marginRight: -8 }}>\n              <MoreVertical size={20} color={colors.inkMuted} />\n            </TouchableOpacity>\n          )}"
);
fs.writeFileSync('apps/mobile/src/components/PostCard.tsx', pc, 'utf8');
