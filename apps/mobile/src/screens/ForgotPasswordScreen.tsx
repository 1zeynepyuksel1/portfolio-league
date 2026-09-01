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

/**
 * ⚠️ BU EKRAN İKİ ADIMLI OLMAK ZORUNDA — VE SEBEBİ KOZMETİK DEĞİL.
 *
 * Eski hâli e-posta + yeni şifre alıp doğrudan gönderiyordu ve sunucu
 * kimliği HİÇ doğrulamıyordu: bir e-posta adresini bilen herkes o hesabı
 * ele geçirebiliyordu. Sunucu düzeltildi; ekran da akışı takip ediyor.
 *
 *   1. adım -> e-posta yaz, hesabın güvenlik SORUSUNU getir
 *   2. adım -> soruyu CEVAPLA + yeni şifreyi belirle
 *
 * ⚠️ İKİNCİ ADIMDA CEVAP VE ŞİFRE TEK İSTEKTE GİDİYOR. "Önce cevabı
 * doğrula, sonra şifre al" daha akıcı olurdu ama araya bir sıfırlama
 * jetonu koymayı gerektirirdi; yoksa ikinci istek hiçbir şeye dayanmaz ve
 * ilk günkü açık geri gelirdi.
 */
type Adim = 'email' | 'answer';

export function ForgotPasswordScreen({ onSuccess, onGoToLogin }: Props) {
  const [adim, setAdim] = useState<Adim>('email');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
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

  /** 1. adım — e-postayı gönder, güvenlik sorusunu getir. */
  async function soruyuGetir() {
    const mail = email.trim();
    const mailError = checkEmail(mail);
    if (mailError !== null) {
      setError(mailError);
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<{ question: string }>(
        '/auth/forgot-password/question',
        { method: 'POST', body: JSON.stringify({ email: mail }) },
      );
      setQuestion(res.question);
      setAdim('answer');
    } catch (err) {
      /*
        ⚠️ Sunucunun mesajı OLDUĞU GİBİ gösteriliyor, kendi metnimizle
        değiştirilmiyor. Üç ayrı durum var — hesap yok, güvenlik sorusu
        kurulmamış, çok fazla deneme — ve üçünde kullanıcının yapması
        gereken şey farklı. Hepsini "bir hata oluştu"ya indirseydik
        kullanıcı ne yapacağını bilemezdi.
      */
      setError(err instanceof Error ? err.message : 'Soru alınamadı.');
    } finally {
      setLoading(false);
    }
  }

  /** 2. adım — cevabı ve yeni şifreyi birlikte gönder. */
  async function sifreyiSifirla() {
    if (answer.trim().length < 2) {
      setError('Güvenlik sorusunun cevabını yaz.');
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
      await apiFetch<{ success: boolean; message: string }>(
        '/auth/reset-password',
        {
          method: 'POST',
          body: JSON.stringify({
            email: email.trim(),
            answer,
            password,
            confirmPassword,
          }),
        },
      );

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
              {adim === 'email'
                ? 'Hesabınızın güvenlik sorusunu getirmek için e-postanızı yazın.'
                : 'Güvenlik sorusunu cevaplayın ve yeni şifrenizi belirleyin.'}
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
              editable={adim === 'email' && !loading && successMsg === ''}
            />

            {adim === 'answer' && (
              <>
                <Text style={styles.questionLabel}>{question}</Text>
                <Field
                  placeholder="Cevabın"
                  value={answer}
                  onChangeText={edit(setAnswer)}
                  autoCapitalize="none"
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
              </>
            )}

            {error !== '' && <ErrorRow message={error} />}
            {successMsg !== '' && (
              <Text style={styles.successText}>{successMsg}</Text>
            )}

            <View style={styles.ctaWrap}>
              <PrimaryButton
                label={
                  adim === 'email'
                    ? loading
                      ? 'Aranıyor…'
                      : 'Devam et'
                    : loading
                      ? 'Sıfırlanıyor…'
                      : 'Şifreyi sıfırla'
                }
                onPress={() =>
                  void (adim === 'email' ? soruyuGetir() : sifreyiSifirla())
                }
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
  questionLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.ink,
    marginBottom: 4,
  },
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
