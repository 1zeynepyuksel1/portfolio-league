const fs = require('fs');
let pc = fs.readFileSync('apps/mobile/src/components/PostCard.tsx', 'utf8');

const oldPinLogic = "setIsPinned(!isPinned);\\n    } catch (e: any) { Alert.alert('Hata', e.message); }\\n    setIsUpdating(false);\\n    setMenuVisible(false);";
const newPinLogic = "setIsPinned(!isPinned);\n      if (!isPinned) {\n        Alert.alert('Başarılı', 'Gönderi başa sabitlendi.', [\n          { text: 'Kapat', style: 'cancel' },\n          { text: 'Profilde Gör', onPress: () => { if (onPressUser && user?.username) onPressUser(user.username); } }\n        ]);\n      }\n    } catch (e: any) { Alert.alert('Hata', e.message); }\n    setIsUpdating(false);\n    setMenuVisible(false);";

pc = pc.replace("setIsPinned(!isPinned);\n    } catch (e: any) { Alert.alert('Hata', e.message); }\n    setIsUpdating(false);\n    setMenuVisible(false);", newPinLogic);

fs.writeFileSync('apps/mobile/src/components/PostCard.tsx', pc, 'utf8');
