import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { FriendsScreen } from './src/screens/FriendsScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { MarketScreen } from './src/screens/MarketScreen';
import { TradeScreen } from './src/screens/TradeScreen';
import { AssetDetailScreen } from './src/screens/AssetDetailScreen';
import { WhatIfScreen } from './src/screens/WhatIfScreen';
import {
  clearSession,
  restoreSession,
  setSessionExpiredHandler,
} from './src/api/client';
import { PortfolioScreen } from './src/screens/PortfolioScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { colors } from './src/theme';
import { TabBar, type TabKey } from './src/components/TabBar';
import { CurrencyProvider } from './src/lib/currency';
import { ErrorBoundary } from './src/components/ErrorBoundary';

type User = {
  id: string;
  email: string;
  displayName: string;
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
 * K├Âk bile┼şen.
 *
 * ÔÜá´©Å SA─ŞLAYICI (Provider) EN DI┼ŞTA ÔÇö VE NEDEN─░ ├ûNEML─░.
 *
 * `CurrencyProvider` uygulaman─▒n tamam─▒n─▒ sar─▒yor, sadece Piyasa/C├╝zdan
 * sekmelerini de─şil. Yaln─▒zca o iki ekran─▒ sarsayd─▒k her sekme kendi
 * sa─şlay─▒c─▒s─▒n─▒ kurar, her birinin ayr─▒ bir tercihi olurdu: kullan─▒c─▒
 * Piyasa'da dolara ge├ğer, C├╝zdan'a bakar, orada TL g├Âr├╝rd├╝ ÔÇö ve ikisi de
 * "├ğal─▒┼ş─▒yor" gibi g├Âr├╝n├╝rd├╝.
 *
 * Alt bile┼şen olarak yaz─▒lmas─▒n─▒n sebebi: `useCurrency` yaln─▒zca
 * sa─şlay─▒c─▒n─▒n ─░├ç─░NDE ├ğa─şr─▒labilir. `App`'in kendisi sa─şlay─▒c─▒y─▒ kuruyorsa
 * kendi i├ğinde onu okuyamaz ÔÇö bu React'in en s─▒k d├╝┼ş├╝len kancas─▒.
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

function AppShell() {
  // Giri┼ş yapm─▒┼ş kullan─▒c─▒ bilgisi (null ise kimlik ekranlar─▒ g├Âr├╝n├╝r)
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Kimlik ak─▒┼ş─▒nda hangi ekranday─▒z
  const [authView, setAuthView] = useState<AuthView>('welcome');

  // Aktif Sekme (C├╝zdan─▒m, Haftal─▒k Lig, Arkada┼şlar, Ya Alsayd─▒n)
  const [activeTab, setActiveTab] = useState<Tab>('league');

  /**
   * Al/Sat ekran─▒ a├ğ─▒ksa hangi varl─▒k i├ğin.
   *
   * `null` = kapal─▒. Ayr─▒ bir sekme DE─Ş─░L, piyasa listesinin ├╝st├╝ne
   * a├ğ─▒lan bir katman: kullan─▒c─▒ hangi varl─▒─şa dokundu─şunu unutmas─▒n diye
   * geri d├Ân├╝nce ayn─▒ listeye d├╝┼ş├╝yor.
   */
  const [tradeAsset, setTradeAsset] = useState<{
    symbol: string;
    name: string;
  } | null>(null);

  /**
   * Varl─▒k detay─▒ (grafik) a├ğ─▒ksa hangi varl─▒k i├ğin.
   *
   * Ak─▒┼ş: liste -> detay -> emir. Detaydan Al/Sat'a ge├ğilince detay
   * KAPANMIYOR, ├╝st├╝ne emir katman─▒ a├ğ─▒l─▒yor; emirden geri d├Ân├╝nce
   * kullan─▒c─▒ grafi─şe d├╝┼ş├╝yor, listeye de─şil.
   */
  const [detailAsset, setDetailAsset] = useState<{
    symbol: string;
    name: string;
  } | null>(null);

  /**
   * Emir ge├ğince portf├Ây├╝n yeniden okunmas─▒n─▒ tetikler.
   *
   * Say─▒y─▒ art─▒rmak PortfolioScreen'in `key`'ini de─şi┼ştiriyor; React
   * bile┼şeni s─▒f─▒rdan kuruyor ve veriyi yeniden ├ğekiyor. Emirden sonra
   * c├╝zdana ge├ğildi─şinde eski bakiyeyi g├Ârmemek i├ğin.
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

  // Saklanan oturum kontrol edilirken a├ğ─▒l─▒┼ş ekran─▒ g├Âsterilir. Bu bayrak
  // olmasayd─▒ uygulama bir an giri┼ş ekran─▒n─▒ g├Âsterip sonra ana ekrana
  // atlard─▒ ÔÇö kullan─▒c─▒ "├ğ─▒k─▒┼ş yapm─▒┼ş─▒m" san─▒r.
  const [restoring, setRestoring] = useState(true);

  /**
   * Archivo yaz─▒ tipi ÔÇö tasar─▒m─▒n tamam─▒ bu font ├╝zerine kurulu.
   *
   * ÔÜá´©Å Y├£KLENMEDEN EKRAN ├ç─░Z─░LMEMEL─░. React Native'de olmayan bir
   * `fontFamily` hata FIRLATMIYOR, sessizce sistem fontuna d├╝┼ş├╝yor.
   * Yani beklemezsek ekran bir an tamamen farkl─▒ bir tipografiyle ├ğizilir,
   * sonra z─▒playarak d├╝zelir ÔÇö ve bir hata g├Ârmedi─şimiz i├ğin "tasar─▒m
   * neden tutmuyor" diye kodda arar─▒z.
   */
  /**
   * ÔÜá´©Å BURAYA EKLENMEYEN FONT SESS─░ZCE ├çALI┼ŞMAZ.
   *
   * `fontFamily: 'IBMPlexMono_500Medium'` yaz─▒p burada y├╝klemezsen React
   * Native hata FIRLATMAZ ÔÇö sistem fontuna d├╝┼şer. Yani "├ğal─▒┼ş─▒yor ama
   * tasar─▒ma benzemiyor" olur ve sebebi hi├ğbir yerde yazmaz.
   *
   * theme.ts'teki `fonts` nesnesindeki her ad burada kar┼ş─▒l─▒─ş─▒n─▒ bulmal─▒.
   */
  const [fontsLoaded] = useFonts({
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  // A├ğ─▒l─▒┼şta diskteki token'la oturumu geri y├╝kle.
  // Gerek├ğe: token sadece bellekte tutulursa sayfa yenilenince kaybolur.
  // Faz 1 biti┼ş kriteri: "uygulamay─▒ kapat a├ğ -> duruyor".
  useEffect(() => {
    void restoreSession()
      .then((user) => setCurrentUser(user))
      .finally(() => setRestoring(false));
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

  // ├ç─▒k─▒┼ş yap fonksiyonu ÔÇö token'─▒ diskten de siliyor
  async function handleLogout() {
    await clearSession();
    setCurrentUser(null);
    // ├ç─▒k─▒┼şta Welcome'a de─şil do─şrudan Login'e d├Ân├╝l├╝yor: kullan─▒c─▒
    // markay─▒ zaten tan─▒yor, tekrar tan─▒tmak yol uzatmak olur.
    setAuthView('login');
  }

  // ÔÜá´©Å Kimlik ekranlar─▒ farkl─▒ bir y├╝zey rengi kullan─▒yor (#111112),
  // ana uygulama h├ól├ó eski lacivert (#0B132B). SafeAreaView'un rengi
  // sabit kalsayd─▒, iOS'ta ├ğentik ve alt ├ğubuk hizas─▒nda yanl─▒┼ş renkte
  // bir ┼şerit g├Âr├╝n├╝rd├╝. Ana uygulama da tasar─▒m diline ge├ğince bu
  // ko┼şul kalkacak.
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
        // 0. OTURUM KONTROL ED─░L─░YOR / YAZI T─░P─░ Y├£KLEN─░YOR
        <View style={styles.splash}>
          <ActivityIndicator size="large" color={colors.ink} />
        </View>
      ) : !currentUser ? (
        // 1. G─░R─░┼Ş YAPILMAMI┼ŞSA: Welcome -> Login / Kay─▒t ak─▒┼ş─▒
        //
        // Basit bir state makinesi; navigasyon k├╝t├╝phanesi eklenmedi.
        // ├£├ğ ekran ve iki ge├ği┼ş i├ğin react-navigation'─▒n kurulum maliyeti
        // kazand─▒rd─▒─ş─▒ndan fazla. Ekran say─▒s─▒ artarsa o zaman ge├ğilir.
        authView === 'login' ? (
          <LoginScreen
            onLoginSuccess={(user) => setCurrentUser(user)}
            onGoToRegister={() => setAuthView('register')}
            onGoToForgotPassword={() => setAuthView('forgot-password')}
          />
        ) : authView === 'register' ? (
          <RegisterScreen
            onRegisterSuccess={(user) => setCurrentUser(user)}
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
        // 2. G─░R─░┼Ş YAPILDIYSA: Ana Uygulama G├Âsterilir
        <View style={styles.mainContainer}>
          {/* Aktif Ekran ─░├ğeri─şi */}
          {activeTab === 'market' ? (
            <MarketScreen
              onSelectAsset={(symbol, name) => setDetailAsset({ symbol, name })}
            />
          ) : activeTab === 'wallet' ? (
            // Sabit "100.000,00 Ôé║" yerine GET /portfolio'dan gelen ger├ğek
            // veri: nakit, pozisyonlar, toplam de─şer, k├ór/zarar.
            <PortfolioScreen
              key={portfolioVersion}
              onLogout={() => void handleLogout()}
              /**
               * C├╝zdandaki bir varl─▒─şa dokununca piyasadaki detay─▒na git.
               *
               * ÔÜá´©Å SEKME DE─Ş─░┼ŞT─░RM─░YORUZ, KATMAN A├çIYORUZ. `setActiveTab`
               * ├ğa─ş─▒rsayd─▒k kullan─▒c─▒ geri d├Ând├╝─ş├╝nde Piyasa sekmesinde
               * kal─▒rd─▒ ÔÇö oysa c├╝zdandan gelmi┼şti. Detay ekran─▒ ├╝stte bir
               * katman olarak a├ğ─▒l─▒yor, kapan─▒nca c├╝zdana d├╝┼ş├╝yor.
               */
              onSelectAsset={(symbol, name) => setDetailAsset({ symbol, name })}
            />
          ) : activeTab === 'league' ? (
            <LeaderboardScreen onOpenFriends={() => setFriendsOpen(true)} />
          ) : (
            <WhatIfScreen />
          )}

          {/*
            ALT SEKME ├çUBU─ŞU ÔÇö tasar─▒m─▒n yeri buras─▒.

            ├£stteydi; tasar─▒m alta ta┼ş─▒yor. Sebebi ergonomi: telefon tek
            elle tutulurken ba┼şparmak ekran─▒n ├╝st kenar─▒na ula┼şam─▒yor.
            Sekmeler en s─▒k dokunulan hedef ve en zor yerdeydi.
          */}
          <TabBar active={activeTab} onChange={setActiveTab} />

          {/*
            AL/SAT KATMANI ÔÇö sekmelerin ├£ST├£NDE.

            Sekme ├ğubu─şunu da kapat─▒yor: emir verirken kullan─▒c─▒ yanl─▒┼şl─▒kla
            ba┼şka sekmeye ge├ğip yar─▒m kalm─▒┼ş bir formu kaybetmesin.
          */}
          {friendsOpen && (
            <View style={StyleSheet.absoluteFill}>
              <FriendsScreen onClose={() => setFriendsOpen(false)} />
            </View>
          )}

          {detailAsset !== null && (
            <View style={StyleSheet.absoluteFill}>
              <AssetDetailScreen
                symbol={detailAsset.symbol}
                name={detailAsset.name}
                onClose={() => setDetailAsset(null)}
                onTrade={() => setTradeAsset(detailAsset)}
              />
            </View>
          )}

          {/* Emir katman─▒ EN ├£STTE ÔÇö detay─▒n da ├╝st├╝nde. */}
          {tradeAsset !== null && (
            <View style={StyleSheet.absoluteFill}>
              <TradeScreen
                symbol={tradeAsset.symbol}
                name={tradeAsset.name}
                onClose={() => setTradeAsset(null)}
                onOrderPlaced={() => setPortfolioVersion((v) => v + 1)}
              />
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B132B',
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
