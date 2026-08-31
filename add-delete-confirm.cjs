const fs = require('fs');
let pc = fs.readFileSync('apps/mobile/src/components/PostCard.tsx', 'utf8');

// Add Platform import if missing
if (!pc.includes("import { Platform }")) {
  pc = pc.replace(
    "import { useState } from 'react';",
    "import { useState } from 'react';\nimport { Platform } from 'react-native';"
  );
}

// 1. Add requestDelete function
const requestDeleteLogic = \const requestDelete = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      if (window.confirm('Gönderiyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
        handleDelete();
      }
    } else {
      Alert.alert(
        'Onay',
        'Gönderiyi silmek istediğinizden emin misiniz?',
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Evet, Sil', style: 'destructive', onPress: handleDelete }
        ]
      );
    }
  };\;

pc = pc.replace(
  "const handleDelete = async () => {",
  requestDeleteLogic + "\n\n  const handleDelete = async () => {"
);

// 2. Change the button onPress to requestDelete
pc = pc.replace(
  "onPress={handleDelete}",
  "onPress={requestDelete}"
);

fs.writeFileSync('apps/mobile/src/components/PostCard.tsx', pc, 'utf8');
