import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiFetch, saveSession } from '../api/client';

type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  username?: string;
  isEmailVerified?: boolean;
};

type RegisterResponse = {
  user: AuthUser;
  requiresVerification: boolean;
  demoCode?: string;
};

type LoginResponse = {
  user: AuthUser;
  accessToken: string;
};

type VerifyResponse = {
  user: AuthUser;
  accessToken: string;
  // Access token ~15 dk sonra ölüyor. Refresh token uzun ömürlü ve
  // saklanması şart — yoksa kullanıcı 15 dakikada bir giriş yapar.
  refreshToken: string;
};

type Props = {
  onLoginSuccess: (user: AuthUser) => void;
};

export function AuthScreen({ onLoginSuccess }: Props) {
  // Akış Durumu: 'welcome' (Hero Ekranı) vs 'auth' (Giriş/Kayıt Formu) vs 'verify' (6 Haneli OTP Kod)
  const [screenMode, setScreenMode] = useState<'welcome' | 'auth' | 'verify'>('welcome');
  const [isLogin, setIsLogin] = useState(true);

  // Form Alanları
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');

  // Beni Hatırla Seçeneği
  const [rememberMe, setRememberMe] = useState(false);

  // Şifre Göster/Gizle Şalterleri
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Doğrulama Durumları
  const [unverifiedUserId, setUnverifiedUserId] = useState<string | null>(null);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);

  // OTP Kutuları İçin Ref'ler
  const inputRefs = useRef<Array<TextInput | null>>([]);

  // Yükleniyor ve Hata Durumları
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 1. GİRİŞ VEYA KAYIT FORMUNU GÖNDER
  async function handleAuthSubmit() {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!isLogin) {
      if (!displayName.trim()) {
        setErrorMessage('Please enter your Full Name.');
        return;
      }
      if (password.length < 8) {
        setErrorMessage('Password must be at least 8 characters.');
        return;
      }
      if (password.length > 64) {
        setErrorMessage('Password cannot exceed 64 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match. Please check again.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isLogin) {
        const res = await apiFetch<LoginResponse>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });

        // Kalıcı depoya da yazılıyor — sayfa yenilenince oturum kaybolmasın.
        await saveSession(res.accessToken, res.refreshToken);
        onLoginSuccess(res.user);
      } else {
        const res = await apiFetch<RegisterResponse>('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email,
            password,
            confirmPassword,
            displayName,
            username: username.trim() ? username.trim() : undefined,
          }),
        });

        if (res.requiresVerification) {
          setUnverifiedUserId(res.user.id);
          setDemoCode(res.demoCode || null);
          setScreenMode('verify');
        } else {
          await saveSession(res.accessToken, res.refreshToken);
          onLoginSuccess(res.user);
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Operation failed.');
    } finally {
      setLoading(false);
    }
  }

  // 2. 6 HANELİ OTP KODUNU DOĞRULA
  async function handleVerifyOtp() {
    const fullCode = otpDigits.join('');
    if (fullCode.length !== 6) {
      setErrorMessage('Please enter the full 6-digit verification code.');
      return;
    }

    if (!unverifiedUserId) return;

    setErrorMessage(null);
    setLoading(true);

    try {
      const res = await apiFetch<VerifyResponse>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          userId: unverifiedUserId,
          code: fullCode,
        }),
      });

      setAccessToken(res.accessToken);
      onLoginSuccess(res.user);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setLoading(false);
    }
  }

  // 3. KODU TEKRAR GÖNDER
  async function handleResendCode() {
    if (!unverifiedUserId) return;

    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await apiFetch<{ message: string; demoCode?: string }>('/auth/resend-code', {
        method: 'POST',
        body: JSON.stringify({ userId: unverifiedUserId }),
      });

      if (res.demoCode) {
        setDemoCode(res.demoCode);
      }
      setSuccessMessage('A new 6-digit code has been sent to your email!');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not resend code.');
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(text: string, index: number) {
    const newDigits = [...otpDigits];
    newDigits[index] = text.slice(-1);
    setOtpDigits(newDigits);

    if (text && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.contentWrapper}>
        {/* MOD 1: HERO KARŞILAMA EKRANI */}
        {screenMode === 'welcome' ? (
          <View style={styles.cleanWelcomeHeroContent}>
            {/* ÜST FERAH TEMİZ BOŞLUK */}
            <View style={styles.cleanTopSpace} />

            {/* EN ALTA HİZALANMIŞ METİNLER VE BUTONLAR */}
            <View style={styles.bottomAnchoredHeroGroup}>
              <Text style={styles.welcomeHeroTitle}>
                Invest & Compete{'\n'}
                <Text style={styles.welcomeHeroHighlight}>Swiftly.</Text>
              </Text>

              <Text style={styles.welcomeHeroSubtitle}>
                Join weekly trading leagues and compete with friends.
              </Text>

              {/* NEON LIME YEŞİLİ "GET STARTED" BUTONU */}
              <TouchableOpacity
                style={styles.welcomeGetStartedButton}
                onPress={() => {
                  setIsLogin(false);
                  setScreenMode('auth');
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.welcomeGetStartedButtonText}>Get Started</Text>
              </TouchableOpacity>

              {/* İKİNCİL SIGN IN LINKI */}
              <TouchableOpacity
                style={styles.welcomeSecondaryLink}
                onPress={() => {
                  setIsLogin(true);
                  setScreenMode('auth');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.welcomeSecondaryLinkText}>
                  Already have an account? <Text style={styles.welcomeSecondaryLinkBold}>Sign in</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : screenMode === 'auth' ? (
          /* MOD 2: BİREBİR YÜKLEDİĞİNİZ GÖRSELİN EKRAN VE YAZI DÜZENİ */
          <View style={styles.formContainer}>
            {/* SOL ÜST GERİ DÖN BUTONU */}
            <TouchableOpacity
              style={styles.circleBackButton}
              onPress={() => setScreenMode('welcome')}
              activeOpacity={0.8}
            >
              <Text style={styles.circleBackButtonText}>←</Text>
            </TouchableOpacity>

            {/* ORTALANMIŞ BÜYÜK BAŞLIK VE ALT YAZI */}
            <View style={styles.centeredHeaderGroup}>
              <Text style={styles.centeredMainTitle}>
                {isLogin ? 'Welcome Back!' : 'Create Account!'}
              </Text>
              <Text style={styles.centeredMainSubtitle}>
                Best Way to Manage Your Finances.
              </Text>
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
                    <Text style={styles.fieldLabel}>Full Name</Text>
                    <View style={styles.pillInputWrapper}>
                      <Text style={styles.inputIcon}>👤</Text>
                      <TextInput
                        style={styles.pillTextInput}
                        placeholder="Enter Your Full Name"
                        placeholderTextColor="#64748B"
                        value={displayName}
                        onChangeText={setDisplayName}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.fieldLabel}>Username</Text>
                    <View style={styles.pillInputWrapper}>
                      <Text style={styles.inputIcon}>🏷️</Text>
                      <TextInput
                        style={styles.pillTextInput}
                        placeholder="Enter Your Username"
                        placeholderTextColor="#64748B"
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                      />
                    </View>
                  </View>
                </>
              )}

              {/* Email Address Kutusu */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Email Address</Text>
                <View style={styles.pillInputWrapper}>
                  <Text style={styles.inputIcon}>✉️</Text>
                  <TextInput
                    style={styles.pillTextInput}
                    placeholder="Enter Your Email"
                    placeholderTextColor="#64748B"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Password Kutusu */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={styles.pillInputWrapper}>
                  <Text style={styles.inputIcon}>🔒</Text>
                  <TextInput
                    style={styles.pillTextInput}
                    placeholder="Enter Your Password"
                    placeholderTextColor="#64748B"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeIconButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Text style={styles.eyeIconText}>{showPassword ? '👁️' : '🙈'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password (Kayıt Modunda) */}
              {!isLogin && (
                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>Confirm Password</Text>
                  <View style={styles.pillInputWrapper}>
                    <Text style={styles.inputIcon}>🔐</Text>
                    <TextInput
                      style={styles.pillTextInput}
                      placeholder="Re-enter Your Password"
                      placeholderTextColor="#64748B"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeIconButton}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <Text style={styles.eyeIconText}>{showConfirmPassword ? '👁️' : '🙈'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* "Remember me" VE "Forgot Password?" HİZALAMASI */}
              {isLogin && (
                <View style={styles.rememberForgotRow}>
                  <TouchableOpacity
                    style={styles.rememberMeRow}
                    onPress={() => setRememberMe(!rememberMe)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.radioCircle, rememberMe && styles.radioCircleChecked]}>
                      {rememberMe && <View style={styles.radioInnerDot} />}
                    </View>
                    <Text style={styles.rememberMeText}>Remember me</Text>
                  </TouchableOpacity>

                  <TouchableOpacity activeOpacity={0.7}>
                    <Text style={styles.purpleForgotText}>Forgot Password?</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* OVAL LOG IN / SIGN UP BUTONU */}
              <TouchableOpacity
                style={[styles.primarySubmitButton, loading && styles.buttonDisabled]}
                onPress={handleAuthSubmit}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#070C14" />
                ) : (
                  <Text style={styles.primarySubmitButtonText}>
                    {isLogin ? 'Log In' : 'Sign Up'}
                  </Text>
                )}
              </TouchableOpacity>

              {/* "Or Continue With" ÇİZGİSİ */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Or Continue With</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* YAN YANA İKÖNLÜ SOSYAL BUTONLAR (GOOGLE & APPLE İKONLU) */}
              <View style={styles.sideBySideSocialRow}>
                <TouchableOpacity style={styles.socialPillButton} activeOpacity={0.8}>
                  {/* Google Çokyüzlü/Renkli İkon Rozeti */}
                  <View style={styles.googleIconBadge}>
                    <Text style={styles.googleIconText}>G</Text>
                  </View>
                  <Text style={styles.socialButtonText}>Google</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.socialPillButton} activeOpacity={0.8}>
                  {/* Apple İkon Logosu */}
                  <Text style={styles.appleIconSymbol}></Text>
                  <Text style={styles.socialButtonText}>Apple</Text>
                </TouchableOpacity>
              </View>

              {/* EN ALT GEÇİŞ METNİ */}
              <TouchableOpacity
                style={styles.switchAuthRow}
                onPress={() => {
                  setIsLogin(!isLogin);
                  setErrorMessage(null);
                }}
              >
                <Text style={styles.switchAuthBaseText}>
                  {isLogin ? "Don’t have an account? " : 'Already have an account? '}
                  <Text style={styles.switchAuthUnderlineText}>
                    {isLogin ? 'Sign up' : 'Log in'}
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* MOD 3: 6 HANELİ E-POSTA OTP DOĞRULAMA EKRANI */
          <View style={styles.formContainer}>
            <TouchableOpacity
              style={styles.circleBackButton}
              onPress={() => setScreenMode('auth')}
              activeOpacity={0.8}
            >
              <Text style={styles.circleBackButtonText}>←</Text>
            </TouchableOpacity>

            <View style={styles.centeredHeaderGroup}>
              <Text style={styles.centeredMainTitle}>Verify Email</Text>
              <Text style={styles.centeredMainSubtitle}>
                Please enter code sent to <Text style={styles.highlightEmail}>{email}</Text>
              </Text>
            </View>

            {/* DEMO KOD BILGI ROZETI */}
            {demoCode && (
              <View style={styles.demoBadgeBox}>
                <Text style={styles.demoBadgeText}>
                  🎁 Demo Code: <Text style={styles.demoCodeNumber}>{demoCode}</Text>
                </Text>
              </View>
            )}

            {errorMessage && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
              </View>
            )}

            {successMessage && (
              <View style={styles.successBox}>
                <Text style={styles.successText}>✅ {successMessage}</Text>
              </View>
            )}

            {/* 6 KARE KUTUCUKLU OTP GRİDİ */}
            <View style={styles.otpGridRow}>
              {otpDigits.map((digit, idx) => (
                <TextInput
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  style={[styles.otpBoxCell, digit !== '' && styles.otpBoxCellFilled]}
                  value={digit}
                  onChangeText={(text) => handleOtpChange(text, idx)}
                  onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, idx)}
                  keyboardType="numeric"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.primarySubmitButton, loading && styles.buttonDisabled]}
              onPress={handleVerifyOtp}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#070C14" />
              ) : (
                <Text style={styles.primarySubmitButtonText}>Verify & Start</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resendLinkButton}
              onPress={handleResendCode}
              disabled={loading}
            >
              <Text style={styles.resendLinkText}>Didn't receive code? Resend</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// STİL TANIMLARI
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070C14',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  contentWrapper: {
    width: '100%',
    maxWidth: 390,
  },
  // HERO EKRANI STİLLERİ
  cleanWelcomeHeroContent: {
    minHeight: 560,
    justifyContent: 'space-between',
  },
  cleanTopSpace: {
    flex: 1,
    minHeight: 250,
  },
  bottomAnchoredHeroGroup: {
    gap: 14,
    justifyContent: 'flex-end',
  },
  welcomeHeroTitle: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#FFFFFF',
    lineHeight: 46,
    letterSpacing: -0.5,
  },
  welcomeHeroHighlight: {
    color: '#A3E635',
  },
  welcomeHeroSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 22,
    marginBottom: 10,
  },
  welcomeGetStartedButton: {
    backgroundColor: '#A3E635',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#A3E635',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  welcomeGetStartedButtonText: {
    color: '#070C14',
    fontSize: 17,
    fontWeight: 'bold',
  },
  welcomeSecondaryLink: {
    alignItems: 'center',
    marginTop: 8,
  },
  welcomeSecondaryLinkText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  welcomeSecondaryLinkBold: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  // EKRAN DÜZEN STİLLERİ
  formContainer: {
    width: '100%',
  },
  circleBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#131C2E',
    borderColor: '#24324D',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  circleBackButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  centeredHeaderGroup: {
    alignItems: 'center',
    marginBottom: 24,
  },
  centeredMainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6,
  },
  centeredMainSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
  },
  successBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    color: '#34D399',
    fontSize: 13,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  pillInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131C2E',
    borderColor: '#24324D',
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 16,
  },
  inputIcon: {
    fontSize: 16,
    marginRight: 10,
    opacity: 0.7,
  },
  pillTextInput: {
    flex: 1,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 14,
  },
  eyeIconButton: {
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  eyeIconText: {
    fontSize: 16,
    opacity: 0.6,
  },
  rememberForgotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#64748B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleChecked: {
    borderColor: '#A3E635',
  },
  radioInnerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#A3E635',
  },
  rememberMeText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  purpleForgotText: {
    color: '#A3E635',
    fontSize: 13,
    fontWeight: '600',
  },
  primarySubmitButton: {
    backgroundColor: '#A3E635',
    borderRadius: 28,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#A3E635',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primarySubmitButtonText: {
    color: '#070C14',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#24324D',
  },
  dividerText: {
    color: '#64748B',
    fontSize: 12,
  },
  sideBySideSocialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialPillButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#131C2E',
    borderColor: '#24324D',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 12,
    gap: 10,
  },
  // GOOGLE RENKLİ G İKONU STİLİ
  googleIconBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIconText: {
    color: '#4285F4',
    fontSize: 13,
    fontWeight: 'bold',
  },
  // APPLE İKONU STİLİ
  appleIconSymbol: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  socialButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  switchAuthRow: {
    alignItems: 'center',
    marginTop: 14,
  },
  switchAuthBaseText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  switchAuthUnderlineText: {
    color: '#A3E635',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  highlightEmail: {
    color: '#A3E635',
    fontWeight: 'bold',
  },
  demoBadgeBox: {
    backgroundColor: 'rgba(163, 230, 53, 0.15)',
    borderColor: '#A3E635',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 18,
    alignItems: 'center',
  },
  demoBadgeText: {
    color: '#BEF264',
    fontSize: 13,
  },
  demoCodeNumber: {
    color: '#A3E635',
    fontWeight: 'bold',
    fontSize: 15,
  },
  otpGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 16,
  },
  otpBoxCell: {
    width: 44,
    height: 52,
    backgroundColor: '#131C2E',
    borderColor: '#24324D',
    borderWidth: 1.5,
    borderRadius: 12,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
  },
  otpBoxCellFilled: {
    borderColor: '#A3E635',
    backgroundColor: 'rgba(163, 230, 53, 0.15)',
  },
  resendLinkButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  resendLinkText: {
    color: '#A3E635',
    fontSize: 13,
    fontWeight: '600',
  },
});
