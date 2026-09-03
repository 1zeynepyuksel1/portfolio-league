import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Modal, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { Platform, DeviceEventEmitter } from 'react-native';
import { apiFetch } from '../api/client';
/*
  ⚠️ `onAccent`/`lossDeep` — beyaz yazı `accent`/`loss` üstünde 3,68/3,76:1
  kontrast veriyordu, WCAG 4,5:1 istiyor. Koyu tonlar 6,70/6,47:1.
*/
import { colors, fonts, radius, spacing, type } from '../theme';
import { formatCents } from '../lib/format';
import { Globe, Users, TrendingUp, TrendingDown, Heart, MessageSquare, MoreVertical, Trash2, Edit2, Pin, AlertTriangle, EyeOff, ShieldCheck, Ban, Crown, Trophy, History } from 'lucide-react-native';
import { createAvatar } from '@dicebear/core';
import { shapes } from '@dicebear/collection';
import { SvgXml } from 'react-native-svg';
import { AssetLogo } from './AssetLogo';
import { ConfirmModal } from './DesignKit';

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
/*
  ⚠️ İKİ BİÇİM: BU YIL İÇİN YILSIZ, ESKİ TARİHLER İÇİN YILLI.

  Tek biçim kullanınca satır taşıyordu:

      "31 Ağu 2026 13:17 → 1 Eyl 2026 13:47"   (36 karakter)

  Gönderi kartındaki pozisyon satırı solda ad + tarih, sağda tutar +
  yüzde taşıyor. Bu uzunluk sağdaki sütunu ekranın DIŞINA itiyordu ve
  tutarın sonu kırpılıyordu — kırpılan şey para.

  ⚠️ YIL, BU YIL İÇİNSE BİLGİ TAŞIMIYOR. Kullanıcı "31 Ağu" görünce
  zaten bu yılı anlıyor. Geçmiş yıllarda yıl şart, o zaman yazılıyor.
  Bilgi kaybı yok, 10 karakter kazanç var.
*/
const TARIH_SAAT_KISA = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const TARIH_SAAT_YILLI = new Intl.DateTimeFormat('tr-TR', {
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

  const buYil = d.getFullYear() === new Date().getFullYear();
  return (buYil ? TARIH_SAAT_KISA : TARIH_SAAT_YILLI).format(d);
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
              <Image source={localAvatars[user.avatarSeed]} style={styles.avatarFill} resizeMode="contain" />
            ) : user?.avatarSeed ? (
              <SvgXml xml={createAvatar(shapes, { seed: user.avatarSeed, backgroundColor: bgColors, shape1Color: shapeColors, shape2Color: shapeColors, shape3Color: shapeColors }).toString()} width="100%" height="100%" />
            ) : (
              <Text style={styles.avatarInitial}>{user?.firstName?.[0] || '?'}</Text>
            )}
          </View>
          <View style={styles.identityBlock}>
            <View style={styles.nameRow}>
                <Text style={[styles.name, styles.nameFlush]}>{user?.firstName || 'Kullanıcı'} {user?.lastName || ''}</Text>
                {isPinned && <Pin size={14} color={colors.accent} />}
              </View>
            <Text style={styles.time}>{isPreview ? 'Şimdi' : timeAgo(post.createdAt)}</Text>
          </View>
        </TouchableOpacity>
          {!isPreview && (
            <TouchableOpacity
              onPress={() => setMenuVisible(true)}
              style={styles.menuBtn}
              accessibilityRole="button"
              accessibilityLabel="Gönderi menüsü"
            >
              <MoreVertical size={20} color={colors.inkMuted} />
            </TouchableOpacity>
          )}
        </View>

      {/* 2. Main Box Area (Pnl / Horoscope / Wheel) */}

                {/* WHAT IF UI */}
        {isWhatIf && (() => {
          const now = new Date();
          const todayStr = ('0' + now.getDate()).slice(-2) + '.' + ('0' + (now.getMonth() + 1)).slice(-2) + '.' + now.getFullYear();
          const nominalStr = typeof payload.nominalMultiple === 'number' ? payload.nominalMultiple.toFixed(1) : parseFloat(payload.nominalMultiple || 0).toFixed(1);
          const realStr = typeof payload.realMultiple === 'number' ? payload.realMultiple.toFixed(1) : parseFloat(payload.realMultiple || 0).toFixed(1);

          /*
            ⚠️ YAN YANA DEĞİL, ÜST ÜSTE.

            Eski düzen solda başlık+cümle, sağda 12.5x kutusu idi.
            Kutu ~100pt çalınca "UnitedHealth" hece ortasından kırılıyor,
            yeşil tutardaki ₺ ayrı satıra düşüyordu. Çarpan zaten alt
            şeritte duruyor; üstte tekrar etmek hem yer hem simetri
            bozuyordu.
          */
          return (
            <View style={styles.whatIfCard}>
              <View style={styles.whatIfBadge}>
                {/*
                  ⚠️ EMOJİ (🕰️) YERİNE VEKTÖR İKON. Bu proje emoji simgeleri
                  zaten kaldırmıştı (commit c2f73a5); bu bir kalıntıydı —
                  `AssetDetailScreen`'in Ya Alsaydın düğmesiyle aynı ikon.
                */}
                <History size={16} color={colors.gain} strokeWidth={2.25} style={styles.whatIfBadgeIcon} />
                <Text style={styles.whatIfBadgeText}>Zaman Yolculuğu</Text>
              </View>

              <Text
                style={styles.whatIfTitle}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {payload.assetName}
              </Text>
              <Text style={styles.whatIfDates}>
                {payload.startDate} → {todayStr}
              </Text>
              <Text style={styles.whatIfBody}>
                {'O gün '}
                <Text style={styles.whatIfAmount}>{payload.initialTry}</Text>
                {' değerinde alsaydım,'}
              </Text>
              <Text style={[styles.whatIfBody, styles.whatIfBodyLast]}>
                {'bugün '}
                <Text style={styles.whatIfAmountGain}>{payload.finalTry}</Text>
                {' olurdu.'}
              </Text>

              <View style={styles.whatIfStats}>
                <View style={styles.whatIfStat}>
                  <Text style={styles.whatIfStatLabel}>KÂĞIT ÜZERİNDE</Text>
                  <Text style={styles.whatIfStatValue}>{nominalStr}×</Text>
                </View>
                <View style={styles.whatIfStatDivider} />
                <View style={styles.whatIfStat}>
                  <Text style={styles.whatIfStatLabel}>ENFLASYONDAN SONRA</Text>
                  <Text style={styles.whatIfStatValue}>{realStr}×</Text>
                </View>
              </View>
            </View>
          );
        })()}
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
          /*
            ⚠️ `zemin` VE `kenar` AYNI ÜÇLÜ KOŞULUN İKİ KOPYASIYDI —
            harfi harfine aynı. Birini değiştirip diğerini unutmak an
            meselesiydi.
          */
          const zemin = rank === 1 ? colors.goldSoft : rank === 2 ? colors.silverSoft : rank === 3 ? colors.bronzeSoft : colors.accentSoft;
          const baslik = rank === 1 ? 'Altın Taç Sahibi!' : rank === 2 ? 'Gümüş Taç Sahibi!' : rank === 3 ? 'Bronz Taç Sahibi!' : `Ligi ${rank}. sırada tamamladı`;
          const donem = payload.periodName ?? payload.leagueName ?? 'Haftalık lig';
          const yuzde = payload.twrPercent;

          return (
          <View style={[styles.crownCard, { backgroundColor: zemin, borderColor: zemin }]}>
            {/*
              ⚠️ GÖLGE RENGİ MADALYANIN KENDİ RENGİ — veriden geliyor,
              bu yüzden `shadowColor` StyleSheet'e taşınamıyor.
            */}
            <View style={[styles.crownWell, { backgroundColor: renk, shadowColor: renk }]}>
              {/*
                ⚠️ İlk üçte taç, sonrasında kupa. Dokuzuncu olan birine
                taç çizmek ödülü değersizleştirirdi; kupa "katıldın ve
                bitirdin" diyor, taç "kazandın" diyor.
              */}
              {madalya
                ? <Crown size={32} color={colors.onAccent} strokeWidth={2.5} fill={colors.onAccent} />
                : <Trophy size={30} color={colors.onAccent} strokeWidth={2.5} />}
            </View>
            <Text style={styles.crownTitle}>
              {baslik}
            </Text>
            <Text style={styles.crownBody}>
              {donem}
              {payload.totalParticipants !== undefined ? ` · ${payload.totalParticipants} katılımcı` : ''}
            </Text>
            {/*
              ⚠️ YÜZDE, TUTAR DEĞİL. Ligin ölçütü TWR; mutlak tutar
              göstermek "kim daha zengin"e kayardı ve TWR'nin seçilme
              sebebi tam olarak buydu.
            */}
            {yuzde !== undefined && (
              <Text style={[styles.crownPct, { color: String(yuzde).startsWith('-') ? colors.loss : colors.gain }]}>
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
              <Text style={styles.pnlMeta}>
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

                  <View style={styles.positionMain}>
                    <Text style={styles.positionName} numberOfLines={1}>{pos.name}</Text>
                    <View style={styles.positionDates}>
                      <Text style={styles.positionDate}>{buyDateStr}</Text>
                      <Text style={styles.positionDate}>➔</Text>
                      <Text style={styles.positionDate}>{olcumAni(payload, post)}</Text>
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
        <View style={styles.editWrap}>
          <TextInput
            style={[styles.caption, styles.captionInput]}
            multiline
            autoFocus
            value={editCaption}
            onChangeText={setEditCaption}
            placeholder="Gönderine bir açıklama ekle..."
            placeholderTextColor={colors.inkMuted}
          />
          <View style={styles.editActions}>
            <TouchableOpacity
              onPress={() => { setIsEditing(false); setEditCaption(localCaption); }}
              style={[styles.editBtn, styles.editBtnGhost]}
              accessibilityRole="button"
            >
              <Text style={styles.editBtnText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleEditSave}
              disabled={isUpdating}
              style={[styles.editBtn, styles.editBtnPrimary]}
              accessibilityRole="button"
              accessibilityState={{ disabled: isUpdating }}
            >
              {isUpdating
                ? <ActivityIndicator size="small" color={colors.onAccent} />
                : <Text style={[styles.editBtnText, styles.editBtnTextOn]}>Kaydet</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : !!localCaption ? (
        <Text style={styles.caption}>{localCaption}</Text>
      ) : null}

      {/* 5. Footer (Likes & Comments Mockup) */}
      {!isPreview ? (
        <View style={styles.interactionFooter}>
          <View style={styles.actionGroup}>
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
          <View style={styles.visibilityGroup}>
            <View style={[styles.badge, styles.visibilityBadge]}>
              <Text style={[styles.badgeText, styles.visibilityBadgeText]}>{badgeText}</Text>
            </View>
            {localVis === 'public' ? (
              <Globe size={14} color={colors.inkMuted} />
            ) : (
              <Users size={14} color={colors.inkMuted} />
            )}
          </View>
        </View>
      ) : (
        <View style={[styles.interactionFooter, styles.interactionFooterMuted]}>
           <View style={styles.actionGroup}>
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
      {/*
        ⚠️ DÖRT ONAY KUTUSU `DesignKit.ConfirmModal`'A TAŞINDI — bkz.
        bileşenin kendi yorumu: iki farklı tasarım vardı, biri kazandı.
      */}
      <ConfirmModal
        visible={showToast}
        icon={Pin}
        title="Başa Sabitlendi"
        description="Gönderi başarıyla profilinin en üstüne sabitlendi. Hemen görmek ister misin?"
        cancelLabel="KAPAT"
        confirmLabel="PROFİLDE GÖR"
        onCancel={() => setShowToast(false)}
        onConfirm={() => { setShowToast(false); if (onPressUser && user?.username) onPressUser(user.username); }}
      />

      {/* 3-DOT MENU MODAL */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuCard}>
            {isUpdating && <ActivityIndicator color={colors.accent} style={styles.menuSpinner} />}

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
                <View style={styles.menuDivider} />
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
                <View style={styles.menuDivider} />
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
                    <View style={styles.menuDivider} />
                    <View style={styles.adminLabelRow}>
                      <ShieldCheck size={14} color={colors.accent} />
                      <Text style={styles.adminLabel}>YÖNETİCİ</Text>
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
      <ConfirmModal
        visible={isConfirmingAdminDelete}
        icon={Trash2}
        tone="danger"
        title="Gönderiyi sil"
        description={`@${user?.username ?? 'kullanıcı'} adlı kişinin gönderisi kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
        cancelLabel="VAZGEÇ"
        confirmLabel="SİL"
        onCancel={() => setIsConfirmingAdminDelete(false)}
        onConfirm={() => { setIsConfirmingAdminDelete(false); void handleAdminDelete(); }}
      />

      <ConfirmModal
        visible={isBanning}
        icon={Ban}
        tone="danger"
        title={`@${user?.username ?? 'kullanıcı'} banlanacak`}
        cancelLabel="VAZGEÇ"
        confirmLabel={isUpdating ? 'BANLANIYOR…' : 'BANLA'}
        onCancel={() => setIsBanning(false)}
        onConfirm={() => void submitBan()}
        busy={isUpdating}
      >
        {/*
          ⚠️ Sebep kullanıcıya gösteriliyor: sebepsiz ban, itiraz
          edilemeyen bir bandır. Sunucu da boş sebebi reddediyor.
          Bu alan `ConfirmModal`'ın `children` yuvasında.
        */}
        <TextInput
          style={styles.banInput}
          value={banReason}
          onChangeText={setBanReason}
          placeholder="Ban sebebi"
          placeholderTextColor={colors.inkMuted}
          multiline
          maxLength={280}
        />
      </ConfirmModal>

      <ConfirmModal
        visible={isConfirmingDelete}
        icon={Trash2}
        tone="danger"
        title="Gönderiyi Sil"
        description="Bu gönderi kalıcı olarak silinecektir. Emin misiniz?"
        cancelLabel="VAZGEÇ"
        confirmLabel="SİL"
        onCancel={() => setIsConfirmingDelete(false)}
        onConfirm={() => { setIsConfirmingDelete(false); handleDelete(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },

  // --- BAŞLIK -----------------------------------------------------------
  avatarFill: { width: '100%', height: '100%' },
  avatarInitial: { fontFamily: fonts.bold, color: colors.inkMuted },
  identityBlock: { justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  /* `name` kendi `marginBottom`'unu taşıyor; satır içinde gerekmiyor. */
  nameFlush: { marginBottom: 0 },
  menuBtn: {
    /* ⚠️ 8pt dolgu + 20pt simge ~36pt veriyordu, taban 44pt. */
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginRight: -8,
  },

  // --- TAÇ KARTI ----------------------------------------------------------
  crownCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  crownWell: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  crownTitle: {
    fontFamily: fonts.bold,
    fontSize: type.title,
    color: colors.ink,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  crownBody: {
    fontFamily: fonts.medium,
    fontSize: type.body,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  crownPct: {
    fontFamily: fonts.bold,
    fontSize: type.emphasis,
    marginTop: spacing.sm,
  },

  // --- POZİSYON -------------------------------------------------------
  pnlMeta: {
    fontFamily: fonts.medium,
    fontSize: type.caption,
    color: colors.inkMuted,
    marginTop: spacing.sm,
  },
  /* ⚠️ `minWidth: 0` olmadan uzun varlık adı sağdaki tutarı ekran dışına iter. */
  positionMain: { flex: 1, minWidth: 0 },
  positionDates: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  positionDate: { fontFamily: fonts.medium, fontSize: type.caption, color: colors.inkMuted },

  // --- AÇIKLAMA DÜZENLEME ---------------------------------------------
  editWrap: { marginBottom: spacing.md },
  captionInput: {
    backgroundColor: colors.surfacePressed,
    padding: spacing.group,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    minHeight: 44,
  },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  editBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.group,
    borderRadius: radius.lg,
  },
  editBtnGhost: { backgroundColor: colors.surfacePressed },
  editBtnPrimary: { backgroundColor: colors.accentDeep },
  editBtnText: { fontFamily: fonts.medium, fontSize: type.body, color: colors.ink },
  editBtnTextOn: { color: colors.onAccent },

  // --- ALT SATIR ------------------------------------------------------
  actionGroup: { flexDirection: 'row', gap: spacing.lg },
  interactionFooterMuted: { opacity: 0.5 },
  visibilityGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  visibilityBadge: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    /*
      ⚠️ `rgba(16, 185, 129, 0.05)` ELLE YAZILIYDI — `gain`'in %5'i.
      Temadaki `gainSoft` %15; kenarlık zaten `gainSoft`'tı, yani zemin
      ve kenar iki ayrı kaynaktan besleniyordu. Artık ikisi de aynı.
    */
    backgroundColor: colors.gainSoft,
    borderColor: colors.gainSoft,
  },
  visibilityBadgeText: { fontSize: type.micro },

  // --- MENÜ / BAN -------------------------------------------------------
  menuSpinner: { position: 'absolute', top: spacing.md, right: spacing.md },
  menuDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  adminLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  adminLabel: {
    fontFamily: fonts.bold,
    fontSize: type.caption,
    color: colors.accent,
    letterSpacing: 0.5,
  },
  banInput: {
    width: '100%',
    backgroundColor: colors.surfacePressed,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: type.body,
    minHeight: 72,
    textAlignVertical: 'top',
    marginBottom: 28,
  },

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

  whatIfCard: {
    backgroundColor: 'rgba(34, 197, 94, 0.05)',
    padding: 16,
    borderRadius: radius.md,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  whatIfBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.xs,
    marginBottom: 12,
  },
  whatIfBadgeIcon: { marginRight: 6 },
  whatIfBadgeText: { fontFamily: fonts.semibold, fontSize: type.body, color: colors.gain },
  whatIfTitle: {
    fontFamily: fonts.bold,
    fontSize: type.title,
    lineHeight: 28,
    color: colors.ink,
  },
  whatIfDates: {
    fontFamily: fonts.medium,
    fontSize: type.body,
    color: colors.inkMuted,
    marginTop: 4,
    marginBottom: 12,
  },
  whatIfBody: {
    fontFamily: fonts.medium,
    fontSize: type.emphasis,
    lineHeight: 22,
    color: colors.inkMuted,
    marginBottom: 0,
  },
  whatIfBodyLast: { marginBottom: 16 },
  whatIfAmount: { color: colors.ink, fontFamily: fonts.semibold },
  /*
    ⚠️ Tutar ile gövde AYNI punto. İç içe 18px yazı satır yüksekliğini
    bozuyor; ₺ ayrı bir Text düğümü olunca kelime sınırında yalnız
    kalıyordu. Renk yeter, büyüklük değil.
  */
  whatIfAmountGain: { color: colors.gain, fontFamily: fonts.bold },
  whatIfStats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.surfaceRaised,
    paddingVertical: 12,
    borderRadius: 12,
  },
  whatIfStat: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  whatIfStatDivider: { width: 1, backgroundColor: colors.border },
  whatIfStatLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.inkMuted,
    marginBottom: 4,
    textAlign: 'center',
  },
  whatIfStatValue: { fontFamily: fonts.bold, fontSize: type.title, color: colors.gain },

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
  /*
    ⚠️ `flex: 1` + `minWidth: 0` BERABER OLMAK ZORUNDA.

    Sol sütun içeriği kadar yer kaplıyordu; uzun tarih satırı onu
    büyütünce sağdaki tutar ekranın DIŞINA itiliyordu. `flex: 1` "kalan
    yeri al" diyor, `minWidth: 0` ise "gerekirse içeriğinden de küçül"
    diyor. İkincisi olmadan flex kutusu içeriğinin altına inemiyor ve
    taşma devam ediyor — flexbox'ın en sık atlanan kuralı.
  */
  positionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  positionIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surfacePressed, justifyContent: 'center', alignItems: 'center' },
  positionIconText: { fontFamily: fonts.bold, fontSize: 14, color: colors.inkMuted, textTransform: 'uppercase' },
  positionName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  positionSymbol: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted },
  /*
    ⚠️ `flexShrink: 0` — SAYILAR ASLA KIRPILMAZ.

    Varsayılan olarak flex çocukları sıkışınca küçülür. Sağdaki sütun
    para taşıyor; kırpılmış bir tutar yanlış okunur. Sıkışma olacaksa
    soldaki metin kısalsın, sayı değil.
  */
  positionRight: { alignItems: 'flex-end', flexShrink: 0, paddingLeft: 12 },
  positionPnl: { fontFamily: fonts.bold, fontSize: 14 },
  positionPct: { fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },

  // Footer Actions
  interactionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted },
});

