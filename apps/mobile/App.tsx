import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthScreen } from './src/screens/AuthScreen';
import { FriendsScreen } from './src/screens/FriendsScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { MarketScreen } from './src/screens/MarketScreen';
import { WhatIfScreen } from './src/screens/WhatIfScreen';
import { clearSession, restoreSession } from './src/api/client';
import { PortfolioScreen } from './src/screens/PortfolioScreen';

type User = {
  id: string;
  email: string;
  displayName: string;
};

type Tab = 'market' | 'wallet' | 'leaderboard' | 'friends' | 'whatif';

export default function App() {
  // Giriş yapmış kullanıcı bilgisi (null ise giriş ekranı görünür)
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Aktif Sekme (Cüzdanım, Haftalık Lig, Arkadaşlar, Ya Alsaydın)
  const [activeTab, setActiveTab] = useState<Tab>('leaderboard');

  // Saklanan oturum kontrol edilirken açılış ekranı gösterilir. Bu bayrak
  // olmasaydı uygulama bir an giriş ekranını gösterip sonra ana ekrana
  // atlardı — kullanıcı "çıkış yapmışım" sanır.
  const [restoring, setRestoring] = useState(true);

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
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {restoring ? (
        // 0. SAKLANAN OTURUM KONTROL EDİLİYOR
        <View style={styles.splash}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : !currentUser ? (
        // 1. GİRİŞ YAPILMAMIŞSA: Giriş/Kayıt Ekranı Gösterilir
        <AuthScreen onLoginSuccess={(user) => setCurrentUser(user)} />
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
            <MarketScreen />
          ) : activeTab === 'wallet' ? (
            // Sabit "100.000,00 ₺" yerine GET /portfolio'dan gelen gerçek
            // veri: nakit, pozisyonlar, toplam değer, kâr/zarar.
            <PortfolioScreen onLogout={() => void handleLogout()} />
          ) : activeTab === 'leaderboard' ? (
            <LeaderboardScreen />
          ) : activeTab === 'friends' ? (
            <FriendsScreen />
          ) : (
            <WhatIfScreen />
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
