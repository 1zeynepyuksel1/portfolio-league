import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Modal, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { Platform, DeviceEventEmitter } from 'react-native';
import { apiFetch } from '../api/client';
import { colors, fonts } from '../theme';
import { formatCents } from '../lib/format';
import { Globe, Users, TrendingUp, TrendingDown, Heart, MessageSquare, MoreVertical, Trash2, Edit2, Pin, AlertTriangle, EyeOff, ShieldCheck, Ban, Crown, Trophy } from 'lucide-react-native';
import { createAvatar } from '@dicebear/core';
import { shapes } from '@dicebear/collection';
import { SvgXml } from 'react-native-svg';
import { AssetLogo } from './AssetLogo';

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
  /** Görüntüleyen kişi yönetici mi — moderasyon seçenekleri buna göre çiziliyor. */
  isAdmin?: boolean;
  onPressUser?: (username: string) => void;
  post: any;
  user?: any;
  isPreview?: boolean;
};


/**
 * Paylasim kartindaki "ne zaman alindi" etiketi — TARIH VE SAAT.
 *
 * ⚠️ SAAT EKLEMEK GORUNMEZ BIR HATAYI GORUNUR YAPTI.
 *
 * Sunucu bu tarihi ham SQL ile cekiyordu ve dilimsiz zaman damgasini
 * yerel saat sayiyordu — her tarih 3 saat erken geliyordu. Yalnizca GUN
 * gosterildigi icin fark edilmiyordu; kayma gunu ancak gece yarisina
 * yakin kayitlarda degistirir. Saat eklenince her kartta gorunur olacakti.
 * Once sunucu duzeltildi (`lib/pg-time.ts`), sonra saat eklendi.
 *
 * ⚠️ `null` GECERLI BIR DEGER. Alis tarihi bulunamayan pozisyon icin
 * sunucu artik "bugun" uydurmuyor, `null` donuyor. Burada da tarih yerine
 * cizgi konuyor — yanlis bir tarih gostermektense bosluk daha durust.
 */
const TARIH_SAAT = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Gonderinin "su an" tarafi — yani olcumun alindigi an.
 *
 * ⚠️ SABIT "Bugun" YAZISI YANLISTI: bir hafta once paylasilan gonderi de
 * "Bugun" diyordu. Akista gezen biri o karin bugun mu yoksa gecen ay mi
 * olculdugunu bilemiyordu.
 *
 * ⚠️ `post.created_at` DEGIL `post.createdAt`. Sunucu gonderi satirini
 * Drizzle ile okuyor ve Drizzle alan adlarini camelCase donduruyor;
 * `created_at` HER ZAMAN `undefined`. Olculdu:
 *
 *     gonderi alan adlari: id, userId, type, scope, payload, caption,
 *                          visibility, createdAt
 *
 * Yanlis ad sessizce `undefined` verir, `tarihSaat` `null` doner ve ekran
 * yedege — yani yine "Bugun"e — duserdi. Hata gorunmez: kod calisir,
 * ekran dolu, sadece dogru degil.
 *
 * ⚠️ `snapshot_date` ONCELIKLI cunku olcum ani odur; `createdAt` yalnizca
 * yedek. Tekil varlik onizlemesi de artik `snapshot_date` gonderiyor.
 */
function olcumAni(payload: any, post: any): string {
  return tarihSaat(payload?.snapshot_date ?? post?.createdAt) ?? 'Bugün';
}

function tarihSaat(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  // ⚠️ Gecersiz tarih sessizce "Invalid Date" yazar; once yakala.
  if (Number.isNaN(d.getTime())) return null;
  return TARIH_SAAT.format(d);
}

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

export function PostCard({ post, user, isPreview, onPressUser, currentUserId, isAdmin }: Props) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [isBanning, setIsBanning] = useState(false);
  const [isConfirmingAdminDelete, setIsConfirmingAdminDelete] = useState(false);
  const [banReason, setBanReason] = useState('');
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

  /*
    ⚠️ YÖNETİCİ SİLME AYRI BİR UÇ KULLANIYOR — ve bu bilinçli.

    `DELETE /posts/:id` sahiplik arıyor (`userId` eşleşmeli) ve öyle
    kalmalı: normal kullanıcı yalnızca kendi gönderisini silebilmeli.
    Yönetici için `DELETE /admin/posts/:id` var.

    Aynı uca "sahipliği atla" bayrağı eklemek daha az kod olurdu ama o
    bayrağın bir gün yanlışlıkla `true` geçilmesi demektir. İki ayrı uç,
    iki ayrı yetki — karıştırılamaz.
  */
  const handleAdminDelete = async () => {
    setIsUpdating(true);
    try {
      await apiFetch('/admin/posts/' + post.id, { method: 'DELETE' });
      setDeleted(true);
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Gönderi silinemedi.');
    }
    setIsUpdating(false);
    setMenuVisible(false);
  };

  /**
   * Gönderi sahibini banlar — sebep soruluyor.
   *
   * ⚠️ `Alert.prompt` YALNIZCA iOS'ta var. Android ve web'de sessizce
   * hiçbir şey yapmaz; kullanıcı düğmeye basar, bir şey olmaz ve sebebi
   * anlaşılmaz. Bu yüzden sebep kendi modal'ımızla soruluyor.
   */
  const handleAdminBan = () => {
    setMenuVisible(false);
    setBanReason('');
    setIsBanning(true);
  };

  const submitBan = async () => {
    if (banReason.trim().length < 3) {
      Alert.alert('Eksik', 'Ban sebebi yazmalısın.');
      return;
    }
    setIsUpdating(true);
    try {
      await apiFetch('/admin/users/' + post.userId + '/ban', {
        method: 'POST',
        body: JSON.stringify({ reason: banReason.trim() }),
      });
      setIsBanning(false);
      Alert.alert('Tamam', '@' + (user?.username ?? 'kullanıcı') + ' banlandı.');
    } catch (e) {
      Alert.alert('Hata', e instanceof Error ? e.message : 'Banlanamadı.');
    }
    setIsUpdating(false);
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
  /*
    ⚠️ Lig sonucu paylaşımı. Payload'ı SUNUCU yazıyor (`posts/service.ts`)
    — istemciden gelen bir derece iddiası kaydedilmiyor, o yüzden buradaki
    sayılara güvenilebilir.
  */
  const isCrown = post.type === 'crown_share';

    const isWhatIf = post.type === 'what_if_share';
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
  /*
    ⚠️ 'Şampiyon' DEĞİL 'Lig Sonucu'. Kutlama artık HER dereceye
    çıkıyor; 9. olan birinin kartında "Şampiyon" yazması yanlış olurdu.
  */
  if (isCrown) badgeText = 'Lig Sonucu';

    if (isWhatIf) badgeText = 'Kaçan Fırsat';

  // Dummy data for mockup
  const [dummyLikes] = useState(() => Math.floor(Math.random() * 200) + 12);
  const [dummyComments] = useState(() => Math.floor(Math.random() * 20) + 2);

  /*
    ⚠️ `crown_share` BU LİSTEDE YOK — ve olmamalı.

    Fal ve çark paylaşımları arayüzden kaldırıldığı için gizleniyor.
    Lig sonucu paylaşımı ise YENİ ve gerçekten çiziliyor; listeye
    eklenseydi akışta hiç görünmez, kullanıcı "paylaştım ama yok"
    derdi.
  */
  if (deleted || post.type === 'horoscope_share' || post.type === 'wheel_share') return null;

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

                {/* WHAT IF UI */}
        {isWhatIf && (
          <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.05)', padding: 20, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.2)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.gain, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 20 }}>🚀</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.inkMuted }}>Zaman Yolculuğu</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink }}>{payload.startDate} ➔ {payload.assetName}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surfaceRaised, padding: 12, borderRadius: 12 }}>
              <View>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted, marginBottom: 4 }}>Nominal Kazanç</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.gain }}>{payload.nominalMultiple}x</Text>
              </View>
              <View style={{ width: 1, backgroundColor: colors.hairline }} />
              <View>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted, marginBottom: 4 }}>Reel Kazanç</Text>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.gain }}>{payload.realMultiple}x</Text>
              </View>
            </View>
          </View>
        )}

        {/* CROWN POST UI */}
        {isCrown && (() => {
          /*
            ⚠️ ÜÇÜNCÜDEN SONRASI DA VAR — ÖNCEKİ HÂLİ BUNU ATLIYORDU.

            Kart `rank === 1 ? altın : rank === 2 ? gümüş : bronz` diye
            yazılmıştı. Üçlü koşulun SON dalı yakalayıcıdır: 7. olan da
            9. olan da "Bronz Taç Sahibi!" görürdü. Madalya üçe kadar
            anlamlı; sonrası için ayrı bir dil gerekiyor.

            ⚠️ ALAN ADLARI SUNUCUNUNKİYLE HİZALANDI. Kart
            `payload.leagueName` okuyordu ama sunucu `periodName`
            yazıyor (`leagues/service.ts`) — yani başlık BOŞ çıkıyordu.
            Eski gönderiler için `leagueName` yedek olarak duruyor.
          */
          const rank: number = Number(payload.rank ?? 0);
          const madalya = rank >= 1 && rank <= 3;
          const renk = rank === 1 ? colors.gold : rank === 2 ? colors.silver : rank === 3 ? colors.bronze : colors.accent;
          const zemin = rank === 1 ? colors.goldSoft : rank === 2 ? colors.silverSoft : rank === 3 ? colors.bronzeSoft : colors.accentSoft;
          const kenar = rank === 1 ? colors.goldSoft : rank === 2 ? colors.silverSoft : rank === 3 ? colors.bronzeSoft : colors.accentSoft;
          const baslik = rank === 1 ? 'Altın Taç Sahibi!' : rank === 2 ? 'Gümüş Taç Sahibi!' : rank === 3 ? 'Bronz Taç Sahibi!' : `Ligi ${rank}. sırada tamamladı`;
          const donem = payload.periodName ?? payload.leagueName ?? 'Haftalık lig';
          const yuzde = payload.twrPercent;

          return (
          <View style={{ backgroundColor: zemin, padding: 24, borderRadius: 20, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: kenar }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: renk, justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: renk, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 }}>
              {/*
                ⚠️ İlk üçte taç, sonrasında kupa. Dokuzuncu olan birine
                taç çizmek ödülü değersizleştirirdi; kupa "katıldın ve
                bitirdin" diyor, taç "kazandın" diyor.
              */}
              {madalya
                ? <Crown size={32} color="#fff" strokeWidth={2.5} fill="#fff" />
                : <Trophy size={30} color="#fff" strokeWidth={2.5} />}
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink, marginBottom: 8, textAlign: 'center' }}>
              {baslik}
            </Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted, textAlign: 'center' }}>
              {donem}
              {payload.totalParticipants !== undefined ? ` · ${payload.totalParticipants} katılımcı` : ''}
            </Text>
            {/*
              ⚠️ YÜZDE, TUTAR DEĞİL. Ligin ölçütü TWR; mutlak tutar
              göstermek "kim daha zengin"e kayardı ve TWR'nin seçilme
              sebebi tam olarak buydu.
            */}
            {yuzde !== undefined && (
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, marginTop: 8, color: String(yuzde).startsWith('-') ? colors.loss : colors.gain }}>
                {String(yuzde).startsWith('-') ? '' : '+'}{yuzde}%
              </Text>
            )}
          </View>
          );
        })()}

      {isPnl && (
        <View style={styles.modernPnlBox}>
          <View>
            <Text style={styles.modernPnlLabel}>{displayTitle}</Text>
            <Text style={[styles.modernPnlValue, { color: isDisplayPositive ? colors.gain : colors.loss }]}>{displayValue}</Text>
            {isPnl && (
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted, marginTop: 8 }}>
                {payload.is_market ? `Son 24 Saat — ${olcumAni(payload, post)}` : (isSingleAsset && tarihSaat(payload.buy_date) ? `${tarihSaat(payload.buy_date)} ➔ ${olcumAni(payload, post)}` : '')}
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
const buyDateStr = tarihSaat(pos.buy_date) ?? '—';
            return (
              <View key={pos.symbol || idx} style={styles.positionRow}>
                <View style={styles.positionLeft}>
                  {/*
                    ⚠️ ONCEDEN `pos.icon_url` VARSA GORSEL, YOKSA HARF ROZETI
                    yaziyordu — ve sunucu o alani HER ZAMAN `null` gonderiyordu.
                    Yani harf rozeti dali daima kazaniyordu; logolar
                    "gelmiyor" degildi, hic istenmiyordu.

                    `AssetLogo` zaten var ve kripto/hisse/doviz/maden dortlusunu
                    tek gorunumde topluyor. Sunucudan URL beklemek yerine onu
                    kullaniyoruz: logolar pakette, ag istegi yok ve taninmayan
                    sembol icin kendi yedegi var.
                  */}
                  <AssetLogo symbol={pos.symbol} size={36} />

                  <View>
                    <Text style={styles.positionName}>{pos.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted }}>{buyDateStr}</Text>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted }}>➔</Text>
                      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted }}>{olcumAni(payload, post)}</Text>
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

      {/*
        ⚠️ FAL VE ÇARK BLOKLARI SİLİNDİ — 40 SATIR ÖLÜ KOD.

        `const isFortune = false` ve `const isWheel = false` sabitti;
        iki blok da HİÇ çizilmiyordu. Özellikler arayüzden kaldırılmış
        ama çizim kodu bırakılmıştı.

        Neden sadece durup beklemiyordu:

        1. İçlerinde temaya bağlı olmayan sekiz renk vardı (#2e1065,
           #4c1d95, #8b5cf6, #c084fc, #c4b5fd…) — mor bir palet, oysa
           uygulamanın vurgusu mavi. Renk sayımında bu dosyayı 37'ye
           çıkaran şeyin yarısı buydu.
        2. Emoji simge kullanıyordu (🔮) — platformdan platforma değişir
           ve token'la kontrol edilemez.
        3. Okuyan kişi "fal özelliği var mı?" diye düşünmek zorunda
           kalıyordu. Bu projede daha önce tam tersi oldu: `AssetLogo`
           yazılmış ama kullanılmıyordu, `WelcomeScreen` çizilmiyordu.
           Var olan ama çalışmayan kod, olmayan koddan daha yanıltıcı.

        Geri gerekirse git geçmişinde duruyor.
      */}

      {/* 4. Caption Area */}
      {isEditing ? (
        <View style={{ marginBottom: 16 }}>
          <TextInput
            style={[styles.caption, { backgroundColor: colors.surfacePressed, padding: 12, borderRadius: 10, marginBottom: 8 }]}
            multiline
            autoFocus
            value={editCaption}
            onChangeText={setEditCaption}
            placeholder="Gönderine bir açıklama ekle..."
            placeholderTextColor={colors.inkMuted}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
            <TouchableOpacity onPress={() => { setIsEditing(false); setEditCaption(localCaption); }} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: colors.surfacePressed }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.ink }}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleEditSave} disabled={isUpdating} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: colors.accent }}>
              {isUpdating ? <ActivityIndicator size="small" color="white" /> : <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: 'white' }}>Kaydet</Text>}
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
            <View style={[styles.badge, { paddingVertical: 2, paddingHorizontal: 8, backgroundColor: 'rgba(16, 185, 129, 0.05)', borderColor: colors.gainSoft }]}>
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
        <View style={{ flex: 1, backgroundColor: colors.backdrop, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.surface, width: '100%', maxWidth: 360, borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
            
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentSoft, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Pin size={32} color={colors.accent} />
            </View>

            <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink, marginBottom: 8 }}>Başa Sabitlendi</Text>
            
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted, textAlign: 'center', marginBottom: 28, paddingHorizontal: 8 }}>
              Gönderi başarıyla profilinin en üstüne sabitlendi. Hemen görmek ister misin?
            </Text>

            <TouchableOpacity 
              onPress={() => setShowToast(false)} 
              activeOpacity={0.7}
              style={{ width: '100%', paddingVertical: 16, borderRadius: 14, backgroundColor: colors.surfacePressed, borderWidth: 1, borderColor: colors.border, alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.inkMuted, letterSpacing: 1 }}>KAPAT</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => { setShowToast(false); if (onPressUser && user?.username) onPressUser(user.username); }} 
              activeOpacity={0.7}
              style={{ width: '100%', paddingVertical: 16, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: 'white', letterSpacing: 1 }}>PROFİLDE GÖR</Text>
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

                {/*
                  ⚠️ YÖNETİCİ BÖLÜMÜ AYRI BİR BAŞLIK ALTINDA — kazayla
                  basılmasın diye. Sıradan seçeneklerle aynı listede
                  dursaydı "Gizle" ile "Sil" yan yana gelirdi; biri
                  geri alınabilir, diğeri kalıcı.

                  ⚠️ Bu blok bir YETKİ DEĞİL. `isAdmin` yalnızca çizim
                  kararı; gerçek kontrol `/admin/*` uçlarındaki
                  `requireAdmin`. Kodu değiştirip burayı açan biri de
                  sunucudan 403 alır.
                */}
                {isAdmin === true && (
                  <>
                    <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <ShieldCheck size={14} color={colors.accent} />
                      <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.accent, letterSpacing: 0.5 }}>YÖNETİCİ</Text>
                    </View>
                    <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setIsConfirmingAdminDelete(true); }} disabled={isUpdating}>
                      <Trash2 size={20} color={colors.loss} />
                      <Text style={[styles.menuText, { color: colors.loss }]}>Gönderiyi Sil</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem} onPress={handleAdminBan} disabled={isUpdating}>
                      <Ban size={20} color={colors.loss} />
                      <Text style={[styles.menuText, { color: colors.loss }]}>@{user?.username ?? 'kullanıcı'} kişisini banla</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/*
        ⚠️ YÖNETİCİ SİLME ONAYI AYRI. Sahibin kendi silme onayından farklı
        bir metin gösteriyor: yönetici BAŞKASININ içeriğini siliyor ve
        bunun kimin gönderisi olduğunu görmesi gerekiyor.
      */}
      <Modal visible={isConfirmingAdminDelete} transparent animationType="fade" onRequestClose={() => setIsConfirmingAdminDelete(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.menuCard}>
            <Trash2 size={28} color={colors.loss} style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={styles.menuTitle}>Gönderiyi sil</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted, textAlign: 'center', marginBottom: 16 }}>
              @{user?.username ?? 'kullanıcı'} adlı kişinin gönderisi kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[styles.menuItem, { flex: 1, justifyContent: 'center', backgroundColor: colors.surfacePressed, borderRadius: 14 }]} onPress={() => setIsConfirmingAdminDelete(false)}>
                <Text style={styles.menuText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, { flex: 1, justifyContent: 'center', backgroundColor: colors.loss, borderRadius: 14 }]} onPress={() => { setIsConfirmingAdminDelete(false); void handleAdminDelete(); }}>
                <Text style={[styles.menuText, { color: '#FFF' }]}>Sil</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isBanning} transparent animationType="fade" onRequestClose={() => setIsBanning(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.menuCard}>
            <Ban size={28} color={colors.loss} style={{ alignSelf: 'center', marginBottom: 12 }} />
            <Text style={styles.menuTitle}>@{user?.username ?? 'kullanıcı'} banlanacak</Text>
            {/*
              ⚠️ Sebep kullanıcıya gösteriliyor: sebepsiz ban, itiraz
              edilemeyen bir bandır. Sunucu da boş sebebi reddediyor.
            */}
            <TextInput
              style={{ backgroundColor: colors.surfacePressed, borderRadius: 14, padding: 16, color: colors.ink, fontFamily: fonts.regular, minHeight: 72, textAlignVertical: 'top', marginBottom: 16 }}
              value={banReason}
              onChangeText={setBanReason}
              placeholder="Ban sebebi"
              placeholderTextColor={colors.inkMuted}
              multiline
              maxLength={280}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[styles.menuItem, { flex: 1, justifyContent: 'center', backgroundColor: colors.surfacePressed, borderRadius: 14 }]} onPress={() => setIsBanning(false)}>
                <Text style={styles.menuText}>Vazgeç</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, { flex: 1, justifyContent: 'center', backgroundColor: colors.loss, borderRadius: 14 }]} onPress={() => void submitBan()} disabled={isUpdating}>
                <Text style={[styles.menuText, { color: '#FFF' }]}>{isUpdating ? 'Banlanıyor…' : 'Banla'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      <Modal visible={isConfirmingDelete} transparent animationType="fade" onRequestClose={() => setIsConfirmingDelete(false)}>
        <View style={{ flex: 1, backgroundColor: colors.backdrop, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.surface, width: '100%', maxWidth: 360, borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
            
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.lossSoft, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Trash2 size={32} color={colors.loss} />
            </View>

            <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink, marginBottom: 8 }}>Gönderiyi Sil</Text>
            
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted, textAlign: 'center', marginBottom: 28, paddingHorizontal: 8 }}>
              Bu gönderi kalıcı olarak silinecektir. Emin misiniz?
            </Text>

            <TouchableOpacity 
              onPress={() => setIsConfirmingDelete(false)} 
              activeOpacity={0.7}
              style={{ width: '100%', paddingVertical: 16, borderRadius: 14, backgroundColor: colors.surfacePressed, borderWidth: 1, borderColor: colors.border, alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.inkMuted, letterSpacing: 1 }}>VAZGEÇ</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => { setIsConfirmingDelete(false); handleDelete(); }} 
              activeOpacity={0.7}
              style={{ width: '100%', paddingVertical: 16, borderRadius: 14, backgroundColor: colors.loss, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: 'white', letterSpacing: 1 }}>SİL</Text>
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
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, marginBottom: 2 },
  time: { fontFamily: fonts.regular, fontSize: 12, color: colors.inkMuted },
  modalOverlay: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'flex-end' },
  menuCard: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  menuTitle: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink, marginBottom: 16 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 },
  menuText: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  badge: { backgroundColor: colors.gainSoft, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 14, borderWidth: 1, borderColor: colors.gainSoft },
  badgeText: { fontFamily: fonts.medium, fontSize: 12, color: colors.gain },

  // Modern Pnl Box
  modernPnlBox: { backgroundColor: colors.surfaceRaised, borderRadius: 14, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modernPnlLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted, marginBottom: 4 },
  modernPnlValue: { fontFamily: fonts.bold, fontSize: 26 },

  // Caption
  caption: { fontFamily: fonts.regular, fontSize: 16, color: colors.ink, lineHeight: 22, marginBottom: 16 },

  // Portfolio list (keeps functionality)
  positionsList: { gap: 12, marginBottom: 16, marginTop: -4 },
  positionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, /* ⚠️ Satır ayracı: elle yazılmış %3 beyaz yerine tema kenarlığı.
       Tema koyulaşırsa/açılırsa ayraç da onunla gider. */
    borderBottomColor: colors.border },
  positionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  positionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surfacePressed, justifyContent: 'center', alignItems: 'center' },
  positionIconText: { fontFamily: fonts.bold, fontSize: 14, color: colors.inkMuted, textTransform: 'uppercase' },
  positionName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  positionSymbol: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted },
  positionRight: { alignItems: 'flex-end' },
  positionPnl: { fontFamily: fonts.bold, fontSize: 14 },
  positionPct: { fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },

  // Footer Actions
  interactionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted },
});

