import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiFetch } from '../api/client';
import { AssetLogo } from '../components/AssetLogo';
import { colors, fonts, spacing } from '../theme';

/**
 * ProfileScreen — kendi profilin ve başkasınınki, TEK ekran.
 *
 * ⚠️ NEDEN TEK EKRAN, İKİ AYRI DEĞİL.
 *
 * Sunucu her iki durumda da AYNI ŞEKİLDE yanıt veriyor; yalnızca alanlar
 * boşalıyor (`visible: false`). İki ayrı ekran yazsaydık aynı düzeni iki
 * kez sürdürmek gerekirdi ve biri eskirdi. Fark yalnızca iki yerde:
 * gizlilik anahtarı (sadece kendinde) ve arkadaşlar bölümü.
 *
 * ⚠️ MUTLAK TUTAR YOK — VE BU BİR ÜRÜN KARARI.
 *
 * Profilde varlık DAĞILIMI var, portföy DEĞERİ yok. Sanal para da olsa
 * mutlak tutar göstermek ligi "kim daha zengin"e çevirirdi; oysa TWR'nin
 * seçilme sebebi tam olarak bunu engellemekti (docs/01-plan.md). Erken
 * başlayan kullanıcı büyük görünür ama daha iyi yatırımcı değildir.
 */

type ProfileSlice = {
  symbol: string;
  name: string;
  sharePercent: string | null;
  profitPercent: string | null;
};

type PublicProfile = {
  username: string;
  firstName: string;
  lastName: string;
  isSelf: boolean;
  isFriend: boolean;
  isPublic: boolean;
  visible: boolean;
  twrPercent: string | null;
  rank: number | null;
  allocation: ProfileSlice[];
  pending: 'outgoing' | 'incoming' | null;
  friendCount: number;
  pendingRequests: number;
};

export function ProfileScreen({
  username,
  onClose,
  onOpenFriends,
  onLogout,
}: {
  /** Bakılacak profil. Kendi profilinde de kullanıcı adı geçiliyor. */
  username: string;
  /** Katman olarak açıldıysa kapatma. Sekmede açıldıysa verilmiyor. */
  onClose?: () => void;
  /** Arkadaşlar katmanını açar — yalnızca kendi profilinde anlamlı. */
  onOpenFriends?: () => void;
  /** Oturumu kapatır. Yalnızca kendi profilinde çiziliyor. */
  onLogout?: () => void;
}) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Anahtar için AYRI state.
   *
   * ⚠️ Doğrudan `profile.isPublic` kullansaydık, kullanıcı anahtara
   * dokununca sunucu yanıtı gelene kadar anahtar ESKİ konumda kalırdı —
   * dokunmanın işe yaramadığı hissi. Önce yerel state değişiyor, istek
   * arkada gidiyor; hata olursa geri alınıyor.
   */
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);

  /** Aşağı çekip yenileme göstergesi. */
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);

    try {
      const res = await apiFetch<{ profile: PublicProfile }>(
        `/users/${username}`,
      );
      setProfile(res.profile);
      setIsPublic(res.profile.isPublic);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profil yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * TEK DOKUNUŞLA ARKADAŞ EKLE.
   *
   * ⚠️ Eskiden profilden arkadaş eklemenin yolu yoktu: kullanıcı adını
   * AKILDA TUTUP başka bir ekrandaki forma yazmak gerekiyordu. Profile
   * bakan biri zaten "bu kişiyi ekleyeyim mi" sorusunu soruyor —
   * cevabı orada verebilmeli.
   *
   * İstek gönderildikten sonra profil YENİDEN yüklenmiyor, yalnızca
   * yerel durum değişiyor: tek alan için tüm ekranı tazelemek
   * gereksiz bir bekleme yaratırdı.
   */
  const [sendingRequest, setSendingRequest] = useState(false);

  async function sendFriendRequest() {
    if (profile === null) return;

    setSendingRequest(true);
    setError(null);

    try {
      await apiFetch('/friends/requests', {
        method: 'POST',
        body: JSON.stringify({ addressee: profile.username }),
      });

      setProfile({ ...profile, pending: 'outgoing' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İstek gönderilemedi.');
    } finally {
      setSendingRequest(false);
    }
  }

  async function toggleVisibility(next: boolean) {
    // İyimser güncelleme: anahtar hemen hareket etsin.
    setIsPublic(next);
    setSaving(true);

    try {
      await apiFetch('/users/me/visibility', {
        method: 'PATCH',
        body: JSON.stringify({ isPublic: next }),
      });
    } catch (err) {
      // Sunucu kabul etmediyse anahtarı GERİ AL — yoksa kullanıcı
      // profilini kapattığını sanır, açık kalır.
      setIsPublic(!next);
      setError(err instanceof Error ? err.message : 'Ayar kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }

  if (profile === null) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.error}>{error ?? 'Profil bulunamadı.'}</Text>
        <TouchableOpacity style={styles.retry} onPress={() => void load()}>
          <Text style={styles.retryText}>Tekrar dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const twr = profile.twrPercent === null ? null : Number(profile.twrPercent);
  const rising = twr !== null && twr >= 0;

  return (
    <View style={styles.container}>
      {onClose !== undefined && (
        <View style={styles.backRow}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.back}>‹ Geri</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        /*
          ⚠️ Profil ekranı kendini periyodik tazelemiyor (fiyat ekranları
          gibi 5 saniyede bir sorgu atmıyor) — çünkü buradaki veri o kadar
          sık değişmiyor. Ama HİÇ tazelenmiyordu da: bekleyen arkadaşlık
          isteği kabul edildikten sonra sayının düşmesi için sekme
          değiştirip geri gelmek gerekiyordu.
        */
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
            tintColor={colors.inkMuted}
          />
        }
      >
        {/* --- kimlik --- */}
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.firstName.slice(0, 1).toLocaleUpperCase('tr')}
              {profile.lastName.slice(0, 1).toLocaleUpperCase('tr')}
            </Text>
          </View>

          <Text style={styles.name}>
            {profile.firstName} {profile.lastName}
          </Text>
          <Text style={styles.handle}>@{profile.username}</Text>

          {profile.isFriend && <Text style={styles.friendTag}>Arkadaşın</Text>}

          {/*
            ARKADAŞLIK DÜĞMESİ — durumu ne ise onu söylüyor.

            ⚠️ Dört ayrı durum var ve hepsi FARKLI görünmeli:
              zaten arkadaş  -> düğme yok, üstte "Arkadaşın" etiketi
              istek gönderdim -> pasif, "İstek gönderildi"
              bana istek geldi -> "Sana istek gönderdi" (kabul Arkadaşlar
                                   ekranından; burada iki eylemli bir
                                   düğme kalabalık yapardı)
              hiçbiri         -> "+ Arkadaş ekle"

            Tek bir "ekle" düğmesi gösterip hepsini aynı yapsaydık,
            kullanıcı zaten gönderdiği isteği tekrar gönderip sunucudan
            hata alırdı.
          */}
          {!profile.isSelf && !profile.isFriend && (
            <TouchableOpacity
              style={[
                styles.addFriend,
                profile.pending !== null && styles.addFriendMuted,
              ]}
              disabled={profile.pending !== null || sendingRequest}
              onPress={() => void sendFriendRequest()}
              accessibilityRole="button"
            >
              {sendingRequest ? (
                <ActivityIndicator size="small" color={colors.onInverse} />
              ) : (
                <Text
                  style={[
                    styles.addFriendText,
                    profile.pending !== null && styles.addFriendTextMuted,
                  ]}
                >
                  {profile.pending === 'outgoing'
                    ? 'İstek gönderildi'
                    : profile.pending === 'incoming'
                      ? 'Sana istek gönderdi'
                      : '+  Arkadaş ekle'}
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/*
            ARKADAŞ SAYISI KİMLİĞİN PARÇASI.

            ⚠️ Eskiden sayfanın en altındaki bir düğmeydi. Oysa "kaç
            arkadaşı var" bir portföy bilgisi değil, bir KİMLİK bilgisi —
            adın ve kullanıcı adının yanına ait. Aşağıda dururken hem
            görünmüyordu hem de portföy verisiymiş gibi okunuyordu.

            Kendi profilinde dokunulabilir (arkadaş listesini açar),
            başkasınınkinde salt bilgi: onun arkadaş listesini görmek
            paylaşmadığı bir şeyi göstermek olurdu.
          */}
          {/*
            ⚠️ ARKADAŞ SAYISI BAŞKASININ PROFİLİNDE GÖSTERİLMİYOR.

            Bir süre küçük bir bilgi hapı olarak duruyordu. Kaldırıldı:
            kimsenin sosyal çevresinin büyüklüğü ligde bir ölçüt olmamalı
            ve az arkadaşı olan kullanıcı için sessiz bir baskı yaratıyor.

            Kendi profilinde ise bir KAPI olarak duruyor (aşağıdaki tam
            genişlik kart) — orada sayı bilgi değil, giriş noktası.

            Sunucu da göndermiyor; ekranda gizlemekle yetinmedik.
          */}
        </View>

        {/*
          BEKLEYEN İSTEK KARTI — yalnızca istek VARSA çiziliyor.

          ⚠️ ESKİDEN EN ALTTA BİR DÜĞMEYDİ ve bu yanlıştı: sayfanın en
          eyleme dönük parçası, gizlilik ayarının da altında kalıyordu.
          Bekleyen bir istek zaman duyarlı — karşı taraf cevap bekliyor.

          ⚠️ Sıfırken HİÇ çizilmiyor. "0 isteğin var" satırı her açılışta
          yer kaplayıp hiçbir şey söylemezdi; kart yalnızca anlamlı
          olduğunda beliriyor.
        */}
        {profile.isSelf && profile.pendingRequests > 0 && (
          <TouchableOpacity
            style={styles.pendingCard}
            onPress={onOpenFriends}
            accessibilityRole="button"
          >
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>
                {profile.pendingRequests}
              </Text>
            </View>

            <View style={styles.pendingText}>
              <Text style={styles.pendingTitle}>
                {profile.pendingRequests === 1
                  ? 'Bir arkadaşlık isteğin var'
                  : `${profile.pendingRequests} arkadaşlık isteğin var`}
              </Text>
              <Text style={styles.pendingHint}>Görmek için dokun</Text>
            </View>

            <Text style={styles.pendingArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/*
          ARKADAŞLAR KARTI — kendi profilinde, TAM GENİŞLİK.

          ⚠️ Bekleyen istek kartının hemen ardında ve ondan daha sönük:
          istek zaman duyarlı, arkadaş listesi değil. İkisi aynı vurguda
          olsaydı acil olan görünmezdi.
        */}
        {profile.isSelf && onOpenFriends !== undefined && (
          <TouchableOpacity
            style={styles.friendsCard}
            onPress={onOpenFriends}
            accessibilityRole="button"
          >
            <View style={styles.friendsCardLeft}>
              <Text style={styles.friendsCardValue}>{profile.friendCount}</Text>
              <Text style={styles.friendsCardLabel}>ARKADAŞ</Text>
            </View>

            <View style={styles.friendsCardText}>
              <Text style={styles.friendsCardTitle}>Arkadaşların</Text>
              <Text style={styles.friendsCardHint}>
                {profile.friendCount === 0
                  ? 'Kullanıcı adıyla arkadaş ekle, ligde yarışın'
                  : 'Listeni gör, yeni arkadaş ekle'}
              </Text>
            </View>

            <Text style={styles.friendsCardArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* --- lig durumu --- */}
        {profile.visible ? (
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>BU HAFTA</Text>
              <Text
                style={[
                  styles.statValue,
                  twr === null
                    ? styles.statMuted
                    : rising
                      ? styles.up
                      : styles.down,
                ]}
              >
                {/*
                  ⚠️ `null` "sıfır" değil "bilinmiyor": kullanıcı bu hafta
                  hiç işlem yapmadıysa lig girişi yok. %0 yazsaydık
                  "denedi ve başabaş kaldı" derdik.
                */}
                {twr === null
                  ? '—'
                  : `${rising ? '+' : ''}%${twr.toFixed(2).replace('.', ',')}`}
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.stat}>
              <Text style={styles.statLabel}>SIRA</Text>
              <Text style={styles.statValue}>
                {profile.rank === null ? '—' : `${profile.rank}.`}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.locked}>
            <Text style={styles.lockedTitle}>Bu profil gizli</Text>
            <Text style={styles.lockedText}>
              {profile.firstName} portföyünü yalnızca arkadaşlarına
              gösteriyor. Arkadaşlık isteği gönderirsen görebilirsin.
            </Text>
          </View>
        )}

        {/* --- varlık dağılımı --- */}
        {profile.visible && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>VARLIK DAĞILIMI</Text>

            {profile.allocation.length === 0 ? (
              <Text style={styles.emptyText}>
                Henüz bir varlığı yok — portföyü tamamen nakitte.
              </Text>
            ) : (
              profile.allocation.map((slice) => (
                <View key={slice.symbol} style={styles.slice}>
                  <AssetLogo symbol={slice.symbol} size={28} />

                  <View style={styles.sliceNames}>
                    <Text style={styles.sliceName} numberOfLines={1}>
                      {slice.name}
                    </Text>
                    <Text style={styles.sliceSymbol}>{slice.symbol}</Text>
                  </View>

                  {/*
                    İKİ SAYI: PAY ve KÂR — ikisi de yüzde, tutar YOK.

                    ⚠️ Bilerek: kimin ne kadar parası olduğu değil, neye
                    yatırdığı ve o yatırımın nasıl gittiği paylaşılıyor.

                    Pay üstte ve baskın (portföyün ne kadarı), kâr altta
                    ve renkli (iyi mi gidiyor). Kâr `null` ise satır hiç
                    çizilmiyor — %0 yazmak "başabaş" iddiası olurdu.
                  */}
                  <View style={styles.sliceNumbers}>
                    <Text style={styles.slicePercent}>
                      %
                      {Number(slice.sharePercent ?? 0)
                        .toFixed(1)
                        .replace('.', ',')}
                    </Text>

                    {slice.profitPercent !== null && (
                      <Text
                        style={[
                          styles.sliceProfit,
                          Number(slice.profitPercent) >= 0
                            ? styles.up
                            : styles.down,
                        ]}
                      >
                        {Number(slice.profitPercent) >= 0 ? '+' : ''}%
                        {Number(slice.profitPercent)
                          .toFixed(2)
                          .replace('.', ',')}
                      </Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* --- yalnızca kendi profilinde: gizlilik + arkadaşlar --- */}
        {profile.isSelf && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>GİZLİLİK</Text>

              <View style={styles.settingRow}>
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>
                    Profilim herkese açık
                  </Text>
                  <Text style={styles.settingHint}>
                    {isPublic
                      ? 'Ligdeki herkes hangi varlıklarda olduğunu görebilir. Tutarlar hiçbir zaman paylaşılmaz.'
                      : 'Yalnızca arkadaşların görebilir. Diğerleri adını görür, portföyünü göremez.'}
                  </Text>
                </View>

                <Switch
                  value={isPublic}
                  onValueChange={(next) => void toggleVisibility(next)}
                  disabled={saving}
                  trackColor={{ false: colors.surfacePressed, true: colors.gain }}
                  thumbColor={colors.ink}
                />
              </View>
            </View>

            {/*
              ⚠️ BURADAKİ "Arkadaşlar" DÜĞMESİ KALDIRILDI.

              Aynı yere iki giriş vardı: kimlikteki sayı ve buradaki
              düğme. İkisi de aynı katmanı açıyordu. Tekrarlanan giriş
              noktası, kullanıcıya "bunlar farklı şeyler mi?" diye
              sordurur. Kimlikteki sayı kaldı — orası doğru yeri.
            */}
          </>
        )}

        {error !== null && <Text style={styles.error}>{error}</Text>}

        {/*
          ÇIKIŞ — en altta ve BİLEREK sönük.

          ⚠️ Yıkıcı olmayan ama geri dönüşü zahmetli bir işlem: çıkınca
          tekrar şifre girmek gerekiyor. Diğer düğmelerle aynı vurguda
          olsaydı yanlışlıkla dokunma ihtimali artardı. Kırmızı da
          yapmadık — "sil" değil, "çık"; tehlike değil, son adım.
        */}
        {profile.isSelf && onLogout !== undefined && (
          <TouchableOpacity
            style={styles.logout}
            onPress={onLogout}
            accessibilityRole="button"
          >
            <Text style={styles.logoutText}>Çıkış yap</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  content: { paddingHorizontal: spacing.screen, paddingBottom: 40 },

  backRow: { paddingHorizontal: spacing.screen, paddingTop: 18, paddingBottom: 4 },
  back: { color: colors.gain, fontSize: 15, fontFamily: fonts.semibold },

  identity: { alignItems: 'center', paddingTop: 24, paddingBottom: 20, gap: 6 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  avatarText: { fontFamily: fonts.bold, fontSize: 24, color: colors.inkBright },
  name: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink },
  handle: { fontFamily: fonts.mono, fontSize: 13, color: colors.inkFaint },
  addFriend: {
    marginTop: 12,
    height: 40,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: colors.inverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Bekleyen durumda düğme SÖNÜK: bir şey yapılamaz ama bilgi durur.
  addFriendMuted: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addFriendText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.onInverse },
  addFriendTextMuted: { color: colors.inkMuted },


  friendsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    marginBottom: 18,
    borderRadius: 14,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
  },
  friendsCardLeft: {
    alignItems: 'center',
    minWidth: 54,
  },
  friendsCardValue: {
    fontFamily: fonts.monoSemibold,
    fontSize: 22,
    color: colors.ink,
  },
  friendsCardLabel: {
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 1.2,
    color: colors.inkFaint,
  },
  friendsCardText: { flex: 1, gap: 3 },
  friendsCardTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  friendsCardHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.inkMuted },
  friendsCardArrow: { fontSize: 22, color: colors.inkFaint },

  // Bekleyen istek kartı — sıfırken hiç çizilmiyor.
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginBottom: 18,
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.gain,
  },
  pendingBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 8,
    backgroundColor: colors.gain,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.onInverse,
  },
  pendingText: { flex: 1, gap: 2 },
  pendingTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  pendingHint: { fontFamily: fonts.regular, fontSize: 12, color: colors.inkMuted },
  pendingArrow: { fontSize: 20, color: colors.inkFaint },

  friendTag: {
    marginTop: 4,
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.gain,
  },

  statsRow: {
    flexDirection: 'row',
    borderRadius: 14,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
  },
  stat: { flex: 1, alignItems: 'center', gap: 6 },
  statDivider: { width: 1, backgroundColor: colors.border },
  statLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.inkFaint,
  },
  statValue: { fontFamily: fonts.monoSemibold, fontSize: 18, color: colors.ink },
  statMuted: { color: colors.inkDisabled },
  up: { color: colors.gain },
  down: { color: colors.loss },

  locked: {
    borderRadius: 14,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 6,
  },
  lockedTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  lockedText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.inkMuted,
  },

  section: { marginTop: 26 },
  sectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.inkFaint,
    marginBottom: 12,
  },
  emptyText: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted },

  slice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sliceNames: { flex: 1 },
  sliceName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  sliceSymbol: { fontFamily: fonts.mono, fontSize: 11, color: colors.inkFaint },
  sliceNumbers: { alignItems: 'flex-end', gap: 2 },
  slicePercent: {
    fontFamily: fonts.monoSemibold,
    fontSize: 15,
    color: colors.ink,
  },
  sliceProfit: { fontFamily: fonts.mono, fontSize: 11 },

  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  settingText: { flex: 1, gap: 4 },
  settingTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  settingHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.inkMuted,
  },

  friendsLink: {
    marginTop: 26,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  friendsLinkText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.inkBright,
  },
  friendsLinkArrow: { fontSize: 20, color: colors.inkFaint },

  logout: {
    alignSelf: 'center',
    marginTop: 36,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  logoutText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.inkMuted,
  },

  error: {
    marginTop: 18,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
  },
  retry: {
    paddingHorizontal: 18,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
});
