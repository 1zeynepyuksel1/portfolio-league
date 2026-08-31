const fs = require('fs');

// 1. Fix PostCard.tsx
let pc = fs.readFileSync('apps/mobile/src/components/PostCard.tsx', 'utf8');

if (!pc.includes('Modal')) {
  pc = pc.replace(
    "import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';",
    "import { View, Text, StyleSheet, Image, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';\nimport { useState } from 'react';\nimport { apiFetch } from '../api/client';"
  );
}
if (!pc.includes('MoreVertical')) {
  pc = pc.replace(
    "import { Globe, Users, TrendingUp, TrendingDown, Heart, MessageSquare } from 'lucide-react-native';",
    "import { Globe, Users, TrendingUp, TrendingDown, Heart, MessageSquare, MoreVertical, Trash2, Edit2, Pin } from 'lucide-react-native';"
  );
}

if (!pc.includes('currentUsername?: string')) {
  pc = pc.replace(
    "export type Props = {",
    "export type Props = {\n  currentUsername?: string;"
  );
}

// Fix menuCard styles
if (!pc.includes('modalOverlay')) {
  pc = pc.replace(
    "  badge: {",
    "  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },\n  menuCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },\n  menuTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink, marginBottom: 16 },\n  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 },\n  menuText: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },\n  badge: {"
  );
}

fs.writeFileSync('apps/mobile/src/components/PostCard.tsx', pc, 'utf8');

// 2. Fix ProfileScreen.tsx
let ps = fs.readFileSync('apps/mobile/src/screens/ProfileScreen.tsx', 'utf8');
ps = ps.replace(
  "currentUsername={currentUser?.username}",
  "currentUsername={currentUsername}"
);
fs.writeFileSync('apps/mobile/src/screens/ProfileScreen.tsx', ps, 'utf8');
