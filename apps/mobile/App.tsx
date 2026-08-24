import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  useFonts,
} from '@expo-google-fonts/archivo';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
  IBMPlexMono_700Bold,
} from '@expo-google-fonts/ibm-plex-mono';
import { FriendsScreen } from './src/screens/FriendsScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { MarketScreen } from './src/screens/MarketScreen';
import { TradeScreen } from './src/screens/TradeScreen';
import { AssetDetailScreen } from './src/screens/AssetDetailScreen';
import { WhatIfScreen } from './src/screens/WhatIfScreen';
import { clearSession, restoreSession } from './src/api/client';
import { PortfolioScreen } from './src/screens/PortfolioScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { colors } from './src/theme';
import { CurrencyProvider } from './src/lib/currency';
import { ErrorBoundary } from './src/components/ErrorBoundary';

type User = {
  id: string;
  email: string;
  displayName: string;
};

type Tab = 'market' | 'wallet' | 'leaderboard' | 'friends' | 'whatif';

/**
 * Giriş yapılmamışken hangi ekran görünüyor.
 *
 * Uygulama ilk açıldığında `welcome` — tasarımın kararı: kullanıcı
 * uygulamayı ilk indirdiğinde markayı görsün, sonra yol seçsin.
 * Oturum geri yüklenemezse de buraya düşülüyor.
 */
type AuthView = 'welcome' | 'login' | 'register';

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

function AppShell() {
  // Giriş yapmış kullanıcı bilgisi (null ise kimlik ekranları görünür)
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Kimlik akışında hangi ekrandayız
  const [authView, setAuthView] = useState<AuthView>('welcome');

  // Aktif Sekme (Cüzdanım, Haftalık Lig, Arkadaşlar, Ya Alsaydın)
  const [activeTab, setActiveTab] = useState<Tab>('leaderboard');

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

  // Saklanan oturum kontrol edilirken açılış ekranı gösterilir. Bu bayrak
  // olmasaydı uygulama bir an giriş ekranını gösterip sonra ana ekrana
  // atlardı — kullanıcı "çıkış yapmışım" sanır.
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
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
    IBMPlexMono_700Bold,
  });

  // Açılışta diskteki token'la oturumu geri yükle.
  // Gerekçe: token sadece bellekte tutulursa sayfa yenilenince kaybolur.
  // Faz 1 bitiş kriteri: "uygulamayı kapat aç -> duruyor".
  useEffect(() => {
    void restoreSession()
      .then((user) => setCurrentUser(user))
      .finally(() => setRestoring(false));
  }, []);

  // Çıkış yap fonksiyonu — token'ı diskten de siliyor
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
      ) : !currentUser ? (
        // 1. GİRİŞ YAPILMAMIŞSA: Welcome -> Login / Kayıt akışı
        //
        // Basit bir state makinesi; navigasyon kütüphanesi eklenmedi.
        // Üç ekran ve iki geçiş için react-navigation'ın kurulum maliyeti
        // kazandırdığından fazla. Ekran sayısı artarsa o zaman geçilir.
        authView === 'login' ? (
          <LoginScreen
            onLoginSuccess={(user) => setCurrentUser(user)}
            onGoToRegister={() => setAuthView('register')}
          />
        ) : authView === 'register' ? (
          <RegisterScreen
            onRegisterSuccess={(user) => setCurrentUser(user)}
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
          {/* Üst Navigasyon Sekme Çubuğu */}
          <View style={styles.topTabBar}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'market' && styles.tabButtonActive]}
              onPress={() => setActiveTab('market')}
            >
              <Text style={[styles.tabButtonText, activeTab === 'market' && styles.tabButtonTextActive]}>
                📈 Piyasa
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'wallet' && styles.tabButtonActive]}
              onPress={() => setActiveTab('wallet')}
            >
              <Text style={[styles.tabButtonText, activeTab === 'wallet' && styles.tabButtonTextActive]}>
                💰 Cüzdan
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'leaderboard' && styles.tabButtonActive]}
              onPress={() => setActiveTab('leaderboard')}
            >
              <Text style={[styles.tabButtonText, activeTab === 'leaderboard' && styles.tabButtonTextActive]}>
                🏆 Ligler
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'friends' && styles.tabButtonActive]}
              onPress={() => setActiveTab('friends')}
            >
              <Text style={[styles.tabButtonText, activeTab === 'friends' && styles.tabButtonTextActive]}>
                👥 Arkadaşlar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'whatif' && styles.tabButtonActive]}
              onPress={() => setActiveTab('whatif')}
            >
              <Text style={[styles.tabButtonText, activeTab === 'whatif' && styles.tabButtonTextActive]}>
                🔮 Ya Alsaydın?
              </Text>
            </TouchableOpacity>
          </View>

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
              onLogout={() => void handleLogout()}
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
          ) : activeTab === 'leaderboard' ? (
            <LeaderboardScreen />
          ) : activeTab === 'friends' ? (
            <FriendsScreen />
          ) : (
            <WhatIfScreen />
          )}

          {/*
            AL/SAT KATMANI — sekmelerin ÜSTÜNDE.

            Sekme çubuğunu da kapatıyor: emir verirken kullanıcı yanlışlıkla
            başka sekmeye geçip yarım kalmış bir formu kaybetmesin.
          */}
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

          {/* Emir katmanı EN ÜSTTE — detayın da üstünde. */}
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
