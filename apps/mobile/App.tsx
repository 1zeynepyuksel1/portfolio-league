import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View, Platform, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from '@expo-google-fonts/rubik';
import {
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  Rubik_700Bold,
} from '@expo-google-fonts/rubik';
import {
  DMMono_400Regular,
  DMMono_500Medium,
} from '@expo-google-fonts/dm-mono';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { FriendsScreen } from './src/screens/FriendsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { MarketScreen } from './src/screens/MarketScreen';
import { TradeScreen } from './src/screens/TradeScreen';
import { AssetDetailScreen } from './src/screens/AssetDetailScreen';
import { DiscoveryScreen } from './src/screens/DiscoveryScreen';
import { SlideView } from './src/components/SlideView';
import {
  apiFetch,
  clearSession,
  setSessionExpiredHandler,
} from './src/api/client';
import { PortfolioScreen } from './src/screens/PortfolioScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { colors } from './src/theme';
import { TabBar, type TabKey } from './src/components/TabBar';
import { CurrencyProvider } from './src/lib/currency';
import { ErrorBoundary } from './src/components/ErrorBoundary';

type User = {
  id: string;
  email: string;
  displayName: string;
  username?: string;
};

/**
 * ⚠️ SEKME LİSTESİ TabBar'DAN GELİYOR, BURADA TEKRAR TANIMLANMIYOR.
 *
 * İki ayrı liste tutsaydık biri değişip öbürü kalırdı ve TypeScript
 * bunu yalnızca kullanıldığı yerde yakalardı. Tek kaynak: TabKey.
 *
 * ⚠️ 'friends' SEKMESİ KALDIRILDI — tasarımın kararı. Arkadaşlar artık
 * Lig ekranının içinde bir alt sekme; ikisi de "başkalarına göre
 * neredeyim" sorusunu soruyor ve ayrı sekmelerde karşılaştırmak zordu.
 */
type Tab = TabKey;

/**
 * Giriş yapılmamışken hangi ekran görünüyor.
 *
 * Uygulama ilk açıldığında `welcome` — tasarımın kararı: kullanıcı
 * uygulamayı ilk indirdiğinde markayı görsün, sonra yol seçsin.
 * Oturum geri yüklenemezse de buraya düşülüyor.
 */
type AuthView = 'welcome' | 'login' | 'register' | 'forgot-password';

/**
 * Kök bileşen.
 *
 * ⚠️ SAĞLAYICI (Provider) EN DIŞTA — VE NEDENİ ÖNEMLİ.
 *
 * `CurrencyProvider` uygulamanın tamamını sarıyor, sadece Piyasa/Cüzdan
 * sekmelerini değil. Yalnızca o iki ekranı sarsaydık her sekme kendi
 * sağlayıcısını kurar, her birinin ayrı bir tercihi olurdu: kullanıcı
 * Piyasa'da dolara geçer, Cüzdan'a bakar, orada TL görürdü — ve ikisi de
 * "çalışıyor" gibi görünürdü.
 *
 * Alt bileşen olarak yazılmasının sebebi: `useCurrency` yalnızca
 * sağlayıcının İÇİNDE çağrılabilir. `App`'in kendisi sağlayıcıyı kuruyorsa
 * kendi içinde onu okuyamaz — bu React'in en sık düşülen kancası.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <CurrencyProvider>
        <AppShell />
      </CurrencyProvider>
    </ErrorBoundary>
  );
}

/**
 * Uygulama ve her yeni oturum hangi sekmeyle açılır.
 *
 * ⚠️ CÜZDAN, LİG DEĞİL. Önce lig açılıyordu; sıralama ilgi çekici ama
 * kullanıcının ilk sorusu "param ne durumda". Lig ancak kendi portföyünü
 * gördükten sonra anlam taşıyor — getirisini bilmeyen biri için
 * sıralamadaki yeri boş bir sayıdır.
 *
 * Sabit olarak duruyor ki iki çağıran (ilk açılış ve giriş sonrası) ayrı
 * ayrı yazmasın: biri değişip diğeri unutulursa "yenileyince cüzdan,
 * giriş yapınca lig" gibi tutarsız bir davranış çıkardı. Aynı hatanın
 * lig ekranındaki rengi iki yere yazılmış hâlini bugün düzelttik.
 */
const START_TAB: Tab = 'wallet';

function AppShell() {
  // Giriş yapmış kullanıcı bilgisi (null ise kimlik ekranları görünür)
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Kimlik akışında hangi ekrandayız
  const [authView, setAuthView] = useState<AuthView>('login');

  // Aktif Sekme (Cüzdanım, Haftalık Lig, Arkadaşlar, Ya Alsaydın)
  const [activeTab, setActiveTab] = useState<Tab>(START_TAB);

  /**
   * Al/Sat ekranı açıksa hangi varlık için.
   *
   * `null` = kapalı. Ayrı bir sekme DEĞİL, piyasa listesinin üstüne
   * açılan bir katman: kullanıcı hangi varlığa dokunduğunu unutmasın diye
   * geri dönünce aynı listeye düşüyor.
   */
  const [tradeAsset, setTradeAsset] = useState<{
    symbol: string;
    name: string;
  } | null>(null);

  /**
   * Varlık detayı (grafik) açıksa hangi varlık için.
   *
   * Akış: liste -> detay -> emir. Detaydan Al/Sat'a geçilince detay
   * KAPANMIYOR, üstüne emir katmanı açılıyor; emirden geri dönünce
   * kullanıcı grafiğe düşüyor, listeye değil.
   */
  const [detailAsset, setDetailAsset] = useState<{
    symbol: string;
    name: string;
  } | null>(null);

  /**
   * Emir geçince portföyün yeniden okunmasını tetikler.
   *
   * Sayıyı artırmak PortfolioScreen'in `key`'ini değiştiriyor; React
   * bileşeni sıfırdan kuruyor ve veriyi yeniden çekiyor. Emirden sonra
   * cüzdana geçildiğinde eski bakiyeyi görmemek için.
   */
  const [portfolioVersion, setPortfolioVersion] = useState(0);

  /**
   * Arkadaşlar katmanı. `false` = kapalı.
   *
   * ⚠️ SEKME DEĞİL, KATMAN — AssetDetail ve Trade ile aynı desen.
   * 'friends' sekmesi tasarım kararıyla kaldırılmıştı ama yerine kapı
   * açılmadığı için ekran ERİŞİLEMEZ kalmıştı: istek gönderiliyor, karşı
   * taraf göremiyordu. Lig ekranındaki "Arkadaşlar" alt sekmesinden
   * açılıyor, kapanınca lige dönüyor.
   */
  const [friendsOpen, setFriendsOpen] = useState(false);

  /**
   * BAŞKASININ profili. `null` = kapalı.
   *
   * ⚠️ KENDİ PROFİLİN SEKMEDE, BAŞKASININKİ KATMANDA. İkisi aynı ekran
   * ama farklı yollarla açılıyor: kendi profilin sık bakılan bir yer,
   * sekmede olmalı. Başkasınınki lig tablosundan bir kez açılıp
   * kapanıyor — sekme değiştirseydik kullanıcı geri döndüğünde ligde
   * değil profilde kalırdı.
   */
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);

  // Saklanan oturum kontrol edilirken açılış ekranı gösterilir. Bu bayrak
  // olmasaydı uygulama bir an giriş ekranını gösterip sonra ana ekrana
  // atlardı — kullanıcı "çıkış yapmışım" sanır.
  /**
   * Tanıtım turu gösterilecek kullanıcı. `null` = gösterilmiyor.
   *
   * ⚠️ EKRAN YAZILMIŞTI AMA HİÇ BAĞLANMAMIŞTI. `OnboardingScreen.tsx`
   * 315 satır, dört kart (100.000 ₺, canlı piyasa, TWR ligi, gizlilik) ve
   * sonunda `isPublic` seçimi — hiçbir yerden import edilmiyordu. Yeni
   * kullanıcı kayıt olup doğrudan boş bir cüzdana düşüyordu: ne lig, ne
   * günlük bonus, ne de ne yapması gerektiği söyleniyordu.
   *
   * ⚠️ YALNIZCA KAYITTAN SONRA, GİRİŞTEN SONRA DEĞİL — ve bu seçim
   * "görüldü mü" bilgisini saklama ihtiyacını tamamen ortadan kaldırıyor.
   * Sunucuda bayrak tutsaydık migration gerekirdi (Zeynep); cihazda
   * tutsaydık kullanıcı telefon değiştirince turu tekrar görürdü. Kayıt
   * zaten hesap başına bir kez olan bir olay.
   */
  const [onboardingFor, setOnboardingFor] = useState<User | null>(null);

  /**
   * Bekleyen (gelen) arkadaşlık isteği sayısı — Profil sekmesindeki rozet.
   *
   * ⚠️ NEDEN KABUKTA, EKRANDA DEĞİL. Sayı `FriendsScreen` içinde zaten
   * hesaplanıyordu ama orası Lig sekmesinin altında bir katman: görmek
   * için ZATEN oraya bakıyor olman gerekiyordu. Bildirimin işi, bakmayan
   * kişiye haber vermek.
   *
   * ⚠️ PROFİL SEKMESİNE KONDU, LİG'E DEĞİL. Bekleyen istek kartı Profil
   * ekranında duruyor; rozet dokunulacak yeri göstermeli. Lig'e koysaydık
   * kullanıcı lige gider, orada bir şey bulamazdı.
   */
  const [pendingRequests, setPendingRequests] = useState(0);

  const [restoring, setRestoring] = useState(true);

  /**
   * Archivo yazı tipi — tasarımın tamamı bu font üzerine kurulu.
   *
   * ⚠️ YÜKLENMEDEN EKRAN ÇİZİLMEMELİ. React Native'de olmayan bir
   * `fontFamily` hata FIRLATMIYOR, sessizce sistem fontuna düşüyor.
   * Yani beklemezsek ekran bir an tamamen farklı bir tipografiyle çizilir,
   * sonra zıplayarak düzelir — ve bir hata görmediğimiz için "tasarım
   * neden tutmuyor" diye kodda ararız.
   */
  /**
   * ⚠️ BURAYA EKLENMEYEN FONT SESSİZCE ÇALIŞMAZ.
   *
   * `fontFamily: 'IBMPlexMono_500Medium'` yazıp burada yüklemezsen React
   * Native hata FIRLATMAZ — sistem fontuna düşer. Yani "çalışıyor ama
   * tasarıma benzemiyor" olur ve sebebi hiçbir yerde yazmaz.
   *
   * theme.ts'teki `fonts` nesnesindeki her ad burada karşılığını bulmalı.
   */
  const [fontsLoaded] = useFonts({
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
    DMMono_400Regular,
    DMMono_500Medium,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  // Otomatik oturum geri yükleme devre dışı bırakıldı. Her açılışta giriş sayfasına yönlendirilir.
  useEffect(() => {
    setRestoring(false);
  }, []);

  /**
   * Oturum uygulama AÇIKKEN ölürse giriş ekranına dön.
   *
   * ⚠️ NEDEN GEREKLİ: erişim token'ı 15 dakikada ölüyor. Eskiden bunun
   * bir karşılığı yoktu — kabuk "giriş yapılmış" ekranını çizmeye devam
   * ediyor, her istek "Access token gereklidir" diyor, o ekranda çıkış
   * tuşu da olmadığı için kullanıcı KİLİTLENİYORDU. Tek çıkış yolu
   * tarayıcı deposunu elle temizlemekti.
   *
   * client.ts önce sessizce yenilemeyi deniyor; yalnızca o da başarısız
   * olursa burası çağrılıyor. Yani kullanıcı normalde hiçbir şey fark
   * etmiyor, sadece gerçekten oturumu bittiğinde giriş ekranını görüyor.
   */
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setCurrentUser(null);
      setAuthView('login');
    });

    // Ekran sökülürken bırak — yoksa eski state'e tutunan bir kapanış kalır.
    return () => setSessionExpiredHandler(null);
  }, []);

  /**
   * Bekleyen istek sayısını periyodik çek.
   *
   * ⚠️ 45 SANİYE — fiyat ekranlarındaki 5 saniye DEĞİL. Arkadaşlık isteği
   * saniyede değişen bir şey değil; 5 saniyede sorsaydık günde ~17.000
   * gereksiz istek olurdu ve rozetin değeri hiç değişmezdi.
   *
   * ⚠️ GİRİŞ YAPILMAMIŞKEN HİÇ ÇALIŞMIYOR. `currentUser` yokken istek
   * atsaydık her tur 401 döner, `client.ts` yenilemeyi dener, o da
   * başarısız olur ve oturum-bitti işleyicisi tetiklenirdi — yani giriş
   * ekranındaki kullanıcı sürekli "oturumun bitti" uyarısı alırdı.
   */
  useEffect(() => {
    if (!currentUser) {
      setPendingRequests(0);
      return;
    }

    let alive = true;

    async function load() {
      try {
        const data = await apiFetch<{ incoming?: unknown[] }>('/friends/requests');
        if (alive) setPendingRequests(data.incoming?.length ?? 0);
      } catch {
        // Rozet ikincil bilgi — okunamazsa sessizce eski değerde kalsın.
        // Hata göstermek, kullanıcının yapabileceği bir şey olmadığı için
        // yalnızca gürültü olurdu.
      }
    }

    void load();
    const timer = setInterval(() => void load(), 45_000);

    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [currentUser]);

  // Çıkış yap fonksiyonu — token'ı diskten de siliyor
  /**
   * Yeni oturum başlatır: kullanıcıyı kurar VE sekmeyi başa alır.
   *
   * ⚠️ SEKME SIFIRLAMASI OLMADAN NE OLUYORDU: `AppShell` çıkış
   * yapınca SÖKÜLMÜYOR, sadece kimlik ekranlarını çiziyor. Yani
   * `activeTab` çıkıştan önceki değerinde kalıyordu. Kullanıcı profil
   * sekmesindeyken çıkıp başka bir hesapla girince, doğrudan O HESABIN
   * profiline düşüyordu — hiç dokunmadığı bir ekrana.
   *
   * İlk açılışta gerekmiyor (state zaten `START_TAB` ile kuruluyor),
   * ama iki yol aynı sabiti kullansın diye burada da yazılıyor.
   */
  function startSession(user: User) {
    setCurrentUser(user);
    setActiveTab(START_TAB);
  }

  /**
   * Tanıtım turu bitti: gizlilik tercihini kaydet ve uygulamaya gir.
   *
   * ⚠️ PATCH BAŞARISIZ OLSA BİLE KULLANICI İÇERİ ALINIYOR. Turun son
   * adımı bir tercih soruyor; ağ o an koparsa kullanıcıyı tanıtım
   * ekranında kilitlemek, kaydedilememiş bir tercihten çok daha kötü.
   * Varsayılan zaten `is_public = true` (şemada) ve kullanıcı aynı ayarı
   * Profil sekmesinden her an değiştirebiliyor.
   */
  async function finishOnboarding(isPublic: boolean) {
    const user = onboardingFor;

    try {
      await apiFetch('/users/me/visibility', {
        method: 'PATCH',
        body: JSON.stringify({ isPublic }),
      });
    } catch {
      // Sessiz geç — gerekçe yukarıda.
    }

    setOnboardingFor(null);
    if (user) startSession(user);
  }

  async function handleLogout() {
    await clearSession();
    setCurrentUser(null);
    // Çıkışta Welcome'a değil doğrudan Login'e dönülüyor: kullanıcı
    // markayı zaten tanıyor, tekrar tanıtmak yol uzatmak olur.
    setAuthView('login');
  }

  // ⚠️ Kimlik ekranları farklı bir yüzey rengi kullanıyor (#111112),
  // ana uygulama hâlâ eski lacivert (#0B132B). SafeAreaView'un rengi
  // sabit kalsaydı, iOS'ta çentik ve alt çubuk hizasında yanlış renkte
  // bir şerit görünürdü. Ana uygulama da tasarım diline geçince bu
  // koşul kalkacak.
  const onAuthFlow = !currentUser;

  return (
    <SafeAreaView
      style={[
        styles.container,
        onAuthFlow && { backgroundColor: colors.surface },
      ]}
    >
      <StatusBar style="light" />

      {restoring || !fontsLoaded ? (
        // 0. OTURUM KONTROL EDİLİYOR / YAZI TİPİ YÜKLENİYOR
        <View style={styles.splash}>
          <ActivityIndicator size="large" color={colors.ink} />
        </View>
      ) : onboardingFor !== null ? (
        /*
          0.5 TANITIM TURU — kayıttan hemen sonra, uygulamadan hemen önce.

          ⚠️ `!currentUser` DALINDAN ÖNCE GELİYOR. Kayıt başarılı olunca
          `startSession` çağrılmıyor, yani `currentUser` hâlâ `null`.
          Bu dal aşağıda olsaydı kimlik akışı devreye girer ve kullanıcı
          kayıt olduktan sonra kendini giriş ekranında bulurdu.
        */
        <OnboardingScreen
          userName={onboardingFor.displayName}
          onFinishOnboarding={(isPublic) => void finishOnboarding(isPublic)}
        />
      ) : !currentUser ? (
        // 1. GİRİŞ YAPILMAMIŞSA: Welcome -> Login / Kayıt akışı
        //
        // Basit bir state makinesi; navigasyon kütüphanesi eklenmedi.
        // Üç ekran ve iki geçiş için react-navigation'ın kurulum maliyeti
        // kazandırdığından fazla. Ekran sayısı artarsa o zaman geçilir.
        authView === 'login' ? (
          <LoginScreen
            onLoginSuccess={(user) => startSession(user)}
            onGoToRegister={() => setAuthView('register')}
            onGoToForgotPassword={() => setAuthView('forgot-password')}
          />
        ) : authView === 'register' ? (
          <RegisterScreen
            onRegisterSuccess={(user) => setOnboardingFor(user)}
            onGoToLogin={() => setAuthView('login')}
          />
        ) : authView === 'forgot-password' ? (
          <ForgotPasswordScreen
            onSuccess={() => setAuthView('login')}
            onGoToLogin={() => setAuthView('login')}
          />
        ) : (
          <WelcomeScreen
            onGoToRegister={() => setAuthView('register')}
            onGoToLogin={() => setAuthView('login')}
          />
        )
      ) : (
        // 2. GİRİŞ YAPILDIYSA: Ana Uygulama Gösterilir
        <View style={styles.mainContainer}>
          {/* Aktif Ekran İçeriği */}
          {activeTab === 'market' ? (
            <MarketScreen
              onSelectAsset={(symbol, name) => setDetailAsset({ symbol, name })}
            />
          ) : activeTab === 'wallet' ? (
            // Sabit "100.000,00 ₺" yerine GET /portfolio'dan gelen gerçek
            // veri: nakit, pozisyonlar, toplam değer, kâr/zarar.
            <PortfolioScreen
              key={portfolioVersion}
              /**
               * Cüzdandaki bir varlığa dokununca piyasadaki detayına git.
               *
               * ⚠️ SEKME DEĞİŞTİRMİYORUZ, KATMAN AÇIYORUZ. `setActiveTab`
               * çağırsaydık kullanıcı geri döndüğünde Piyasa sekmesinde
               * kalırdı — oysa cüzdandan gelmişti. Detay ekranı üstte bir
               * katman olarak açılıyor, kapanınca cüzdana düşüyor.
               */
              onSelectAsset={(symbol, name) => setDetailAsset({ symbol, name })}
            />
          ) : activeTab === 'league' ? (
            <LeaderboardScreen
              onOpenFriends={() => setFriendsOpen(true)}
              onSelectUser={(username) => setViewingProfile(username)}
            />
          ) : activeTab === 'profile' ? (
            /*
              ⚠️ KENDİ PROFİLİN — kullanıcı adı `currentUser`'dan geliyor.

              `username` eski bir oturumda eksik olabilir (0008 migration'ından
              önce açılmış token). O durumda profil ekranı yerine kısa bir
              uyarı gösteriyoruz: `undefined` bir URL'e girip 404 almaktansa
              ne yapılacağını söylemek doğru.
            */
            currentUser?.username ? (
              <ProfileScreen
                username={currentUser.username}
                currentUserId={currentUser.id}
                onOpenFriends={() => setFriendsOpen(true)}
                onLogout={() => void handleLogout()}
              />
            ) : (
              <View style={styles.splash}>
                <Text style={styles.notice}>
                  Profilini görmek için çıkıp tekrar giriş yap.
                </Text>
              </View>
            )
          ) : (
            <DiscoveryScreen onSelectUser={(username) => setViewingProfile(username)} currentUser={currentUser} />
          )}

          {/*
            ALT SEKME ÇUBUĞU — tasarımın yeri burası.

            Üstteydi; tasarım alta taşıyor. Sebebi ergonomi: telefon tek
            elle tutulurken başparmak ekranın üst kenarına ulaşamıyor.
            Sekmeler en sık dokunulan hedef ve en zor yerdeydi.
          */}
          <TabBar
            active={activeTab}
            onChange={setActiveTab}
            badges={{ profile: pendingRequests }}
          />

          {/*
            AL/SAT KATMANI — sekmelerin ÜSTÜNDE.

            Sekme çubuğunu da kapatıyor: emir verirken kullanıcı yanlışlıkla
            başka sekmeye geçip yarım kalmış bir formu kaybetmesin.
          */}
          {friendsOpen && (
            <SlideView direction="bottom">
              <FriendsScreen
                onClose={() => setFriendsOpen(false)}
                onSelectUser={(username) => setViewingProfile(username)}
              />
            </SlideView>
          )}

          {/*
            ⚠️ PROFİL KATMANI ARKADAŞLAR KATMANININ ALTINDA DEĞİL ÜSTÜNDE —
            ve sıra bu yüzden değişti.

            JSX'te sonra çizilen üstte durur. Profil önce yazılıydı; arkadaş
            listesinden bir kişiye dokunulduğunda profil AÇILIYOR ama arkadaş
            ekranının ALTINDA kalıyordu. Ekranda hiçbir şey olmuyormuş gibi
            görünürdü.

            Profil en son: hem ligden hem arkadaş listesinden açılabiliyor,
            ikisinin de üstünde olması gerekiyor. Kapanınca altındaki ekran
            neyse ona dönülüyor.
          */}
          {viewingProfile !== null && (
            <SlideView direction="right">
              <ProfileScreen
                username={viewingProfile}
                currentUserId={currentUser?.id}
                onClose={() => setViewingProfile(null)}
              />
            </SlideView>
          )}

          {detailAsset !== null && (
            <SlideView direction="right">
              <AssetDetailScreen
                symbol={detailAsset.symbol}
                name={detailAsset.name}
                onClose={() => setDetailAsset(null)}
                onTrade={() => setTradeAsset(detailAsset)}
              />
            </SlideView>
          )}

          {/* Emir katmanı EN ÜSTTE — detayın da üstünde. */}
          {tradeAsset !== null && (
            <SlideView direction="bottom">
              <TradeScreen
                symbol={tradeAsset.symbol}
                name={tradeAsset.name}
                onClose={() => setTradeAsset(null)}
                onOrderPlaced={() => setPortfolioVersion((v) => v + 1)}
              />
            </SlideView>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  notice: {
    color: colors.inkMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  container: {
    flex: 1,
    backgroundColor: '#0B132B',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  mainContainer: {
    flex: 1,
  },
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTabBar: {
    flexDirection: 'row',
    backgroundColor: '#1C2541',
    padding: 6,
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 12,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#10B981',
  },
  tabButtonText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 12,
  },
  tabButtonTextActive: {
    color: '#FFFFFF',
  },
  walletContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeEmoji: {
    fontSize: 50,
    marginBottom: 10,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 4,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#1C2541',
    borderColor: '#10B981',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 28,
  },
  cardTitle: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  cardAmount: {
    color: '#10B981',
    fontSize: 32,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  cardInfo: {
    color: '#E2E8F0',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  logoutButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
