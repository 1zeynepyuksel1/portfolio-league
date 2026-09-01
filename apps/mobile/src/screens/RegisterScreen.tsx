/**
 * RegisterScreen — Login ile aynı tasarım dilinde kayıt ekranı.
 *
 * ⚠️ BU EKRAN HANDOFF'TA YOKTU.
 * Tasarım paketi Welcome + Login içeriyor; "Hesabınız yok mu? Hesap aç"
 * bağlantısı var ama gideceği ekran çizilmemiş. Kayıt olmadan uygulama
 * kullanılamaz (100.000 TL sanal bakiye kayıtta açılıyor), o yüzden
 * Login'in belirteçleriyle — aynı alan, aynı düğme, aynı boşluklar —
 * kuruldu. Yeni bir görsel karar alınmadı; hepsi theme.ts'ten geliyor.
 */

import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { checkEmail } from '../lib/validation';
import { ApiError, apiFetch, saveSession } from '../api/client';
import { ChartBackground } from '../components/ChartBackground';
import {
  ErrorRow,
  Field,
  HomeIndicator,
  PrimaryButton,
} from '../components/AuthControls';
import { colors, fonts, spacing } from '../theme';

type AuthUser = { id: string; email: string; displayName: string };

type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

type Props = {
  onRegisterSuccess: (user: AuthUser) => void;
  /** "Giriş yap" bağlantısı — Login ekranına döner. */
  onGoToLogin: () => void;
};



/**
 * ⚠️ SUNUCUNUN KURALIYLA AYNI OLMALI.
 * Backend `register.schema.ts`'te isim en az 2, şifre en az 8 karakter
 * istiyor. Burada daha gevşek davransaydık kullanıcı formu doldurur,
 * gönderir ve sunucudan gelen İngilizce Zod hatasını görürdü. İstemci
 * doğrulaması sunucununkini değiştirmez — onu ÖNCEDEN, kendi dilinde
 * söyler.
 */
const MIN_PASSWORD_LENGTH = 8;
const MIN_NAME_LENGTH = 2;

export function RegisterScreen({ onRegisterSuccess, onGoToLogin }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function edit(setter: (v: string) => void) {
    return (value: string) => {
      setter(value);
      if (error !== '') setError('');
    };
  }

  async function handleSubmit() {
    const first = firstName.trim();
    const last = lastName.trim();
    const user = username.trim();
    const mail = email.trim();

    if (first.length < MIN_NAME_LENGTH) {
      setError(`İsim en az ${MIN_NAME_LENGTH} karakter olmalı.`);
      return;
    }

    if (last.length < MIN_NAME_LENGTH) {
      setError(`Soyisim en az ${MIN_NAME_LENGTH} karakter olmalı.`);
      return;
    }

    if (user.length < 3) {
      setError('Kullanıcı adı en az 3 karakter olmalı.');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(user)) {
      setError('Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir.');
      return;
    }

    // Kural `lib/validation.ts`'te tek yerde — üç kimlik ekranı da onu
    // kullanıyor. Eskiden her ekranın kendi deseni vardı ve biri
    // düzeltilince ötekiler eski kalıyordu.
    const mailError = checkEmail(mail);
    if (mailError !== null) {
      setError(mailError);
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`);
      return;
    }

    if (password !== confirmPassword) {
      setError('Şifreler birbiriyle eşleşmiyor.');
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: mail,
          password,
          confirmPassword,
          firstName: first,
          lastName: last,
          username: user,
        }),
      });

      await saveSession(res.accessToken, res.refreshToken);
      onRegisterSuccess(res.user);
    } catch (err) {
      /**
       * ⚠️ ÖNCE ALAN HATASI, SONRA GENEL MESAJ.
       *
       * Sunucu Zod hatasında `fieldErrors` gönderiyor: hangi alan, neden.
       * Ekran bunu atıp yalnızca "Gönderilen kayıt bilgileri geçersiz."
       * gösteriyordu — kullanıcı altı kutudan hangisini düzelteceğini
       * bilemiyordu.
       *
       * Yukarıdaki istemci kontrolleri çoğu durumu zaten yakalıyor; burası
       * ikisinin ayrıştığı durumlar için ağ. İki doğrulamanın zamanla
       * ayrılması kaçınılmaz, o yüzden sunucunun sözü de görünür olmalı.
       */
      const fields =
        err instanceof ApiError && err.fieldErrors !== undefined
          ? Object.values(err.fieldErrors).flat().filter(Boolean)
          : [];

      setError(
        fields.length > 0
          ? fields.join(' ')
          : err instanceof Error
            ? err.message
            : 'Kayıt oluşturulamadı.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <ChartBackground />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <Text style={styles.brandName}>PORTFOLIOYUN</Text>
          </View>

          <View style={styles.hero}>
            <Text style={styles.title}>Hesabınızı{'\n'}oluşturun.</Text>
            <Text style={styles.subtitle}>
              100.000 TL sanal bakiyeniz hazır.
            </Text>
          </View>

          <View style={styles.form}>
            <Field
              placeholder="İsim"
              value={firstName}
              onChangeText={edit(setFirstName)}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="givenName"
              editable={!loading}
            />

            <Field
              placeholder="Soyisim"
              value={lastName}
              onChangeText={edit(setLastName)}
              autoCapitalize="words"
              autoComplete="name-family"
              textContentType="familyName"
              editable={!loading}
            />

            <Field
              placeholder="Kullanıcı adı"
              value={username}
              onChangeText={edit(setUsername)}
              autoCapitalize="none"
              autoComplete="username"
              textContentType="username"
              editable={!loading}
            />

            <Field
              placeholder="E-posta adresi"
              value={email}
              onChangeText={edit(setEmail)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              editable={!loading}
            />

            <Field
              placeholder="Şifre (en az 8 karakter)"
              value={password}
              onChangeText={edit(setPassword)}
              isPassword
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!loading}
            />

            <Field
              placeholder="Şifre tekrarı"
              value={confirmPassword}
              onChangeText={edit(setConfirmPassword)}
              isPassword
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!loading}
            />

            {error !== '' && <ErrorRow message={error} />}

            <View style={styles.ctaWrap}>
              <PrimaryButton
                label={loading ? 'Oluşturuluyor…' : 'Hesap aç'}
                onPress={() => void handleSubmit()}
                loading={loading}
              />
            </View>

            <Text style={styles.legal}>
              Devam ederek Kullanım Koşulları ve Gizlilik Politikası'nı kabul
              edersiniz.
            </Text>
          </View>

          <View style={styles.footer}>
            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Zaten hesabınız var mı?</Text>
              <Pressable onPress={onGoToLogin} accessibilityRole="button">
                {({ pressed }) => (
                  <Text
                    style={[
                      styles.loginLink,
                      pressed && { color: colors.accent },
                    ]}
                  >
                    Giriş yap
                  </Text>
                )}
              </Pressable>
            </View>

            <View style={styles.indicatorWrap}>
              <HomeIndicator />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.bottom,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingTop: 44,
  },
  brandDot: {
    width: 9,
    height: 9,
    borderRadius: 6.5,
    backgroundColor: colors.accent,
  },
  brandName: {
    fontSize: 12,
    fontFamily: fonts.bold,
    letterSpacing: 0.26 * 12,
    color: colors.ink,
  },

  hero: { paddingTop: 40 },
  title: {
    fontSize: 44,
    lineHeight: 42,
    fontFamily: fonts.bold,
    letterSpacing: -0.035 * 42,
    color: colors.ink,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.inkDim,
    marginTop: 20,
  },

  form: { marginTop: 28, gap: 12 },
  ctaWrap: { marginTop: 8 },
  legal: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.inkGhost,
    textAlign: 'center',
    marginTop: 12,
  },

  footer: { marginTop: 'auto', paddingTop: 24 },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  loginText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.inkDim,
  },
  loginLink: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  indicatorWrap: { marginTop: 24 },
});
