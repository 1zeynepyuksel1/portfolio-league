import { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, Pressable, View, Modal, SafeAreaView, Platform, StatusBar as RNStatusBar, Image } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { apiFetch } from '../api/client';
import { getMe } from '../lib/me';
import { EmptyState } from '../components/EmptyState';
import { Newspaper } from 'lucide-react-native';
import { Crown, ShieldCheck, Ban } from 'lucide-react-native';
import { AdminScreen } from './AdminScreen';
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

/**
 * Derece -> madalya rengi.
 *
 * ⚠️ RENKLER ELLE YAZILMIŞTI ('#94A3B8', '#B45309') ve tema
 * değiştiğinde GERİDE KALIYORLARDI. `colors.bronze` mordan gerçek
 * bronza çevrildiğinde bu satır hâlâ eski değeri taşıyordu; aynı
 * madalya iki ekranda iki farklı renk oluyordu.
 *
 * ⚠️ Üçlü koşul yerine fonksiyon: aynı ifade `color` ve `fill` için
 * İKİ KEZ yazılıyordu. İkisinden birini güncelleyip diğerini unutmak
 * an meselesiydi.
 */
function madalyaRengi(rank: number | null | undefined): string {
  if (rank === 1) return colors.gold;
  if (rank === 2) return colors.silver;
  return colors.bronze;
}

/*
  ⚠️ DAĞILIM PALETİ ARTIK TEMADAN TÜRETİLİYOR.

  Altı hex elle yazılmıştı ve beşi temadaki renklerin KOPYASIYDI
  (#f59e0b=gold, #cbd5e1=silver, #3b82f6=accent, #10b981=gain,
  #8b5cf6=violet). Tema değişince kopyalar geride kalıyordu — nitekim
  #f59e0b artık `gold` değil, `warn`.

  ⚠️ Bu bir ANLAM paleti değil, AYIRT ETME paleti: dilimlerin
  birbirinden ayrılması için var, "yeşil=kâr" gibi bir şey söylemiyor.
  Yine de token'dan gelmesi gerekiyor ki tema değiştiğinde uyum bozulmasın.
*/
const ASSET_COLORS = [
  colors.gold,
  colors.silver,
  colors.inkFaint,
  colors.accent,
  colors.gain,
  colors.violet,
];
const getAssetColor = (index: number) => ASSET_COLORS[index % ASSET_COLORS.length];

type ProfileSlice = { symbol: string; name: string; sharePercent: string | null; profitPercent: string | null; };
type PublicProfile = {
  username: string; firstName: string; lastName: string; avatarSeed?: string | null; avatarStyle?: string | null;
  isSelf: boolean; isFriend: boolean; isPublic: boolean; allocationVisibility?: string; visible: boolean;
  /**
   * 'user' | 'admin'. Sunucu bunu YALNIZCA kendi profilinde dolduruyor;
   * başkasının profilinde her zaman 'user' geliyor.
   *
   * ⚠️ Yetki değil, arayüz ipucu. Yönetim uçlarının kendi kontrolü var.
   */
  role?: string;
  twrPercent: string | null; rank: number | null; totalParticipants: number | null;
  achievementsCount?: number; allocation: ProfileSlice[]; pending: 'outgoing' | 'incoming' | null;
  friendCount: number; mutualFriendCount: number; pendingRequests: number;
  lastWeekRank?: number | null;
  lastWeekLeagueName?: string | null;
};

export function ProfileScreen({ username, onClose, onOpenFriends, onLogout, onSelectUser, currentUserId }: { username: string; onClose?: () => void; onOpenFriends?: () => void; onLogout?: () => void; onSelectUser?: (username: string) => void; currentUserId?: string; }) {
  
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<any[]>([]);

  /*
    Profil içi sekmeler: Portföy | Paylaşımlar.

    ⚠️ İKİSİ ALT ALTA DURUYORDU VE PORTFÖY HİÇ GÖRÜNMÜYORDU. Sekmeye
    ayırmanın iki kazancı var: uzun sayfa kısalıyor, ve portföyü
    GİZLİ olan kullanıcıda sekme hiç çizilmediği için "burada bir şey
    vardı ama göremiyorum" hissi doğmuyor — olmayan bir şey aranmıyor.
  */
  const [profileTab, setProfileTab] = useState<'portfolio' | 'posts'>('posts');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  /*
    ⚠️ Bu bayrak bir YETKİ DEĞİL, sadece ekranın açık olup olmadığı.
    Yönetici olmayan biri kodu değiştirip burayı `true` yapsa bile
    `/admin/*` uçları 403 döner — yetki sunucuda.
  */
  const [showAdmin, setShowAdmin] = useState(false);
  /*
    ⚠️ `profile.role` BAŞKASININ PROFİLİNDE HER ZAMAN 'user' — sunucu
    rolü yalnızca kendi profilinde gönderiyor (kim yönetici bilgisini
    sızdırmamak için). Bu yüzden "BEN yönetici miyim" ayrı okunuyor.

    İkisini karıştırmak kolay bir hata olurdu: `profile.role` başkasının
    profilinde bakılınca hep 'user' döneceği için ban düğmesi HİÇ
    görünmezdi ve sebebi anlaşılmazdı.
  */
  const [amAdmin, setAmAdmin] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [banBusy, setBanBusy] = useState(false);
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
  /*
    ⚠️ GÜVENLİK SORUSU AYRI BİR İSTEKLE KAYDEDİLİYOR, profil PATCH'iyle
    değil. Sebep: cevabı sunucuda `argon2` ile hash'lemek gerekiyor ve o
    iş `PUT /auth/security-question` ucunda. Profil ucuna eklemek, kimlik
    sırlarını genel profil güncellemesinin içine karıştırmak olurdu.

    ⚠️ MEVCUT CEVAP HİÇ GERİ GELMİYOR — hash'in geri çevrilmesi mümkün
    değil ve olmamalı. Alanlar her açılışta boş; kullanıcı değiştirmek
    isterse ikisini de yeniden yazar.
  */
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  /*
    ⚠️ YARIM KALMIŞ TAÇ AÇILIR PENCERESİ KALDIRILDI — VE İKİ SEBEBİ VAR.

    1) HİÇ ÇİZİLMİYORDU. `showCrownPopup` kuruluyor ama JSX'te
       kullanılmıyordu; `handleShareCrown` da hiç çağrılmıyordu. Ölü kod,
       üstelik `@react-native-async-storage/async-storage`'ı import
       ettiği için DERLEMEYİ KIRIYORDU — o paket kurulu değil.

    2) İKİZİ VARDI. "Lig bitince ilk açılışta kutlama" isteği
       `components/LeagueResultModal.tsx` olarak zaten yapıldı ve
       App.tsx'te uygulama seviyesinde duruyor.

    ⚠️ ÖNEMLİ FARK — "görüldü mü" bilgisi NEREDE TUTULUYOR:

        buradaki (kaldırılan) : AsyncStorage — CİHAZDA
        LeagueResultModal     : league_entries.result_seen_at — SUNUCUDA

    Cihazda tutmak üç yerde bozulur: uygulamayı silip kuran, ikinci
    cihazdan giren ve tarayıcı verisini temizleyen kullanıcı aynı
    kutlamayı tekrar görür. Sunucudaki kayıt bunların üçünde de doğru.

    Taç ROZETİ kalıyor — o gerçekten çiziliyor ve `lastWeekRank`'ten
    besleniyor. Kaldırılan yalnızca hiç görünmeyen açılır pencere.
  */



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

  /*
    ⚠️ TAÇ ARTIK BURADAN GELMİYOR — `profile.lastWeekRank`'ten geliyor.

    Önce `lib/champion.ts` yazmıştım: ayrı bir uç (`GET /leagues/champion`)
    ve modül seviyesinde önbellek. Zeynep aynı işi profil yanıtının içine
    koydu ve ilk ÜÇE genişletti (altın / gümüş / bronz).

    Onunki kazandı: veri zaten çekilen yanıtın içinde, ek istek yok ve
    ekran tek bir kaynağa bakıyor. Benim modülüm ve ucu silindi —
    kullanılmayan kod, bu projede en çok tuzağa düşüren şey.

    Bu efekt artık yalnızca "ben yönetici miyim" sorusunu soruyor.
  */
  useEffect(() => {
    void getMe().then((me) => setAmAdmin(me?.role === 'admin'));
  }, []);

  useEffect(() => {
    void load();
    const sub = DeviceEventEmitter.addListener('refreshProfile', () => { void load(); });
    return () => sub.remove();
  }, [load]);

  const handleSaveSettings = async () => {
    setSavingSettings(true); setSettingsError('');
    try {
      /*
        ⚠️ `allocationVisibility` BURADAN ÇIKARILDI — YANLIŞ UCA
        GİDİYORDU VE HİÇ KAYDEDİLMİYORDU.

        `PATCH /users/me` yalnızca ad, soyad ve şifre yazıyor;
        şeması bu alanı hiç tanımıyordu ve Zod bilinmeyen anahtarı
        SESSİZCE atıyordu. İstek 200 dönüyor, ekran "kaydedildi"
        diyor, veritabanı değişmiyordu.

        ⚠️ Görünürlük ayarlarının tek adresi artık
        `PATCH /users/me/visibility` ve ikisini birden alıyor.
      */
      await apiFetch('/users/me', { method: 'PATCH', body: JSON.stringify({ firstName: editFirstName, lastName: editLastName, password: editPassword ? editPassword : undefined }) });

      /*
        ⚠️ KOŞUL KALDIRILDI. Önceden yalnızca `isPublic` DEĞİŞTİYSE
        gönderiliyordu; portföy görünürlüğü tek başına değiştirilirse
        istek hiç atılmıyordu. İkisi tek uca gittiği için koşul
        artık ikisini birden susturuyordu.
      */
      await apiFetch('/users/me/visibility', {
        method: 'PATCH',
        body: JSON.stringify({ isPublic: editIsPublic, allocationVisibility: editAlloc }),
      });

      /*
        ⚠️ İKİSİ BİRDEN DOLU DEĞİLSE HİÇ GÖNDERİLMİYOR.

        Yalnızca soruyu değiştirip cevabı boş bırakan biri, hesabını
        cevabı bilinmeyen bir soruyla kilitlerdi: sıfırlama akışı çalışır
        ama hiçbir cevap tutmaz. İkisi tek bir bütün.
      */
      if (editQuestion.trim() !== '' && editAnswer.trim() !== '') {
        await apiFetch('/auth/security-question', { method: 'PUT', body: JSON.stringify({ question: editQuestion.trim(), answer: editAnswer.trim() }) });
        setEditQuestion(''); setEditAnswer('');
      } else if (editQuestion.trim() !== '' || editAnswer.trim() !== '') {
        throw new Error('Güvenlik sorusu için hem soruyu hem cevabı doldur.');
      }
      await load(); setShowSettings(false); setEditPassword('');
    } catch (err) { setSettingsError(err instanceof Error ? err.message : 'Ayarlar kaydedilemedi.'); } finally { setSavingSettings(false); }
  };

  const submitBan = async () => {
    if (banReason.trim().length < 3) { showToast('Ban sebebi yazmalısın', 'error'); return; }
    setBanBusy(true);
    try {
      await apiFetch(`/admin/users/by-username/${profile?.username}/ban`, { method: 'POST', body: JSON.stringify({ reason: banReason.trim() }) });
      setBanOpen(false); setBanReason('');
      showToast('@' + profile?.username + ' banlandı');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Banlanamadı', 'error');
    } finally { setBanBusy(false); }
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

  /*
    ⚠️ PORTFÖY GÖRÜNÜRLÜĞÜNÜ İSTEMCİ HESAPLAMIYOR, SUNUCUDAN OKUYOR.

    Kural sunucuda: `profile/service.ts:299` — `allocation` dizisi
    ya dolu gelir (kendisi · herkese açık · arkadaşsa "friends")
    ya da BOŞ. Burada tek yaptığımız "dolu mu" diye bakmak.

    Kuralı burada yeniden yazsaydık (isSelf, isFriend,
    allocationVisibility okuyup karar vermek) iki yerde yaşayan bir
    kural olurdu ve biri değiştiğinde öteki geride kalırdı —
    nitekim eski kod tam olarak bunu yapıyordu.
  */
  const portfoyGorunur =
    Array.isArray(profile.allocation) && profile.allocation.length > 0;

  /*
    ⚠️ "GİZLİ" İLE "BOŞ" AYRI ŞEYLER — VE SEKMEYİ SAKLAMAK BUNU
    AYIRT EDİLEMEZ KILIYORDU.

    Önce sekmeyi yalnızca portföy görülebiliyorsa çizdim; gerekçem
    "olmayan bir şey aranmaz"dı. Kullanımda yanlış çıktı: arkadaş
    ekleyen kullanıcı portföyü görmeyi bekliyor, sekme hiç
    görünmüyor ve ortada bir AÇIKLAMA yok. Kişinin portföyü mü boş,
    yoksa gizli mi — bilinmiyor.

    Sessizlik, yanlış varsayıma davetiye. Sekme artık her zaman
    duruyor; içinde ya dağılım ya da NEDEN göremediğin yazıyor.

    ⚠️ Kuralı yine sunucudan okuyoruz, yeniden hesaplamıyoruz:
    `allocationVisibility` + `isFriend`. `private` arkadaşları da
    kapsar — "hiç kimse" gerçekten hiç kimse demek.
  */
  const gorunurlukAyari = profile.allocationVisibility ?? 'private';
  const portfoyGizli =
    !profile.isSelf &&
    (gorunurlukAyari === 'private' ||
      (gorunurlukAyari === 'friends' && !profile.isFriend));

  const bgColors = [colors.surfaceRaised.replace('#',''), colors.surfacePressed.replace('#','')];
  const shapeColors = [colors.gain, colors.loss, colors.warn, colors.gold, colors.accent].map(c => c.replace('#', ''));

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={colors.inkMuted} />}>
        {onClose !== undefined && (
          <TouchableOpacity onPress={onClose} hitSlop={12} style={{ position: 'absolute', top: Platform.OS === 'ios' ? 48 : 24, left: 16, zIndex: 10, padding: 8, backgroundColor: colors.backdrop, borderRadius: 20 }}>
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
                <Text style={{ fontFamily: fonts.bold, fontSize: 26, color: '#FFF' }}>{profile?.firstName.slice(0, 1).toLocaleUpperCase('tr')}{profile?.lastName.slice(0, 1).toLocaleUpperCase('tr')}</Text>
              )}
            </View>

            {/* CROWN LOGIC based on lastWeekRank */}
              {profile.lastWeekRank && profile.lastWeekRank <= 3 ? (
                <View style={{ position: 'absolute', left: 40, top: -6, backgroundColor: colors.surface, borderRadius: 14, padding: 2, zIndex: 99 }}>
                  <Crown size={18} color={madalyaRengi(profile.lastWeekRank)} strokeWidth={2.5} fill={madalyaRengi(profile.lastWeekRank)} />
                </View>
              ) : null}

            <View style={{ marginLeft: 16 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink }}>{profile.firstName} {profile.lastName}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted }}>@{profile.username}</Text>
            </View>
          </View>
          
          {profile.isSelf ? (
            /*
              ⚠️ FRAGMENT (<>...</>) ŞART — ve nedeni bir hatadan geliyor.

              Ternary'nin bir dalı TEK bir eleman döndürmek zorunda. İki
              düğmeyi yan yana yazınca derleme kırıldı; sarmalayıcı bir
              <View> koymak da olmazdı çünkü dıştaki satır zaten yatay
              hizalıyor, araya kutu koymak hizayı bozardı.

              Fragment görünmeyen bir sarmalayıcı: gruplar ama çizmez.

              ⚠️ Yönetim düğmesi yalnızca yöneticiye görünüyor — KOLAYLIK
              olsun diye, güvenlik olsun diye değil. Sunucu `role`'ü zaten
              yalnızca kendi profilinde gönderiyor ve asıl kontrol
              `/admin/*` uçlarındaki `requireAdmin`.
            */
            <>
              {profile.role === 'admin' && (
                <TouchableOpacity onPress={() => setShowAdmin(true)} style={{ padding: 8, backgroundColor: colors.surfacePressed, borderRadius: 20, marginRight: 8 }}>
                  <ShieldCheck size={20} color={colors.accent} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setShowSettings(true)} style={{ padding: 8, backgroundColor: colors.surfacePressed, borderRadius: 20 }}>
                <Settings size={20} color={colors.inkMuted} />
              </TouchableOpacity>
            </>
          ) : (
            <View>
              {profile.isFriend ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gainSoft, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.gainSoft }}>
                  <Check size={16} color={colors.gain} style={{ marginRight: 8 }} />
                  <Text style={{ fontFamily: fonts.medium, color: colors.gain, fontSize: 14 }}>Arkadaş</Text>
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
                  <User size={16} color={profile.pending === 'outgoing' ? colors.inkMuted : profile.pending === 'incoming' ? '#FFF' : colors.accent} style={{ marginRight: 8 }} />
                  <Text style={{ fontFamily: fonts.bold, color: profile.pending === 'outgoing' ? colors.inkMuted : profile.pending === 'incoming' ? '#FFF' : colors.accent, fontSize: 14 }}>
                    {profile.pending === 'incoming' ? 'Kabul Et' : profile.pending === 'outgoing' ? 'Bekliyor' : 'Arkadaş Ekle'}
                  </Text>
                </TouchableOpacity>
              )}

              {/*
                ⚠️ BAN DÜĞMESİ ARKADAŞ DÜĞMESİNİN ALTINDA, YANINDA DEĞİL.
                Yan yana olsaydı "Arkadaş Ekle" ile "Banla" bir dokunuş
                mesafesinde dururdu; biri geri alınabilir, diğeri kişiyi
                uygulamadan atıyor.
              */}
              {amAdmin && !profile.isSelf && (
                <TouchableOpacity
                  onPress={() => { setBanReason(''); setBanOpen(true); }}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.loss, backgroundColor: colors.lossSoft }}
                >
                  <Ban size={14} color={colors.loss} style={{ marginRight: 8 }} />
                  <Text style={{ fontFamily: fonts.bold, color: colors.loss, fontSize: 12 }}>Banla</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <Modal visible={banOpen} transparent animationType="fade" onRequestClose={() => setBanOpen(false)}>
          <View style={{ flex: 1, backgroundColor: colors.backdrop, justifyContent: 'center', padding: 24 }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink, marginBottom: 8 }}>@{profile.username} banlanacak</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted, marginBottom: 16 }}>
                Sebep kullanıcıya gösterilir. Elindeki oturum anında geçersiz olur.
              </Text>
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
                <TouchableOpacity style={{ flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: colors.surfacePressed }} onPress={() => setBanOpen(false)}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.ink }}>Vazgeç</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center', backgroundColor: colors.loss }} onPress={() => void submitBan()} disabled={banBusy}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#FFF' }}>{banBusy ? 'Banlanıyor…' : 'Banla'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {!profile.visible ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 40, paddingVertical: 40, backgroundColor: colors.surfaceRaised, borderRadius: 20 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfacePressed, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Lock size={32} color={colors.inkMuted} />
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink, marginBottom: 8 }}>Gizli Profil</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted, textAlign: 'center', paddingHorizontal: 32, lineHeight: 22 }}>
              Bu profil gizlidir. Bilgilerini ve paylaşımlarını görmek için arkadaş olarak ekleyin.
            </Text>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
              {/* TWR */}
                <View style={{ flex: 1, minWidth: '45%', backgroundColor: colors.surfaceRaised, borderRadius: 14, padding: 16 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: rising ? colors.gainSoft : falling ? colors.lossSoft : colors.silverSoft, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                    {rising ? <TrendingUp size={20} color={colors.gain} /> : falling ? <TrendingDown size={20} color={colors.loss} /> : <TrendingUp size={20} color={colors.inkMuted} />}
                  </View>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted, marginBottom: 4 }}>HAFTALIK TWR</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: rising ? colors.gain : falling ? colors.loss : colors.ink }}>
                    {twr === null ? '—' : formatPercent(twr, true)}
                  </Text>
                </View>
                {/* League */}
                <View style={{ flex: 1, minWidth: '45%', backgroundColor: colors.surfaceRaised, borderRadius: 14, padding: 16 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.accentSoft, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                    <Trophy size={20} color={colors.accent} />
                  </View>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted, marginBottom: 4 }}>LİG SIRASI</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink }}>
                    {profile.rank === null ? '—' : `#${profile.rank}`}
                    {profile.totalParticipants ? <Text style={{ fontSize: 12, color: colors.inkMuted }}> / {profile.totalParticipants}</Text> : null}
                  </Text>
                </View>
                {/* Badges */}
                <TouchableOpacity onPress={() => setShowAchievements(true)} style={{ flex: 1, minWidth: '45%', backgroundColor: colors.surfaceRaised, borderRadius: 14, padding: 16 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.goldSoft, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                    <Award size={20} color={colors.bronze} />
                  </View>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted, marginBottom: 4 }}>ROZET</Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink }}>{profile.achievementsCount} Adet</Text>
                </TouchableOpacity>
                {/* Friends */}
                <TouchableOpacity onPress={() => onOpenFriends?.()} style={{ flex: 1, minWidth: '45%', backgroundColor: colors.surfaceRaised, borderRadius: 14, padding: 16 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.violetSoft, justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
                    {/* ⚠️ #8B5CF6 elle yazılmıştı ve bronzun ESKİ değeriyle
                        aynı hex'ti; ikisi alakasız ama aynı sayı olduğu için
                        birini değiştiren diğerini bozuyordu. */}
                    <Users size={20} color={colors.violet} />
                  </View>
                  {/*
                    ⚠️ BAŞKASININ ARKADAŞ SAYISI GÖSTERİLMİYOR — ONUN
                    BİLGİSİ. Yerine ORTAK arkadaş sayısı: o bilgi iki
                    tarafa da ait ve sosyal uygulamada işe yarayan şey
                    zaten bu — "tanıdık biri mi?".

                    ⚠️ Sunucu başkasının profilinde `friendCount`'ı
                    HİÇ HESAPLAMIYOR (0 gönderiyor). Yalnızca ekranda
                    gizleseydik sayı yine ağdan geçer ve konsoldan
                    okunabilirdi. Gizlemenin doğru yeri veriyi hiç
                    üretmemek.
                  */}
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted, marginBottom: 4 }}>
                    {profile.isSelf ? 'ARKADAŞ' : 'ORTAK'}
                  </Text>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink }}>
                    {profile.isSelf ? (profile.friendCount || 0) : (profile.mutualFriendCount || 0)}
                  </Text>
                </TouchableOpacity>
            </View>

            {/*
              ⚠️ SEKMELER YALNIZCA PORTFÖY GÖRÜLEBİLİYORSA ÇİZİLİYOR.

              Tek sekme sunan bir sekme çubuğu, sekme çubuğu değildir.
              Portföy gizliyse doğrudan paylaşımlar gösteriliyor.
            */}
            {(
              <View style={styles.profileTabs}>
                {([
                  { key: 'portfolio' as const, label: 'Portföy' },
                  { key: 'posts' as const, label: 'Paylaşımlar' },
                ]).map((s) => (
                  <TouchableOpacity
                    key={s.key}
                    onPress={() => setProfileTab(s.key)}
                    style={[styles.profileTab, profileTab === s.key && styles.profileTabOn]}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityState={{ selected: profileTab === s.key }}
                  >
                    <Text style={[styles.profileTabText, profileTab === s.key && styles.profileTabTextOn]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/*
              VARLIK DAĞILIMI.

              ⚠️ ESKİ KOŞUL `profile.isSelf && ...` İDİ — VE BU YÜZDEN
              BAŞKASININ PORTFÖYÜ HİÇBİR ZAMAN GÖRÜNMÜYORDU.

              Kullanıcı ayarını "herkese açık" yapsa bile ekran onu
              yok sayıyordu. Sunucu kararı zaten doğru veriyor
              (`profile/service.ts:299`): `allocation` dizisi
              görünürlük kuralına göre ya dolu ya BOŞ geliyor —
              `isSelf`, `public`, ya da `friends` + arkadaşsa dolu.

              ⚠️ DERS: SUNUCUNUN VERDİĞİ KARARI İSTEMCİDE TEKRAR VERME.
              Buradaki ikinci koşul sunucununkinden daha DAR olduğu
              için sızıntı yaratmadı — sessizce özelliği kapattı.
              Ters yönde olsaydı gizlilik ihlali olurdu. İki yerde
              yaşayan bir kural, er ya da geç ayrışır.
            */}
            {profileTab === 'portfolio' && !portfoyGorunur && (
              <View style={{ backgroundColor: colors.surfaceRaised, borderRadius: 20, padding: 24, marginBottom: 24, alignItems: 'center' }}>
                <Lock size={22} color={colors.inkFaint} strokeWidth={2} />
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.ink, marginTop: 10, textAlign: 'center' }}>
                  {portfoyGizli ? 'Portföyü gizli' : 'Portföyü boş'}
                </Text>
                {/*
                  ⚠️ İKİNCİ SATIR "NE YAPMALIYIM"I SÖYLÜYOR (K6 kuralı).
                  Yalnızca "gizli" demek bir kapı; "arkadaş olursanız
                  görebilirsin" bir yol.
                */}
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted, marginTop: 4, textAlign: 'center' }}>
                  {portfoyGizli
                    ? (gorunurlukAyari === 'friends'
                        ? 'Bu kullanıcı portföyünü yalnızca arkadaşlarına gösteriyor.'
                        : 'Bu kullanıcı portföyünü kimseye göstermiyor.')
                    : 'Bu kullanıcı henüz bir varlık almamış.'}
                </Text>
              </View>
            )}

            {profileTab === 'portfolio' && portfoyGorunur && (
              <View style={{ backgroundColor: colors.surfaceRaised, borderRadius: 20, padding: 16, marginBottom: 24 }}>
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

            {/* Paylaşımlar — portföy sekmesi açıkken gizleniyor. */}
            {profileTab === 'posts' && (
            <View>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink, marginBottom: 16 }}>Paylaşımlar</Text>
              {posts.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 32, backgroundColor: colors.surfaceRaised, borderRadius: 20 }}>
                  <EmptyState
                    compact
                    icon={Newspaper}
                    title="Henüz paylaşım yok"
                    description={profile.isSelf
                      ? 'Portföyünü ya da bir varlığını paylaştığında burada görünecek.'
                      : 'Bu kullanıcı henüz bir şey paylaşmamış.'}
                  />
                </View>
              ) : (
                <View style={{ gap: 16 }}>
                  {posts.map(post => (
                    <PostCard key={post.id} post={post} user={profile} isPreview={false} currentUserId={currentUserId} onPressUser={(u) => { if (u !== profile.username && onSelectUser) onSelectUser(u); }} />
                  ))}
                </View>
              )}
            </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={showAdmin} animationType="slide" presentationStyle="pageSheet">
        <AdminScreen onClose={() => setShowAdmin(false)} />
      </Modal>

      {/* Settings Modal (kept simple for brevity, functionality preserved) */}
      <Modal visible={showSettings} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink }}>Ayarlar</Text>
            <TouchableOpacity onPress={() => setShowSettings(false)} style={{ padding: 8 }}><X size={24} color={colors.ink} /></TouchableOpacity>
          </View>
          <ScrollView
        showsVerticalScrollIndicator={false} style={{ padding: 16 }}>

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
            <TextInput style={{ backgroundColor: colors.surfaceRaised, padding: 12, borderRadius: 10, color: colors.ink, fontFamily: fonts.medium, marginBottom: 16 }} value={editFirstName} onChangeText={setEditFirstName} />
            <Text style={{ fontFamily: fonts.medium, color: colors.ink, marginBottom: 8 }}>Soyad</Text>
            <TextInput style={{ backgroundColor: colors.surfaceRaised, padding: 12, borderRadius: 10, color: colors.ink, fontFamily: fonts.medium, marginBottom: 16 }} value={editLastName} onChangeText={setEditLastName} />

            <Text style={{ fontFamily: fonts.medium, color: colors.ink, marginBottom: 8, marginTop: 16 }}>Yeni Şifre</Text>
            <TextInput 
              style={{ backgroundColor: colors.surfaceRaised, padding: 12, borderRadius: 10, color: colors.ink, fontFamily: fonts.medium, marginBottom: 16 }} 
              value={editPassword} 
              onChangeText={setEditPassword} 
              placeholder="Değiştirmek istemiyorsanız boş bırakın"
              placeholderTextColor={colors.inkMuted}
              secureTextEntry
            />

            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 32 }}>
              <View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink }}>Herkese Açık Profil</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted, marginTop: 4 }}>Kapalı olduğunda sadece arkadaşların görebilir.</Text>
              </View>
              <Switch value={editIsPublic} onValueChange={setEditIsPublic} trackColor={{ false: colors.surfacePressed, true: colors.accent }} />
              </View>

              <View style={{ marginTop: 24, marginBottom: 32 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink }}>Varlık Dağılımı (Portföy) Kimlere Görünsün?</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted, marginTop: 4, marginBottom: 12 }}>Cüzdanındaki hisse ve coin dağılımını (yüzdelerini) kimlerin görebileceğini seç.</Text>
                <View style={{ flexDirection: 'row', backgroundColor: colors.surfacePressed, borderRadius: 10, padding: 4 }}>
                  <TouchableOpacity onPress={() => setEditAlloc('private')} style={{ flex: 1, paddingVertical: 12, borderRadius: 6, backgroundColor: editAlloc === 'private' ? '#FFF' : 'transparent', alignItems: 'center', shadowColor: editAlloc === 'private' ? '#000' : 'transparent', shadowOpacity: 0.1, shadowRadius: 2, elevation: editAlloc === 'private' ? 2 : 0 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: editAlloc === 'private' ? '#000' : colors.inkMuted }}>Hiç Kimse</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditAlloc('friends')} style={{ flex: 1, paddingVertical: 12, borderRadius: 6, backgroundColor: editAlloc === 'friends' ? '#FFF' : 'transparent', alignItems: 'center', shadowColor: editAlloc === 'friends' ? '#000' : 'transparent', shadowOpacity: 0.1, shadowRadius: 2, elevation: editAlloc === 'friends' ? 2 : 0 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: editAlloc === 'friends' ? '#000' : colors.inkMuted }}>Arkadaşlar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditAlloc('public')} style={{ flex: 1, paddingVertical: 12, borderRadius: 6, backgroundColor: editAlloc === 'public' ? '#FFF' : 'transparent', alignItems: 'center', shadowColor: editAlloc === 'public' ? '#000' : 'transparent', shadowOpacity: 0.1, shadowRadius: 2, elevation: editAlloc === 'public' ? 2 : 0 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: editAlloc === 'public' ? '#000' : colors.inkMuted }}>Herkes</Text>
                  </TouchableOpacity>
                </View>
              </View>


              <View style={{ marginTop: 8, marginBottom: 32 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.ink }}>Güvenlik Sorusu</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted, marginTop: 4, marginBottom: 12 }}>
                  Şifreni unutursan hesabına yalnızca bu sorunun cevabıyla erişebilirsin. Kurmazsan şifre sıfırlama çalışmaz.
                </Text>
                <TextInput
                  value={editQuestion}
                  onChangeText={setEditQuestion}
                  placeholder="Soru (örn. İlk evcil hayvanının adı neydi?)"
                  placeholderTextColor={colors.inkMuted}
                  style={{ backgroundColor: colors.surfacePressed, borderRadius: 14, padding: 16, color: colors.ink, fontFamily: fonts.regular, marginBottom: 12 }}
                />
                <TextInput
                  value={editAnswer}
                  onChangeText={setEditAnswer}
                  placeholder="Cevap"
                  placeholderTextColor={colors.inkMuted}
                  autoCapitalize="none"
                  style={{ backgroundColor: colors.surfacePressed, borderRadius: 14, padding: 16, color: colors.ink, fontFamily: fonts.regular }}
                />
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted, marginTop: 8 }}>
                  Cevap sunucuda şifrelenerek saklanır, kimse göremez. Büyük/küçük harf ve baştaki boşluklar önemsiz.
                </Text>
              </View>

            {settingsError ? <Text style={{ color: colors.loss, marginBottom: 16, textAlign: 'center' }}>{settingsError}</Text> : null}
            <TouchableOpacity onPress={handleSaveSettings} disabled={savingSettings} style={{ backgroundColor: colors.accent, padding: 16, borderRadius: 14, alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.bold, color: '#FFF', fontSize: 16 }}>{savingSettings ? 'Kaydediliyor...' : 'Kaydet'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onLogout} style={{ marginTop: 24, padding: 16, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.loss, backgroundColor: colors.lossSoft }}>
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

/*
  ⚠️ BU DOSYADAKİ TEK `StyleSheet` — GERİ KALANI SATIR İÇİ STİL.

  Dosyanın alışkanlığı satır içi stil ve ona uymak "tutarlı" olurdu.
  Uymadım: satır içi stiller her çizimde yeni bir nesne üretiyor ve
  aynı değerler dosyanın içinde tekrar tekrar yazılıyor. Yeni kod
  eskinin hatasını taklit etmemeli.

  Dosya bir sonraki elden geçirmede tamamen buraya taşınmalı.
*/
const styles = StyleSheet.create({
  profileTabs: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  /*
    İkisi eşit genişlikte (`flex: 1` + `minWidth: 0`). Biri içeriğine
    göre büyüseydi "Paylaşımlar" daha geniş kutu olur ve görsel olarak
    önerilen sekme gibi okunurdu.
  */
  profileTab: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: 'center',
  },
  profileTabOn: { backgroundColor: colors.accent },
  profileTabText: { fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted },
  // Mavi zeminde tema mürekkebi karşıtlık eşiğini geçmiyor; beyaz geçiyor.
  profileTabTextOn: { fontFamily: fonts.bold, color: '#FFFFFF' },
});
