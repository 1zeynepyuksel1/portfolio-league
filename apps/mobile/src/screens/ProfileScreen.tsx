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
import { allocationPalette, colors, fonts, medalColor, radius, shadows, spacing, type } from '../theme';
import { ConfirmModal, Segmented } from '../components/DesignKit';
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

/*
  ⚠️ MADALYA RENGİ VE DAĞILIM PALETİ ARTIK `theme.ts`'TEN GELİYOR.

  İkisi de burada AYRI AYRI tanımlıydı ve iki farklı ekranda iki farklı
  sonuç veriyordu: `LeagueResultModal` gümüşü elle '#94A3B8' yazıyordu,
  burası `colors.silver` kullanıyordu — aynı 2.'lik madalyası iki renk.
  Dağılım paleti de `AllocationBar` (Cüzdan) ile farklıydı — aynı BTC
  iki ekranda iki renk. `medalColor()` ve `allocationPalette` artık
  TEK kaynak; ikisi de `theme.ts`'te, gerekçesiyle birlikte duruyor.

  ⚠️ `getAssetColor` VARDI AMA JSX HİÇ ÇAĞIRMIYORDU — aşağıdaki dağılım
  çubuğu ve liste kendi elle yazılmış `[colors.accent, colors.gain, ...]`
  dizisini kullanıyordu, iki KOPYA hâlinde. Bu satır o iki kopyayı da
  `getAssetColor(i)`'ye bağlıyor; artık gerçekten çağrılıyor.
*/
const getAssetColor = (index: number) =>
  allocationPalette[index % allocationPalette.length] as string;

/**
 * Portföy görünürlüğü — sunucudaki `allocationVisibility` ile aynı üç değer.
 */
type AllocVisibility = 'private' | 'friends' | 'public';

const ALLOC_OPTIONS = [
  { key: 'private' as const, label: 'Hiç Kimse' },
  { key: 'friends' as const, label: 'Arkadaşlar' },
  { key: 'public' as const, label: 'Herkes' },
];

/**
 * Sunucudan gelen metni tipe daraltır.
 *
 * ⚠️ NEDEN `as AllocVisibility` DEĞİL. `as` derleyiciye "bana güven" demek;
 * sunucu bir gün 'friends_only' gönderse TypeScript susar, ekranda hiçbir
 * bölme seçili görünmez ve sebebi anlaşılmaz. Fonksiyon tanımadığı her
 * değeri en KISITLI seçeneğe düşürüyor — gizlilikte doğru varsayılan budur.
 */
function toAllocVisibility(value: string | undefined | null): AllocVisibility {
  return value === 'friends' || value === 'public' ? value : 'private';
}

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
  const [editAlloc, setEditAlloc] = useState<AllocVisibility>('private');
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
        setEditAlloc(toAllocVisibility(res.profile.allocationVisibility));
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

  /*
    ⚠️ İKİ DURUM DA AYNI STİLİ İKİ PARÇA HÂLİNDE YAZIYORDU:
    `[{ flex: 1, backgroundColor }, { justifyContent, alignItems }]`.
    Dizi olması bir şeye yaramıyordu — ikisi de sabit; tek stile alındı.
  */
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (profile === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? 'Profil bulunamadı.'}</Text>
      </View>
    );
  }

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

  /*
    ⚠️ ARKADAŞ DÜĞMESİNİN RENGİ ÜÇ KEZ HESAPLANIYORDU — simge, yazı ve
    (dolaylı olarak) zemin için ayrı ayrı yazılmış aynı üçlü koşul.
    Birini değiştirip ötekini unutmak an meselesiydi; tek değişken.
  */
  const friendActionColor =
    profile.pending === 'outgoing' ? colors.inkMuted
    : profile.pending === 'incoming' ? colors.onAccent
    : colors.accent;

  const bgColors = [colors.surfaceRaised.replace('#',''), colors.surfacePressed.replace('#','')];
  const shapeColors = [colors.gain, colors.loss, colors.warn, colors.gold, colors.accent].map(c => c.replace('#', ''));

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={colors.inkMuted} />}>
        {onClose !== undefined && (
          <TouchableOpacity
            onPress={onClose}
            hitSlop={12}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
          >
            <X size={20} color={colors.ink} />
          </TouchableOpacity>
        )}

        <View style={styles.headerRow}>
          <View style={styles.identity}>
            {/*
              ⚠️ `profile.avatarSeed &&` YETMİYOR — dizi içinde `''` (boş
              metin) döndürür ve React Native onu geçersiz stil sayar.
              `Boolean(...)` sonucu kesin olarak true/false yapıyor.
            */}
            <View style={[styles.avatarBox, Boolean(profile.avatarSeed) && styles.avatarBoxSeeded]}>
              {profile?.avatarStyle === 'local' && profile?.avatarSeed && localAvatars[profile.avatarSeed] ? (
                <Image source={localAvatars[profile.avatarSeed]} style={styles.avatarFill} resizeMode="contain" />
              ) : profile?.avatarSeed ? (
                <SvgXml xml={createAvatar(shapes, { seed: profile.avatarSeed, backgroundColor: bgColors, shape1Color: shapeColors, shape2Color: shapeColors, shape3Color: shapeColors }).toString()} width="100%" height="100%" />
              ) : (
                <Text style={styles.avatarInitials}>{profile?.firstName.slice(0, 1).toLocaleUpperCase('tr')}{profile?.lastName.slice(0, 1).toLocaleUpperCase('tr')}</Text>
              )}
            </View>

            {/* CROWN LOGIC based on lastWeekRank */}
              {profile.lastWeekRank && profile.lastWeekRank <= 3 ? (
                <View style={styles.crownBadge}>
                  <Crown size={18} color={medalColor(profile.lastWeekRank)} strokeWidth={2.5} fill={medalColor(profile.lastWeekRank)} />
                </View>
              ) : null}

            <View style={styles.nameBlock}>
              <Text style={styles.displayName}>{profile.firstName} {profile.lastName}</Text>
              <Text style={styles.handle}>@{profile.username}</Text>
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
                <TouchableOpacity
                  onPress={() => setShowAdmin(true)}
                  style={[styles.iconBtn, styles.iconBtnSpaced]}
                  accessibilityRole="button"
                  accessibilityLabel="Yönetim"
                >
                  <ShieldCheck size={20} color={colors.accent} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setShowSettings(true)}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel="Ayarlar"
              >
                <Settings size={20} color={colors.inkMuted} />
              </TouchableOpacity>
            </>
          ) : (
            <View>
              {profile.isFriend ? (
                <View style={styles.friendPill}>
                  <Check size={16} color={colors.gain} style={styles.actionIcon} />
                  <Text style={styles.friendPillText}>Arkadaş</Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={handleFriendAction}
                  disabled={profile.pending === 'outgoing'}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: profile.pending === 'outgoing' }}
                  /*
                    ⚠️ ÜÇ DURUM, TEK DÜĞME: yok / gönderildi / geldi.
                    Renk hesabı üç kez tekrarlanıyordu (zemin, simge, yazı);
                    tek değişkene alındı — biri değişip ötekiler kalamaz.
                    'incoming' zemini `accentDeep`: beyaz yazı `accent`
                    üstünde 3,68:1 kontrast veriyordu, WCAG 4,5:1 istiyor.
                  */
                  style={[
                    styles.addBtn,
                    {
                      backgroundColor:
                        profile.pending === 'incoming' ? colors.accentDeep
                        : profile.pending === 'outgoing' ? colors.surfacePressed
                        : 'transparent',
                      borderColor: profile.pending === 'outgoing' ? 'transparent' : colors.accent,
                    },
                  ]}
                >
                  <User size={16} color={friendActionColor} style={styles.actionIcon} />
                  <Text style={[styles.addBtnText, { color: friendActionColor }]}>
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
                  style={styles.banBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`@${profile.username} kullanıcısını banla`}
                >
                  <Ban size={14} color={colors.loss} style={styles.actionIcon} />
                  <Text style={styles.banBtnText}>Banla</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/*
          ⚠️ BEŞİNCİ ONAY KUTUSU — `DesignKit.ConfirmModal`'A TAŞINDI.
          `PostCard`'daki dört kopyayla aynı işi yapıyordu, ayrı bir
          tasarımla (`modalBtnDanger` zemini `colors.loss`, `lossDeep`
          değil — beyaz yazı 3,76:1 veriyordu, bu geçişte de düzeldi).
        */}
        <ConfirmModal
          visible={banOpen}
          icon={Ban}
          tone="danger"
          title={`@${profile.username} banlanacak`}
          description="Sebep kullanıcıya gösterilir. Elindeki oturum anında geçersiz olur."
          cancelLabel="Vazgeç"
          confirmLabel={banBusy ? 'Banlanıyor…' : 'Banla'}
          onCancel={() => setBanOpen(false)}
          onConfirm={() => void submitBan()}
          busy={banBusy}
        >
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

        {!profile.visible ? (
          <View style={styles.privateCard}>
            <View style={styles.privateIconWrap}>
              <Lock size={32} color={colors.inkMuted} />
            </View>
            <Text style={styles.privateTitle}>Gizli Profil</Text>
            <Text style={styles.privateBody}>
              Bu profil gizlidir. Bilgilerini ve paylaşımlarını görmek için arkadaş olarak ekleyin.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.statGrid}>
              {/* TWR */}
                <View style={styles.statCard}>
                  <View style={[styles.statIconWrap, { backgroundColor: rising ? colors.gainSoft : falling ? colors.lossSoft : colors.silverSoft }]}>
                    {rising ? <TrendingUp size={20} color={colors.gain} /> : falling ? <TrendingDown size={20} color={colors.loss} /> : <TrendingUp size={20} color={colors.inkMuted} />}
                  </View>
                  <Text style={styles.statLabel}>HAFTALIK TWR</Text>
                  <Text style={[styles.statValue, { color: rising ? colors.gain : falling ? colors.loss : colors.ink }]}>
                    {twr === null ? '—' : formatPercent(twr, true)}
                  </Text>
                </View>
                {/* League */}
                <View style={styles.statCard}>
                  <View style={[styles.statIconWrap, { backgroundColor: colors.accentSoft }]}>
                    <Trophy size={20} color={colors.accent} />
                  </View>
                  <Text style={styles.statLabel}>LİG SIRASI</Text>
                  <Text style={styles.statValue}>
                    {profile.rank === null ? '—' : `#${profile.rank}`}
                    {profile.totalParticipants ? <Text style={styles.statValueSub}> / {profile.totalParticipants}</Text> : null}
                  </Text>
                </View>
                {/* Badges */}
                <TouchableOpacity onPress={() => setShowAchievements(true)} style={styles.statCard} accessibilityRole="button">
                  <View style={[styles.statIconWrap, { backgroundColor: colors.goldSoft }]}>
                    <Award size={20} color={colors.bronze} />
                  </View>
                  <Text style={styles.statLabel}>ROZET</Text>
                  <Text style={styles.statValue}>{profile.achievementsCount} Adet</Text>
                </TouchableOpacity>
                {/* Friends */}
                <TouchableOpacity onPress={() => onOpenFriends?.()} style={styles.statCard} accessibilityRole="button">
                  <View style={[styles.statIconWrap, { backgroundColor: colors.violetSoft }]}>
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
                  <Text style={styles.statLabel}>
                    {profile.isSelf ? 'ARKADAŞ' : 'ORTAK'}
                  </Text>
                  <Text style={styles.statValue}>
                    {profile.isSelf ? (profile.friendCount || 0) : (profile.mutualFriendCount || 0)}
                  </Text>
                </TouchableOpacity>
            </View>

            {/*
              ⚠️ SEKMELER YALNIZCA PORTFÖY GÖRÜLEBİLİYORSA ÇİZİLİYOR.

              Tek sekme sunan bir sekme çubuğu, sekme çubuğu değildir.
              Portföy gizliyse doğrudan paylaşımlar gösteriliyor.
            */}
            {/*
              ⚠️ ELLE YAZILAN SEKME ÇUBUĞU `DesignKit.Segmented`'E TAŞINDI.
              Buradaki sürüm Piyasa'dakiyle neredeyse aynıydı ama yazısı
              14, dikey dolgusu 9'du (öteki 15 ve 8). Fark gözle
              seçilmiyor, "tutmuyor" hissi bırakıyor.
            */}
            <View style={styles.profileTabsWrap}>
              <Segmented
                options={[
                  { key: 'portfolio' as const, label: 'Portföy' },
                  { key: 'posts' as const, label: 'Paylaşımlar' },
                ]}
                value={profileTab}
                onChange={setProfileTab}
              />
            </View>

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
              <View style={styles.noticeCard}>
                <Lock size={22} color={colors.inkFaint} strokeWidth={2} />
                <Text style={styles.noticeTitle}>
                  {portfoyGizli ? 'Portföyü gizli' : 'Portföyü boş'}
                </Text>
                {/*
                  ⚠️ İKİNCİ SATIR "NE YAPMALIYIM"I SÖYLÜYOR (K6 kuralı).
                  Yalnızca "gizli" demek bir kapı; "arkadaş olursanız
                  görebilirsin" bir yol.
                */}
                <Text style={styles.noticeBody}>
                  {portfoyGizli
                    ? (gorunurlukAyari === 'friends'
                        ? 'Bu kullanıcı portföyünü yalnızca arkadaşlarına gösteriyor.'
                        : 'Bu kullanıcı portföyünü kimseye göstermiyor.')
                    : 'Bu kullanıcı henüz bir varlık almamış.'}
                </Text>
              </View>
            )}

            {profileTab === 'portfolio' && portfoyGorunur && (
              <View style={styles.allocCard}>
                <Text style={styles.sectionHeading}>Varlık Dağılımı</Text>
                {/*
                  ⚠️ PALET İKİ KEZ ELLE YAZILIYORDU (çubukta ve listede) VE
                  DOSYANIN BAŞINDAKİ `getAssetColor` HİÇ ÇAĞRILMIYORDU.
                  Artık ikisi de tek fonksiyondan, o da paylaşılan
                  `theme.allocationPalette`'ten besleniyor.

                  ⚠️ `opacity: 1 - (i * 0.1)` DE SİLİNDİ. 10. varlıkta
                  opaklık 0 oluyordu — dilim görünmüyor ama yer kaplıyor;
                  11.'de negatife düşüyordu. Ayırt etme işini solukluk
                  değil RENK yapmalı, palet zaten bunun için var.
                */}
                <View style={styles.allocBar}>
                  {profile.allocation.map((item, i) => (
                    <View
                      key={item.symbol}
                      style={{ width: `${item.sharePercent}%` as any, backgroundColor: getAssetColor(i) }}
                    />
                  ))}
                </View>
                {profile.allocation.map((item, i) => (
                  <View
                    key={item.symbol}
                    style={[
                      styles.allocRow,
                      { borderBottomWidth: i === profile.allocation.length - 1 ? 0 : 1 },
                    ]}
                  >
                    <View style={styles.allocLeft}>
                      <View style={[styles.allocDot, { backgroundColor: getAssetColor(i) }]} />
                      <Text style={styles.allocName}>{item.name}</Text>
                    </View>
                    <Text style={styles.allocShare}>{item.sharePercent}%</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Paylaşımlar — portföy sekmesi açıkken gizleniyor. */}
            {profileTab === 'posts' && (
            <View>
              <Text style={styles.sectionHeading}>Paylaşımlar</Text>
              {posts.length === 0 ? (
                <View style={styles.postsEmpty}>
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
                <View style={styles.postsList}>
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
        <SafeAreaView style={styles.screen}>
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsTitle}>Ayarlar</Text>
            <TouchableOpacity
              onPress={() => setShowSettings(false)}
              style={styles.settingsClose}
              accessibilityRole="button"
              accessibilityLabel="Ayarları kapat"
            >
              <X size={24} color={colors.ink} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.settingsBody}>

            <Text style={[styles.groupHeading, styles.groupHeadingSpaced]}>Avatar Seçimi</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.avatarStrip}>
              {Object.keys(localAvatars).map(key => (
                <TouchableOpacity
                  key={key}
                  onPress={() => handleUpdateAvatar(key, true)}
                  disabled={avatarSaving !== null}
                  style={[styles.avatarChoice, profile?.avatarSeed === key && styles.avatarChoiceOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: profile?.avatarSeed === key }}
                  accessibilityLabel={`${key} avatarı`}
                >
                  <Image source={localAvatars[key]} style={styles.avatarChoiceImg} resizeMode="contain" />
                  {avatarSaving === key && <ActivityIndicator color={colors.ink} style={styles.avatarSpinner} />}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.groupHeading}>Kişisel Bilgiler</Text>

            <Text style={styles.fieldLabel}>Ad</Text>
            <TextInput style={styles.input} value={editFirstName} onChangeText={setEditFirstName} />
            <Text style={styles.fieldLabel}>Soyad</Text>
            <TextInput style={styles.input} value={editLastName} onChangeText={setEditLastName} />

            <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Yeni Şifre</Text>
            <TextInput
              style={styles.input}
              value={editPassword}
              onChangeText={setEditPassword}
              placeholder="Değiştirmek istemiyorsanız boş bırakın"
              placeholderTextColor={colors.inkMuted}
              secureTextEntry
            />


            <View style={styles.switchRow}>
              <View>
                <Text style={styles.settingTitle}>Herkese Açık Profil</Text>
                <Text style={styles.settingBody}>Kapalı olduğunda sadece arkadaşların görebilir.</Text>
              </View>
              <Switch value={editIsPublic} onValueChange={setEditIsPublic} trackColor={{ false: colors.surfacePressed, true: colors.accent }} />
              </View>

              <View style={styles.settingBlock}>
                <Text style={styles.settingTitle}>Varlık Dağılımı (Portföy) Kimlere Görünsün?</Text>
                <Text style={[styles.settingBody, styles.settingBodySpaced]}>Cüzdanındaki hisse ve coin dağılımını (yüzdelerini) kimlerin görebileceğini seç.</Text>
                {/*
                  ⚠️ SEGMENTLİ DENETİMİN BEŞİNCİ KOPYASIYDI — ve en tuhafı.
                  Seçili bölme BEYAZ zemin + SİYAH yazı, yani koyu temanın
                  ortasında açık temadan kalma bir parça. Üstelik `shadowColor`
                  ile iOS gölgesi veriyordu; koyu zeminde görünmeyen bir gölge.
                */}
                <Segmented
                  options={ALLOC_OPTIONS}
                  value={editAlloc}
                  onChange={setEditAlloc}
                />
              </View>


              <View style={styles.settingBlockTight}>
                <Text style={styles.settingTitle}>Güvenlik Sorusu</Text>
                <Text style={[styles.settingBody, styles.settingBodySpaced]}>
                  Şifreni unutursan hesabına yalnızca bu sorunun cevabıyla erişebilirsin. Kurmazsan şifre sıfırlama çalışmaz.
                </Text>
                <TextInput
                  value={editQuestion}
                  onChangeText={setEditQuestion}
                  placeholder="Soru (örn. İlk evcil hayvanının adı neydi?)"
                  placeholderTextColor={colors.inkMuted}
                  style={[styles.inputTall, styles.inputTallSpaced]}
                />
                <TextInput
                  value={editAnswer}
                  onChangeText={setEditAnswer}
                  placeholder="Cevap"
                  placeholderTextColor={colors.inkMuted}
                  autoCapitalize="none"
                  style={styles.inputTall}
                />
                <Text style={styles.settingHint}>
                  Cevap sunucuda şifrelenerek saklanır, kimse göremez. Büyük/küçük harf ve baştaki boşluklar önemsiz.
                </Text>
              </View>

            {settingsError ? <Text style={styles.errorText}>{settingsError}</Text> : null}
            <TouchableOpacity onPress={handleSaveSettings} disabled={savingSettings} style={styles.saveBtn} accessibilityRole="button">
              <Text style={styles.saveBtnText}>{savingSettings ? 'Kaydediliyor...' : 'Kaydet'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onLogout} style={styles.logoutBtn} accessibilityRole="button">
              <Text style={styles.logoutBtnText}>Çıkış Yap</Text>
            </TouchableOpacity>
            <View style={styles.bottomPad} />

          </ScrollView>
        </SafeAreaView>
      </Modal>

      {toastMessage && (
        /*
          ⚠️ `accessibilityLiveRegion` OLMADAN EKRAN OKUYUCU BU MESAJI HİÇ
          DUYURMUYOR. Bildirim odaklanılan bir öge değil; kendiliğinden
          gelip gidiyor. "assertive" = okumakta olduğunu kesip söyle.
        */
        <View
          style={[
            styles.toast,
            { backgroundColor: toastMessage.type === 'error' ? colors.loss : colors.gain },
          ]}
          accessibilityLiveRegion="assertive"
        >
          <Text style={styles.toastText}>{toastMessage.text}</Text>
        </View>
      )}
    </View>
  );

}

/*
  STİLLER.

  ⚠️ BU DOSYA 113 SATIR İÇİ STİL NESNESİ TAŞIYORDU, `styles` KULLANIMI 1'Dİ.

  İki bedeli vardı:

  1. HER ÇİZİMDE YENİ NESNE. `style={{ padding: 16 }}` her render'da yeni
     bir JS nesnesi üretir; React Native onu köprüden yeniden geçirmek
     zorunda kalır. `StyleSheet.create` bir kez kaydeder, sonra sayı gönderir.
  2. AYNI DEĞER ONLARCA KEZ. `borderRadius: 20` on beş yerde elle yazılıydı.
     Ölçek değişince hepsini bulmak gerekiyordu — ve biri mutlaka kalıyordu.

  ⚠️ TAŞIRKEN SAYILAR TOKEN'A BAĞLANDI, AYNEN KOPYALANMADI. Taşımak
  yalnızca yeri değiştirmek olsaydı 20/24/14/12 kaosu StyleSheet'in
  içine taşınmış olurdu. `radius.lg`, `spacing.md`, `type.body` yazınca
  değer TEK yerden geliyor.

  ⚠️ DURUMA GÖRE DEĞİŞEN STİLLER DİZİ OLARAK VERİLDİ
  (`[styles.taban, kosul && styles.varyant]`). Bir stili "hesaplanıyor"
  diye StyleSheet'e zorlamak onu okunmaz bir fonksiyona çevirirdi.
*/
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  scrollContent: { padding: spacing.lg },
  centered: {
    flex: 1,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },

  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 48 : spacing.lg,
    left: spacing.md,
    zIndex: 10,
    padding: spacing.sm,
    backgroundColor: colors.backdrop,
    borderRadius: radius.lg,
  },

  // --- BAŞLIK -------------------------------------------------------------
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  identity: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatarBox: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    overflow: 'hidden',
    backgroundColor: colors.surfacePressed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /* Gerçek avatar varken zemin görünmemeli — kenarda halka bırakıyordu. */
  avatarBoxSeeded: { backgroundColor: 'transparent' },
  avatarFill: { width: '100%', height: '100%' },
  avatarInitials: { fontFamily: fonts.bold, fontSize: type.headline, color: colors.ink },
  crownBadge: {
    position: 'absolute',
    left: 40,
    top: -6,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 2,
    zIndex: 99,
  },
  nameBlock: { marginLeft: spacing.md },
  displayName: { fontFamily: fonts.bold, fontSize: type.title, color: colors.ink },
  handle: { fontFamily: fonts.medium, fontSize: type.body, color: colors.inkMuted },

  iconBtn: {
    /*
      ⚠️ 8pt DOLGU + 20pt SİMGE = 36pt. Platform tabanı 44pt.
      Simgeyi büyütmek yerine en küçük ölçü verildi: görsel aynı
      kalıyor, dokunulabilir alan büyüyor.
    */
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfacePressed,
    borderRadius: radius.lg,
  },
  iconBtnSpaced: { marginRight: spacing.sm },

  friendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gainSoft,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gainSoft,
  },
  friendPillText: { fontFamily: fonts.medium, color: colors.gain, fontSize: type.body },
  actionIcon: { marginRight: spacing.sm },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  addBtnText: { fontFamily: fonts.bold, fontSize: type.body },

  banBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.loss,
    backgroundColor: colors.lossSoft,
  },
  banBtnText: { fontFamily: fonts.bold, color: colors.loss, fontSize: type.caption },

  // --- BAN KİPİ -------------------------------------------------------
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
  // --- GİZLİ PROFİL ---------------------------------------------------
  privateCard: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    paddingVertical: 40,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
  },
  privateIconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.surfacePressed,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  privateTitle: {
    fontFamily: fonts.bold,
    fontSize: type.title,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  privateBody: {
    fontFamily: fonts.medium,
    fontSize: type.body,
    color: colors.inkMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    lineHeight: 22,
  },

  // --- DÖRT SAYAÇ ------------------------------------------------------
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.group,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    /* ⚠️ %45: iki kutu bir satıra sığsın, üçüncüsü alta düşsün. */
    minWidth: '45%',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.group,
  },
  statLabel: {
    fontFamily: fonts.medium,
    fontSize: type.caption,
    color: colors.inkMuted,
    marginBottom: spacing.xs,
  },
  statValue: { fontFamily: fonts.bold, fontSize: type.title, color: colors.ink },
  statValueSub: { fontSize: type.caption, color: colors.inkMuted },

  profileTabsWrap: { marginBottom: spacing.lg },

  // --- PORTFÖY ---------------------------------------------------------
  noticeCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  noticeTitle: {
    fontFamily: fonts.bold,
    fontSize: type.emphasis,
    color: colors.ink,
    marginTop: 10,
    textAlign: 'center',
  },
  noticeBody: {
    fontFamily: fonts.regular,
    fontSize: type.body,
    color: colors.inkMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  allocCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionHeading: {
    fontFamily: fonts.bold,
    fontSize: type.emphasis,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  allocBar: {
    flexDirection: 'row',
    height: spacing.group,
    borderRadius: radius.xs,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  allocRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomColor: colors.border,
  },
  allocLeft: { flexDirection: 'row', alignItems: 'center' },
  allocDot: {
    width: spacing.group,
    height: spacing.group,
    borderRadius: radius.xs,
    marginRight: spacing.group,
  },
  allocName: { fontFamily: fonts.medium, fontSize: type.body, color: colors.ink },
  allocShare: { fontFamily: fonts.bold, fontSize: type.body, color: colors.ink },

  postsEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
  },
  postsList: { gap: spacing.md },

  // --- AYARLAR ----------------------------------------------------------
  settingsHeader: {
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingsTitle: { fontFamily: fonts.bold, fontSize: type.title, color: colors.ink },
  settingsClose: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  settingsBody: { padding: spacing.md },

  groupHeading: {
    fontFamily: fonts.bold,
    fontSize: type.emphasis,
    color: colors.ink,
    marginBottom: spacing.group,
  },
  groupHeadingSpaced: { marginTop: spacing.sm },

  fieldLabel: {
    fontFamily: fonts.medium,
    fontSize: type.body,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  fieldLabelSpaced: { marginTop: spacing.md },
  input: {
    backgroundColor: colors.surfaceRaised,
    padding: spacing.group,
    borderRadius: radius.sm,
    color: colors.ink,
    fontFamily: fonts.medium,
    fontSize: type.body,
    marginBottom: spacing.md,
    /* ⚠️ Giriş alanı da bir dokunma hedefi — 12pt dolgu tek başına 40pt. */
    minHeight: 44,
  },
  inputTall: {
    backgroundColor: colors.surfacePressed,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: type.body,
    minHeight: 44,
  },
  inputTallSpaced: { marginBottom: spacing.group },

  avatarStrip: { marginBottom: spacing.lg, flexDirection: 'row' },
  avatarChoice: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    marginRight: spacing.group,
    backgroundColor: colors.surfaceRaised,
    /*
      ⚠️ KENARLIK HER ZAMAN ÇİZİLİYOR, SEÇİLİNCE YALNIZCA RENGİ DEĞİŞİYOR.
      Eskiden `borderWidth` 0'dan 2'ye çıkıyordu; seçim değiştiğinde kutu
      4px büyüyüp bütün şerit yana kayıyordu.
    */
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarChoiceOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  avatarChoiceImg: { width: '80%', height: '80%' },
  avatarSpinner: { position: 'absolute' },

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  settingTitle: { fontFamily: fonts.bold, fontSize: type.emphasis, color: colors.ink },
  settingBody: {
    fontFamily: fonts.medium,
    fontSize: type.body,
    color: colors.inkMuted,
    marginTop: spacing.xs,
  },
  settingBodySpaced: { marginBottom: spacing.group },
  settingBlock: { marginTop: spacing.lg, marginBottom: spacing.xl },
  settingBlockTight: { marginTop: spacing.sm, marginBottom: spacing.xl },
  settingHint: {
    fontFamily: fonts.medium,
    fontSize: type.caption,
    color: colors.inkMuted,
    marginTop: spacing.sm,
  },

  errorText: {
    color: colors.loss,
    fontFamily: fonts.medium,
    fontSize: type.body,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  saveBtn: {
    backgroundColor: colors.accentDeep,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  saveBtnText: { fontFamily: fonts.bold, color: colors.onAccent, fontSize: type.emphasis },
  logoutBtn: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.loss,
    backgroundColor: colors.lossSoft,
  },
  logoutBtnText: { fontFamily: fonts.bold, color: colors.loss, fontSize: type.emphasis },
  bottomPad: { height: 40 },

  toast: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.group,
    borderRadius: radius.lg,
    ...shadows.card,
  },
  /*
    ⚠️ BEYAZ YAZI YEŞİL/KIRMIZI ZEMİNDE KALIYORDU: yeşil (#10b981)
    üstünde 2,54:1, kırmızı (#ef4444) üstünde 3,76:1 — WCAG 4,5:1
    istiyor. Bu ikisi YÖN göstermek için seçilmiş AÇIK renkler; kendileri
    zemin olunca üstlerine KOYU yazı gerekiyor (7,55 ve 5,09).
  */
  toastText: { fontFamily: fonts.bold, fontSize: type.body, color: colors.onInverse },
});
