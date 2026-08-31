const fs = require('fs');
let pc = fs.readFileSync('apps/mobile/src/components/PostCard.tsx', 'utf8');

pc = pc.replace(
  "{isOwnPost && !isPreview && (\\n              <TouchableOpacity onPress={() => setMenuVisible(true)} style={{ padding: 8, marginRight: 8 }}>\\n                <MoreVertical size={20} color={colors.inkMuted} />\\n              </TouchableOpacity>\\n            )}\\n            <View style={styles.badge}>",
  "<View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>\n            {isOwnPost && !isPreview && (\n              <TouchableOpacity onPress={() => setMenuVisible(true)} style={{ padding: 8, marginRight: -4 }}>\n                <MoreVertical size={20} color={colors.inkMuted} />\n              </TouchableOpacity>\n            )}\n            <View style={styles.badge}>"
);

pc = pc.replace(
  "<Text style={styles.badgeText}>{badgeText}</Text>\\n            </View>",
  "<Text style={styles.badgeText}>{badgeText}</Text>\n            </View>\n          </View>"
);

fs.writeFileSync('apps/mobile/src/components/PostCard.tsx', pc, 'utf8');
