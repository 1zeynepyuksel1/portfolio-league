import React, { useState } from 'react';
import {
  Platform,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthScreen } from './src/screens/AuthScreen';
import { FriendsScreen } from './src/screens/FriendsScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { WhatIfScreen } from './src/screens/WhatIfScreen';
import { setAccessToken } from './src/api/client';

type User = {
  id: string;
  email: string;
  displayName: string;
  isNewUser?: boolean;
};

type Tab = 'wallet' | 'leaderboard' | 'friends' | 'whatif';

export default function App() {
  // Giriş yapmış kullanıcı bilgisi
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Karşılama Ekranı Durumu
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Aktif Sekme (Cüzdan, Ligler, Arkadaşlar, Ya Alsaydın)
  const [activeTab, setActiveTab] = useState<Tab>('leaderboard');

  // Giriş/Kayıt Başarılı Olduğunda
  function handleAuthSuccess(user: User) {
    setCurrentUser(user);
    setShowOnboarding(true);
  }

  // Çıkış yap fonksiyonu
  function handleLogout() {
    setAccessToken(null);
    setCurrentUser(null);
    setShowOnboarding(false);
  }

  // Android Çentik ve Status Bar Boşluğu
  const paddingTop = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 36) + 6 : 0;

  return (
    <SafeAreaView style={[styles.container, { paddingTop }]}>
      <StatusBar style="light" />

      {!currentUser ? (
        // 1. GİRİŞ YAPILMAMIŞSA: Glassmorphic Giriş/Kayıt Ekranı
        <AuthScreen onLoginSuccess={handleAuthSuccess} />
      ) : showOnboarding ? (
        // 2. YENİ KAYIT OLUNDUYSA: Glassmorphic Karşılama Ekranı
        <OnboardingScreen
          userName={currentUser.displayName}
          onFinishOnboarding={() => setShowOnboarding(false)}
        />
      ) : (
        // 3. GİRİŞ YAPILDIYSA: Ana Uygulama (Glassmorphic Alt Navigasyonlu)
        <View style={styles.mainContainer}>
          {/* EKRAN İÇERİĞİ */}
          <View style={styles.screenContent}>
            {activeTab === 'wallet' ? (
              <View style={styles.walletContainer}>
                <View style={styles.glassCard}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>
                      {currentUser.displayName.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.welcomeTitle}>Hoş Geldiniz, {currentUser.displayName}</Text>
                  <Text style={styles.welcomeSubtitle}>{currentUser.email}</Text>

                  <View style={styles.balanceContainer}>
                    <Text style={styles.cardTitle}>💼 SANAL SERMAYE BAKİYESİ</Text>
                    <Text style={styles.cardAmount}>100.000,00 ₺</Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>● JWT Oturumu Aktif</Text>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.logoutPillButton} onPress={handleLogout}>
                    <Text style={styles.logoutPillButtonText}>Güvenli Çıkış Yap</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : activeTab === 'leaderboard' ? (
              <LeaderboardScreen />
            ) : activeTab === 'friends' ? (
              <FriendsScreen />
            ) : (
              <WhatIfScreen />
            )}
          </View>

          {/* BUZLU CAM ALT NAVİGASYON ÇUBUĞU (GLASSMORPHIC BOTTOM BAR) */}
          <View style={styles.glassBottomTabBar}>
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
    backgroundColor: '#081226',
  },
  mainContainer: {
    flex: 1,
  },
  screenContent: {
    flex: 1,
  },
  glassBottomTabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderTopWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 8,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
  },
  bottomTabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTabIcon: {
    fontSize: 20,
    marginBottom: 4,
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
    color: '#10B981',
    fontWeight: 'bold',
  },
  walletContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glassCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1.5,
    borderRadius: 28,
    padding: 26,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
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
    marginBottom: 20,
  },
  balanceContainer: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  cardAmount: {
    color: '#10B981',
    fontSize: 34,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  statusBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 4,
  },
  statusBadgeText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '600',
  },
  logoutPillButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    borderRadius: 26,
    paddingVertical: 13,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  logoutPillButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
