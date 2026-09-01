import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Modal, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { Platform, DeviceEventEmitter } from 'react-native';
import { apiFetch } from '../api/client';
import { colors, fonts } from '../theme';
import { formatCents } from '../lib/format';
import { Globe, Users, TrendingUp, TrendingDown, Heart, MessageSquare, MoreVertical, Trash2, Edit2, Pin, AlertTriangle, EyeOff } from 'lucide-react-native';
import { createAvatar } from '@dicebear/core';
import { shapes } from '@dicebear/collection';
import { SvgXml } from 'react-native-svg';

const localAvatars: Record<string, any> = {
  meerkat: require('../../assets/avatars/meerkat.png'),
  chicken: require('../../assets/avatars/chicken.png'),
  bear: require('../../assets/avatars/bear.png'),
  cat: require('../../assets/avatars/cat.png'),
  rabbit: require('../../assets/avatars/rabbit.png'),
  panda: require('../../assets/avatars/panda.png'),
};

const bgColors = ["10b981", "3b82f6", "8b5cf6", "f59e0b", "ef4444", "06b6d4"];
const shapeColors = ["ffffff"];

type Props = {
  currentUserId?: string;
  onPressUser?: (username: string) => void;
  post: any;
  user?: any;
  isPreview?: boolean;
};


function timeAgo(dateString: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'şimdi';
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}d önce`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}s önce`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}g önce`;
  
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(date);
}

export function PostCard({ post, user, isPreview, onPressUser, currentUserId }: Props) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  
  const [localVis, setLocalVis] = useState(post?.visibility);
  const [isPinned, setIsPinned] = useState(post?.payload?.isPinned || false);
  const [showToast, setShowToast] = useState(false);

  const handlePin = async () => {
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
  };
  const [localCaption, setLocalCaption] = useState(post?.caption || '');
  const [isEditing, setIsEditing] = useState(false);
  const [editCaption, setEditCaption] = useState(post?.caption || '');

  const handleEditSave = async () => {
    setIsUpdating(true);
    try {
      await apiFetch('/posts/' + post.id, { method: 'PATCH', body: JSON.stringify({ caption: editCaption }) });
      setLocalCaption(editCaption);
      setIsEditing(false);
    } catch (e) {}
    setIsUpdating(false);
  };


  const isOwnPost = currentUserId && post?.userId === currentUserId;

  const handleDelete = async () => {
    setIsUpdating(true);
    try {
      await apiFetch('/posts/' + post.id, { method: 'DELETE' });
      setDeleted(true);
    } catch (e) {}
    setMenuVisible(false);
  };

  const handleVisibility = async (newVis: string) => {
    setIsUpdating(true);
    try {
      await apiFetch('/posts/' + post.id + '/visibility', { method: 'PATCH', body: JSON.stringify({ visibility: newVis }) });
      setLocalVis(newVis);
    } catch (e) {}
    setIsUpdating(false);
    setMenuVisible(false);
  };

  


  const payload = post.payload || {};
  const isPnl = post.type === 'pnl_share';
  const isFortune = false; // removed
  const isWheel = false; // removed
  const isSingleAsset = post.scope === 'single_asset' || payload.is_market || payload.asset_key !== undefined;

  const pnlCents = BigInt(payload.pnl_amount || '0');
  const isPositive = payload.is_market ? (parseFloat(payload.pnl_percent || '0') >= 0) : (pnlCents >= 0n);
  const pnlFormatted = (isPositive ? '+' : '') + formatCents(pnlCents, 'try');

  const pnlTLCents = BigInt(payload.total_pnl_amount || '0');
  const pnlTLPositive = pnlTLCents >= 0n;
  const pnlTLFormatted = (pnlTLPositive ? '+' : '') + formatCents(pnlTLCents, 'try');

  const displayTitle = payload.is_market ? (payload.asset_name || 'Piyasa') : (isSingleAsset ? payload.asset_name || 'Varlık' : payload.period_label || 'Portföy Değişimi');
  const isDisplayPositive = isSingleAsset ? isPositive : pnlTLPositive;
  const displayValue = isSingleAsset ? `${isDisplayPositive && !String(payload.pnl_percent).startsWith('-') ? '+' : ''}${payload.pnl_percent}%` : `${isDisplayPositive && !String(payload.total_pnl_percent).startsWith('-') ? '+' : ''}${payload.total_pnl_percent}%`;

  let badgeText = 'Gönderi';
  if (isPnl) badgeText = payload.is_market ? 'Piyasa' : 'Kâr/Zarar';
  // if (isFortune) badgeText removed
  // if (isWheel) badgeText removed

  // Dummy data for mockup
  const [dummyLikes] = useState(() => Math.floor(Math.random() * 200) + 12);
  const [dummyComments] = useState(() => Math.floor(Math.random() * 20) + 2);

  if (deleted) return null;

  return (
    <View style={styles.card}>
      {/* 1. Header Area */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.userInfo} activeOpacity={0.7} onPress={() => { if (onPressUser && user?.username) onPressUser(user.username); DeviceEventEmitter.emit('refreshProfile'); }}>
          <View style={styles.avatar}>
            {user?.avatarStyle === 'local' && user?.avatarSeed && localAvatars[user.avatarSeed] ? (
              <Image source={localAvatars[user.avatarSeed]} style={{width: '100%', height: '100%'}} resizeMode="contain" />
            ) : user?.avatarSeed ? (
              <SvgXml xml={createAvatar(shapes, { seed: user.avatarSeed, backgroundColor: bgColors, shape1Color: shapeColors, shape2Color: shapeColors, shape3Color: shapeColors }).toString()} width="100%" height="100%" />
            ) : (
              <Text style={{ fontFamily: fonts.bold, color: colors.inkMuted }}>{user?.firstName?.[0] || '?'}</Text>
            )}
          </View>
          <View style={{ justifyContent: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Text style={[styles.name, { marginBottom: 0 }]}>{user?.firstName || 'Kullanıcı'} {user?.lastName || ''}</Text>
                {isPinned && <Pin size={14} color={colors.accent} />}
              </View>
            <Text style={styles.time}>{isPreview ? 'Şimdi' : timeAgo(post.createdAt)}</Text>
          </View>          </TouchableOpacity>
          {!isPreview && (
            <TouchableOpacity onPress={() => setMenuVisible(true)} style={{ padding: 8, marginRight: -8 }}>
              <MoreVertical size={20} color={colors.inkMuted} />
            </TouchableOpacity>
          )}
        </View>

      {/* 2. Main Box Area (Pnl / Horoscope / Wheel) */}
      {isPnl && (
        <View style={styles.modernPnlBox}>
          <View>
            <Text style={styles.modernPnlLabel}>{displayTitle}</Text>
            <Text style={[styles.modernPnlValue, { color: isDisplayPositive ? colors.gain : colors.loss }]}>{displayValue}</Text>
            {isPnl && (
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted, marginTop: 6 }}>
                {payload.is_market ? 'Son 24 Saat' : (isSingleAsset && payload.buy_date ? `${new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(payload.buy_date))} ➔ Bugün` : '')}
              </Text>
            )}
          </View>
          {isDisplayPositive ? (
            <TrendingUp size={24} color={colors.gain} strokeWidth={2.5} />
          ) : (
            <TrendingDown size={24} color={colors.loss} strokeWidth={2.5} />
          )}
        </View>
      )}

      {/* 3. Portfolio Positions (If applicable, keeping for functionality) */}
      {isPnl && !isSingleAsset && payload.positions && payload.positions.length > 0 && (
        <View style={styles.positionsList}>
          {payload.positions.map((pos: any, idx: number) => {
            const posCents = BigInt(pos.pnl_amount || '0');
            const posIsPos = posCents >= 0n;
            const buyDateStr = pos.buy_date ? new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(pos.buy_date)) : 'Geçmiş';
            return (
              <View key={pos.symbol || idx} style={styles.positionRow}>
                <View style={styles.positionLeft}>
                  {pos.icon_url ? <Image source={{ uri: pos.icon_url }} style={{ width: 36, height: 36, borderRadius: 8 }} /> : <View style={styles.positionIcon}><Text style={styles.positionIconText}>{pos.symbol?.slice(0,2)}</Text></View>}
                  <View>
                    <Text style={styles.positionName}>{pos.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.inkMuted }}>{buyDateStr}</Text>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.inkMuted }}>➔</Text>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.inkMuted }}>Bugün</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.positionRight}>
                  <Text style={[styles.positionPnl, { color: posIsPos ? colors.gain : colors.loss }]}>{(posIsPos ? '+' : '') + formatCents(posCents, 'try')}</Text>
                  <Text style={[styles.positionPct, { color: posIsPos ? colors.gain : colors.loss }]}>{(posIsPos ? '+' : '') + pos.pnl_percent}%</Text>
                </View>
              </View>
            )
          })}
        </View>
      )}

      {isFortune && (
          <View style={{ backgroundColor: '#2e1065', borderRadius: 16, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: '#4c1d95' }}>
            <View style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: 50, backgroundColor: '#8b5cf6', opacity: 0.2 }} />
            <View style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: 40, backgroundColor: '#c084fc', opacity: 0.2 }} />
            
            <View style={{ padding: 20, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
                <Text style={{ fontSize: 28, textShadowColor: '#8b5cf6', textShadowRadius: 10 }}>🔮</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#c4b5fd', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>Falcı Abla Diyor ki:</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: '#ffffff', lineHeight: 22, fontStyle: 'italic' }}>"{payload.fortune_content}"</Text>
              </View>
            </View>
          </View>
        )}

      {isWheel && (
        <View style={[styles.modernPnlBox, { backgroundColor: 'rgba(245, 158, 11, 0.05)', borderColor: 'rgba(245, 158, 11, 0.15)' }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.modernPnlLabel, { color: '#F59E0B' }]}>Çarkıfelek Ödülü!</Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.ink, marginTop: 4 }}>{payload.prize_text}</Text>
          </View>
        </View>
      )}

      {/* 4. Caption Area */}
      {isEditing ? (
        <View style={{ marginBottom: 16 }}>
          <TextInput
            style={[styles.caption, { backgroundColor: colors.surfacePressed, padding: 12, borderRadius: 8, marginBottom: 8 }]}
            multiline
            autoFocus
            value={editCaption}
            onChangeText={setEditCaption}
            placeholder="Gönderine bir açıklama ekle..."
            placeholderTextColor={colors.inkMuted}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <TouchableOpacity onPress={() => { setIsEditing(false); setEditCaption(localCaption); }} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.surfacePressed }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.ink }}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleEditSave} disabled={isUpdating} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.accent }}>
              {isUpdating ? <ActivityIndicator size="small" color="white" /> : <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: 'white' }}>Kaydet</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : !!localCaption ? (
        <Text style={styles.caption}>{localCaption}</Text>
      ) : null}

      {/* 5. Footer (Likes & Comments Mockup) */}
      {!isPreview ? (
        <View style={styles.interactionFooter}>
          <View style={{ flexDirection: 'row', gap: 20 }}>
            <TouchableOpacity style={styles.actionBtn}>
              <Heart size={18} color={colors.inkMuted} />
              <Text style={styles.actionText}>{dummyLikes}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}>
              <MessageSquare size={18} color={colors.inkMuted} />
              <Text style={styles.actionText}>{dummyComments}</Text>
            </TouchableOpacity>
          </View>
          
          {/* Visibility indicator on the right if needed, optional */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.badge, { paddingVertical: 2, paddingHorizontal: 8, backgroundColor: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Text style={[styles.badgeText, { fontSize: 10 }]}>{badgeText}</Text>
            </View>
            {localVis === 'public' ? (
              <Globe size={14} color={colors.inkMuted} />
            ) : (
              <Users size={14} color={colors.inkMuted} />
            )}
          </View>
        </View>
      ) : (
        <View style={[styles.interactionFooter, { opacity: 0.5 }]}>
           <View style={{ flexDirection: 'row', gap: 20 }}>
            <View style={styles.actionBtn}>
              <Heart size={18} color={colors.inkMuted} />
              <Text style={styles.actionText}>0</Text>
            </View>
            <View style={styles.actionBtn}>
              <MessageSquare size={18} color={colors.inkMuted} />
              <Text style={styles.actionText}>0</Text>
            </View>
          </View>
        </View>
      )}
      {/* CUSTOM PIN SUCCESS MODAL */}
      <Modal visible={showToast} transparent animationType="fade" onRequestClose={() => setShowToast(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.surface, width: '100%', maxWidth: 360, borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
            
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(99, 102, 241, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Pin size={32} color={colors.accent} />
            </View>

            <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink, marginBottom: 8 }}>Başa Sabitlendi</Text>
            
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted, textAlign: 'center', marginBottom: 28, paddingHorizontal: 8 }}>
              Gönderi başarıyla profilinin en üstüne sabitlendi. Hemen görmek ister misin?
            </Text>

            <TouchableOpacity 
              onPress={() => setShowToast(false)} 
              activeOpacity={0.7}
              style={{ width: '100%', paddingVertical: 14, borderRadius: 12, backgroundColor: colors.surfacePressed, borderWidth: 1, borderColor: colors.border, alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.inkMuted, letterSpacing: 1 }}>KAPAT</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => { setShowToast(false); if (onPressUser && user?.username) onPressUser(user.username); }} 
              activeOpacity={0.7}
              style={{ width: '100%', paddingVertical: 14, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: 'white', letterSpacing: 1 }}>PROFİLDE GÖR</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>
      
      {/* 3-DOT MENU MODAL */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuCard}>
            {isUpdating && <ActivityIndicator color={colors.accent} style={{ position: 'absolute', top: 16, right: 16 }} />}
            
            <Text style={styles.menuTitle}>Gönderi Seçenekleri</Text>
            
            {isOwnPost ? (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleVisibility(localVis === 'public' ? 'friends_only' : 'public')} disabled={isUpdating}>
                  {localVis === 'public' ? <Users size={20} color={colors.ink} /> : <Globe size={20} color={colors.ink} />}
                  <Text style={styles.menuText}>
                    {localVis === 'public' ? 'Sadece Arkadaşlar Yap' : 'Herkese Açık Yap'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => { setIsEditing(true); setMenuVisible(false); }}>
                  <Edit2 size={20} color={colors.ink} />
                  <Text style={styles.menuText}>Düzenle</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handlePin} disabled={isUpdating}>
                  <Pin size={20} color={isPinned ? colors.accent : colors.inkMuted} />
                  <Text style={[styles.menuText, { color: isPinned ? colors.accent : colors.inkMuted }]}>{isPinned ? 'Sabitlemeyi Kaldır' : 'Başa Sabitle'}</Text>
                </TouchableOpacity>
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
                <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setIsConfirmingDelete(true); }} disabled={isUpdating}>
                  <Trash2 size={20} color={colors.loss} />
                  <Text style={[styles.menuText, { color: colors.loss }]}>Gönderiyi Sil</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={() => setMenuVisible(false)}>
                  <EyeOff size={20} color={colors.ink} />
                  <Text style={styles.menuText}>Gönderiyi Gizle (Yakında)</Text>
                </TouchableOpacity>
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
                <TouchableOpacity style={styles.menuItem} onPress={() => setMenuVisible(false)}>
                  <AlertTriangle size={20} color={colors.loss} />
                  <Text style={[styles.menuText, { color: colors.loss }]}>Şikayet Et (Yakında)</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      <Modal visible={isConfirmingDelete} transparent animationType="fade" onRequestClose={() => setIsConfirmingDelete(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.surface, width: '100%', maxWidth: 360, borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
            
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(244, 63, 94, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Trash2 size={32} color={colors.loss} />
            </View>

            <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink, marginBottom: 8 }}>Gönderiyi Sil</Text>
            
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted, textAlign: 'center', marginBottom: 28, paddingHorizontal: 8 }}>
              Bu gönderi kalıcı olarak silinecektir. Emin misiniz?
            </Text>

            <TouchableOpacity 
              onPress={() => setIsConfirmingDelete(false)} 
              activeOpacity={0.7}
              style={{ width: '100%', paddingVertical: 14, borderRadius: 12, backgroundColor: colors.surfacePressed, borderWidth: 1, borderColor: colors.border, alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.inkMuted, letterSpacing: 1 }}>VAZGEÇ</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => { setIsConfirmingDelete(false); handleDelete(); }} 
              activeOpacity={0.7}
              style={{ width: '100%', paddingVertical: 14, borderRadius: 12, backgroundColor: colors.loss, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: 'white', letterSpacing: 1 }}>SİL</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  userInfo: { flexDirection: 'row', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfacePressed, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink, marginBottom: 2 },
  time: { fontFamily: fonts.regular, fontSize: 12, color: colors.inkMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  menuCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  menuTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink, marginBottom: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 },
  menuText: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  badge: { backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)' },
  badgeText: { fontFamily: fonts.medium, fontSize: 11, color: colors.gain },

  // Modern Pnl Box
  modernPnlBox: { backgroundColor: colors.surfaceRaised, borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modernPnlLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted, marginBottom: 4 },
  modernPnlValue: { fontFamily: fonts.bold, fontSize: 24 },

  // Caption
  caption: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink, lineHeight: 22, marginBottom: 16 },

  // Portfolio list (keeps functionality)
  positionsList: { gap: 12, marginBottom: 16, marginTop: -4 },
  positionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  positionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  positionIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.surfacePressed, justifyContent: 'center', alignItems: 'center' },
  positionIconText: { fontFamily: fonts.bold, fontSize: 13, color: colors.inkMuted, textTransform: 'uppercase' },
  positionName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  positionSymbol: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted },
  positionRight: { alignItems: 'flex-end' },
  positionPnl: { fontFamily: fonts.bold, fontSize: 14 },
  positionPct: { fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },

  // Footer Actions
  interactionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontFamily: fonts.medium, fontSize: 13, color: colors.inkMuted },
});

