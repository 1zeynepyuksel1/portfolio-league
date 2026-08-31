const fs = require('fs');
let pc = fs.readFileSync('apps/mobile/src/components/PostCard.tsx', 'utf8');

// 1. Add showToast state
pc = pc.replace(
  "const [isPinned, setIsPinned] = useState(post?.payload?.isPinned || false);",
  "const [isPinned, setIsPinned] = useState(post?.payload?.isPinned || false);\n  const [showToast, setShowToast] = useState(false);"
);

// 2. Change Alert to Toast
const oldAlertRegex = /if \(\!isPinned\) \{\s*Alert\.alert\([\s\S]*?\);\s*\}/;
const newToastLogic = if (!isPinned) {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
      };
pc = pc.replace(oldAlertRegex, newToastLogic);

// 3. Inject custom Toast UI at the bottom of the Card
const returnEndRegex = /<\/View>\s*\)\s*\}/;
const toastUI = 
        {showToast && (
          <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16, backgroundColor: colors.surfaceRaised, padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontFamily: fonts.medium, color: colors.ink, fontSize: 13 }}>Gönderi başa sabitlendi!</Text>
            <TouchableOpacity onPress={() => { setShowToast(false); if (onPressUser && user?.username) onPressUser(user.username); }} style={{ backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
              <Text style={{ fontFamily: fonts.medium, color: 'white', fontSize: 13 }}>Gör 👉</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    )
  };
pc = pc.replace(returnEndRegex, toastUI);

fs.writeFileSync('apps/mobile/src/components/PostCard.tsx', pc, 'utf8');
