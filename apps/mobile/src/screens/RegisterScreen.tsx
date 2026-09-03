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

/**
 * "Ad Soyad" metnini sunucunun beklediği iki alana ayırır.
 *
 * ⚠️ EKRANDA TEK ALAN, SUNUCUDA İKİ ALAN — VE BU BİR UYUMSUZLUK DEĞİL,
 * BİLİNÇLİ BİR KATMAN.
 *
 * Sunucu `firstName` ve `lastName`'i AYRI ve zorunlu istiyor
 * (`register.schema.ts`, her biri en az 2 karakter). Ama kullanıcı
 * adını iki kutuya bölerek düşünmüyor; tek nefeste yazıyor. Arayüzün
 * işi veritabanının şeklini taklit etmek değil, insanın alışkanlığına
 * uymak — dönüşümü kod yapar.
 *
 * ⚠️ SON BOŞLUKTAN BÖLÜNÜYOR, İLKİNDEN DEĞİL. Türkçede bileşik AD
 * yaygın ("Ahmet Can Yılmaz"), bileşik SOYAD nadir. İlk boşluktan
 * bölseydik "Ahmet" / "Can Yılmaz" çıkardı — soyadı yanlış olurdu.
 * Son boşluk: "Ahmet Can" / "Yılmaz". ✅
 *
 * ⚠️ SOYAD YOKSA UYDURMUYORUZ. `lastName` boş dönerse çağıran taraf
 * kullanıcıdan soyadını istiyor. Sunucuyu geçmek için nokta ya da
 * adın kopyasını göndermek, veritabanına bilerek çöp yazmak olurdu.
 */
export function splitName(raw: string): { firstName: string; lastName: string } {
  const temiz = raw.trim().replace(/\s+/g, ' ');
  const sonBosluk = temiz.lastIndexOf(' ');

  if (sonBosluk === -1) return { firstName: temiz, lastName: '' };

  return {
    firstName: temiz.slice(0, sonBosluk),
    lastName: temiz.slice(sonBosluk + 1),
  };
}

export function RegisterScreen({ onRegisterSuccess, onGoToLogin }: Props) {
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /*
    ⚠️ FORM İKİ ADIMA BÖLÜNDÜ — SEBEBİ MİLLER YASASI DEĞİL, SIRALAMA.

    Altı alan tek ekranda duruyordu. Bölmenin bilinen gerekçesi
    "insan aynı anda ~7 şeyi tutabilir" (Miller) — ama asıl kazanç
    sayıda değil SIRADA:

      Adım 1: İsim · Soyisim · Kullanıcı adı   -> düşük gerilim
      Adım 2: E-posta · Şifre · Şifre tekrarı  -> yüksek gerilim

    Şifre oluşturmak formun en zorlayıcı anıdır. Kolay alanları öne
    almak, kullanıcı zora gelmeden önce emek harcamasını sağlıyor —
    ve harcanan emek devam etme eğilimi yaratıyor (sunk cost).

    ⚠️ ADIM SAYISI GÖSTERİLİYOR ("1/2"). Göstermeseydik bölmek geri
    teperdi: sonu görünmeyen bir form, uzun bir formdan daha
    caydırıcıdır.
  */
  const [step, setStep] = useState<0 | 1>(0);

  /**
   * 1. adımın alanlarını doğrular.
   *
   * ⚠️ AYNI KURALLAR `handleSubmit`'te DE VAR — ve bu tekrar bilinçli
   * DEĞİL, geçici. Doğrusu kuralları tek bir yerde toplamak; şimdilik
   * ikinci kopya buraya alındı çünkü adım geçişinde sunucuya
   * gidilmiyor. Sonraki temizlikte `lib/validation.ts`'e taşınmalı.
   */
  function step1Error(): string | null {
    const { firstName, lastName } = splitName(fullName);

    if (firstName.length < MIN_NAME_LENGTH) {
      return `Adın en az ${MIN_NAME_LENGTH} karakter olmalı.`;
    }
    /*
      ⚠️ BOŞLUK YOKSA HATA VERİYORUZ, TAHMİN ETMİYORUZ.
      Alan "Ad Soyad" diyor; tek kelime yazan kullanıcı soyadını
      unutmuş demektir. Sessizce boş göndermek sunucudan İngilizce
      bir Zod hatası döndürürdü — kullanıcı neyi düzelteceğini
      bilemezdi.
    */
    if (lastName.length < MIN_NAME_LENGTH) {
      return 'Soyadını da yaz (örn. "Batuhan Oğuz").';
    }
    if (username.trim().length < 3) {
      return 'Kullanıcı adı en az 3 karakter olmalı.';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      return 'Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir.';
    }
    return null;
  }

  function ileri() {
    const hata = step1Error();
    if (hata !== null) {
      setError(hata);
      return;
    }
    setError('');
    setStep(1);
  }

  function edit(setter: (v: string) => void) {
    return (value: string) => {
      setter(value);
      if (error !== '') setError('');
    };
  }

  async function handleSubmit() {
    const { firstName: first, lastName: last } = splitName(fullName);
    const user = username.trim();
    const mail = email.trim();

    /*
      ⚠️ 1. ADIMIN KURALLARI BURADA TEKRARLANMIYOR, ÇAĞRILIYOR.
      Önceden aynı dört kontrol iki yerde yazılıydı ve biri
      değişirse öteki geride kalırdı. Tek kaynak: `step1Error`.
    */
    const adimHatasi = step1Error();
    if (adimHatasi !== null) {
      setError(adimHatasi);
      setStep(0);
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
            {/*
              ⚠️ SONU GÖRÜNEN FORM. "1/2" olmadan bölmek işe yaramaz:
              kaç adım kaldığını bilmeyen kullanıcı en kötüsünü varsayar
              ve uzun bir formdan daha çok caydırılır.
            */}
            <Text style={styles.stepBadge}>ADIM {step + 1} / 2</Text>

            <Text style={styles.title}>
              {step === 0 ? 'Seni nasıl\nçağıralım?' : 'Giriş\nbilgilerin.'}
            </Text>

            {/*
              ⚠️ "100.000 TL sanal bakiyeniz hazır" BURADAN KALKTI.
              O cümle artık onboarding'in 2. adımında, çerçevesiyle
              birlikte duruyor. İki yerde tekrar etseydi ikinci
              görüşünde değerini kaybederdi.

              ⚠️ KULLANICI ADININ NEDEN İSTENDİĞİ SÖYLENİYOR.
              Profesör tam bunu sormuştu: "kullanıcı adı gerçekten
              gerekli mi — leaderboard varsa gerekli, ama bu adımda mı
              almalıyız?" Alan kalıyor, ama artık gerekçesiyle.
            */}
            <Text style={styles.subtitle}>
              {step === 0
                ? 'Kullanıcı adın lig tablosunda görünecek.'
                : 'Hesabına bu bilgilerle gireceksin.'}
            </Text>
          </View>

          <View style={styles.form}>
            {step === 0 && (
              <>
                {/*
                  ⚠️ TEK ALAN — SUNUCU İKİ ALAN İSTESE BİLE.

                  Profesör "isim soyisim teke düşürülebilir mi" diye
                  sormuştu. Sunucu `firstName` ve `lastName`'i ayrı
                  ayrı zorunlu tutuyor, ama bu SUNUCUNUN sorunu:
                  kullanıcı adını iki kutuya bölerek düşünmüyor.

                  Ekran tek alan gösteriyor, `splitName` son boşluktan
                  ayırıp sunucunun istediği şekle çeviriyor. Arayüzün
                  işi veritabanının şeklini taklit etmek değil.
                */}
                <Field
                  placeholder="Ad Soyad"
                  value={fullName}
                  onChangeText={edit(setFullName)}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
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
              </>
            )}

            {step === 1 && (
              <>
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
              </>
            )}

            {error !== '' && <ErrorRow message={error} />}

            <View style={styles.ctaWrap}>
              <PrimaryButton
                label={
                  step === 0 ? 'Devam' : loading ? 'Oluşturuluyor…' : 'Hesap aç'
                }
                onPress={() => (step === 0 ? ileri() : void handleSubmit())}
                loading={loading}
              />

              {/*
                ⚠️ GERİ DÜĞMESİ ŞART. 1. adımda yazdığı kullanıcı adını
                düzeltmek isteyen kişi geri dönemezse formu baştan
                doldurur — bölmenin kazandırdığı her şeyi tek başına
                geri alır.
              */}
              {step === 1 && (
                <Pressable
                  onPress={() => { setError(''); setStep(0); }}
                  disabled={loading}
                  accessibilityRole="button"
                >
                  <Text style={styles.backLink}>‹ Bilgilerimi düzelt</Text>
                </Pressable>
              )}
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
  stepBadge: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.inkFaint,
    marginBottom: 10,
  },
  backLink: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: 14,
  },
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
