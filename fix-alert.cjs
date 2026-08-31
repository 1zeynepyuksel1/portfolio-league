const fs = require('fs');
let pc = fs.readFileSync('apps/mobile/src/components/PostCard.tsx', 'utf8');

// Use regex for the catch block to be safe against spaces/newlines
const regex = /setIsEditing\(false\);\s*\} catch \(e\) \{\}\s*setIsUpdating\(false\);/;
const replacement = "setIsEditing(false);\n    } catch (e: any) { Alert.alert('Hata', e.message); }\n    setIsUpdating(false);";

pc = pc.replace(regex, replacement);

fs.writeFileSync('apps/mobile/src/components/PostCard.tsx', pc, 'utf8');
