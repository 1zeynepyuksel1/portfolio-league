const { execSync } = require('child_process');
const fs = require('fs');

// 1. Reset file to git original
execSync('git checkout apps/mobile/src/components/PostCard.tsx');

// 2. Re-apply all features sequentially
execSync('node c:\\Users\\hp\\.gemini\\antigravity\\brain\\e1523a11-0e5c-4d3a-bde6-ca16b7a3239d\\scratch\\redesign-postcard.cjs');
execSync('node c:\\Users\\hp\\.gemini\\antigravity\\brain\\e1523a11-0e5c-4d3a-bde6-ca16b7a3239d\\scratch\\frontend-edit.cjs');
execSync('node c:\\Users\\hp\\.gemini\\antigravity\\brain\\e1523a11-0e5c-4d3a-bde6-ca16b7a3239d\\scratch\\frontend-pin.cjs');

// 3. Fix the 'dummyLikes' and 'deleted' crash
let pc = fs.readFileSync('apps/mobile/src/components/PostCard.tsx', 'utf8');

pc = pc.replace(
  "const dummyLikes = Math.floor(Math.random() * 200) + 12;",
  "const [dummyLikes] = useState(() => Math.floor(Math.random() * 200) + 12);"
);
pc = pc.replace(
  "const dummyComments = Math.floor(Math.random() * 20) + 2;",
  "const [dummyComments] = useState(() => Math.floor(Math.random() * 20) + 2);"
);

pc = pc.replace("if (deleted) return null;\\n", "");
pc = pc.replace("if (deleted) return null;\\r\\n", "");
pc = pc.replace("if (deleted) return null;", "");
const returnRegex = /return \(\s*<View style=\{styles\.card\}>/;
pc = pc.replace(returnRegex, "if (deleted) return null;\n\n  return (\n    <View style={styles.card}>");

// 4. Safely implement the Custom Toast!
const pinRegex = /const handlePin = async \(\) => \{[\s\S]*?setMenuVisible\(false\);\n  \};/;
const customPinLogic = \const [showToast, setShowToast] = useState(false);
  const handlePin = async () => {
    setIsUpdating(true);
    try {
      await apiFetch('/posts/' + post.id + '/pin', { method: 'PATCH' });
      setIsPinned(!isPinned);
      if (!isPinned) {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
      }
    } catch (e: any) { Alert.alert('Hata', e.message); }
    setIsUpdating(false);
    setMenuVisible(false);
  };\;
pc = pc.replace(pinRegex, customPinLogic);

// Add the Toast UI just before the Modal! (This avoids cutting the file end)
const modalStartRegex = /\{\/\* 3-DOT MENU MODAL \*\/\}/;
const toastUI = \
      {showToast && (
        <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16, backgroundColor: colors.surfaceRaised, padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, borderWidth: 1, borderColor: colors.border, zIndex: 100 }}>
          <Text style={{ fontFamily: fonts.medium, color: colors.ink, fontSize: 13 }}>Gönderi başa sabitlendi!</Text>
          <TouchableOpacity onPress={() => { setShowToast(false); if (onPressUser && user?.username) onPressUser(user.username); }} style={{ backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
            <Text style={{ fontFamily: fonts.medium, color: 'white', fontSize: 13 }}>Gör 👉</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 3-DOT MENU MODAL */}\;
pc = pc.replace(modalStartRegex, toastUI);

fs.writeFileSync('apps/mobile/src/components/PostCard.tsx', pc, 'utf8');
