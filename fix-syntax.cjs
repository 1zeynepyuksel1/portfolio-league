const fs = require('fs');
let pc = fs.readFileSync('apps/mobile/src/components/PostCard.tsx', 'utf8');

const brokenPinRegex = /const handlePin = async \(\) => \{[\s\S]*?setMenuVisible\(false\);\n  \};/;

const cleanPinFunction = \const handlePin = async () => {
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

pc = pc.replace(brokenPinRegex, cleanPinFunction);

fs.writeFileSync('apps/mobile/src/components/PostCard.tsx', pc, 'utf8');
