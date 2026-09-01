import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ban, Search, ShieldCheck, Trash2, X } from 'lucide-react-native';
import { apiFetch } from '../api/client';
import { colors, fonts } from '../theme';

/**
 * AdminScreen — moderasyon paneli.
 *
 * ⚠️ BU EKRANIN GÖRÜNMESİ BİR YETKİ DEĞİL. Profil ekranı bu düğmeyi
 * yalnızca `role === 'admin'` olduğunda çiziyor ama asıl kontrol
 * SUNUCUDA: `/admin/*` uçlarının hepsi `requireAdmin`'den geçiyor.
 *
 * İstemcideki gizleme bir KOLAYLIK; yetki değil. Kod okuyan biri bu
 * ekranı elle açsa bile sunucu 403 döner. Tersini yapan uygulamalar —
 * "düğmeyi gizledik, yeter" — en sık görülen yetki açığıdır.
 */

type AdminUser = {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  bannedAt: string | null;
  banReason: string | null;
};

type AdminPost = {
  id: string;
  type: string;
  caption: string | null;
  visibility: string;
  createdAt: string;
  username: string | null;
  bannedAt: string | null;
};

type Sekme = 'users' | 'posts';

export function AdminScreen({ onClose }: { onClose: () => void }) {
  const [sekme, setSekme] = useState<Sekme>('users');
  const [stats, setStats] = useState<{ totalUsers: number; bannedUsers: number; totalPosts: number } | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [postlar, setPostlar] = useState<AdminPost[]>([]);
  const [arama, setArama] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState('');

  /** Ban gerekçesi sorulan kullanıcı. `null` = kapalı. */
  const [banHedefi, setBanHedefi] = useState<AdminUser | null>(null);
  const [banSebebi, setBanSebebi] = useState('');
  const [islemde, setIslemde] = useState(false);

  const yukle = useCallback(async () => {
    setHata('');
    try {
      const [s, u, p] = await Promise.all([
        apiFetch<{ totalUsers: number; bannedUsers: number; totalPosts: number }>('/admin/stats'),
        apiFetch<{ users: AdminUser[] }>(`/admin/users?q=${encodeURIComponent(arama)}`),
        apiFetch<{ posts: AdminPost[] }>('/admin/posts'),
      ]);
      setStats(s);
      setUsers(u.users);
      setPostlar(p.posts);
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Panel yüklenemedi.');
    } finally {
      setYukleniyor(false);
    }
  }, [arama]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  async function banla() {
    if (banHedefi === null) return;
    /*
      ⚠️ Sebep istemcide de kontrol ediliyor ama SUNUCU da kontrol ediyor.
      İstemci kontrolü kullanıcıya hızlı geri bildirim için; sunucuyu
      doğrudan çağıran biri için hiçbir güvence değil.
    */
    if (banSebebi.trim().length < 3) {
      Alert.alert('Eksik', 'Ban sebebi yazmalısın.');
      return;
    }

    setIslemde(true);
    try {
      await apiFetch(`/admin/users/${banHedefi.id}/ban`, {
        method: 'POST',
        body: JSON.stringify({ reason: banSebebi.trim() }),
      });
      setBanHedefi(null);
      setBanSebebi('');
      await yukle();
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Banlanamadı.');
    } finally {
      setIslemde(false);
    }
  }

  async function baniKaldir(u: AdminUser) {
    try {
      await apiFetch(`/admin/users/${u.id}/unban`, { method: 'POST' });
      await yukle();
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Ban kaldırılamadı.');
    }
  }

  function gonderiSil(p: AdminPost) {
    /*
      ⚠️ ONAY ŞART VE GERİ ALINAMAZ OLDUĞU SÖYLENİYOR. Silme kalıcı;
      yanlış satıra dokunmak kolay ve listede satırlar birbirine benziyor.
    */
    Alert.alert(
      'Gönderiyi sil',
      `@${p.username ?? '?'} adlı kullanıcının gönderisi kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch(`/admin/posts/${p.id}`, { method: 'DELETE' });
              await yukle();
            } catch (err) {
              Alert.alert('Hata', err instanceof Error ? err.message : 'Silinemedi.');
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <X size={24} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={18} color={colors.accent} />
          <Text style={styles.title}>Yönetim</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {stats !== null && (
        <View style={styles.statsRow}>
          <Kutu etiket="Kullanıcı" deger={stats.totalUsers} />
          <Kutu etiket="Banlı" deger={stats.bannedUsers} vurgu />
          <Kutu etiket="Gönderi" deger={stats.totalPosts} />
        </View>
      )}

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, sekme === 'users' && styles.tabActive]}
          onPress={() => setSekme('users')}
        >
          <Text style={[styles.tabText, sekme === 'users' && styles.tabTextActive]}>Kullanıcılar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, sekme === 'posts' && styles.tabActive]}
          onPress={() => setSekme('posts')}
        >
          <Text style={[styles.tabText, sekme === 'posts' && styles.tabTextActive]}>Gönderiler</Text>
        </TouchableOpacity>
      </View>

      {hata !== '' && <Text style={styles.error}>{hata}</Text>}

      {yukleniyor ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : sekme === 'users' ? (
        <>
          <View style={styles.searchRow}>
            <Search size={16} color={colors.inkMuted} />
            <TextInput
              style={styles.searchInput}
              value={arama}
              onChangeText={setArama}
              placeholder="Kullanıcı adı, e-posta, isim…"
              placeholderTextColor={colors.inkMuted}
              autoCapitalize="none"
            />
          </View>

          <FlatList
            data={users}
            keyExtractor={(u) => u.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.rowTitle}>@{item.username}</Text>
                    {item.role === 'admin' && (
                      <View style={styles.rozet}>
                        <Text style={styles.rozetText}>yönetici</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.rowSub}>
                    {item.firstName} {item.lastName} · {item.email}
                  </Text>
                  {item.bannedAt !== null && (
                    <Text style={styles.banli}>Banlı — {item.banReason ?? 'sebep yok'}</Text>
                  )}
                </View>

                {/*
                  ⚠️ Yönetici satırında hiç düğme yok. Sunucu zaten
                  reddediyor; düğmeyi çizip 400 aldırmak, kullanıcıya
                  yapılabilir bir şey varmış gibi göstermek olurdu.
                */}
                {item.role !== 'admin' &&
                  (item.bannedAt === null ? (
                    <TouchableOpacity style={styles.banBtn} onPress={() => setBanHedefi(item)}>
                      <Ban size={16} color={colors.loss} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={styles.unbanBtn} onPress={() => void baniKaldir(item)}>
                      <Text style={styles.unbanText}>Kaldır</Text>
                    </TouchableOpacity>
                  ))}
              </View>
            )}
            ListEmptyComponent={<Text style={styles.bos}>Kullanıcı bulunamadı.</Text>}
          />
        </>
      ) : (
        <FlatList
          data={postlar}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>@{item.username ?? 'silinmiş kullanıcı'}</Text>
                <Text style={styles.rowSub} numberOfLines={2}>
                  {item.caption?.trim() !== '' && item.caption !== null
                    ? item.caption
                    : '(açıklama yok)'}
                </Text>
                <Text style={styles.meta}>
                  {item.type} · {item.visibility} ·{' '}
                  {new Intl.DateTimeFormat('tr-TR', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(item.createdAt))}
                </Text>
              </View>
              <TouchableOpacity style={styles.banBtn} onPress={() => gonderiSil(item)}>
                <Trash2 size={16} color={colors.loss} />
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.bos}>Gönderi yok.</Text>}
        />
      )}

      <Modal visible={banHedefi !== null} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>@{banHedefi?.username} banlanacak</Text>
            <Text style={styles.cardSub}>
              Sebep kullanıcıya gösterilir. Sebepsiz ban, itiraz edilemeyen bir bandır.
            </Text>
            <TextInput
              style={styles.reasonInput}
              value={banSebebi}
              onChangeText={setBanSebebi}
              placeholder="Ban sebebi"
              placeholderTextColor={colors.inkMuted}
              multiline
              maxLength={280}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.cardBtn, { backgroundColor: colors.surfacePressed }]}
                onPress={() => {
                  setBanHedefi(null);
                  setBanSebebi('');
                }}
              >
                <Text style={[styles.cardBtnText, { color: colors.ink }]}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cardBtn, { backgroundColor: colors.loss }]}
                onPress={() => void banla()}
                disabled={islemde}
              >
                <Text style={styles.cardBtnText}>{islemde ? 'Banlanıyor…' : 'Banla'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Kutu({ etiket, deger, vurgu }: { etiket: string; deger: number; vurgu?: boolean }) {
  return (
    <View style={styles.kutu}>
      <Text style={[styles.kutuDeger, vurgu === true && deger > 0 && { color: colors.loss }]}>
        {deger}
      </Text>
      <Text style={styles.kutuEtiket}>{etiket}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  statsRow: { flexDirection: 'row', gap: 10, padding: 16 },
  kutu: {
    flex: 1,
    backgroundColor: colors.surfacePressed,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  kutuDeger: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink },
  kutuEtiket: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: colors.surfacePressed },
  tabActive: { backgroundColor: colors.accent },
  tabText: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkMuted },
  tabTextActive: { color: '#FFF' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.surfacePressed,
    borderRadius: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10, color: colors.ink, fontFamily: fonts.regular },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  rowSub: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  meta: { fontFamily: fonts.medium, fontSize: 11, color: colors.inkMuted, marginTop: 4 },
  banli: { fontFamily: fonts.medium, fontSize: 12, color: colors.loss, marginTop: 4 },
  rozet: { backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  rozetText: { fontFamily: fonts.bold, fontSize: 10, color: '#FFF' },
  banBtn: { padding: 10, borderRadius: 10, backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  unbanBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.surfacePressed },
  unbanText: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bos: { fontFamily: fonts.medium, color: colors.inkMuted, textAlign: 'center', marginTop: 32 },
  error: { fontFamily: fonts.medium, color: colors.loss, textAlign: 'center', marginBottom: 8 },
  backdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'center',
    padding: 24,
  },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border },
  cardTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, marginBottom: 6 },
  cardSub: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkMuted, marginBottom: 14 },
  reasonInput: {
    backgroundColor: colors.surfacePressed,
    borderRadius: 12,
    padding: 14,
    color: colors.ink,
    fontFamily: fonts.regular,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  cardBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cardBtnText: { fontFamily: fonts.bold, fontSize: 14, color: '#FFF' },
});
