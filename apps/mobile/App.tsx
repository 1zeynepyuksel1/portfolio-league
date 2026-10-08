import React, { useEffect, useState } from 'react';
import { ActivityIndicator, DeviceEventEmitter, SafeAreaView, StyleSheet, Text, TouchableOpacity, View, Platform, StatusBar as RNStatusBar } from 'react-native';
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
import { CoachScreen } from './src/screens/CoachScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { MarketScreen } from './src/screens/MarketScreen';
import { TradeScreen } from './src/screens/TradeScreen';
import { AssetDetailScreen } from './src/screens/AssetDetailScreen';
import { DiscoveryScreen } from './src/screens/DiscoveryScreen';
import { UserAvatar } from './src/components/UserAvatar';
import { formatCentsString } from './src/lib/format';
import { setPreference } from './src/lib/storage';
import { LeagueResultModal } from './src/components/LeagueResultModal';
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
import { OnboardingScreen, type OnboardingResult } from './src/screens/OnboardingScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { colors } from './src/theme';
import { TabBar, type TabKey } from './src/components/TabBar';
import { CurrencyProvider } from './src/lib/currency';
import { ErrorBoundary } from './src/components/ErrorBoundary';

/**
 * Saate göre selamlama.
 *
 * ⚠️ SAF FONKSİYON, BİLEŞENİN DIŞINDA. İçeride tanımlasaydık her
 * çizimde yeniden oluşurdu — küçük bir israf ama asıl sorun şu:
 * test edilebilirliği kaybederdik. Burada duran hâli tek başına
 * çağrılabilir.
 *
 * ⚠️ Sınırlar bilinçli: gece 23-05 arası "iyi geceler" diyor. Sabah
 * 05'te "günaydın" başlamasının sebebi, uygulamayı o saatte açan
 * kişinin uyanık olması — takvim değil, kullanıcının hâli önemli.
 */
function selamlama(saat: number): string {
  if (saat >= 5 && saat < 11) return 'Günaydın';
  if (saat >= 11 && saat < 18) return 'Merhaba';
  if (saat >= 18 && saat < 23) return 'İyi akşamlar';
  return 'İyi geceler';
}

/**
 * Selamlamada kullanılacak ad.
 *
 * ⚠️ SADECE İLK AD. `displayName` "Batuhan Oğuz" olabilir; selamlamada
 * tam ad resmî durur ve satırı uzatır. Boşluktan öncesini alıyoruz.
 * Ad hiç yoksa kullanıcı adına düşüyor — orası her zaman dolu.
 */
function ilkAd(displayName?: string, username?: string): string {
  const ad = (displayName ?? '').trim().split(/\s+/)[0];
  return ad !== undefined && ad !== '' ? ad : (username ?? '');
}

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
 * ⚠️ 'wallet' -> 'discovery' DEĞİŞTİ. Eski gerekçe şuydu: "kullanıcının
 * ilk sorusu 'param ne durumda'". Doğru — ama YALNIZCA portföyü olan
 * kullanıcı için. Yeni kullanıcının cüzdanı boş; onu boş bir cüzdanla
 * karşılamak, uygulamanın ilk söylediği şeyin "burada bir şeyin yok"
 * olması demek. Profesörün ifadesi: "cüzdandan almak bana ürkütücü
 * geldi."
 *
 * Akış hem doluyor (başkalarının paylaşımları) hem de üstünde lig
 * kartını taşıyor — yani ilk ekran hep bir şey söylüyor.
 *
 * ⚠️ Sabit olarak duruyor ki iki çağıran (ilk açılış ve giriş sonrası)
 * ayrı ayrı yazmasın: biri değişip diğeri unutulursa "yenileyince akış,
 * giriş yapınca cüzdan" gibi tutarsız bir davranış çıkar.
 */
const START_TAB: Tab = 'discovery';

function AppShell() {
  // Giriş yapmış kullanıcı bilgisi (null ise kimlik ekranları görünür)
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Kimlik akışında hangi ekrandayız
  /*
    ⚠️ BAŞLANGIÇ 'welcome' — 'login' YAZIYORDU VE EKRAN HİÇ GÖRÜNMÜYORDU.

    `WelcomeScreen.tsx` yazılıydı, App.tsx'te import ediliyordu ve JSX'te
    son dal olarak duruyordu. Ama başlangıç değeri 'login' olduğu için o
    dala HİÇ düşülmüyordu: uygulama her açılışta doğrudan giriş formunu
    gösteriyordu.

    ⚠️ Bu, bu projede ÜÇÜNCÜ kez aynı şekil: `AssetLogo` yazılmış ama
    kullanılmıyordu, `FriendsScreen` çiziliyor sanılıyordu ama
    erişilemezdi. Kod var olması bir şeyin GÖRÜNDÜĞÜ anlamına gelmiyor —
    ona giden bir yol da olmalı.

    ⚠️ ÇIKIŞTA 'login'e dönülüyor, 'welcome'a değil (`handleLogout`).
    O bilinçli ve orada gerekçesi yazılı: kullanıcı markayı zaten tanıyor.
    Karşılama yalnızca uygulamanın ilk açılışı için.
  */
  const [authView, setAuthView] = useState<AuthView>('welcome');

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
  const [friendsMode, setFriendsMode] = useState<'league' | 'profile'>('league');

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

  /*
    `+` MENÜSÜ VE KEŞFET ODAĞI.

    ⚠️ `discoveryFocus` bir SEKME DEĞİL, bir İSTEK. Keşfet hangi alt
    sekmede olduğunu kendi biliyor; buradan yalnızca "şuna geç" diye
    haber gönderiyoruz. `nonce` her istekte artıyor — sebebi
    DiscoveryScreen'de yazılı: aynı hedef arka arkaya seçilirse
    `tab` değişmediği için efekt bir daha tetiklenmez.
  */

  /*
    Sol üstteki avatarın görseli.

    ⚠️ OTURUM NESNESİNDE YOK — giriş cevabı `avatarSeed` döndürmüyor,
    o alan profil ucunda yaşıyor. Ayrı tutuluyor ki `currentUser`ın
    şekli değişmesin; değiştirseydik giriş, kayıt ve oturum geri
    yükleme yollarının ÜÇÜNÜ birden güncellemek gerekirdi.

    ⚠️ Okunamazsa `undefined` kalıyor ve UserAvatar baş harfe düşüyor —
    yani avatar isteği başarısız olsa da sol üst köşe boş kalmıyor.
  */
  const [myAvatar, setMyAvatar] = useState<{ seed?: string | null; style?: string | null } | undefined>(undefined);

  /*
    Üst çubuktaki portföy değeri.

    ⚠️ CÜZDAN EKRANIYLA AYNI VERİ AMA AYRI İSTEK — ve bu bilinçli.
    PortfolioScreen kendi verisini kendi çekiyor; oradan yukarı
    taşımak için ya durumu App'e almak (her fiyat tazelemesinde tüm
    uygulama yeniden çizilir) ya da geri çağrı geçirmek gerekirdi
    (ekran açık değilken değer boş kalır). Ayrı ve seyrek bir istek
    ikisinden de ucuz.
  */
  const [myTotal, setMyTotal] = useState<string | null>(null);

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
    const sub = DeviceEventEmitter.addListener('switchTab', (tab) => setActiveTab(tab));
    return () => sub.remove();
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
      /*
        ⚠️ ÜST ÇUBUK VERİSİ DE SIFIRLANIYOR — VE BU BİR HATA
        DÜZELTMESİ.

        Çıkış yapılınca yalnızca `currentUser` temizleniyordu; avatar
        ve portföy değeri ÖNCEKİ kullanıcınınki olarak state'te
        kalıyordu. Yeni bir hesap açıldığında üst çubuk hâlâ eski
        kullanıcının avatarını ve bakiyesini gösteriyordu — ekran
        "başkasının hesabına girmişsin" gibi görünüyordu.
      */
      setMyAvatar(undefined);
      setMyTotal(null);
      return;
    }

    let alive = true;

    /*
      ⚠️ BU BAYRAK EFEKTE AİT, BİLEŞENE DEĞİL — VE FARK BURADA.

      Eskiden koşul `myAvatar === undefined` idi, yani "elimizde yoksa
      çek". İki sorunu vardı:

        1. Kullanıcı değişince eski avatar hâlâ `undefined` DEĞİLDİ,
           dolayısıyla yeni kullanıcının avatarı hiç çekilmiyordu.
        2. `myAvatar` bu kapanışta ÇİZİM ANINDAKİ değeriyle
           donuyor; efektin içinde sıfırlasak bile kapanış eski
           değeri görürdü.

      `alindi` her efekt turunda — yani her kullanıcı için — sıfırdan
      başlıyor. "Kullanıcı başına bir kez" kuralını durumdan değil,
      efektin ömründen alıyor.
    */
    let alindi = false;

    // Yeni kullanıcı: eski kimliğin izlerini hemen sil.
    setMyAvatar(undefined);
    setMyTotal(null);

    async function load() {
      try {
        const data = await apiFetch<{ incoming?: unknown[] }>('/friends/requests');
        if (alive) setPendingRequests(data.incoming?.length ?? 0);

        // Avatar 45 saniyede bir değişmiyor: kullanıcı başına bir kez.
        if (alive && !alindi && currentUser?.username) {
          alindi = true;
          const me = await apiFetch<{ profile?: { avatarSeed?: string | null; avatarStyle?: string | null } }>(
            `/users/${currentUser.username}`,
          );
          if (alive) {
            setMyAvatar({ seed: me.profile?.avatarSeed, style: me.profile?.avatarStyle });
          }
        }

        /*
          ⚠️ HER TURDA TAZELENİYOR — avatarın aksine. Portföy değeri
          45 saniyede gerçekten değişiyor; başlıktaki sayı ekrandaki
          sayıdan geride kalırsa kullanıcı hangisine inanacağını
          bilemez.
        */
        const pf = await apiFetch<{ totalValueCents?: string }>('/portfolio');
        if (alive && pf.totalValueCents) setMyTotal(pf.totalValueCents);
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
  /*
    OTURUM DEĞİŞİNCE ÖNCEKİ OTURUMUN KATMANLARINI KAPAT.

    ⚠️ BULUNAN HATA: yeni hesap açan kullanıcı, ÖNCEKİ hesabın
    profiline düşüyordu.

    Sebep: `viewingProfile` bir KULLANICI ADI tutuyor ve çıkışta
    temizlenmiyordu. Sıra şöyle işliyordu:

      1. batuhanwh olarak gir, avatara dokun -> viewingProfile='batuhanwh'
      2. Çıkış yap -> currentUser=null, ama viewingProfile HÂLÂ 'batuhanwh'
      3. Yeni hesap aç -> currentUser=yeni, profil katmanı hâlâ ÜSTTE
         ve batuhanwh'ı çiziyor

    ⚠️ BU BİR SINIF, TEK BİR HATA DEĞİL. Aynı şey açık her katman için
    geçerli: arkadaş listesi, varlık detayı, emir ekranı. Hepsi önceki
    oturuma ait bir şeye tutunuyordu. O yüzden dördü birden burada
    kapanıyor — tek tek bulunup yamanmıyor.

    ⚠️ BAĞIMLILIK `currentUser?.id`, `currentUser` DEĞİL. Nesne kimliği
    başka sebeplerle de değişebilir; o zaman kullanıcı bir varlık
    detayına bakarken katman aniden kapanırdı. Kimlik değiştiğinde
    kapanmalı, nesne değiştiğinde değil.

    ⚠️ İlk açılışta da çalışıyor ve zararsız: hepsi zaten kapalı.
  */
  useEffect(() => {
    setViewingProfile(null);
    setFriendsOpen(false);
    setDetailAsset(null);
    setTradeAsset(null);
  }, [currentUser?.id]);

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
  async function finishOnboarding(result: OnboardingResult) {
    const user = onboardingFor;

    /*
      ⚠️ SEVİYE SUNUCUYA GİTMİYOR, CİHAZDA KALIYOR.

      Sunucuda saklamak `users` tablosuna yeni bir kolon demek — yani
      migration, yani Zeynep'in şeridi ve bir bekleme. Oysa seviyenin
      TEK İŞİ arayüzü şekillendirmek: hangi ipucu gösterilecek, boş
      durum metni ne kadar uzun olacak. Bunların hiçbiri sunucuyu
      ilgilendirmiyor.

      ⚠️ Bedeli var ve biliniyor: kullanıcı telefon değiştirirse cevap
      kaybolur ve varsayılana düşer. Kabul edilebilir — çünkü yanlış
      varsayılan kimseyi engellemiyor, yalnızca deneyimi ortalamaya
      çekiyor.
    */
    try {
      await setPreference('onboardingLevel', result.level);
      /*
        ⚠️ PAYLAŞIM GÖRÜNÜRLÜĞÜ DE CİHAZDA — ama sebebi seviyeninkinden
        FARKLI.

        Seviye sunucuyu hiç ilgilendirmiyor. Bu ise bir VARSAYILAN:
        gerçek görünürlük her gönderinin kendi `visibility` alanında
        (`posts.visibility`) ve o sunucuda. Burada sakladığımız şey
        yalnızca paylaşım kutusunun açılış değeri.

        ⚠️ Bu ayrımı kaybetme: kullanıcı "arkadaşlarım" dedi diye
        paylaşımları gizlenmiyor — bir sonraki paylaşımında kutu
        "arkadaşlarım" seçili açılıyor. Gizliliği sağlayan yer
        sunucu, burası sadece kolaylık.
      */
      await setPreference('defaultPostVisibility', result.postVisibility);
    } catch {
      // Tercih yazılamazsa akış durmamalı; varsayılanlar kullanılır.
    }

    try {
      /*
        ⚠️ ARTIK TEK AYAR GİDİYOR — `isPublic` onboarding'den kalktı.

        Eskiden ikisi birlikte gönderiliyordu ("biri geçip öteki
        düşmesin" diye). Profil görünürlüğü sorusu kaldırılınca
        (gerekçe: OnboardingScreen'deki `OnboardingResult` notu)
        geriye yalnızca dağılım görünürlüğü kaldı.

        ⚠️ `isPublic` GÖNDERİLMEMESİ BİLİNÇLİ, EKSİK DEĞİL. Kolonun
        varsayılanı `true`; uç nokta da alanı opsiyonel alıyor
        (profile/router.ts: ikisinden biri yeterli). Yani hesap
        "profili açık" olarak başlıyor ve kullanıcı dilerse
        ProfileScreen'den kapatıyor.
      */
      await apiFetch('/users/me/visibility', {
        method: 'PATCH',
        body: JSON.stringify({
          allocationVisibility: result.allocationVisibility,
        }),
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

  return (
    <SafeAreaView style={styles.container}>
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
          onFinishOnboarding={(result) => void finishOnboarding(result)}
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
          {/*
            ÜST ÇUBUK — SOL ÜSTTE AVATAR.

            ⚠️ PROFİL ARTIK SEKME DEĞİL. Alt çubuktaki beş kutudan biri
            profile ayrılmıştı; profil ise günde bir kez açılan bir yer.
            En kolay ulaşılan alanı en seyrek kullanılan sayfaya vermek
            pahalı bir tercihti. Avatar hem daha az yer kaplıyor hem de
            "burası SEN'sin" bilgisini simgeden daha iyi taşıyor.

            ⚠️ ARKADAŞLIK İSTEĞİ ROZETİ DE BURAYA TAŞINDI. Sekme silinince
            rozet kimsenin görmediği bir yerde kalırdı — `badges` artık
            TabBar'a geçmiyor.

            ⚠️ İNCE VE BOŞ. İçine başlık koymadık: her ekranın kendi
            başlığı zaten var, ikincisini eklemek iki katlı bir başlık
            yaratırdı.
          */}
          <TouchableOpacity
            style={styles.topBar}
            onPress={() => {
              if (currentUser?.username) setViewingProfile(currentUser.username);
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Profilini aç"
          >
            {/*
              ⚠️ DOKUNMA HEDEFİ TÜM SATIR, YALNIZCA AVATAR DEĞİL.
              34 piksellik bir daire, 44 piksellik alt sınırın altında.
              Satırın tamamı basılabilir olunca hedef genişliyor ve
              "bastım ama açılmadı" durumu ortadan kalkıyor.
            */}
            <View>
              <UserAvatar
                seed={myAvatar?.seed}
                avatarStyle={myAvatar?.style}
                fallback={currentUser?.username ?? currentUser?.displayName}
                size={38}
              />
              {pendingRequests > 0 && (
                <View style={styles.avatarBadge}>
                  <Text style={styles.avatarBadgeText}>
                    {pendingRequests > 9 ? '9+' : pendingRequests}
                  </Text>
                </View>
              )}
            </View>

            {/*
              ⚠️ `flex: 1` + `minWidth: 0` BİRLİKTE. Uzun bir ad
              ("Abdurrahman") yalnızca `flex: 1` ile kutuyu içeriğinden
              dar olamayacak hâle getirir ve satır sağa taşar.
            */}
            <View style={styles.topBarText}>
              <Text style={styles.greeting} numberOfLines={1}>
                {selamlama(new Date().getHours())},{' '}
                {ilkAd(currentUser?.displayName, currentUser?.username)}
              </Text>

              {/*
                ⚠️ SAYI GELMEDEN SATIR ÇİZİLMİYOR — "0,00 ₺" YAZMIYORUZ.
                Yüklenirken sıfır göstermek, gerçekten sıfır bakiyeden
                ayırt edilemez; kullanıcı bir an parasının gittiğini
                sanar. Satır yoksa merak eder, yanlış bilgi almaz.
              */}
              {myTotal !== null && (
                <Text style={styles.greetingSub} numberOfLines={1}>
                  Portföyün {formatCentsString(myTotal)}
                </Text>
              )}
            </View>
          </TouchableOpacity>

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
          ) : activeTab === 'coach' ? (
            /*
              KOÇ — davranış göstergeleri + yapay zekâ yorumu + sohbet.

              ⚠️ Başka ekranların aksine parametre almıyor: kimlik
              token'dan geliyor (`GET /me/behavior`). Kullanıcı adını
              geçirseydik başkasının alışkanlığını istemek İSTEMCİDE
              mümkün görünürdü — sunucu reddederdi ama arayüz yanlış bir
              şey vaat etmiş olurdu.
            */
            <CoachScreen />
          ) : activeTab === 'league' ? (
            /*
              LİG — kendi sekmesine geri döndü.

              ⚠️ `onOpenFriends` App'ten geçiyor, Lig ekranından değil.
              Arkadaş listesi bir KATMAN ve katmanı açan durum burada
              (`friendsOpen`). Lig kendi içinden açsaydı ikinci bir
              arkadaş katmanı doğar, ikisi ayrı durum tutardı.
            */
            <LeaderboardScreen
              onOpenFriends={() => { setFriendsMode('league'); setFriendsOpen(true); }}
              onSelectUser={(username) => setViewingProfile(username)}
            />
          ) : (
            /*
              ⚠️ `onOpenFriends` BURADAN GEÇİYOR — Lig ekranı Keşfet'in
              içine taşındı ama arkadaş listesini AÇAN katman hâlâ burada
              (`setFriendsOpen`). Keşfet kendi içinden açmaya kalksaydı
              ikinci bir arkadaş katmanı doğardı ve ikisi ayrı durum
              tutardı.
            */
            <DiscoveryScreen
              onSelectUser={(username) => setViewingProfile(username)}
              currentUser={currentUser}
              /*
                ⚠️ `friendsMode` BURADA 'league' — Zeynep'in eklediği ayrım
                korunuyor. Arkadaş katmanı iki yerden açılıyor ve iki yerde
                farklı davranıyor: profilden açılınca salt okunur, ligden
                açılınca sıralamaya yönelik. Lig ekranı artık Keşfet'in
                içinde ama katmanı açan yer değişmedi, dolayısıyla kip de
                'league' kalmalı.
              */
              onOpenFriends={() => { setFriendsMode('league'); setFriendsOpen(true); }}
              /*
                ⚠️ AKIŞTAKİ LİG KARTI BURAYA BAĞLANIYOR.

                Kart Keşfet'in içinde ama gideceği yer bir ÜST SEKME.
                Keşfet kendi kendine sekme değiştiremez — sekme durumu
                App'te. O yüzden geri çağrı olarak geçiyor.
              */
              onOpenLeague={() => setActiveTab('league')}
            />
          )}

          {/*
            LIG SONUCU KUTLAMASI.

            ⚠️ SEKMEDEN BAĞIMSIZ, EN ÜSTTE. Tek bir ekranın içine
            koysaydık kutlama yalnızca o sekme açıkken çıkardı — oysa
            kullanıcı uygulamayı hangi sekmede bıraktıysa orada açıyor.

            ⚠️ Kendi içinde `null` dönerek kayboluyor; burada koşul yok.
            Koşulu burada tutsaydık "gösterilecek sonuç var mı" bilgisi iki
            yerde yaşardı ve ikisi ayrı düşerdi.
          */}
          <LeagueResultModal />

          {/*
            ALT SEKME ÇUBUĞU — tasarımın yeri burası.

            Üstteydi; tasarım alta taşıyor. Sebebi ergonomi: telefon tek
            elle tutulurken başparmak ekranın üst kenarına ulaşamıyor.
            Sekmeler en sık dokunulan hedef ve en zor yerdeydi.
          */}
          <TabBar
            active={activeTab}
            onChange={setActiveTab}
          />

          {/*
            AL/SAT KATMANI — sekmelerin ÜSTÜNDE.

            Sekme çubuğunu da kapatıyor: emir verirken kullanıcı yanlışlıkla
            başka sekmeye geçip yarım kalmış bir formu kaybetmesin.
          */}
          {/*
            ⚠️ İKİ KATMANIN SIRASI SABİT DEĞİL — VE OLAMAZ.

            JSX'te sonra yazılan üstte durur. Ama burada hangisinin
            üstte olması gerektiği DEĞİŞİYOR:

              Lig -> Arkadaşlar -> bir kişiye dokun -> PROFİL üstte
              Profil -> "Arkadaşlarım"             -> ARKADAŞLAR üstte

            Sabit sıra ikisinden birini bozar. Nitekim bozdu: profil
            sonra yazılıydı, "Arkadaşlarım"a basınca liste AÇILIYOR
            ama profilin altında kalıyordu — ekranda hiçbir şey
            olmuyormuş gibi görünüyordu.

            ⚠️ YENİ DURUM DEĞİŞKENİ EKLEMEDİK. `friendsMode` zaten
            nereden açıldığını söylüyor: 'profile' ise arkadaşlar
            üstte, 'league' ise profil üstte. İkinci bir bayrak
            tutsaydık ikisi ayrışabilirdi.
          */}
          {(() => {
            const arkadasKatmani = friendsOpen ? (
              <SlideView key="friends" direction="bottom">
                <FriendsScreen
                  mode={friendsMode}
                  onClose={() => setFriendsOpen(false)}
                  onSelectUser={(username) => setViewingProfile(username)}
                />
              </SlideView>
            ) : null;

            const profilKatmani = viewingProfile !== null ? (
              <SlideView key="profile" direction="right">
                <ProfileScreen
                  username={viewingProfile}
                  currentUserId={currentUser?.id}
                  onClose={() => setViewingProfile(null)}
                  /*
                    ⚠️ KENDİ PROFİLİN İLE BAŞKASININKİ AYNI KATMAN,
                    FARKLI YETKİ. Çıkış ve arkadaş yönetimi yalnızca
                    kendi profilinde anlamlı.

                    ⚠️ Koşullu YAYILIYOR (`...`): `onLogout={undefined}`
                    yazmak ile alanı hiç göndermemek farklı şeyler.
                  */
                  {...(viewingProfile === currentUser?.username
                    ? {
                        onOpenFriends: () => { setFriendsMode('profile'); setFriendsOpen(true); },
                        onLogout: () => void handleLogout(),
                      }
                    : {})}
                />
              </SlideView>
            ) : null;

            return friendsMode === 'profile'
              ? [profilKatmani, arkadasKatmani]
              : [arkadasKatmani, profilKatmani];
          })()}

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
                onGoToWallet={() => {
                  setTradeAsset(null);
                  setDetailAsset(null);
                  setActiveTab('wallet');
                }}
              />
            </SlideView>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  /*
    Üst çubuk. Yükseklik yok — içerik (34 piksel avatar + dolgu)
    belirliyor. Sabit yükseklik verseydik yazı tipi ölçeği büyütülmüş
    bir cihazda avatar taşardı.
  */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingTop: 8,
    // ⚠️ 12 -> 6. Altındaki ekranın kendi üst dolgusu var; ikisi
    // toplanınca avatar ile içerik arası boşluk fazla oluyordu.
    paddingBottom: 6,
  },
  topBarText: { flex: 1, minWidth: 0 },
  greeting: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 15,
    color: colors.ink,
  },
  greetingSub: {
    /*
      ⚠️ RAKAM İÇEREN SATIR DAR YAZI TİPİNDE (DM Mono). Rakamların
      genişliği eşit olduğu için sayı 45 saniyede bir değiştiğinde
      satır oynamıyor. Orantılı bir yazı tipinde "1" ile "8"
      farklı genişlikte ve başlık her tazelemede titrerdi.
    */
    fontFamily: 'DMMono_400Regular',
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: 1,
  },
  avatarBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: colors.loss,
    alignItems: 'center',
    justifyContent: 'center',
    // Rozet avatarın üstüne biniyor; ince kenarlık ikisini ayırıyor.
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  avatarBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.ink,
  },

  container: {
    flex: 1,
    /*
      ⚠️ BURASI LACİVERTTİ (#0B132B) — VE ESKİ YORUM "DÜZELTTİK" DİYORDU
      AMA DÜZELTME BAŞKA BİR STİLE (`mainContainer`) YAZILMIŞTI.

      `mainContainer` yalnızca giriş yapılmışken çizilen bir ÇOCUK View;
      kök `SafeAreaView`'ın kendi güvenli-alan dolgusu (iOS'ta çentik ve
      alt çubuk şeridi) hâlâ bu stile bakıyordu. Yani lacivert şerit hâlâ
      oradaydı, sadece ekranın geri kalanı üstünü örttüğü için
      görünmüyordu — üst çubuk eklenince açığa çıkan boşluk buydu.

      ⚠️ Kaba bir yama da vardı: `onAuthFlow && { backgroundColor: colors.surface }`
      yalnızca kimlik ekranlarında (`currentUser` yokken) doğru rengi
      veriyordu. Bugün her ekran zaten `colors.surface` kullanıyor —
      WelcomeScreen, LoginScreen, RegisterScreen, ForgotPasswordScreen,
      OnboardingScreen, `mainContainer` — hepsi. Yama bir FARKI telafi
      ediyordu ve o fark artık yok; kökün kendisi doğru rengi taşıyınca
      yamaya gerek kalmadı.

      ⚠️ Bu, `...shadows.accentGlow`'un ezilmesiyle aynı sınıf hata:
      YORUM NİYETİ ANLATIYOR, KOD BAŞKA ŞEY YAPIYOR. İkisini birlikte
      okumadan "düzeltilmiş" sanmak kolay.
    */
    backgroundColor: colors.surface,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  mainContainer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
