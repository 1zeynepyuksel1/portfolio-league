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
import { apiFetch } from '../api/client';
import { ChartBackground } from '../components/ChartBackground';
import {
  ErrorRow,
  Field,
  HomeIndicator,
  PrimaryButton,
} from '../components/AuthControls';
import { colors, fonts, spacing } from '../theme';

type Props = {
  onSuccess: () => void;
  onGoToLogin: () => void;
};

const MIN_PASSWORD_LENGTH = 8;

export function ForgotPasswordScreen({ onSuccess, onGoToLogin }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  function edit(setter: (v: string) => void) {
    return (value: string) => {
      setter(value);
      if (error !== '') setError('');
    };
  }

  async function handleSubmit() {
    const mail = email.trim();

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
      await apiFetch<{ success: boolean; message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: mail, password, confirmPassword }),
      });

      setSuccessMsg('Şifreniz başarıyla sıfırlandı. Giriş sayfasına yönlendiriliyorsunuz...');
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Şifre sıfırlanamadı.');
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
            <Text style={styles.title}>Şifrenizi{'\n'}sıfırlayın.</Text>
            <Text style={styles.subtitle}>
              Yeni şifrenizi belirleyin ve onaylayın.
            </Text>
          </View>

          <View style={styles.form}>
            <Field
              placeholder="E-posta adresi"
              value={email}
              onChangeText={edit(setEmail)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              editable={!loading && successMsg === ''}
            />

            <Field
              placeholder="Yeni şifre (en az 8 karakter)"
              value={password}
              onChangeText={edit(setPassword)}
              isPassword
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!loading && successMsg === ''}
            />

            <Field
              placeholder="Yeni şifre tekrarı"
              value={confirmPassword}
              onChangeText={edit(setConfirmPassword)}
              isPassword
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              editable={!loading && successMsg === ''}
            />

            {error !== '' && <ErrorRow message={error} />}
            {successMsg !== '' && (
              <Text style={styles.successText}>{successMsg}</Text>
            )}

            <View style={styles.ctaWrap}>
              <PrimaryButton
                label={loading ? 'Sıfırlanıyor…' : 'Şifreyi sıfırla'}
                onPress={() => void handleSubmit()}
                loading={loading || successMsg !== ''}
              />
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Şifrenizi hatırladınız mı?</Text>
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
    borderRadius: 4.5,
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
    fontSize: 42,
    lineHeight: 42,
    fontFamily: fonts.bold,
    letterSpacing: -0.035 * 42,
    color: colors.ink,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.inkDim,
    marginTop: 18,
  },

  form: { marginTop: 28, gap: 12 },
  ctaWrap: { marginTop: 6 },
  successText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.gain,
    textAlign: 'center',
    marginTop: 10,
  },

  footer: { marginTop: 'auto', paddingTop: 24 },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  loginText: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.inkDim,
  },
  loginLink: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  indicatorWrap: { marginTop: 22 },
});
