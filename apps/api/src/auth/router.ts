import { Router } from 'express';
import { loginBodySchema } from './login.schema.js';
import { refreshBodySchema } from './refresh.schema.js';
import { registerBodySchema } from './register.schema.js';
import {
  EmailAlreadyInUseError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  loginUser,
  logoutUser,
  refreshUserSession,
  registerUser,
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

    return response.status(201).json({
      user: registration.user,
      tokenType: 'Bearer',
      accessToken: registration.accessToken,
      refreshToken: registration.refreshToken,
    });
  } catch (error) {
    if (error instanceof EmailAlreadyInUseError) {
      return response.status(409).json({
        error: {
          code: 'EMAIL_ALREADY_IN_USE',
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
    if (error instanceof InvalidCredentialsError) {
      return response.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
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
