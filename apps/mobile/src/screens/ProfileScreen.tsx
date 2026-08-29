import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, Pressable, View, Modal, SafeAreaView, Platform, StatusBar as RNStatusBar, Image } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { apiFetch } from '../api/client';
import { colors, fonts } from '../theme';
import { TrendingUp, TrendingDown, Trophy, Award, Users, Lock, Settings, ChevronRight, X, User, Check } from 'lucide-react-native';
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
  isSelf: boolean; isFriend: boolean; isPublic: boolean; visible: boolean;
  twrPercent: string | null; rank: number | null; totalParticipants: number | null;
  achievementsCount?: number; allocation: ProfileSlice[]; pending: 'outgoing' | 'incoming' | null;
  friendCount: number; pendingRequests: number;
};

export function ProfileScreen({ username, onClose, onOpenFriends, onLogout }: { username: string; onClose?: () => void; onOpenFriends?: () => void; onLogout?: () => void; }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
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
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => { setToastMessage({ text, type }); setTimeout(() => setToastMessage(null), 3000); };

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch<{ profile: PublicProfile }>(`/users/${username}`);
      setProfile(res.profile); setEditIsPublic(res.profile.isPublic); setEditFirstName(res.profile.firstName); setEditLastName(res.profile.lastName);
    } catch (err) { setError(err instanceof Error ? err.message : 'Profil yüklenemedi.'); } finally { setLoading(false); }
  }, [username]);

  useEffect(() => { void load(); }, [load]);

  const handleSaveSettings = async () => {
    setSavingSettings(true); setSettingsError('');
    try {
      await apiFetch('/users/me', { method: 'PATCH', body: JSON.stringify({ firstName: editFirstName, lastName: editLastName, password: editPassword ? editPassword : undefined }) });
      if (editIsPublic !== profile?.isPublic) { await apiFetch('/users/me/visibility', { method: 'PATCH', body: JSON.stringify({ isPublic: editIsPublic }) }); }
      await load(); setShowSettings(false); setEditPassword('');
    } catch (err) { setSettingsError(err instanceof Error ? err.message : 'Ayarlar kaydedilemedi.'); } finally { setSavingSettings(false); }
  };

  const twr = profile?.twrPercent === null || profile?.twrPercent === undefined ? null : Number(profile.twrPercent);
  const isZero = twr !== null && Math.abs(twr) < 0.005;
  const rising = twr !== null && !isZero && twr > 0;
  const falling = twr !== null && !isZero && twr < 0;

  if (loading) return <View style={[styles.container, styles.center]}><ActivityIndicator color={colors.accent} /></View>;
  if (profile === null) return <View style={[styles.container, styles.center]}><Text style={styles.error}>{error ?? 'Profil bulunamadı.'}</Text><TouchableOpacity style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>Tekrar dene</Text></TouchableOpacity></View>;

  const bgColors = [colors.surfaceRaised.replace('#',''), colors.surfacePressed.replace('#','')];
  const shapeColors = [colors.gain, colors.loss, colors.warn, colors.gold, colors.accent].map(c => c.replace('#', ''));

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={colors.inkMuted} />}>
        {onClose !== undefined && (
          <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeButton}><X size={24} color={colors.ink} /></TouchableOpacity>
        )}

        <View style={styles.identityRow}>
          <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
            <View style={[styles.avatar, profile.avatarSeed && { backgroundColor: 'transparent' }]}>
              {profile?.avatarStyle === 'local' && profile?.avatarSeed && localAvatars[profile.avatarSeed] ? (
                <Image source={localAvatars[profile.avatarSeed]} style={{width: '100%', height: '100%'}} resizeMode="contain" />
              ) : profile?.avatarSeed ? (
                <SvgXml xml={createAvatar(shapes, { seed: profile.avatarSeed, backgroundColor: bgColors, shape1Color: shapeColors, shape2Color: shapeColors, shape3Color: shapeColors }).toString()} width="100%" height="100%" />
              ) : (
                <Text style={styles.avatarText}>{profile?.firstName.slice(0, 1).toLocaleUpperCase('tr')}{profile?.lastName.slice(0, 1).toLocaleUpperCase('tr')}</Text>
              )}
            </View>
            <View style={styles.identityText}>
              <Text style={styles.name}>{profile.firstName} {profile.lastName}</Text>
              <Text style={styles.username}>@{profile.username}</Text>
            </View>
          </View>
          {profile.isSelf && (
            <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.settingsIcon}>
              <Settings size={22} color={colors.inkMuted} />
            </TouchableOpacity>
          )}
        </View>

        {profile.visible && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Haftalık TWR</Text>
                <Text style={styles.cardSubtitle}>Zaman Ağırlıklı Getiri</Text>
              </View>
              <View style={[styles.badge, rising ? styles.badgeUp : falling ? styles.badgeDown : styles.badgeNeutral]}>
                {rising ? <TrendingUp size={14} color={colors.gain} /> : falling ? <TrendingDown size={14} color={colors.loss} /> : <TrendingUp size={14} color={colors.inkMuted} />}
                <Text style={[styles.badgeText, rising ? {color: colors.gain} : falling ? {color: colors.loss} : {color: colors.inkMuted}]}>
                  {twr === null ? '—' : formatPercent(twr, true)}
                </Text>
              </View>
            </View>
            <View style={{ height: 100, marginTop: 24, marginHorizontal: -12 }}>
               <Svg width="100%" height="100" viewBox="0 0 100 50" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={rising ? colors.gain : falling ? colors.loss : colors.inkMuted} stopOpacity="0.25" />
                    <Stop offset="1" stopColor={rising ? colors.gain : falling ? colors.loss : colors.inkMuted} stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Path d={rising ? "M0,45 Q15,35 25,35 T50,20 T65,40 L75,10 L85,40 L95,15 L100,15 L100,50 L0,50 Z" : falling ? "M0,5 Q15,15 25,15 T50,30 T65,10 L75,40 L85,10 L95,35 L100,35 L100,50 L0,50 Z" : "M0,45 L100,45 L100,50 L0,50 Z"} fill="url(#grad)" />
                <Path d={rising ? "M0,45 Q15,35 25,35 T50,20 T65,40 L75,10 L85,40 L95,15 L100,15" : falling ? "M0,5 Q15,15 25,15 T50,30 T65,10 L75,40 L85,10 L95,35 L100,35" : "M0,45 L100,45"} fill="none" stroke={rising ? colors.gain : falling ? colors.loss : colors.inkMuted} strokeWidth="2.5" />
                <Circle cx="95" cy={rising ? "15" : falling ? "35" : "45"} r="3" fill={rising ? colors.gain : falling ? colors.loss : colors.inkMuted} />
                <Circle cx="95" cy={rising ? "15" : falling ? "35" : "45"} r="6" fill="none" stroke={rising ? colors.gain : falling ? colors.loss : colors.inkMuted} strokeWidth="1" strokeOpacity="0.4" />
              </Svg>
            </View>
          </View>
        )}

        {profile.visible && (
          <View style={styles.metricsRow}>
            <View style={[styles.card, styles.halfCard]}>
              <View style={[styles.iconBox, {backgroundColor: 'rgba(245,158,11,0.1)'}]}>
                <Trophy size={20} color={colors.warn} />
              </View>
              <Text style={styles.metricLabel}>LİG SIRASI</Text>
              <View style={{flexDirection: 'row', alignItems: 'baseline'}}>
                <Text style={styles.metricValue}>{profile.rank === null ? '—' : profile.rank}</Text>
                {profile.rank !== null && <Text style={styles.metricSuffix}>. sıra</Text>}
              </View>
            </View>

            <TouchableOpacity style={[styles.card, styles.halfCard]} onPress={() => setShowAchievements(true)}>
              <View style={[styles.iconBox, {backgroundColor: 'rgba(148,163,184,0.1)'}]}>
                <Award size={20} color={colors.inkMuted} />
              </View>
              <Text style={styles.metricLabel}>ROZETLER</Text>
              <Text style={styles.metricValue}>{profile.achievementsCount || 0}</Text>
            </TouchableOpacity>
          </View>
        )}

        {profile.visible && profile.isSelf && onOpenFriends !== undefined && (
          <TouchableOpacity style={[styles.card, styles.friendsCard]} onPress={onOpenFriends}>
            <View style={styles.friendsLeft}>
              <View style={[styles.iconBox, {backgroundColor: 'rgba(148,163,184,0.1)', marginRight: 12, marginBottom: 0}]}>
                <Users size={20} color={colors.inkMuted} />
              </View>
              <View>
                <Text style={styles.metricLabel}>ARKADAŞLAR</Text>
                <Text style={styles.metricValueSm}>{profile.friendCount}</Text>
              </View>
            </View>
            <View style={styles.avatarStack}>
              <View style={[styles.stackAvatar, {zIndex: 3}]}><Image source={localAvatars.panda} style={styles.stackImg}/></View>
              <View style={[styles.stackAvatar, {zIndex: 2, marginLeft: -12}]}><Image source={localAvatars.meerkat} style={styles.stackImg}/></View>
              <View style={[styles.stackAvatar, {zIndex: 1, marginLeft: -12}]}><Image source={localAvatars.cat} style={styles.stackImg}/></View>
              <View style={[styles.stackAvatar, {zIndex: 0, marginLeft: -12, backgroundColor: colors.surfacePressed}]}>
                <Text style={styles.stackText}>+3</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {!profile.visible && (
          <View style={[styles.card, {alignItems: 'center', paddingVertical: 40}]}>
            <Lock size={32} color={colors.inkMuted} style={{ marginBottom: 16 }} />
            <Text style={styles.lockedTitle}>Bu profil gizli</Text>
            <Text style={styles.lockedText}>
              {profile.firstName} portföyünü yalnızca arkadaşlarına gösteriyor.
            </Text>
          </View>
        )}

        {profile.visible && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Varlık Dağılımı</Text>
            <View style={[styles.card, {paddingBottom: 24}]}>
              <View style={styles.segmentsBar}>
                {profile.allocation.length === 0 ? (
                  <View style={[styles.segment, {width: '100%', backgroundColor: colors.surfacePressed}]} />
                ) : (
                  profile.allocation.map((s, i) => (
                    <View key={s.symbol} style={[styles.segment, {width: `${s.sharePercent || 0}%` as any, backgroundColor: getAssetColor(i)}]} />
                  ))
                )}
              </View>
              <View style={styles.legendWrap}>
                {profile.allocation.length === 0 ? (
                   <Text style={styles.emptyText}>Henüz bir varlığı yok — portföyü tamamen nakitte.</Text>
                ) : (
                  profile.allocation.map((s, i) => (
                    <View key={s.symbol} style={styles.legendItem}>
                      <View style={[styles.legendDot, {backgroundColor: getAssetColor(i)}]} />
                      <Text style={styles.legendText}>{s.name || s.symbol} (%{Number(s.sharePercent || 0).toFixed(0)})</Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Settings Modal */}
      <Modal visible={showSettings} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setShowSettings(false); setSettingsError(''); }} hitSlop={12}>
              <Text style={styles.modalCancelText}>İptal</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Ayarlar</Text>
            <TouchableOpacity onPress={handleSaveSettings} hitSlop={12}>
              {savingSettings ? <ActivityIndicator size="small" color={colors.accent} /> : <Text style={[styles.modalCancelText, { color: colors.accent, fontFamily: fonts.semibold }]}>Kaydet</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {settingsError !== '' && <Text style={styles.error}>{settingsError}</Text>}
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionLabel}>PROFİL BİLGİLERİ</Text>
              <TextInput style={styles.input} value={editFirstName} onChangeText={setEditFirstName} placeholder="Ad" placeholderTextColor={colors.inkFaint} />
              <TextInput style={styles.input} value={editLastName} onChangeText={setEditLastName} placeholder="Soyad" placeholderTextColor={colors.inkFaint} />
            </View>
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionLabel}>ŞİFRE DEĞİŞTİR</Text>
              <TextInput style={styles.input} value={editPassword} onChangeText={setEditPassword} placeholder="Yeni Şifre (Değiştirmek istemiyorsanız boş bırakın)" placeholderTextColor={colors.inkFaint} secureTextEntry />
            </View>
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionLabel}>AVATAR</Text>
              <TouchableOpacity style={styles.avatarChangeRow} onPress={() => setShowAvatarPicker(true)}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <User size={20} color={colors.inkMuted} style={{ marginRight: 12 }} />
                  <Text style={styles.avatarChangeText}>Avatar Seç</Text>
                </View>
                <ChevronRight size={20} color={colors.inkMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSection}>
              <Text style={styles.modalSectionLabel}>GİZLİLİK</Text>
              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Profilim herkese açık</Text>
                  <Text style={styles.settingHint}>Ligdeki herkes varlıklarını görebilir.</Text>
                </View>
                <Switch value={editIsPublic} onValueChange={setEditIsPublic} trackColor={{ false: colors.surfacePressed, true: colors.gain }} thumbColor={colors.ink} />
              </View>
            </View>
            {onLogout !== undefined && (
              <View style={styles.modalSection}>
                <TouchableOpacity style={styles.logoutButton} onPress={() => setShowLogoutConfirm(true)}>
                  <Text style={styles.logoutButtonText}>Hesaptan Çıkış Yap</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Avatar Picker Modal */}
      <Modal visible={showAvatarPicker} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAvatarPicker(false)} hitSlop={12}>
              <Text style={styles.modalCancelText}>Kapat</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Avatar Seç</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, alignItems: 'center' }}>
            <View style={styles.miniProfileCard}>
              <View style={styles.miniProfileAvatar}>
                {profile?.avatarStyle === 'local' && profile?.avatarSeed && localAvatars[profile.avatarSeed] ? (
                  <Image source={localAvatars[profile.avatarSeed]} style={{width: '100%', height: '100%'}} resizeMode="contain" />
                ) : profile?.avatarSeed ? (
                  <SvgXml xml={createAvatar(shapes, { seed: profile.avatarSeed, backgroundColor: bgColors, shape1Color: shapeColors, shape2Color: shapeColors, shape3Color: shapeColors }).toString()} width="100%" height="100%" />
                ) : (
                  <Text style={styles.avatarText}>{profile?.firstName.slice(0,1)}{profile?.lastName.slice(0,1)}</Text>
                )}
              </View>
              <View>
                <Text style={styles.miniProfileName}>{profile?.firstName} {profile?.lastName}</Text>
                <Text style={styles.miniProfileUsername}>@{profile?.username}</Text>
                <Text style={styles.miniProfileRank}>Lig Sırası: {profile?.rank ?? '-'} • Rozetler: {profile?.achievementsCount ?? 0}</Text>
              </View>
            </View>
            
            <Text style={styles.avatarChoiceTitle}>Koleksiyon (Özel İkonlar)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
              {['meerkat', 'chicken', 'bear', 'rabbit', 'cat', 'panda'].map((seed) => {
                const isSelected = profile?.avatarSeed === seed;
                const isLoading = avatarSaving === seed;
                return (
                  <Pressable key={seed} onPress={() => { if (isSelected || avatarSaving) return; setConfirmAvatarSeed(seed); }} style={({ pressed }) => [ styles.avatarChoiceContainer, isSelected && styles.avatarChoiceSelected, pressed && { transform: [{ scale: 0.92 }] }, isLoading && { opacity: 0.6 } ]}>
                    <View style={styles.avatarChoiceInner}>
                      <Image source={localAvatars[seed]} style={{width: '100%', height: '100%'}} resizeMode="contain" />
                      {isLoading && <View style={styles.avatarChoiceLoading}><ActivityIndicator size="small" color={colors.accent} /></View>}
                    </View>
                    {isSelected && <View style={styles.avatarChoiceCheckmark}><Check size={12} color={colors.ink} /></View>}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          {toastMessage && (
            <View style={[styles.toastContainer, toastMessage.type === 'error' ? { backgroundColor: colors.loss } : { backgroundColor: colors.gain }]}>
              <Text style={styles.toastText}>{toastMessage.text}</Text>
            </View>
          )}
        </SafeAreaView>

        {/* Confirmation Modal */}
        <Modal visible={confirmAvatarSeed !== null} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Avatarı Değiştir</Text>
              <View style={{ alignItems: 'center', marginVertical: 16 }}>
                <View style={[styles.avatarChoiceInner, { width: 80, height: 80, borderRadius: 40 }]}>
                  {confirmAvatarSeed && localAvatars[confirmAvatarSeed] ? (
                    <Image source={localAvatars[confirmAvatarSeed]} style={{width: '100%', height: '100%'}} resizeMode="contain" />
                  ) : null}
                </View>
              </View>
              <Text style={[styles.confirmText, { textAlign: 'center' }]}>Profilinizde bu avatarı kullanmak istediğinize emin misiniz?</Text>
              <View style={styles.confirmActions}>
                <TouchableOpacity style={styles.confirmCancel} onPress={() => setConfirmAvatarSeed(null)}><Text style={styles.confirmCancelText}>Vazgeç</Text></TouchableOpacity>
                <TouchableOpacity style={styles.confirmDanger} onPress={async () => {
                  const seed = confirmAvatarSeed; setConfirmAvatarSeed(null); if (!seed) return;
                  setAvatarSaving(seed);
                  try {
                    const style = 'local';
                    await apiFetch('/users/me/avatar', { method: 'PATCH', body: JSON.stringify({ avatarSeed: seed, avatarStyle: style }) });
                    setProfile(prev => prev ? { ...prev, avatarSeed: seed, avatarStyle: style } : null);
                    showToast('Avatar güncellendi', 'success'); setTimeout(() => setShowAvatarPicker(false), 1000);
                  } catch(e) { showToast(e instanceof Error ? e.message : 'Avatar kaydedilemedi', 'error'); } finally { setAvatarSaving(null); }
                }}>
                  <Text style={styles.confirmDangerText}>Evet, Değiştir</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </Modal>

      {/* Badges Modal */}
      <Modal visible={showAchievements} animationType="slide">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAchievements(false)} hitSlop={12}><Text style={styles.modalCancelText}>Kapat</Text></TouchableOpacity>
            <Text style={styles.modalTitle}>Rozetlerin</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 24, alignItems: 'center' }}>
            <Award size={64} color={colors.warn} style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 24, fontFamily: fonts.bold, color: colors.warn, marginBottom: 24 }}>{profile?.achievementsCount || 0} Rozet</Text>
            <View style={{ width: '100%', backgroundColor: colors.surfaceRaised, borderRadius: 16, padding: 16, gap: 16, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Trophy size={32} color={(profile?.achievementsCount ?? 0) > 0 ? colors.warn : colors.inkMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontFamily: fonts.semibold, fontSize: 16 }}>Şampiyon</Text>
                  <Text style={{ color: colors.inkMuted, fontSize: 14 }}>Haftalık ligi 1. sırada bitir.</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TrendingUp size={32} color={(profile?.achievementsCount ?? 0) > 1 ? colors.accent : colors.inkMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontFamily: fonts.semibold, fontSize: 16 }}>Seri Başarılı</Text>
                  <Text style={{ color: colors.inkMuted, fontSize: 14 }}>Üst üste 3 hafta ilk 3'e gir.</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Lock size={32} color={(profile?.achievementsCount ?? 0) > 2 ? colors.gain : colors.inkMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.ink, fontFamily: fonts.semibold, fontSize: 16 }}>Diamond Hands</Text>
                  <Text style={{ color: colors.inkMuted, fontSize: 14 }}>30 gün boyunca satış yapma.</Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
      
      {/* Logout Modal */}
      <Modal visible={showLogoutConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Çıkış Yap</Text>
            <Text style={styles.confirmText}>Hesabınızdan çıkış yapmak istediğinize emin misiniz?</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setShowLogoutConfirm(false)}><Text style={styles.confirmCancelText}>Vazgeç</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.confirmDanger, {backgroundColor: 'rgba(239,68,68,0.15)'}]} onPress={() => { setShowLogoutConfirm(false); if (onLogout) onLogout(); }}>
                <Text style={[styles.confirmDangerText, {color: colors.loss}]}>Çıkış Yap</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0 },
  center: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingTop: 24, paddingBottom: 32 },
  closeButton: { alignSelf: 'flex-start', marginBottom: 16 },
  identityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceRaised, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginRight: 16, borderWidth: 1, borderColor: colors.border },
  avatarText: { fontFamily: fonts.bold, fontSize: 24, color: colors.ink },
  identityText: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: 22, color: colors.ink, marginBottom: 2 },
  username: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkMuted },
  settingsIcon: { padding: 8 },
  card: { backgroundColor: colors.surfaceRaised, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink, marginBottom: 4 },
  cardSubtitle: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  badgeUp: { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  badgeDown: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  badgeNeutral: { backgroundColor: 'rgba(148, 163, 184, 0.1)' },
  badgeText: { fontFamily: fonts.semibold, fontSize: 12, marginLeft: 4 },
  metricsRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  halfCard: { flex: 1, marginBottom: 0 },
  iconBox: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  metricLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.inkMuted, letterSpacing: 0.5, marginBottom: 4 },
  metricValue: { fontFamily: fonts.bold, fontSize: 28, color: colors.ink },
  metricValueSm: { fontFamily: fonts.bold, fontSize: 22, color: colors.ink },
  metricSuffix: { fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted, marginLeft: 4 },
  friendsCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  friendsLeft: { flexDirection: 'row', alignItems: 'center' },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  stackAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: colors.surfaceRaised, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  stackImg: { width: '100%', height: '100%' },
  stackText: { fontFamily: fonts.medium, fontSize: 11, color: colors.inkMuted },
  section: { marginTop: 8, marginBottom: 24 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink, marginBottom: 16 },
  segmentsBar: { height: 12, borderRadius: 6, flexDirection: 'row', overflow: 'hidden', marginBottom: 24 },
  segment: { height: '100%' },
  legendWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendText: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  lockedTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink, marginBottom: 12 },
  lockedText: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkMuted, textAlign: 'center', lineHeight: 20 },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkMuted, textAlign: 'center' },
  error: { fontFamily: fonts.regular, fontSize: 14, color: colors.loss, textAlign: 'center', marginBottom: 16 },
  retry: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.surfaceRaised, borderRadius: 20 },
  retryText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  modalContainer: { flex: 1, backgroundColor: colors.surface },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  modalCancelText: { fontFamily: fonts.medium, fontSize: 16, color: colors.inkMuted },
  modalContent: { padding: 16 },
  modalSection: { marginBottom: 24 },
  modalSectionLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.inkMuted, marginBottom: 12, letterSpacing: 0.5 },
  input: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: colors.ink, fontFamily: fonts.regular, fontSize: 15, marginBottom: 12 },
  avatarChangeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 12, backgroundColor: colors.surfaceRaised, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  avatarChangeText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surfaceRaised, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  settingText: { flex: 1, marginRight: 20 },
  settingTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, marginBottom: 4 },
  settingHint: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted, lineHeight: 18 },
  logoutButton: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 16, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
  logoutButtonText: { fontFamily: fonts.bold, fontSize: 15, color: colors.loss },
  miniProfileCard: { width: '100%', flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceRaised, padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: colors.border },
  miniProfileAvatar: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', marginRight: 16, backgroundColor: colors.surfacePressed, justifyContent: 'center', alignItems: 'center' },
  miniProfileName: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink, marginBottom: 2 },
  miniProfileUsername: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkMuted, marginBottom: 6 },
  miniProfileRank: { fontFamily: fonts.medium, fontSize: 12, color: colors.gain },
  avatarChoiceTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.inkMuted, marginBottom: 16, alignSelf: 'flex-start' },
  avatarChoiceContainer: { width: 68, height: 68, borderRadius: 34, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  avatarChoiceSelected: { borderColor: colors.accent },
  avatarChoiceInner: { width: 60, height: 60, borderRadius: 30, overflow: 'hidden', backgroundColor: colors.surfacePressed },
  avatarChoiceLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  avatarChoiceCheckmark: { position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.accent, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: colors.surface },
  toastContainer: { position: 'absolute', bottom: 40, alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  toastText: { fontFamily: fonts.medium, fontSize: 14, color: '#fff' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(5, 20, 36, 0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  confirmCard: { width: '100%', backgroundColor: colors.surfaceRaised, borderRadius: 16, padding: 24, borderWidth: 1, borderColor: colors.border },
  confirmTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink, marginBottom: 12 },
  confirmText: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkMuted, marginBottom: 24, lineHeight: 22 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  confirmCancel: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.surfacePressed },
  confirmCancelText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  confirmDanger: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: colors.accent },
  confirmDangerText: { fontFamily: fonts.bold, fontSize: 15, color: '#fff' },
});
