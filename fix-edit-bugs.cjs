const fs = require('fs');
let pc = fs.readFileSync('apps/mobile/src/components/PostCard.tsx', 'utf8');

// 1. Fix changing dummy numbers by wrapping them in useState
pc = pc.replace(
  "const dummyLikes = Math.floor(Math.random() * 200) + 12;",
  "const [dummyLikes] = useState(() => Math.floor(Math.random() * 200) + 12);"
);
pc = pc.replace(
  "const dummyComments = Math.floor(Math.random() * 20) + 2;",
  "const [dummyComments] = useState(() => Math.floor(Math.random() * 20) + 2);"
);

// 2. Add an alert to the catch block to see why API is failing
pc = pc.replace(
  "setIsEditing(false);\\n    } catch (e) {}\\n    setIsUpdating(false);",
  "setIsEditing(false);\n    } catch (e: any) { alert('Hata: ' + e.message); }\n    setIsUpdating(false);"
);
pc = pc.replace(
  "setIsEditing(false);\\r\\n    } catch (e) {}\\r\\n    setIsUpdating(false);",
  "setIsEditing(false);\n    } catch (e: any) { alert('Hata: ' + e.message); }\n    setIsUpdating(false);"
);

// Add Alert to imports if not there
if (!pc.includes('Alert,')) {
  pc = pc.replace("ActivityIndicator, TextInput", "ActivityIndicator, TextInput, Alert");
  // And replace alert( with Alert.alert(
  pc = pc.replace("alert('Hata: ' + e.message)", "Alert.alert('Hata', e.message)");
}

fs.writeFileSync('apps/mobile/src/components/PostCard.tsx', pc, 'utf8');
