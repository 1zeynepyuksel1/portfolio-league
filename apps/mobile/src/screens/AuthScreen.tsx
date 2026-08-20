import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiFetch, setAccessToken } from '../api/client';

type AuthResponse = {
  user: {
    id: string;
    email: string;
    displayName: string;
    username?: string;
  };
  accessToken: string;
};

type Props = {
  onLoginSuccess: (user: AuthResponse['user']) => void;
};

export function AuthScreen({ onLoginSuccess }: Props) {
  // Giriş Yap mı, Kayıt Ol mu? (Varsayılan: Giriş Yap)
  const [isLogin, setIsLogin] = useState(true);

  // Form Alanları
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');

  // Şifre Göster/Gizle Şalterleri (Show / Hide Password)
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Yükleniyor ve Hata Durumları
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Gönderme Fonksiyonu
  async function handleSubmit() {
    setErrorMessage(null);

    // İSTEMCİ TARAFI PRE-VALIDATION (İSTEMCİ DOĞRULAMASI)
    if (!isLogin) {
      if (password.length < 8) {
        setErrorMessage('Şifre en az 8 karakter olmalıdır.');
        return;
      }
      if (password.length > 64) {
        setErrorMessage('Şifre en fazla 64 karakter olabilir.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Şifreler birbiriyle eşleşmiyor. Lütfen kontrol edin.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        // 1. GİRİŞ YAP İSTEĞİ
        const res = await apiFetch<AuthResponse>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });

        setAccessToken(res.accessToken);
        onLoginSuccess(res.user);
      } else {
        // 2. KAYIT OL İSTEĞİ (100.000 TL Kasa otomatik açılır)
        const res = await apiFetch<AuthResponse>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email,
            password,
            confirmPassword,
            displayName,
            username: username.trim() ? username.trim() : undefined,
          }),
        });

        setAccessToken(res.accessToken);
        onLoginSuccess(res.user);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'İşlem başarısız.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Üst Logo ve Başlık */}
      <View style={styles.header}>
        <Text style={styles.title}>🏆 Portföy Ligi</Text>
        <Text style={styles.subtitle}>
          Haftalık Sanal Yatırım Ligi & Simülatör
        </Text>
      </View>

      {/* 100.000 TL Bonus Teşvik Kartı */}
      <View style={styles.bonusBadge}>
        <Text style={styles.bonusText}>
          🎁 Kaydol, 100.000 TL sanal bakiyeni kap!
        </Text>
      </View>

      {/* Sekmeler (Giriş Yap / Kayıt Ol) */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, isLogin && styles.tabButtonActive]}
          onPress={() => {
            setIsLogin(true);
            setErrorMessage(null);
          }}
        >
          <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>
            Giriş Yap
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, !isLogin && styles.tabButtonActive]}
          onPress={() => {
            setIsLogin(false);
            setErrorMessage(null);
          }}
        >
          <Text style={[styles.tabText, !isLogin && styles.tabTextActive]}>
            Kayıt Ol
          </Text>
        </TouchableOpacity>
      </View>

      {/* Hata Mesajı Kutusu */}
      {errorMessage && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
        </View>
      )}

      {/* Form Alanları */}
      <View style={styles.form}>
        {!isLogin && (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>İsim Soyisim *</Text>
              <TextInput
                style={styles.input}
                placeholder="Örn: Zeynep Yılmaz"
                placeholderTextColor="#64748B"
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Kullanıcı Adı</Text>
              <TextInput
                style={styles.input}
                placeholder="Örn: zeynep_2026"
                placeholderTextColor="#64748B"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>
          </>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>E-posta Adresi *</Text>
          <TextInput
            style={styles.input}
            placeholder="ornek@gmail.com"
            placeholderTextColor="#64748B"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Şifre Alanı (Göster/Gizle Butonlu) */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Şifre * {!isLogin && <Text style={styles.hint}>(8 - 64 karakter)</Text>}
          </Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.passwordInput}
              placeholder="••••••••"
              placeholderTextColor="#64748B"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Şifre Tekrarı Alanı (Sadece Kayıt Olurken) */}
        {!isLogin && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Şifre Tekrarı *</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                placeholderTextColor="#64748B"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Text style={styles.eyeIcon}>{showConfirmPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Ana İşlem Butonu */}
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {isLogin ? 'Giriş Yap' : 'Kayıt Ol ve Başla'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// Stil Tanımları (Koyu Lacivert & Zümrüt Yeşili Tema)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B132B',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 30,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  bonusBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  bonusText: {
    color: '#10B981',
    fontWeight: '600',
    fontSize: 13,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1C2541',
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
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
  tabText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 14,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
  },
  form: {
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '500',
  },
  hint: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: 'normal',
  },
  input: {
    backgroundColor: '#1C2541',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C2541',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 10,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  eyeIcon: {
    fontSize: 18,
  },
  primaryButton: {
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
