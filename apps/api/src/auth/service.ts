import argon2 from 'argon2';
import {
  addRefreshToken,
  createUserWithAccount,
  findUserByEmail,
  findUserByUsername,
  findUserForLogin,
  findUserVerificationInfo,
  markEmailVerified,
  revokeRefreshToken,
  rotateRefreshToken,
  updateVerificationCode,
  updateUserPasswordById,
  findUserByGoogleId,
  linkGoogleId,
  createGoogleUser,
  isUsernameTaken,
  findUserSecurity,
  updateSecurityQuestion,
} from './repository.js';
import type { LoginBody } from './login.schema.js';
import type { RegisterBody } from './register.schema.js';
import type { RefreshBody } from './refresh.schema.js';
import {
  normalizeAnswer,
  type ResetWithAnswerBody,
  type SetSecurityQuestionBody,
} from './security-question.schema.js';
import { hit } from '../lib/rate-limit.js';
import { GoogleAuthError, verifyGoogleIdToken } from './google.js';

/*
  ⚠️ SINIRLAR NEDEN FARKLI: iki ucun riski aynı değil.

  Soru sorma (`sq-lookup`) yalnızca "bu adres kayıtlı mı"yı açık ediyor —
  can sıkıcı ama hesap ele geçirmiyor. Cevap denemesi (`sq-reset`) doğrudan
  hesabın kapısı; orada sınır çok daha dar.

  ⚠️ 5 DENEME / 15 DAKİKA rastgele seçilmedi: "ilk evcil hayvanınızın adı"
  gibi bir soru için makul cevap uzayı birkaç yüz. Saatte 20 deneme ile
  200 ihtimali taramak 10 saat sürer; sınırsızken saniyeler sürerdi.
*/
const SORU_SORMA_LIMITI = 10;
const SORU_PENCERESI_MS = 15 * 60 * 1000;
const CEVAP_DENEME_LIMITI = 5;
const CEVAP_PENCERESI_MS = 15 * 60 * 1000;
import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
} from './token.js';

export class EmailAlreadyInUseError extends Error {
  constructor() {
    super('Bu e-posta adresi zaten kullanılıyor.');
  }
}

export class UsernameAlreadyInUseError extends Error {
  constructor() {
    super('Bu kullanıcı adı zaten alınmış.');
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('E-posta veya şifre hatalı.');
  }
}

export class InvalidRefreshTokenError extends Error {
  constructor() {
    super('Refresh token geçersiz veya süresi dolmuş.');
  }
}

export class EmailNotVerifiedError extends Error {
  constructor(public readonly userId: string) {
    super('E-posta adresiniz henüz doğrulanmadı. Lütfen gelen 6 haneli kodu giriniz.');
  }
}

export class InvalidVerificationCodeError extends Error {
  constructor() {
    super('Girdiğiniz 6 haneli doğrulama kodu hatalı. Lütfen kontrol edip tekrar deneyiniz.');
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

// 6 haneli doğrulama kodu üretir (Örn: "589214")
function generate6DigitCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function registerUser(input: RegisterBody) {
  const existingUser = await findUserByEmail(input.email);

  if (existingUser) {
    throw new EmailAlreadyInUseError();
  }

  const existingUsername = await findUserByUsername(input.username);

  if (existingUsername) {
    throw new UsernameAlreadyInUseError();
  }

  const passwordHash = await argon2.hash(input.password);
  const refreshToken = createRefreshToken();
  const verificationCode = generate6DigitCode();

  try {
    const user = await createUserWithAccount({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      username: input.username,
      verificationCode,
      refreshTokenHash: refreshToken.tokenHash,
      refreshTokenExpiresAt: refreshToken.expiresAt,
    });

    console.log(`[KAYIT] ${input.email} başarıyla doğrudan kayıt oldu (doğrulama atlandı).`);

    const accessToken = await createAccessToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        username: user.username,
        isEmailVerified: true,
      },
      accessToken,
      refreshToken: refreshToken.value,
      requiresVerification: false,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error('E-posta veya kullanıcı adı zaten kullanımda.');
    }

    throw error;
  }
}

export async function verifyUserEmail(userId: string, code: string) {
  const user = await findUserVerificationInfo(userId);

  if (!user) {
    throw new Error('Kullanıcı bulunamadı.');
  }

  if (user.isEmailVerified) {
    // Zaten doğrulanmışsa token üretip dön
    const accessToken = await createAccessToken(user.id);
    const refreshToken = createRefreshToken();
    await addRefreshToken({
      userId: user.id,
      tokenHash: refreshToken.tokenHash,
      expiresAt: refreshToken.expiresAt,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        isEmailVerified: true,
      },
      accessToken,
      refreshToken: refreshToken.value,
    };
  }

  if (user.verificationCode !== code) {
    throw new InvalidVerificationCodeError();
  }

  // Kodu doğrula ve veritabanını güncelle
  await markEmailVerified(userId);

  const accessToken = await createAccessToken(user.id);
  const refreshToken = createRefreshToken();
  await addRefreshToken({
    userId: user.id,
    tokenHash: refreshToken.tokenHash,
    expiresAt: refreshToken.expiresAt,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isEmailVerified: true,
    },
    accessToken,
    refreshToken: refreshToken.value,
  };
}

export async function resendVerificationCode(userId: string) {
  const user = await findUserVerificationInfo(userId);

  if (!user) {
    throw new Error('Kullanıcı bulunamadı.');
  }

  if (user.isEmailVerified) {
    return { message: 'E-posta adresiniz zaten doğrulanmış.', demoCode: null };
  }

  const newCode = generate6DigitCode();
  await updateVerificationCode(userId, newCode);

  console.log(`[E-POSTA SİMÜLATÖRÜ] ${user.email} adresine YENİ doğrulama kodu gönderildi: ${newCode}`);

  return {
    message: 'Yeni 6 haneli doğrulama kodu e-postanıza gönderildi.',
    demoCode: newCode,
  };
}

/** Hesap askıya alınmış — giriş engellendi. */
export class AccountBannedError extends Error {
  constructor(reason: string | null) {
    super(reason ?? 'Hesabın askıya alındı.');
    this.name = 'AccountBannedError';
  }
}

export async function loginUser(input: LoginBody) {
  const user = await findUserForLogin(input.email);

  /*
    ⚠️ `passwordHash === null` = SADECE GOOGLE İLE KAYITLI HESAP.

    Bu kontrol olmadan `argon2.verify(null, ...)` çalışma anında patlardı
    ve kullanıcı "şifre yanlış" yerine 500 görürdü. TypeScript kolonu
    null yapılabilir hâle getirdiğimizde tam olarak burayı gösterdi.

    ⚠️ HATA MESAJI YİNE "geçersiz kimlik" — "bu hesap Google ile açılmış"
    DEMİYORUZ. Söyleseydik, bir e-postanın kayıtlı olup olmadığını ve
    hangi yolla açıldığını herkese anlatan bir uç olurdu.
  */
  if (
    !user ||
    user.passwordHash === null ||
    !(await argon2.verify(user.passwordHash, input.password))
  ) {
    throw new InvalidCredentialsError();
  }

  /*
    ⚠️ BAN KONTROLÜ ŞİFRE DOĞRULANDIKTAN SONRA.

    Önce yapsaydık, şifreyi bilmeyen biri de bir e-posta deneyerek o
    hesabın banlı olup olmadığını öğrenebilirdi. Ban durumu hesap
    sahibinin bilgisi; yabancıya söylenmez.
  */
  if (user.bannedAt !== null) {
    throw new AccountBannedError(user.banReason);
  }

  const refreshToken = createRefreshToken();
  await addRefreshToken({
    userId: user.id,
    tokenHash: refreshToken.tokenHash,
    expiresAt: refreshToken.expiresAt,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      // ⚠️ Kayıt yanıtında vardı, GİRİŞ yanıtında yoktu. Profil sekmesi
      // kullanıcı adını adres olarak kullaniyor; eksik olunca giris
      // yapan kullanici kendi profilini goremiyordu.
      username: user.username,
      isEmailVerified: true,
    },
    accessToken: await createAccessToken(user.id),
    refreshToken: refreshToken.value,
  };
}

export async function refreshUserSession(input: RefreshBody) {
  const currentToken = hashRefreshToken(input.refreshToken);
  const nextToken = createRefreshToken();
  const rotated = await rotateRefreshToken({
    currentTokenHash: currentToken,
    newTokenHash: nextToken.tokenHash,
    newTokenExpiresAt: nextToken.expiresAt,
  });

  if (!rotated) {
    throw new InvalidRefreshTokenError();
  }

  return {
    tokenType: 'Bearer' as const,
    accessToken: await createAccessToken(rotated.userId),
    refreshToken: nextToken.value,
  };
}

export async function logoutUser(input: RefreshBody) {
  await revokeRefreshToken(hashRefreshToken(input.refreshToken));
}

export class UserNotFoundError extends Error {
  constructor() {
    super('Kullanıcı bulunamadı.');
  }
}

export class SameAsOldPasswordError extends Error {
  constructor() {
    super('Yeni şifreniz, eski şifrenizle aynı olamaz.');
  }
}

/**
 * Güvenlik sorusu kurulmamış hesap — sıfırlama yapılamıyor.
 *
 * ⚠️ Bu hata KASITEN ayrı: "cevap yanlış" demek yanıltıcı olurdu, çünkü
 * ortada doğrulanacak bir cevap yok. Kullanıcı neden takıldığını bilmeli.
 */
export class NoSecurityQuestionError extends Error {
  constructor() {
    super(
      'Bu hesapta güvenlik sorusu tanımlı değil. Giriş yaptıktan sonra profil ayarlarından bir soru belirleyebilirsin.',
    );
    this.name = 'NoSecurityQuestionError';
  }
}

/** Güvenlik sorusunun cevabı yanlış. */
export class WrongSecurityAnswerError extends Error {
  constructor() {
    super('Güvenlik sorusunun cevabı yanlış.');
    this.name = 'WrongSecurityAnswerError';
  }
}

/** Çok fazla deneme yapıldı. */
export class TooManyAttemptsError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super(
      `Çok fazla deneme yapıldı. ${retryAfterSeconds} saniye sonra tekrar dene.`,
    );
    this.name = 'TooManyAttemptsError';
  }
}

/**
 * 1. adım — e-postaya ait güvenlik sorusunu döndürür.
 *
 * ⚠️ BU UÇ, BİR E-POSTANIN KAYITLI OLDUĞUNU AÇIK EDİYOR (kullanıcı
 * sayımı). Kaçınılmaz: soruyu göstermek için hesabın var olduğunu kabul
 * etmek zorundayız. Kabul edilen bir bedel, ve karşılığında iki önlem:
 *
 *   1. HIZ SINIRI — liste hâlinde adres taramayı pratik olmaktan çıkarıyor
 *   2. Soru metni dışında HİÇBİR ŞEY dönmüyor — ad, kullanıcı adı yok
 *
 * Alternatif (her zaman sahte bir soru göstermek) sayımı engellerdi ama
 * gerçek kullanıcıyı hiç bilmediği bir soruyla baş başa bırakırdı.
 */
export async function getSecurityQuestion(email: string) {
  const limit = hit(`sq-lookup:${email}`, SORU_SORMA_LIMITI, SORU_PENCERESI_MS);
  if (!limit.ok) throw new TooManyAttemptsError(limit.retryAfterSeconds);

  const user = await findUserSecurity(email);

  if (!user) throw new UserNotFoundError();
  if (user.securityQuestion === null || user.securityAnswerHash === null) {
    throw new NoSecurityQuestionError();
  }

  return { question: user.securityQuestion };
}

/**
 * 2. adım — cevabı doğrular ve şifreyi değiştirir.
 *
 * ⚠️ BU FONKSİYON BİR GÜVENLİK AÇIĞINI KAPATIYOR.
 *
 * Önceki hâli yalnızca `{ email, password }` alıyordu ve kimliği HİÇ
 * doğrulamıyordu: bir e-posta adresini bilen herkes o hesabın şifresini
 * değiştirebiliyordu. Uçta `requireAccessToken` yoktu, jeton yoktu, eski
 * şifre sorulmuyordu. Tek kontrol "yeni şifre eskisiyle aynı mı" idi —
 * yani saldırgana "bildiğin şifreyi değil, başka bir şey yaz" diyordu.
 *
 * Artık cevap doğrulanmadan hiçbir yazma işlemi olmuyor.
 */
export async function resetUserPassword(input: ResetWithAnswerBody) {
  /*
    ⚠️ HIZ SINIRI EN BAŞTA — veritabanına gitmeden önce.
    Sonra koysaydık, sınıra takılan istek yine de sorgu çalıştırırdı ve
    hız sınırı veritabanını korumazdı.
  */
  const limit = hit(`sq-reset:${input.email}`, CEVAP_DENEME_LIMITI, CEVAP_PENCERESI_MS);
  if (!limit.ok) throw new TooManyAttemptsError(limit.retryAfterSeconds);

  const user = await findUserSecurity(input.email);

  if (!user) throw new UserNotFoundError();
  if (user.securityQuestion === null || user.securityAnswerHash === null) {
    throw new NoSecurityQuestionError();
  }

  const answerOk = await argon2.verify(
    user.securityAnswerHash,
    normalizeAnswer(input.answer),
  );
  if (!answerOk) throw new WrongSecurityAnswerError();

  /*
    ⚠️ "Eski şifreyle aynı" kontrolü ARTIK CEVAPTAN SONRA.
    Önce yapılsaydı, cevabı bilmeyen biri bile bir şifre denemesi
    göndererek "bu, hesabın mevcut şifresi mi?" sorusunu sorabilirdi —
    şifre doğrulama ucu hâline gelirdi.

    ⚠️ Google-only hesapta `passwordHash` null: karşılaştıracak eski şifre
    yok, kontrol atlanıyor ve sıfırlama hesaba şifre EKLİYOR.
  */
  if (user.passwordHash !== null) {
    const isSame = await argon2.verify(user.passwordHash, input.password);
    if (isSame) throw new SameAsOldPasswordError();
  }

  const passwordHash = await argon2.hash(input.password);
  await updateUserPasswordById(user.id, passwordHash);
}

/**
 * Giriş yapmış kullanıcı güvenlik sorusunu kurar / değiştirir.
 *
 * ⚠️ CEVAP `argon2` İLE HASH'LENİYOR — ŞİFREYLE AYNI FONKSİYON.
 * Düz metin saklasaydık veritabanı sızıntısında cevaplar okunurdu ve
 * insanlar aynı cevabı başka servislerde de kullandığı için zarar bu
 * uygulamanın dışına taşardı.
 */
export async function setSecurityQuestion(
  userId: string,
  input: SetSecurityQuestionBody,
) {
  const answerHash = await argon2.hash(normalizeAnswer(input.answer));
  const updated = await updateSecurityQuestion({
    userId,
    question: input.question.trim(),
    answerHash,
  });

  if (!updated) throw new UserNotFoundError();
}

/**
 * Google ile giriş / kayıt.
 *
 * ⚠️ EN ZOR KARAR BURADA: AYNI E-POSTAYLA ZATEN BİR HESAP VARSA NE OLACAK?
 *
 * Üç seçenek vardı:
 *
 *   a) Hata ver ("bu e-posta kayıtlı, şifreyle gir")
 *      -> Kullanıcı Google düğmesine basar, reddedilir, şifresini
 *         hatırlamaz ve sıfırlamaya gider. Kötü.
 *
 *   b) İkinci bir hesap aç
 *      -> `email` UNIQUE olduğu için zaten imkânsız; olsaydı da kullanıcı
 *         iki portföyle iki ayrı ligde yarışırdı.
 *
 *   c) OTOMATİK BAĞLA — seçilen yol.
 *      Google e-postayı DOĞRULAMIŞ (`email_verified` kontrol edildi),
 *      yani bu kişi gerçekten o adresin sahibi. Aynı adres = aynı insan.
 *
 * ⚠️ (c) ANCAK `email_verified` KONTROLÜYLE BİRLİKTE GÜVENLİ. O kontrol
 * olmasaydı biri Google hesabına kurbanın adresini doğrulamadan ekleyip
 * bizdeki hesabı ele geçirirdi. İki karar tek bir bütün: birini alıp
 * diğerini atmak sistemi açar.
 *
 * ⚠️ BAĞLAMA YARIŞA KARŞI KORUNUYOR: `linkGoogleId` yalnızca `google_id`
 * BOŞKEN yazıyor (veritabanı koşulu). Aynı anda iki istek gelse bile
 * ikincisi bağ kuramaz.
 */
export async function loginWithGoogle(idToken: string) {
  const kimlik = await verifyGoogleIdToken(idToken);

  // 1) Bu Google hesabı zaten bağlı mı?
  let user = await findUserByGoogleId(kimlik.sub);

  // 2) Değilse, aynı e-postalı yerel hesabı bağla.
  if (user === null) {
    const mevcut = await findUserByEmail(kimlik.email);

    if (mevcut) {
      const baglandi = await linkGoogleId(mevcut.id, kimlik.sub);
      if (baglandi === null) {
        /*
          ⚠️ Buraya düşmek "bu hesap BAŞKA bir Google hesabına bağlı"
          demek. Sessizce giriş yaptırsaydık, A kişisi B'nin hesabına
          girebilirdi.
        */
        throw new GoogleAuthError(
          'Bu hesap farklı bir Google hesabına bağlı. Şifrenle giriş yap.',
        );
      }
      user = await findUserByGoogleId(kimlik.sub);
    }
  }

  // 3) Hâlâ yoksa yeni kullanıcı aç.
  if (user === null) {
    const refreshToken = createRefreshToken();
    const yeni = await createGoogleUser({
      email: kimlik.email,
      googleId: kimlik.sub,
      firstName: kimlik.firstName,
      lastName: kimlik.lastName,
      username: await benzersizKullaniciAdi(kimlik.email),
      refreshTokenHash: refreshToken.tokenHash,
      refreshTokenExpiresAt: refreshToken.expiresAt,
    });

    return {
      user: {
        id: yeni.id,
        email: yeni.email,
        displayName: yeni.displayName,
        username: yeni.username,
        isEmailVerified: true,
      },
      accessToken: await createAccessToken(yeni.id),
      refreshToken: refreshToken.value,
      isNewUser: true,
    };
  }

  /*
    ⚠️ BAN KONTROLÜ BURADA DA VAR. Yalnızca şifreli girişe koysaydık
    banlı kullanıcı Google düğmesinden içeri girerdi — aynı kapının
    ikinci anahtarı.
  */
  if (user.bannedAt !== null) {
    throw new AccountBannedError(user.banReason);
  }

  const refreshToken = createRefreshToken();
  await addRefreshToken({
    userId: user.id,
    tokenHash: refreshToken.tokenHash,
    expiresAt: refreshToken.expiresAt,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: `${user.firstName} ${user.lastName}`,
      username: user.username,
      isEmailVerified: true,
    },
    accessToken: await createAccessToken(user.id),
    refreshToken: refreshToken.value,
    isNewUser: false,
  };
}

/**
 * E-postadan benzersiz kullanıcı adı üretir.
 *
 * ⚠️ ÇAKIŞMA GERÇEK BİR İHTİMAL: `ahmet@gmail.com` ve `ahmet@outlook.com`
 * aynı tabanı verir. `username` UNIQUE olduğu için ikinci kayıt
 * veritabanı hatasıyla düşerdi ve kullanıcı sebebini anlamazdı.
 *
 * ⚠️ SONSUZ DÖNGÜ YOK: 20 denemeden sonra rastgele son ek. Döngüyü
 * koşulsuz bırakmak, teorik olarak imkânsız bir durumda sunucuyu
 * kilitlemek demektir.
 */
async function benzersizKullaniciAdi(email: string): Promise<string> {
  const taban =
    (email.split('@')[0] ?? 'kullanici')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 20) || 'kullanici';

  if (!(await isUsernameTaken(taban))) return taban;

  for (let i = 2; i <= 20; i++) {
    const aday = `${taban}${i}`;
    if (!(await isUsernameTaken(aday))) return aday;
  }

  return `${taban}${Math.random().toString(36).slice(2, 8)}`;
}
