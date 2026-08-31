const fs = require('fs');
let pc = fs.readFileSync('apps/mobile/src/components/PostCard.tsx', 'utf8');

// 1. Add showToast state
pc = pc.replace(
  "const [isPinned, setIsPinned] = useState(post?.payload?.isPinned || false);",
  "const [isPinned, setIsPinned] = useState(post?.payload?.isPinned || false);\n  const [showToast, setShowToast] = useState(false);"
);

// 2. Add Toast UI before Modal
const modalTarget = "{/* 3-DOT MENU MODAL */}";
const toastUI = \{showToast && (
        <View style={{ position: 'absolute', bottom: 16, left: 16, right: 16, backgroundColor: colors.surfaceRaised, padding: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, borderWidth: 1, borderColor: colors.border, zIndex: 100 }}>
          <Text style={{ fontFamily: fonts.medium, color: colors.ink, fontSize: 13 }}>Gönderi başa sabitlendi!</Text>
          <TouchableOpacity onPress={() => { setShowToast(false); if (onPressUser && user?.username) onPressUser(user.username); }} style={{ backgroundColor: colors.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
            <Text style={{ fontFamily: fonts.medium, color: 'white', fontSize: 13 }}>Gör 👉</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {/* 3-DOT MENU MODAL */}\;
pc = pc.replace(modalTarget, toastUI);

// 3. Update pin logic
const pinRegex = /setIsPinned\(\!isPinned\);\s*\} catch \(e: any\) \{ Alert\.alert\('Hata', e\.message\); \}/;
const newPinLogic = \setIsPinned(!isPinned);
      if (!isPinned) {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
      }
    } catch (e: any) { Alert.alert('Hata', e.message); }\;
pc = pc.replace(pinRegex, newPinLogic);

fs.writeFileSync('apps/mobile/src/components/PostCard.tsx', pc, 'utf8');
