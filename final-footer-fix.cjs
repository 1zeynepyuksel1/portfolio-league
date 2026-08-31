const fs = require('fs');
let pc = fs.readFileSync('apps/mobile/src/components/PostCard.tsx', 'utf8');

// The string to replace is:
/*
            {/* Visibility indicator on the right if needed, optional *\/}
            </View>
          </View>
*/
const emptyFooterRegex = /\{\/\*\s*Visibility indicator on the right if needed, optional\s*\*\/\}\s*<\/View>\s*<\/View>/;
const newFooterRight = \
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[styles.badge, { paddingVertical: 2, paddingHorizontal: 8, backgroundColor: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Text style={[styles.badgeText, { fontSize: 10 }]}>{badgeText}</Text>
              </View>
              {localVis === 'public' ? (
                <Globe size={14} color={colors.inkMuted} />
              ) : (
                <Users size={14} color={colors.inkMuted} />
              )}
            </View>
          </View>\;

pc = pc.replace(emptyFooterRegex, newFooterRight);

fs.writeFileSync('apps/mobile/src/components/PostCard.tsx', pc, 'utf8');
