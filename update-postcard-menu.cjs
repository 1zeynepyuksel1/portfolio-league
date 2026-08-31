const fs = require('fs');

// 1. Update PostCard.tsx
let postCard = fs.readFileSync('apps/mobile/src/components/PostCard.tsx', 'utf8');

// Add imports if missing
if (!postCard.includes('MoreVertical')) {
  postCard = postCard.replace(
    "import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';",
    "import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, ActivityIndicator } from 'react-native';\nimport { MoreVertical, Trash2, Globe, Users, Edit2, Pin } from 'lucide-react-native';\nimport { useState } from 'react';\nimport { apiFetch } from '../api/client';"
  );
}

// Update Props
postCard = postCard.replace(
  "export type Props = {",
  "export type Props = {\n  currentUsername?: string;"
);

// Inject logic
postCard = postCard.replace(
  "export function PostCard({ post, user, isPreview, onPressUser }: Props) {",
  "export function PostCard({ post, user, isPreview, onPressUser, currentUsername }: Props) {\n  const [menuVisible, setMenuVisible] = useState(false);\n  const [isUpdating, setIsUpdating] = useState(false);\n  const [deleted, setDeleted] = useState(false);\n  const [localVis, setLocalVis] = useState(post?.visibility);\n\n  const isOwnPost = currentUsername && user?.username === currentUsername;\n\n  const handleDelete = async () => {\n    setIsUpdating(true);\n    try {\n      await apiFetch('/posts/' + post.id, { method: 'DELETE' });\n      setDeleted(true);\n    } catch (e) {}\n    setMenuVisible(false);\n  };\n\n  const handleVisibility = async (newVis: string) => {\n    setIsUpdating(true);\n    try {\n      await apiFetch('/posts/' + post.id + '/visibility', { method: 'PATCH', body: JSON.stringify({ visibility: newVis }) });\n      setLocalVis(newVis);\n    } catch (e) {}\n    setIsUpdating(false);\n    setMenuVisible(false);\n  };\n\n  if (deleted) return null;\n"
);

// Add 3-dots icon to UI
postCard = postCard.replace(
  "</TouchableOpacity>\\n          <View style={styles.badge}>",
  "</TouchableOpacity>\n          {isOwnPost && !isPreview && (\n            <TouchableOpacity onPress={() => setMenuVisible(true)} style={{ padding: 8, marginRight: -8 }}>\n              <MoreVertical size={20} color={colors.inkMuted} />\n            </TouchableOpacity>\n          )}\n          <View style={styles.badge}>"
);

// Add Modal to the bottom
postCard = postCard.replace(
  "    </View>\\n  );\\n}",
        {/* 3-DOT MENU MODAL */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuCard}>
            {isUpdating && <ActivityIndicator color={colors.accent} style={{ position: 'absolute', top: 16, right: 16 }} />}
            
            <Text style={styles.menuTitle}>Gönderi Seçenekleri</Text>

            <TouchableOpacity style={styles.menuItem} onPress={() => handleVisibility(localVis === 'public' ? 'friends_only' : 'public')} disabled={isUpdating}>
              {localVis === 'public' ? <Users size={20} color={colors.ink} /> : <Globe size={20} color={colors.ink} />}
              <Text style={styles.menuText}>
                {localVis === 'public' ? 'Sadece Arkadaşlar Yap' : 'Herkese Açık Yap'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} disabled={true}>
              <Edit2 size={20} color={colors.inkMuted} />
              <Text style={[styles.menuText, { color: colors.inkMuted }]}>Düzenle (Yakında)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} disabled={true}>
              <Pin size={20} color={colors.inkMuted} />
              <Text style={[styles.menuText, { color: colors.inkMuted }]}>Başa Sabitle (Yakında)</Text>
            </TouchableOpacity>

            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />

            <TouchableOpacity style={styles.menuItem} onPress={handleDelete} disabled={isUpdating}>
              <Trash2 size={20} color={colors.loss} />
              <Text style={[styles.menuText, { color: colors.loss }]}>Gönderiyi Sil</Text>
            </TouchableOpacity>

          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
);

// Add styles
postCard = postCard.replace(
  "  badge: {",
  "  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },\n  menuCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },\n  menuTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink, marginBottom: 16 },\n  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 },\n  menuText: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },\n  badge: {"
);

fs.writeFileSync('apps/mobile/src/components/PostCard.tsx', postCard, 'utf8');
