import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  useFonts,
} from '@expo-google-fonts/archivo';
import { AuthScreen } from './src/screens/AuthScreen';
import { FriendsScreen } from './src/screens/FriendsScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { MarketScreen } from './src/screens/MarketScreen';
import { TradeScreen } from './src/screens/TradeScreen';
import { AssetDetailScreen } from './src/screens/AssetDetailScreen';
import { WhatIfScreen } from './src/screens/WhatIfScreen';
import { PortfolioScreen } from './src/screens/PortfolioScreen';
import { clearSession, restoreSession, setAccessToken } from './src/api/client';
import { CurrencyProvider } from './src/lib/currency';
import { ErrorBoundary } from './src/components/ErrorBoundary';

type User = {
  id: string;
  email: string;
  displayName: string;
  isNewUser?: boolean;
};

type Tab = 'market' | 'wallet' | 'leaderboard' | 'friends' | 'whatif';

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
  // Giriş yapmış kullanıcı bilgisi
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Karşılama Ekranı Durumu (Onboarding)
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Aktif Sekme (Piyasa, Cüzdan, Ligler, Arkadaşlar, Ya Alsaydın)
  const [activeTab, setActiveTab] = useState<Tab>('leaderboard');

  // Detay & Trade Katmanları
  const [tradeAsset, setTradeAsset] = useState<{ symbol: string; name: string } | null>(null);
  const [detailAsset, setDetailAsset] = useState<{ symbol: string; name: string } | null>(null);

  const [portfolioVersion, setPortfolioVersion] = useState(0);
  const [restoring, setRestoring] = useState(true);

  const [fontsLoaded] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
  });

  useEffect(() => {
    void restoreSession()
      .then((user) => {
        if (user) {
          setCurrentUser(user);
        }
      })
      .finally(() => setRestoring(false));
  }, []);

  function handleAuthSuccess(user: User) {
    setCurrentUser(user);
    setShowOnboarding(true);
  }

  async function handleLogout() {
    await clearSession();
    setAccessToken(null);
    setCurrentUser(null);
    setShowOnboarding(false);
  }

  const paddingTop = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 36) + 6 : 0;

  return (
    <SafeAreaView style={[styles.container, { paddingTop }]}>
      <StatusBar style="light" />

      {restoring || !fontsLoaded ? (
        <View style={styles.splash}>
          <ActivityIndicator size="large" color="#A3E635" />
        </View>
      ) : !currentUser ? (
        // 1. GİRİŞ YAPILMAMIŞSA: 2 Adımlı (Get Started -> Sign In/Up) AuthScreen
        <AuthScreen onLoginSuccess={handleAuthSuccess} />
      ) : showOnboarding ? (
        // 2. İLK KAYITTA: Karşılama Ekranı
        <OnboardingScreen
          userName={currentUser.displayName}
          onFinishOnboarding={() => setShowOnboarding(false)}
        />
      ) : (
        // 3. GİRİŞ YAPILDIYSA: Ana Uygulama Ekranları
        <View style={styles.mainContainer}>
          <View style={styles.screenContent}>
            {activeTab === 'market' ? (
              <MarketScreen onSelectAsset={(symbol, name) => setDetailAsset({ symbol, name })} />
            ) : activeTab === 'wallet' ? (
              <PortfolioScreen key={portfolioVersion} onLogout={() => void handleLogout()} />
            ) : activeTab === 'leaderboard' ? (
              <LeaderboardScreen />
            ) : activeTab === 'friends' ? (
              <FriendsScreen />
            ) : (
              <WhatIfScreen />
            )}
          </View>

          {/* AL/SAT & DETAY KATMANLARI */}
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

          {/* BUZLU CAM ALT NAVİGASYON ÇUBUĞU */}
          <View style={styles.glassBottomTabBar}>
            <TouchableOpacity
              style={styles.bottomTabButton}
              onPress={() => setActiveTab('market')}
              activeOpacity={0.75}
            >
              <Text style={[styles.bottomTabIcon, activeTab === 'market' && styles.bottomTabIconActive]}>
                📈
              </Text>
              <Text style={[styles.bottomTabText, activeTab === 'market' && styles.bottomTabTextActive]}>
                Piyasa
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.bottomTabButton}
              onPress={() => setActiveTab('wallet')}
              activeOpacity={0.75}
            >
              <Text style={[styles.bottomTabIcon, activeTab === 'wallet' && styles.bottomTabIconActive]}>
                💰
              </Text>
              <Text style={[styles.bottomTabText, activeTab === 'wallet' && styles.bottomTabTextActive]}>
                Cüzdan
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.bottomTabButton}
              onPress={() => setActiveTab('leaderboard')}
              activeOpacity={0.75}
            >
              <Text style={[styles.bottomTabIcon, activeTab === 'leaderboard' && styles.bottomTabIconActive]}>
                🏆
              </Text>
              <Text style={[styles.bottomTabText, activeTab === 'leaderboard' && styles.bottomTabTextActive]}>
                Ligler
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.bottomTabButton}
              onPress={() => setActiveTab('friends')}
              activeOpacity={0.75}
            >
              <Text style={[styles.bottomTabIcon, activeTab === 'friends' && styles.bottomTabIconActive]}>
                👥
              </Text>
              <Text style={[styles.bottomTabText, activeTab === 'friends' && styles.bottomTabTextActive]}>
                Arkadaşlar
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.bottomTabButton}
              onPress={() => setActiveTab('whatif')}
              activeOpacity={0.75}
            >
              <Text style={[styles.bottomTabIcon, activeTab === 'whatif' && styles.bottomTabIconActive]}>
                🔮
              </Text>
              <Text style={[styles.bottomTabText, activeTab === 'whatif' && styles.bottomTabTextActive]}>
                Ya Alsaydın?
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070C14',
  },
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#070C14',
  },
  mainContainer: {
    flex: 1,
  },
  screenContent: {
    flex: 1,
  },
  glassBottomTabBar: {
    flexDirection: 'row',
    backgroundColor: '#0D1424',
    borderColor: '#1E293B',
    borderTopWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 6,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  bottomTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTabIcon: {
    fontSize: 20,
    marginBottom: 2,
    opacity: 0.5,
  },
  bottomTabIconActive: {
    opacity: 1,
    transform: [{ scale: 1.15 }],
  },
  bottomTabText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  bottomTabTextActive: {
    color: '#A3E635',
    fontWeight: 'bold',
  },
});
