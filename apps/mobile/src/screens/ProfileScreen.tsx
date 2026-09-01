import { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, Pressable, View, Modal, SafeAreaView, Platform, StatusBar as RNStatusBar, Image } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { apiFetch } from '../api/client';
import { colors, fonts } from '../theme';
import { TrendingUp, TrendingDown, Trophy, Award, Users, Lock, Settings, ChevronRight, X, User, Check } from 'lucide-react-native';
import { PostCard } from '../components/PostCard';
import { createAvatar } from '@dicebear/core';
import { shapes } from '@dicebear/collection';
import { SvgXml } from 'react-native-svg';
import { formatPercent } from '../lib/format';

const localAvatars: Record<string, any> = {
  meerkat: require('../../assets/avatars/meerkat.png'),
  chicken: require('../../assets/avatars/chicken.png'),
  bear: require('../../assets/avatars/bear.png'),
  rabbit: require('../../assets/avatars/rabbit.png'),
  cat: require('../../assets/avatars/cat.png'),
  panda: require('../../assets/avatars/panda.png'),
};

const ASSET_COLORS = ['#f59e0b', '#cbd5e1', '#475569', '#3b82f6', '#10b981', '#8b5cf6'];
const getAssetColor = (index: number) => ASSET_COLORS[index % ASSET_COLORS.length];

type ProfileSlice = { symbol: string; name: string; sharePercent: string | null; profitPercent: string | null; };
type PublicProfile = {
  username: string; firstName: string; lastName: string; avatarSeed?: string | null; avatarStyle?: string | null;
  isSelf: boolean; isFriend: boolean; isPublic: boolean; allocationVisibility?: string; visible: boolean;
  twrPercent: string | null; rank: number | null; totalParticipants: number | null;
  achievementsCount?: number; allocation: ProfileSlice[]; pending: 'outgoing' | 'incoming' | null;
  friendCount: number; pendingRequests: number;
};

export function ProfileScreen({ username, onClose, onOpenFriends, onLogout, onSelectUser, currentUserId }: { username: string; onClose?: () => void; onOpenFriends?: () => void; onLogout?: () => void; onSelectUser?: (username: string) => void; currentUserId?: string; }) {
  
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [confirmAvatarSeed, setConfirmAvatarSeed] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(true);
    const [editAlloc, setEditAlloc] = useState('private');
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => { setToastMessage({ text, type }); setTimeout(() => setToastMessage(null), 3000); };

  
  const handleUpdateAvatar = async (seed: string, isLocal: boolean) => {
    setAvatarSaving(seed);
    try {
      await apiFetch('/users/me/avatar', {
        method: 'PATCH',
        body: JSON.stringify({
          avatarStyle: isLocal ? 'local' : 'shapes',
          avatarSeed: seed,
        }),
      });
      await load();
      showToast('Avatar güncellendi');
    } catch (err: any) {
      showToast(err.message || 'Avatar güncellenemedi', 'error');
    } finally {
      setAvatarSaving(null);
    }
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch<{ profile: PublicProfile }>(`/users/${username}`);
      setProfile(res.profile); 
      setEditIsPublic(res.profile.isPublic);
        setEditAlloc(res.profile.allocationVisibility || 'private'); 
      setEditFirstName(res.profile.firstName); 
      setEditLastName(res.profile.lastName);

      if (res.profile.visible) {
        const postsUrl = res.profile.isSelf ? '/posts/me' : `/posts/user/${res.profile.username}`;
        const postsRes = await apiFetch<{ posts: any[] }>(postsUrl);
        setPosts(postsRes.posts || []);
      } else {
        setPosts([]);
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Profil yüklenemedi.'); } finally { setLoading(false); }
  }, [username]);

  useEffect(() => { 
    void load(); 
    const sub = DeviceEventEmitter.addListener('refreshProfile', () => { void load(); });
    return () => sub.remove();
  }, [load]);

  const handleSaveSettings = async () => {
    setSavingSettings(true); setSettingsError('');
    try {
      await apiFetch('/users/me', { method: 'PATCH', body: JSON.stringify({ firstName: editFirstName, lastName: editLastName, password: editPassword ? editPassword : undefined, allocationVisibility: editAlloc }) });
      if (editIsPublic !== profile?.isPublic) { await apiFetch('/users/me/visibility', { method: 'PATCH', body: JSON.stringify({ isPublic: editIsPublic }) }); }
      await load(); setShowSettings(false); setEditPassword('');
    } catch (err) { setSettingsError(err instanceof Error ? err.message : 'Ayarlar kaydedilemedi.'); } finally { setSavingSettings(false); }
  };

  const handleFriendAction = async () => {
    if (!profile) return;
    try {
      if (profile.pending === null && !profile.isFriend) {
        await apiFetch('/friends/requests', { method: 'POST', body: JSON.stringify({ addressee: profile.username }) });
        setProfile({ ...profile, pending: 'outgoing' });
        showToast('Arkadaşlık isteği gönderildi');
      } else if (profile.pending === 'incoming') {
        await apiFetch(`/friends/by-username/${profile.username}/accept`, { method: 'POST' });
        showToast('Arkadaşlık isteği kabul edildi');
        load();
      }
    } catch (err: any) {
      showToast(err.message || 'Bir hata oluştu', 'error');
    }
  };

  const twr = profile?.twrPercent === null || profile?.twrPercent === undefined ? null : Number(profile.twrPercent);
  const isZero = twr !== null && Math.abs(twr) < 0.005;
  const rising = twr !== null && !isZero && twr > 0;
  const falling = twr !== null && !isZero && twr < 0;

  if (loading) return <View style={[{ flex: 1, backgroundColor: colors.surface }, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={colors.accent} /></View>;
  if (profile === null) return <View style={[{ flex: 1, backgroundColor: colors.surface }, { justifyContent: 'center', alignItems: 'center' }]}><Text style={{ color: colors.loss }}>{error ?? 'Profil bulunamadı.'}</Text></View>;

  const bgColors = [colors.surfaceRaised.replace('#',''), colors.surfacePressed.replace('#','')];
  const shapeColors = [colors.gain, colors.loss, colors.warn, colors.gold, colors.accent].map(c => c.replace('#', ''));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={colors.inkMuted} />}>
        {onClose !== undefined && (
          <TouchableOpacity onPress={onClose} hitSlop={12} style={{ position: 'absolute', top: Platform.OS === 'ios' ? 48 : 24, left: 16, zIndex: 10, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 }}>
            <X size={20} color="#FFF" />
          </TouchableOpacity>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, marginTop: 16 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <View style={[{ width: 64, height: 64, borderRadius: 32, overflow: 'hidden', backgroundColor: colors.surfacePressed, justifyContent: 'center', alignItems: 'center' }, profile.avatarSeed && { backgroundColor: 'transparent' }]}>
              {profile?.avatarStyle === 'local' && profile?.avatarSeed && localAvatars[profile.avatarSeed] ? (
                <Image source={localAvatars[profile.avatarSeed]} style={{width: '100%', height: '100%'}} resizeMode="contain" />
              ) : profile?.avatarSeed ? (
                <SvgXml xml={createAvatar(shapes, { seed: profile.avatarSeed, backgroundColor: bgColors, shape1Color: shapeColors, shape2Color: shapeColors, shape3Color: shapeColors }).toString()} width="100%" height="100%" />
              ) : (
                <Text style={{ fontFamily: fonts.bold, fontSize: 24, color: '#FFF' }}>{profile?.firstName.slice(0, 1).toLocaleUpperCase('tr')}{profile?.lastName.slice(0, 1).toLocaleUpperCase('tr')}</Text>
              )}
            </View>
            <View style={{ marginLeft: 16 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink }}>{profile.firstName} {profile.lastName}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted }}>@{profile.username}</Text>
            </View>
          </View>
          
          {profile.isSelf ? (
            <TouchableOpacity onPress={() => setShowSettings(true)} style={{ padding: 8, backgroundColor: colors.surfacePressed, borderRadius: 20 }}>
              <Settings size={20} color={colors.inkMuted} />
            </TouchableOpacity>
          ) : (
            <View>
              {profile.isFriend ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                  <Check size={16} color={colors.gain} style={{ marginRight: 6 }} />
                  <Text style={{ fontFamily: fonts.medium, color: colors.gain, fontSize: 13 }}>Arkadaş</Text>
                </View>
              ) : (
                <TouchableOpacity 
                  onPress={handleFriendAction}
                  disabled={profile.pending === 'outgoing'}
                  style={{ 
                    flexDirection: 'row', alignItems: 'center', 
                    backgroundColor: profile.pending === 'incoming' ? colors.accent : profile.pending === 'outgoing' ? colors.surfacePressed : 'transparent', 
                    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, 
                    borderWidth: 1, borderColor: profile.pending === 'outgoing' ? 'transparent' : colors.accent 
                  }}
                >
                  <User size={16} color={profile.pending === 'outgoing' ? colors.inkMuted : profile.pending === 'incoming' ? '#FFF' : colors.accent} style={{ marginRight: 6 }} />
                  <Text style={{ fontFamily: fonts.bold, color: profile.pending === 'outgoing' ? colors.inkMuted : profile.pending === 'incoming' ? '#FFF' : colors.accent, fontSize: 13 }}>
                    {profile.pending === 'incoming' ? 'Kabul Et' : profile.pending === 'outgoing' ? 'Bekliyor' : 'Arkadaş Ekle'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {!profile.visible ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 40, paddingVertical: 40, backgroundColor: colors.surfaceRaised, borderRadius: 16 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfacePressed, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Lock size={32} color={colors.inkMuted} />
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.ink, marginBottom: 8 }}>Gizli Profil</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted, textAlign: 'center', paddingHorizontal: 32, lineHeight: 22 }}>
              Bu profil gizlidir. Bilgilerini ve paylaşımlarını görmek için arkadaş olarak ekleyin.
            </Text>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
              {/* TWR */}
              <View style={{ flex: 1, minWidth: '45%', backgroundColor: colors.surfaceRaised, borderRadius: 12, padding: 16 }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: rising ? 'rgba(16, 185, 129, 0.1)' : falling ? 'rgba(239, 68, 68, 0.1)' : 'rgba(148,163,184,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                  {rising ? <TrendingUp size={20} color={colors.gain} /> : falling ? <TrendingDown size={20} color={colors.loss} /> : <TrendingUp size={20} color={colors.inkMuted} />}
                </View>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.inkMuted, marginBottom: 4 }}>HAFTALIK TWR</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: rising ? colors.gain : falling ? colors.loss : colors.ink }}>
                  {twr === null ? '—' : formatPercent(twr, true)}
                </Text>
              </View>
              {/* League */}
              <View style={{ flex: 1, minWidth: '45%', backgroundColor: colors.surfaceRaised, borderRadius: 12, padding: 16 }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(59, 130, 246, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                  <Trophy size={20} color={colors.accent} />
                </View>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.inkMuted, marginBottom: 4 }}>LİG SIRASI</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink }}>
                  {profile.rank === null ? '—' : `#${profile.rank}`}
                  {profile.totalParticipants ? <Text style={{ fontSize: 12, color: colors.inkMuted }}> / {profile.totalParticipants}</Text> : null}
                </Text>
              </View>
              {/* Badges */}
              <View style={{ flex: 1, minWidth: '45%', backgroundColor: colors.surfaceRaised, borderRadius: 12, padding: 16 }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(245, 158, 11, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                  <Award size={20} color={colors.bronze} />
                </View>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.inkMuted, marginBottom: 4 }}>ROZET</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink }}>{profile.achievementsCount} Adet</Text>
              </View>
              {/* Friends */}
              <View style={{ flex: 1, minWidth: '45%', backgroundColor: colors.surfaceRaised, borderRadius: 12, padding: 16 }}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(139, 92, 246, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                  <Users size={20} color="#8B5CF6" />
                </View>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.inkMuted, marginBottom: 4 }}>ARKADAŞ</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink }}>{profile.friendCount || 0}</Text>
              </View>
            </View>

            {/* Asset Allocation (Only if Self) */}
            {profile.isSelf && profile.allocation && profile.allocation.length > 0 && (
              <View style={{ backgroundColor: colors.surfaceRaised, borderRadius: 16, padding: 16, marginBottom: 24 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink, marginBottom: 16 }}>Varlık Dağılımı</Text>
                <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 16 }}>
                  {profile.allocation.map((item, i) => (
                    <View key={i} style={{ width: `${item.sharePercent}%` as any, backgroundColor: [colors.accent, colors.gain, colors.gold, colors.warn, colors.bronze][i % 5], opacity: 1 - (i * 0.1) }} />
                  ))}
                </View>
                {profile.allocation.map((item, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: i === profile.allocation.length - 1 ? 0 : 1, borderBottomColor: colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: [colors.accent, colors.gain, colors.gold, colors.warn, colors.bronze][i % 5], marginRight: 12 }} />
                      <Text style={{ fontFamily: fonts.medium, color: colors.ink }}>{item.name}</Text>
                    </View>
                    <Text style={{ fontFamily: fonts.bold, color: colors.ink }}>{item.sharePercent}%</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Posts */}
            <View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink, marginBottom: 16 }}>Paylaşımlar</Text>
              {posts.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 32, backgroundColor: colors.surfaceRaised, borderRadius: 16 }}>
                  <Text style={{ fontFamily: fonts.medium, color: colors.inkMuted }}>Henüz paylaşım yok</Text>
                </View>
              ) : (
                <View style={{ gap: 16 }}>
                  {posts.map(post => (
                    <PostCard key={post.id} post={post} user={profile} isPreview={false} currentUserId={currentUserId} onPressUser={(u) => { if (u !== profile.username && onSelectUser) onSelectUser(u); }} />
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Settings Modal (kept simple for brevity, functionality preserved) */}
      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.ink }}>Ayarlar</Text>
            <TouchableOpacity onPress={() => setShowSettings(false)} style={{ padding: 8 }}><X size={24} color={colors.ink} /></TouchableOpacity>
          </View>
          <ScrollView style={{ padding: 16 }}>

            <Text style={{ fontFamily: fonts.bold, color: colors.ink, marginBottom: 12, marginTop: 8 }}>Avatar Seçimi</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24, flexDirection: 'row' }}>
              {Object.keys(localAvatars).map(key => (
                <TouchableOpacity 
                  key={key} 
                  onPress={() => handleUpdateAvatar(key, true)}
                  disabled={avatarSaving !== null}
                  style={{ 
                    width: 60, height: 60, borderRadius: 30, marginRight: 12, 
                    backgroundColor: profile?.avatarSeed === key ? colors.accent : colors.surfaceRaised,
                    borderWidth: profile?.avatarSeed === key ? 2 : 0,
                    borderColor: colors.accent,
                    justifyContent: 'center', alignItems: 'center' 
                  }}
                >
                  <Image source={localAvatars[key]} style={{ width: '80%', height: '80%' }} resizeMode="contain" />
                  {avatarSaving === key && <ActivityIndicator color="#FFF" style={{ position: 'absolute' }} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            <Text style={{ fontFamily: fonts.bold, color: colors.ink, marginBottom: 12 }}>Kişisel Bilgiler</Text>

            <Text style={{ fontFamily: fonts.medium, color: colors.ink, marginBottom: 8 }}>Ad</Text>
            <TextInput style={{ backgroundColor: colors.surfaceRaised, padding: 12, borderRadius: 8, color: colors.ink, fontFamily: fonts.medium, marginBottom: 16 }} value={editFirstName} onChangeText={setEditFirstName} />
            <Text style={{ fontFamily: fonts.medium, color: colors.ink, marginBottom: 8 }}>Soyad</Text>
            <TextInput style={{ backgroundColor: colors.surfaceRaised, padding: 12, borderRadius: 8, color: colors.ink, fontFamily: fonts.medium, marginBottom: 16 }} value={editLastName} onChangeText={setEditLastName} />

            <Text style={{ fontFamily: fonts.medium, color: colors.ink, marginBottom: 8, marginTop: 16 }}>Yeni Şifre</Text>
            <TextInput 
              style={{ backgroundColor: colors.surfaceRaised, padding: 12, borderRadius: 8, color: colors.ink, fontFamily: fonts.medium, marginBottom: 16 }} 
              value={editPassword} 
              onChangeText={setEditPassword} 
              placeholder="Değiştirmek istemiyorsanız boş bırakın"
              placeholderTextColor={colors.inkMuted}
              secureTextEntry
            />

            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 32 }}>
              <View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink }}>Herkese Açık Profil</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.inkMuted, marginTop: 4 }}>Kapalı olduğunda sadece arkadaşların görebilir.</Text>
              </View>
              <Switch value={editIsPublic} onValueChange={setEditIsPublic} trackColor={{ false: colors.surfacePressed, true: colors.accent }} />
              </View>

              <View style={{ marginTop: 24, marginBottom: 32 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink }}>Varlık Dağılımı (Portföy) Kimlere Görünsün?</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.inkMuted, marginTop: 4, marginBottom: 12 }}>Cüzdanındaki hisse ve coin dağılımını (yüzdelerini) kimlerin görebileceğini seç.</Text>
                <View style={{ flexDirection: 'row', backgroundColor: colors.surfacePressed, borderRadius: 8, padding: 4 }}>
                  <TouchableOpacity onPress={() => setEditAlloc('private')} style={{ flex: 1, paddingVertical: 10, borderRadius: 6, backgroundColor: editAlloc === 'private' ? '#FFF' : 'transparent', alignItems: 'center', shadowColor: editAlloc === 'private' ? '#000' : 'transparent', shadowOpacity: 0.1, shadowRadius: 2, elevation: editAlloc === 'private' ? 2 : 0 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: editAlloc === 'private' ? '#000' : colors.inkMuted }}>Hiç Kimse</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditAlloc('friends')} style={{ flex: 1, paddingVertical: 10, borderRadius: 6, backgroundColor: editAlloc === 'friends' ? '#FFF' : 'transparent', alignItems: 'center', shadowColor: editAlloc === 'friends' ? '#000' : 'transparent', shadowOpacity: 0.1, shadowRadius: 2, elevation: editAlloc === 'friends' ? 2 : 0 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: editAlloc === 'friends' ? '#000' : colors.inkMuted }}>Arkadaşlar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditAlloc('public')} style={{ flex: 1, paddingVertical: 10, borderRadius: 6, backgroundColor: editAlloc === 'public' ? '#FFF' : 'transparent', alignItems: 'center', shadowColor: editAlloc === 'public' ? '#000' : 'transparent', shadowOpacity: 0.1, shadowRadius: 2, elevation: editAlloc === 'public' ? 2 : 0 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: editAlloc === 'public' ? '#000' : colors.inkMuted }}>Herkes</Text>
                  </TouchableOpacity>
                </View>
              </View>


            {settingsError ? <Text style={{ color: colors.loss, marginBottom: 16, textAlign: 'center' }}>{settingsError}</Text> : null}
            <TouchableOpacity onPress={handleSaveSettings} disabled={savingSettings} style={{ backgroundColor: colors.accent, padding: 16, borderRadius: 12, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, color: '#FFF', fontSize: 16 }}>{savingSettings ? 'Kaydediliyor...' : 'Kaydet'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onLogout} style={{ marginTop: 24, padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.loss, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
              <Text style={{ fontFamily: fonts.bold, color: colors.loss, fontSize: 16 }}>Çıkış Yap</Text>
            </TouchableOpacity>
            <View style={{ height: 40 }} />

          </ScrollView>
        </SafeAreaView>
      </Modal>

      {toastMessage && (
        <View style={{ position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: toastMessage.type === 'error' ? colors.loss : colors.gain, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 }}>
          <Text style={{ fontFamily: fonts.bold, color: '#FFF' }}>{toastMessage.text}</Text>
        </View>
      )}
    </View>
  );

}
