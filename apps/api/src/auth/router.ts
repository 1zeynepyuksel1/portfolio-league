/*
  ⚠️ `Response` EXPRESS'TEN AÇIKÇA ALINIYOR — yoksa TypeScript onu
  tarayıcının global `Response` tipine bağlar ve `res.status()` /
  `res.setHeader()` "bu ifade çağrılabilir değil" hatası verir. Hata
  mesajı sebebi hiç söylemiyor; bir kez görüp bilmek gerekiyor.
*/
import { Router, type Response } from 'express';
import { requireAccessToken } from './middleware.js';
import { GoogleAuthError, isGoogleEnabled } from './google.js';
import { loginBodySchema } from './login.schema.js';
import { refreshBodySchema } from './refresh.schema.js';
import { registerBodySchema } from './register.schema.js';
import { resendCodeSchema, verifyEmailSchema } from './verify.schema.js';
import {
  resetWithAnswerSchema,
  securityQuestionLookupSchema,
  setSecurityQuestionSchema,
} from './security-question.schema.js';
import {
  EmailAlreadyInUseError,
  UsernameAlreadyInUseError,
  EmailNotVerifiedError,
  InvalidCredentialsError,
  AccountBannedError,
  loginWithGoogle,
  InvalidRefreshTokenError,
  InvalidVerificationCodeError,
  loginUser,
  logoutUser,
  refreshUserSession,
  registerUser,
  resendVerificationCode,
  verifyUserEmail,
  resetUserPassword,
  getSecurityQuestion,
  setSecurityQuestion,
  NoSecurityQuestionError,
  WrongSecurityAnswerError,
  TooManyAttemptsError,
  UserNotFoundError,
  SameAsOldPasswordError,
} from './service.js';

export const authRouter = Router();

/**
 * Beklenmeyen bir hatayı SUNUCU LOG'UNA yazar.
 *
 * ⚠️ BU FONKSİYON BİR HATA AYIKLAMA OTURUMUNUN BEDELİYDİ.
 * `catch` blokları 500 döndürüyor ama hatayı hiçbir yere yazmıyordu.
 * Sonuç: kayıt ve giriş 500 verirken ne tarayıcı konsolunda ne sunucu
 * terminalinde tek bir ipucu yoktu. Sebebi bulmak, aynı kodu ayrı bir
 * portta çalıştırıp karşılaştırmayı gerektirdi.
 *
 * KURAL: 500 dönen her yer hatayı log'lamalı. 500 zaten "bilmiyorum"
 * demek; onu sessizce demek, sorunu görünmez kılıyor.
 *
 * ⚠️ İSTEMCİYE GİDEN MESAJ DEĞİŞMİYOR — bilerek.
 * Yığın izi (stack trace) ve veritabanı kısıt adları saldırgana şemayı
 * anlatır. Ayrıntı sunucuda kalır, istemci genel mesajı görür.
 */
function logUnexpected(scope: string, error: unknown): void {
  console.error(
    `[auth/${scope}] beklenmeyen hata:`,
    error instanceof Error ? (error.stack ?? error.message) : error,
  );

  // Postgres hataları `cause` altında ayrıntı taşıyor (kısıt adı, kolon).
  // `instanceof Error` bunları yakalamıyor, ayrıca basıyoruz.
  const cause = (error as { cause?: unknown })?.cause;
  if (cause !== undefined) {
    console.error(`[auth/${scope}] sebep:`, cause);
  }
}

authRouter.post('/register', async (request, response) => {
  const parsedBody = registerBodySchema.safeParse(request.body);

  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Gönderilen kayıt bilgileri geçersiz.',
        details: parsedBody.error.flatten(),
      },
    });
  }

  try {
    const registration = await registerUser(parsedBody.data);

    return response.status(201).json(registration);
  } catch (error) {
    if (error instanceof EmailAlreadyInUseError) {
      return response.status(409).json({
        error: {
          code: 'EMAIL_ALREADY_IN_USE',
          message: error.message,
        },
      });
    }

    if (error instanceof UsernameAlreadyInUseError) {
      return response.status(409).json({
        error: {
          code: 'USERNAME_ALREADY_IN_USE',
          message: error.message,
        },
      });
    }

    logUnexpected('register', error);

    return response.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Kayıt oluşturulurken beklenmeyen bir hata oluştu.',
      },
    });
  }
});

authRouter.post('/verify-email', async (request, response) => {
  const parsedBody = verifyEmailSchema.safeParse(request.body);

  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Geçersiz 6 haneli doğrulama kodu.',
        details: parsedBody.error.flatten(),
      },
    });
  }

  try {
    const result = await verifyUserEmail(parsedBody.data.userId, parsedBody.data.code);

    return response.status(200).json({
      ...result,
      tokenType: 'Bearer',
    });
  } catch (error) {
    if (error instanceof InvalidVerificationCodeError) {
      return response.status(400).json({
        error: {
          code: 'INVALID_VERIFICATION_CODE',
          message: error.message,
        },
      });
    }

    return response.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'E-posta doğrulanırken bir hata oluştu.',
      },
    });
  }
});

authRouter.post('/resend-code', async (request, response) => {
  const parsedBody = resendCodeSchema.safeParse(request.body);

  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Geçersiz kullanıcı kimliği.',
      },
    });
  }

  try {
    const result = await resendVerificationCode(parsedBody.data.userId);
    return response.status(200).json(result);
  } catch (error) {
    return response.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Doğrulama kodu tekrar gönderilemedi.',
      },
    });
  }
});

authRouter.post('/login', async (request, response) => {
  const parsedBody = loginBodySchema.safeParse(request.body);

  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Gönderilen giriş bilgileri geçersiz.',
        details: parsedBody.error.flatten(),
      },
    });
  }

  try {
    const session = await loginUser(parsedBody.data);

    return response.status(200).json({
      ...session,
      tokenType: 'Bearer',
    });
  } catch (error) {
    if (error instanceof EmailNotVerifiedError) {
      return response.status(403).json({
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: error.message,
          userId: error.userId,
        },
      });
    }

    if (error instanceof InvalidCredentialsError) {
      return response.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: error.message,
        },
      });
    }

    /*
      ⚠️ 403, 401 DEĞİL. 401 "kim olduğunu kanıtlayamadın" demek ve
      istemci şifreyi yeniden sorar; oysa kimlik doğru, YETKİ yok.
      403 ile istemci doğru davranıyor: mesajı gösterip duruyor.
    */
    if (error instanceof AccountBannedError) {
      return response.status(403).json({
        error: {
          code: 'ACCOUNT_BANNED',
          message: error.message,
        },
      });
    }

    logUnexpected('login', error);

    return response.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Giriş yapılırken beklenmeyen bir hata oluştu.',
      },
    });
  }
});

authRouter.post('/refresh', async (request, response) => {
  const parsedBody = refreshBodySchema.safeParse(request.body);

  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Refresh token gereklidir.',
        details: parsedBody.error.flatten(),
      },
    });
  }

  try {
    const session = await refreshUserSession(parsedBody.data);

    return response.status(200).json(session);
  } catch (error) {
    if (error instanceof InvalidRefreshTokenError) {
      return response.status(401).json({
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: error.message,
        },
      });
    }

    logUnexpected('refresh', error);

    return response.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Oturum yenilenirken beklenmeyen bir hata oluştu.',
      },
    });
  }
});

authRouter.post('/logout', async (request, response) => {
  const parsedBody = refreshBodySchema.safeParse(request.body);

  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Refresh token gereklidir.',
        details: parsedBody.error.flatten(),
      },
    });
  }

  await logoutUser(parsedBody.data);
  return response.status(204).send();
});

/*
  ⚠️ BU BLOK BİR HESAP ELE GEÇİRME AÇIĞINI KAPATIYOR.

  Eski `/reset-password` ucu `{ email, password, confirmPassword }` alıyor
  ve şifreyi DEĞİŞTİRİYORDU. `requireAccessToken` yoktu, jeton yoktu, eski
  şifre sorulmuyordu. Yani bir e-posta adresini bilen herkes o hesabın
  şifresini değiştirebiliyordu.

  Akış artık iki adım:

    1. POST /auth/forgot-password/question  { email }     -> { question }
    2. POST /auth/reset-password  { email, answer, password, confirmPassword }

  Cevap doğrulanmadan hiçbir yazma yapılmıyor.
*/

/**
 * Google ile giriş / kayıt.
 *
 * ⚠️ İSTEMCİDEN GELEN TEK ŞEY `idToken`. Ad, e-posta, resim gibi hiçbir
 * profil alanı KABUL EDİLMİYOR — hepsi Google'a doğrulatılan jetondan
 * okunuyor. İstemcinin gönderdiği e-postaya güvenseydik, herhangi biri
 * istediği hesaba girerdi.
 *
 * ⚠️ KENDİ JWT AUTH'UMUZ YERİNİ KORUYOR. Bu uç Google'ı doğruladıktan
 * sonra BİZİM access/refresh token'ımızı üretiyor; uygulamanın geri
 * kalanı Google'ı hiç bilmiyor. Google yalnızca bir GİRİŞ YOLU, kimlik
 * sisteminin kendisi değil (docs/01-plan.md'deki kilitli karar böyle
 * korunuyor).
 */
authRouter.post('/google', async (request, response) => {
  if (!isGoogleEnabled()) {
    /*
      ⚠️ 501: "yapılandırılmamış" ile "reddedildi" ayrı şeyler.
      400 dönseydik istemci jetonu hatalı sanıp tekrar denerdi.
    */
    return response.status(501).json({
      error: {
        code: 'GOOGLE_NOT_CONFIGURED',
        message: 'Google girişi bu sunucuda yapılandırılmamış.',
      },
    });
  }

  const idToken = request.body?.idToken;

  if (typeof idToken !== 'string' || idToken.trim() === '') {
    return response.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'idToken gerekli.' },
    });
  }

  try {
    const result = await loginWithGoogle(idToken);
    return response.status(200).json(result);
  } catch (error) {
    if (error instanceof GoogleAuthError) {
      return response.status(401).json({
        error: { code: 'GOOGLE_AUTH_FAILED', message: error.message },
      });
    }

    if (error instanceof AccountBannedError) {
      return response.status(403).json({
        error: { code: 'ACCOUNT_BANNED', message: error.message },
      });
    }

    logUnexpected('google-login', error);
    return response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Google girişi başarısız.' },
    });
  }
});

authRouter.post('/forgot-password/question', async (request, response) => {
  const parsed = securityQuestionLookupSchema.safeParse(request.body);

  if (!parsed.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Geçerli bir e-posta adresi giriniz.',
        details: parsed.error.flatten(),
      },
    });
  }

  try {
    const result = await getSecurityQuestion(parsed.data.email);
    return response.status(200).json(result);
  } catch (error) {
    return handleSecurityError(error, response, 'forgot-password/question');
  }
});

authRouter.post('/reset-password', async (request, response) => {
  const parsedBody = resetWithAnswerSchema.safeParse(request.body);

  if (!parsedBody.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Gönderilen şifre sıfırlama bilgileri geçersiz.',
        details: parsedBody.error.flatten(),
      },
    });
  }

  try {
    await resetUserPassword(parsedBody.data);

    return response.status(200).json({
      success: true,
      message: 'Şifreniz başarıyla güncellendi.',
    });
  } catch (error) {
    return handleSecurityError(error, response, 'reset-password');
  }
});

/**
 * Güvenlik sorusunu kurma / değiştirme — GİRİŞ YAPMIŞ KULLANICI.
 *
 * ⚠️ `requireAccessToken` BURADA ZORUNLU. Olmasaydı, saldırgan kurbanın
 * güvenlik sorusunu KENDİ bildiği bir soruyla değiştirip sonra sıfırlama
 * akışını çalıştırırdı — kapattığımız açığın birebir aynısı, arka kapıdan.
 */
authRouter.put('/security-question', requireAccessToken, async (request, response) => {
  const parsed = setSecurityQuestionSchema.safeParse(request.body);

  if (!parsed.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Güvenlik sorusu bilgileri geçersiz.',
        details: parsed.error.flatten(),
      },
    });
  }

  try {
    await setSecurityQuestion(response.locals.userId as string, parsed.data);
    return response.status(200).json({ success: true });
  } catch (error) {
    return handleSecurityError(error, response, 'security-question');
  }
});

/**
 * Güvenlik akışlarının ortak hata çevirisi.
 *
 * ⚠️ TEK YERDE: üç uç da aynı hataları fırlatıyor. Her uçta ayrı ayrı
 * çevirseydik biri eksik kalır ve o uç 500 dönerdi — hata mesajları
 * güvenlik akışında kullanıcıyı yönlendiren tek şey.
 */
function handleSecurityError(error: unknown, response: Response, etiket: string) {
  if (error instanceof TooManyAttemptsError) {
    /*
      ⚠️ 429 + `Retry-After` — doğru durum kodu ÖNEMLİ. 400 dönseydik
      istemci "girdim yanlış" sanıp kullanıcıya cevabını tekrar
      yazdırırdı; oysa sorun cevap değil, beklemesi gerektiği.
    */
    response.setHeader('Retry-After', String(error.retryAfterSeconds));
    return response.status(429).json({
      error: {
        code: 'TOO_MANY_ATTEMPTS',
        message: error.message,
        retryAfterSeconds: error.retryAfterSeconds,
      },
    });
  }

  if (error instanceof WrongSecurityAnswerError) {
    return response.status(400).json({
      error: { code: 'WRONG_SECURITY_ANSWER', message: error.message },
    });
  }

  if (error instanceof NoSecurityQuestionError) {
    return response.status(409).json({
      error: { code: 'NO_SECURITY_QUESTION', message: error.message },
    });
  }

  if (error instanceof UserNotFoundError) {
    return response.status(404).json({
      error: { code: 'USER_NOT_FOUND', message: error.message },
    });
  }

  if (error instanceof SameAsOldPasswordError) {
    return response.status(400).json({
      error: { code: 'SAME_AS_OLD_PASSWORD', message: error.message },
    });
  }

  logUnexpected(etiket, error);

  return response.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Beklenmeyen bir hata oluştu.',
    },
  });
}

