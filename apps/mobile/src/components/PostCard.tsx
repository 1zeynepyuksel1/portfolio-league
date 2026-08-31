import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { colors, fonts } from '../theme';
import { formatCents } from '../lib/format';
import { Globe, Users, TrendingUp, TrendingDown, Heart, MessageSquare } from 'lucide-react-native';
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

export function PostCard({ post, user, isPreview, onPressUser }: Props) {

  const payload = post.payload || {};
  const isPnl = post.type === 'pnl_share';
  const isFortune = post.type === 'horoscope_share';
  const isWheel = post.type === 'wheel_share';
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
  if (isFortune) badgeText = 'Finans Falı';
  if (isWheel) badgeText = 'Çarkıfelek';

  // Dummy data for mockup
  const dummyLikes = Math.floor(Math.random() * 200) + 12;
  const dummyComments = Math.floor(Math.random() * 20) + 2;

  return (
    <View style={styles.card}>
      {/* 1. Header Area */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.userInfo} activeOpacity={0.7} onPress={() => { if (onPressUser && user?.username) onPressUser(user.username); }}>
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
            <Text style={styles.name}>{user?.firstName || 'Kullanıcı'} {user?.lastName || ''}</Text>
            <Text style={styles.time}>{isPreview ? 'Şimdi' : timeAgo(post.createdAt)}</Text>
          </View>\n          </TouchableOpacity>\n          <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeText}</Text>
        </View>
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
        <View style={[styles.modernPnlBox, { backgroundColor: 'rgba(139, 92, 246, 0.05)', borderColor: 'rgba(139, 92, 246, 0.15)' }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.modernPnlLabel, { color: colors.bronze }]}>Falcı Abla Diyor ki:</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.ink, lineHeight: 22, marginTop: 4 }}>"{payload.fortune_content}"</Text>
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
      {!!post.caption && (
        <Text style={styles.caption}>{post.caption}</Text>
      )}

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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {post.visibility === 'public' ? (
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

