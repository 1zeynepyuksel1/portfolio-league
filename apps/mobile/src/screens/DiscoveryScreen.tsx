import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Image, Platform, StatusBar as RNStatusBar } from 'react-native';
import { colors, fonts, shadows } from '../theme';
import { LeagueRankCard } from '../components/LeagueRankCard';
import { apiFetch } from '../api/client';
import { PostCard } from '../components/PostCard';
import { ActivityIndicator, FlatList, RefreshControl } from 'react-native';

import { Heart, MessageSquare, TrendingUp, TrendingDown, Gift, Plus } from 'lucide-react-native';
import { GlobalShareMenu } from '../components/GlobalShareMenu';
import { getMe } from '../lib/me';
import { EmptyState } from '../components/EmptyState';
import { Newspaper } from 'lucide-react-native';

/**
 * ⚠️ 'league' BURADAN ÇIKTI — TEKRAR ALT ÇUBUĞA DÖNDÜ.
 *
 * Lig bir dönem burada alt sekmeydi. Profesörün itirazı ("3'de bunu
 * çok saklamışsınız") ve iki kapılı yapının yarattığı kararsızlık
 * sonrası kendi sekmesine geri alındı.
 *
 * ⚠️ Ama Lig BURADAN DA görünüyor: akışın en üstündeki `LeagueRankCard`
 * bir GİRİŞ NOKTASI. Sekme "Lig var" der, kart "Lig'de 4. sıradasın"
 * der. İkisi aynı şey değil ve ikisi de gerekli.
 */
/*
  ⚠️ ALT SEKMELER TAMAMEN KALKTI — İKİ AYRI SEBEPLE.

  1) İSİM ÇAKIŞMASI. Alt çubuktaki sekmenin adı "Akış"tı ve içinde
     yine "Akış" adlı bir alt sekme vardı. Aynı kelime iki kademede:
     kullanıcı ikisinin farklı şeyler olduğunu sanar.

  2) ÜÇÜNCÜ KAPI. "Sosyal" arkadaş listesini açıyordu — ama o liste
     Lig ekranından ZATEN iki yoldan erişilebiliyor ("Arkadaşlarım"
     alt sekmesi ve arkadaş katmanı düğmesi). Yani aynı şeye üç kapı
     vardı. `+` menüsünü bıraktıran kararsızlığın aynısı.

  Şimdi Keşfet TEK İŞ yapıyor: akışı göstermek. Tek çocuğu olan bir
  sekme çubuğuna gerek yok — bir seçenek sunan menü, menü değildir.

  ⚠️ Arkadaşlar KAYBOLMADI, Lig'in içinde. `onOpenFriends` propu
  burada artık kullanılmıyor ama imzada duruyor: App.tsx onu hâlâ
  geçiriyor ve ileride akıştan bir giriş noktası açılabilir.
*/
export function DiscoveryScreen({ onSelectUser, currentUser, onOpenLeague }: { onSelectUser?: (username: string) => void; currentUser?: any; onOpenFriends?: () => void; onOpenLeague?: (() => void) | undefined }) {
  const [shareMenuVisible, setShareMenuVisible] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <FeedTab onSelectUser={onSelectUser} currentUser={currentUser} onOpenLeague={onOpenLeague} />
      </View>
      {/*
        ⚠️ Paylaş düğmesi yalnızca Akış sekmesinde. Lig sıralamasına ya da
        arkadaş listesine bakarken "paylaş" düğmesi neyin paylaşılacağını
        belirsiz bırakıyordu; düğme her zaman görünür olunca kullanıcı onu
        bulunduğu sekmeyle ilişkilendiriyor.
      */}
      {/* Ekranda tek içerik var; koşula gerek kalmadı. */}
      {(
      <TouchableOpacity style={styles.fab} onPress={() => setShareMenuVisible(true)}>
        <Plus size={24} color="#FFF" />
      </TouchableOpacity>
      )}
      <GlobalShareMenu visible={shareMenuVisible} onClose={() => setShareMenuVisible(false)}  />
    </View>
  );
}

function FeedTab({ onSelectUser, currentUser, onOpenLeague }: { onSelectUser?: (username: string) => void; currentUser?: any; onOpenLeague?: (() => void) | undefined }) {
  
  const [posts, setPosts] = React.useState<any[]>([]);
  /*
    ⚠️ ROL BURADA BİR KEZ OKUNUYOR, HER KARTTA DEĞİL.

    `lib/me.ts` modül seviyesinde önbellekli; yine de isteği akışın
    kendisi atıyor ve sonucu kartlara PROP olarak geçiyor. Her kart
    kendi `getMe()`'sini çağırsaydı önbellek yüzünden ağ isteği tek
    kalırdı ama her kart gereksiz bir `useEffect` ve render turu daha
    yaşardı.
  */
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  async function loadFeed(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await apiFetch<{ posts: any[] }>('/posts/feed');
      setPosts(res.posts || []);
    } catch (err) {
      console.warn('Failed to load feed:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  React.useEffect(() => {
    loadFeed();
    void getMe().then((me) => setIsAdmin(me?.role === 'admin'));
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <FlatList
        showsVerticalScrollIndicator={false}
      data={posts}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.feedContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadFeed(true)} tintColor={colors.accent} />}
      /*
        ⚠️ KART `ListHeaderComponent`'TE, AYRI BİR `View`'DA DEĞİL.

        Listenin üstüne ayrı bir kutu koysaydık kart SABİT kalır,
        yalnızca gönderiler kayardı. O zaman ekranın üstünden 70
        piksel kalıcı olarak giderdi. Başlık olarak verilince kart
        akışın bir parçası: aşağı kaydırınca yukarı çıkıyor.

        ⚠️ `ListEmptyComponent` İLE BİRLİKTE ÇALIŞIR — akış boşken
        bile başlık çizilir. Yani hiç gönderi yokken bile kullanıcı
        lig kartını görüyor; boş ekranda yapacak bir şey kalıyor.
      */
      ListHeaderComponent={
        onOpenLeague ? <LeagueRankCard username={currentUser?.username} onPress={onOpenLeague} /> : null
      }
      ListEmptyComponent={
        <EmptyState
          icon={Newspaper}
          title="Akış henüz boş"
          description="Arkadaşların bir şey paylaştığında burada görünecek. İlk paylaşımı sen yapabilirsin."
        />
      }
      renderItem={({ item }) => (
        <PostCard 
          post={item} 
          user={item.user || { username: 'Gizli Kullanıcı', avatarStyle: 'shapes', avatarSeed: 'default' }} 
            isPreview={false}
            currentUserId={currentUser?.id}
            isAdmin={isAdmin}
            onPressUser={onSelectUser} 
        />
      )}
      /*
        ⚠️ ÜÇ SAHTE GÖNDERİ BURADAN KALDIRILDI.

        `ListFooterComponent` içinde elle yazılmış üç kart duruyordu:
        "Sarah Jenkins", "Cem Yılmaz", sabit beğeni sayıları ve
        "Günlük çarktan Kripto Kurdu rozeti çıktı!" metni. Tasarım
        turundan kalan yer tutucularmış.

        ⚠️ ZARARSIZ DEĞİLLERDİ, İKİ SEBEPLE:

        1. GERÇEK gönderilerin ALTINA ekleniyorlardı. Kullanıcı kendi
           paylaşımını yapıp akışa bakınca altında hiç var olmamış
           insanların gönderilerini görüyordu; hangisinin gerçek olduğu
           anlaşılmıyordu.

        2. Çark özelliği KALDIRILDI ama bu kart onu hâlâ duyuruyordu.
           Veritabanında tek bir çark kaydı yok (`wheel_spins: 0`,
           `wheel_rewards: 0`); ekrandaki tek "çark" izi buydu.
      */
    />
  );
}

function PlaceholderTab({ title, description, icon }: { title: string, description: string, icon: React.ReactNode }) {
  return (
    <View style={styles.placeholderContainer}>
      <View style={styles.placeholderIconBox}>{icon}</View>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderText}>{description}</Text>
      <TouchableOpacity style={styles.placeholderBtn}>
        <Text style={styles.placeholderBtnText}>Çok Yakında</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    /*
      ⚠️ YÜZEN DÜĞME GERÇEKTEN YÜZMELİ. Gölgesiz hâlde içeriğin üstüne
      yapıştırılmış bir daire gibi duruyordu; renkli gölge onu
      zeminden ayırıyor ve "bu katman farklı" diyor.
    */
    ...shadows.accentGlow,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6
  },
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  content: {
    flex: 1,
  },
  feedContent: {
    padding: 16,
    // Üstteki sekme çubuğuyla arasında zaten çizgi var; 16 fazlaydı.
    paddingTop: 12,
    /*
      ⚠️ ALT BOŞLUK FAB'IN ALTINI KURTARIYOR.

      Yüzen `+` düğmesi alttan 24, yüksekliği 56 — yani ekranın alt 80
      pikselini kaplıyor. Liste 40 piksel boşlukla bitince SON kartın
      düğmeleri o dairenin altında kalıyordu; kullanıcı beğen/yorum
      simgesine basmak isterken paylaşım menüsü açılıyordu.

      104 = 56 (düğme) + 24 (alt boşluk) + 24 (nefes payı).
    */
    paddingBottom: 104,
    gap: 16,
  },
  postCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfacePressed,
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  postMeta: {
    flex: 1,
  },
  postName: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.ink,
    marginBottom: 2,
  },
  postTime: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.inkMuted,
  },
  postBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
  postBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  innerBox: {
    backgroundColor: colors.surface, // Daha koyu zemin (arka planla aynı)
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)',
  },
  innerBoxLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.inkMuted,
    marginBottom: 4,
  },
  innerBoxValue: {
    fontFamily: fonts.bold,
    fontSize: 26,
  },
  postText: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.inkBright,
    lineHeight: 22,
    marginBottom: 20,
  },
  postFooter: {
    flexDirection: 'row',
    gap: 24,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.inkMuted,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  placeholderIconBox: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholderTitle: {
    fontFamily: fonts.bold,
    fontSize: 26,
    color: colors.ink,
    marginBottom: 12,
    textAlign: 'center',
  },
  placeholderText: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  placeholderBtn: {
    backgroundColor: colors.surfacePressed,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholderBtnText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.inkMuted,
  }
});
