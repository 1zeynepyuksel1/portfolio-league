/**
 * LoginScreen — tasarım: design_handoff_portfolioyun_auth (v4, koyu)
 *
 * ⚠️ METİNLERDE ÜRÜNE UYARLAMA YAPILDI.
 * Tasarımdaki `THYAO +1,86%` / `ASELS −0,42%` BIST hisseleri. BIST Faz 3'e
 * ertelendi ve uygulamada işlem görmüyorlar. Olmayan bir varlığı fiyatıyla
 * göstermek, kullanıcıya alabileceği bir şey vaat etmek olur. Yerlerine
 * gerçekten işlem gören BTC ve ETH yazıldı; düzen, boyut, renk aynı.
 *
 * ⚠️ APPLE / GOOGLE DÜĞMELERİ HENÜZ BAĞLI DEĞİL.
 * Backend'de OAuth yok — kendi JWT auth'umuz var. Düğmeler tasarımdaki
 * gibi duruyor ama basınca "yakında" diyor. Bağlanması Zeynep'in şeridinde
 * (kimlik). Sessizce hiçbir şey yapmalarındansa açıkça söylemeleri doğru.
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
import Svg, { Path, Polyline } from 'react-native-svg';
import { checkEmail } from '../lib/validation';
import { apiFetch, saveSession } from '../api/client';
import { useGoogleSignIn } from '../lib/useGoogleSignIn';
import { ChartBackground } from '../components/ChartBackground';
import {
  Divider,
  ErrorRow,
  Field,
  HomeIndicator,
  PrimaryButton,
  SecondaryButton,
} from '../components/AuthControls';
import { colors, fonts, spacing } from '../theme';

type AuthUser = { id: string; email: string; displayName: string };

type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

type Props = {
  onLoginSuccess: (user: AuthUser) => void;
  /** "Hesap aç" bağlantısı — kayıt ekranına götürür. */
  onGoToRegister: () => void;
  onGoToForgotPassword: () => void;
};

/**
 * E-posta biçim kontrolü.
 *
 * ⚠️ BU DESEN BİLEREK GEVŞEK. "Geçerli e-posta"yı tam olarak tanımlayan
 * RFC 5322 deseni yüzlerce karakter ve pratikte kimse kullanmıyor. Burada
 * amaç yazım hatasını yakalamak (`@` unutulmuş, nokta yok), gerçekliği
 * kanıtlamak değil — onu ancak doğrulama e-postası yapar.
 */

const MIN_PASSWORD_LENGTH = 6;

/** Küçük yön işareti — kotasyon satırındaki yukarı/aşağı ok. */
function Chevron({ up, color }: { up: boolean; color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12">
      <Polyline
        points={up ? '1,8 6,3 11,8' : '1,4 6,9 11,4'}
        fill="none"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function AppleGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill={colors.ink}
        d="M17.05 12.54c.02-2.3 1.88-3.4 1.96-3.45-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.83-.81-3-.79-1.55.02-2.98.9-3.77 2.28-1.61 2.79-.41 6.92 1.15 9.19.76 1.11 1.67 2.35 2.86 2.31 1.15-.05 1.58-.74 2.97-.74 1.39 0 1.78.74 3 .72 1.24-.02 2.02-1.13 2.78-2.24.88-1.29 1.24-2.54 1.26-2.6-.03-.01-2.41-.93-2.43-3.69M14.8 5.6c.63-.77 1.06-1.83.94-2.9-.91.04-2.01.61-2.67 1.37-.59.68-1.1 1.76-.96 2.8 1.02.08 2.06-.52 2.69-1.27"
      />
    </Svg>
  );
}

/** Google'ın resmî dört renkli G harfi. Marka kılavuzu renk değişikliğine izin vermiyor. */
function GoogleGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5.1-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.1" />
      <Path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41.1 15.4 46 24 46" />
      <Path fill="#FBBC05" d="M11.6 28.1c-.4-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.8z" />
      <Path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.1 30 2 24 2 15.4 2 7.9 6.9 4.3 14.2l7.3 5.7c1.7-5.2 6.6-9.1 12.4-9.1" />
    </Svg>
  );
}

export function LoginScreen({ onLoginSuccess, onGoToRegister, onGoToForgotPassword }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * Her tuş vuruşunda hata siliniyor.
   *
   * Tasarımın açık isteği ve doğru olan da bu: kullanıcı düzeltmeye
   * başlamışken hâlâ eski hatayı okuyorsa, düzeltmesinin işe yarayıp
   * yaramadığını anlayamaz.
   */
  function edit(setter: (v: string) => void) {
    return (value: string) => {
      setter(value);
      if (error !== '') setError('');
    };
  }

  /*
    ⚠️ GOOGLE İÇİN YENİ DÜĞME EKLENMEDİ — AŞAĞIDAKİ MEVCUT DÜĞME BAĞLANDI.

    Tasarımda zaten "Google ile devam et" düğmesi vardı (resmî dört renkli
    G harfiyle) ve `setError('yakında eklenecek')` diyordu. Önce yanına
    ikinci bir düğme koymuştum; yan yana iki Google düğmesi oldu.

    Doğrusu davranışı bir kancaya koyup var olan düğmeye vermek: görünüm
    tasarımın, davranış kancanın.
  */
  const google = useGoogleSignIn({
    onError: setError,
    onSuccess: async (res) => {
      /*
        ⚠️ OTURUM AYNI YERE YAZILIYOR (`saveSession`). Google ile gelen de
        BİZİM access/refresh token'ımız; uygulamanın geri kalanı hangi
        yoldan girildiğini bilmiyor ve bilmemeli. Kilitli karar ("kendi
        JWT auth'umuz") böyle korunuyor.
      */
      await saveSession(res.accessToken, res.refreshToken);
      onLoginSuccess(res.user);
    },
  });

  async function handleSubmit() {
    // Sunucuya gitmeden önce yerel kontrol: ağ turunu boşa harcamayalım
    // ve kullanıcı hatayı anında görsün.
    const trimmed = email.trim();

    const mailError = checkEmail(trimmed);
    if (mailError !== null) {
      setError(mailError);
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`);
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: trimmed, password }),
      });

      // Kalıcı depoya yazılıyor — uygulama kapanınca oturum kaybolmasın.
      await saveSession(res.accessToken, res.refreshToken);
      onLoginSuccess(res.user);
    } catch (err) {
      // Sunucu hatası da aynı satırda gösteriliyor: kullanıcının bakacağı
      // tek bir yer olsun.
      setError(err instanceof Error ? err.message : 'Giriş yapılamadı.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <ChartBackground />

      {/* Klavye açılınca CTA'nın altında kalmaması için. iOS ve Android
          farklı davrandığı için davranış platforma göre seçiliyor. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Marka satırı */}
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <Text style={styles.brandName}>PORTFOLIOYUN</Text>
          </View>

          {/* Başlık */}
          <View style={styles.hero}>
            <Text style={styles.title}>Tekrar{'\n'}hoş geldiniz.</Text>
            <Text style={styles.subtitle}>Portföyünüz sizi bekliyor.</Text>

            <View style={styles.quoteRow}>
              <View style={styles.quote}>
                <Chevron up color={colors.gain} />
                <Text style={[styles.quoteText, { color: colors.gain }]}>
                  BTC +1,86%
                </Text>
              </View>
              <View style={styles.quote}>
                <Chevron up={false} color={colors.accent} />
                {/* Gerçek eksi işareti (U+2212), kısa çizgi değil —
                    tasarımın açık isteği, rakamlarla aynı genişlikte. */}
                <Text style={[styles.quoteText, { color: colors.accent }]}>
                  ETH −0,42%
                </Text>
              </View>
            </View>
          </View>

          {/* Form */}
          <View style={styles.form}>
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
              placeholder="Şifre"
              value={password}
              onChangeText={edit(setPassword)}
              isPassword
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              editable={!loading}
            />

            {error !== '' && <ErrorRow message={error} />}

            <View style={styles.ctaWrap}>
              <PrimaryButton
                label={loading ? 'Doğrulanıyor…' : 'Giriş yap'}
                onPress={() => void handleSubmit()}
                loading={loading}
              />
            </View>

            <Pressable
              onPress={onGoToForgotPassword}
              accessibilityRole="button"
              style={styles.forgot}
            >
              <Text style={styles.forgotText}>Şifremi unuttum</Text>
            </Pressable>
          </View>

          {/* Alt blok — marginTop:auto ile ekranın dibine yaslanıyor */}
          <View style={styles.footer}>
            <Divider />

            <View style={styles.oauth}>
              <SecondaryButton
                compact
                label="Apple ile devam et"
                glyph={<AppleGlyph />}
                onPress={() =>
                  setError('Apple ile giriş yakında eklenecek.')
                }
              />
              <SecondaryButton
                compact
                label={
                  google.busy ? 'Google ile bağlanılıyor…' : 'Google ile devam et'
                }
                glyph={<GoogleGlyph />}
                onPress={() => {
                  /*
                    ⚠️ Yapılandırma yoksa düğme yine ÇİZİLİYOR ama iş
                    yapmıyor — yanındaki Apple düğmesi de aynı durumda.
                    Gizleseydik tasarımın simetrisi bozulur, tek başına
                    kalan Apple düğmesi "yakında" derdi ve Google hiç
                    yokmuş gibi görünürdü.
                  */
                  if (!google.available) {
                    setError('Google girişi henüz yapılandırılmadı.');
                    return;
                  }
                  setError('');
                  google.signIn();
                }}
              />
            </View>

            <View style={styles.signupRow}>
              <Text style={styles.signupText}>Hesabınız yok mu?</Text>
              <Pressable onPress={onGoToRegister} accessibilityRole="button">
                {({ pressed }) => (
                  <Text
                    style={[
                      styles.signupLink,
                      pressed && { color: colors.accent },
                    ]}
                  >
                    Hesap aç
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
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  flex: {
    flex: 1,
  },
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
    // Tasarımda .26em. RN em bilmiyor, punto ile çarpıyoruz: 12 × .26
    letterSpacing: 0.26 * 12,
    color: colors.ink,
  },

  hero: {
    paddingTop: 40,
  },
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
    marginTop: 18,
  },
  quoteRow: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 16,
  },
  quote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quoteText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    letterSpacing: 0.04 * 12,
  },

  form: {
    marginTop: 28,
    gap: 12,
  },
  ctaWrap: {
    marginTop: 6,
  },
  forgot: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  forgotText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.inkDim,
  },

  footer: {
    // ⚠️ Alt bloğu dibe yaslayan şey bu. Sabit bir üst boşluk verseydik
    // küçük ekranda form ile çakışır, büyük ekranda ortada asılı kalırdı.
    marginTop: 'auto',
    paddingTop: 24,
  },
  oauth: {
    gap: 10,
    marginTop: 16,
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 20,
  },
  signupText: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.inkDim,
  },
  signupLink: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },
  indicatorWrap: {
    marginTop: 22,
  },
});
