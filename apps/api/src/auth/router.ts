import { Router } from 'express';
import { loginBodySchema } from './login.schema.js';
import { refreshBodySchema } from './refresh.schema.js';
import { registerBodySchema } from './register.schema.js';
import { resendCodeSchema, verifyEmailSchema } from './verify.schema.js';
import {
  EmailAlreadyInUseError,
  EmailNotVerifiedError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  InvalidVerificationCodeError,
  loginUser,
  logoutUser,
  refreshUserSession,
  registerUser,
  resendVerificationCode,
  verifyUserEmail,
} from './service.js';

export const authRouter = Router();

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
