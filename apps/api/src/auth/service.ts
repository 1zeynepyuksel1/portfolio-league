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
  updateUserPassword,
} from './repository.js';
import type { LoginBody } from './login.schema.js';
import type { RegisterBody } from './register.schema.js';
import type { RefreshBody } from './refresh.schema.js';
import type { ResetPasswordBody } from './reset-password.schema.js';
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

    console.log(`[E-POSTA SİMÜLATÖRÜ] ${input.email} adresine doğrulama kodu gönderildi: ${verificationCode}`);

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        username: user.username,
        isEmailVerified: false,
      },
      requiresVerification: true,
      demoCode: verificationCode,
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

export async function loginUser(input: LoginBody) {
  const user = await findUserForLogin(input.email);

  if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
    throw new InvalidCredentialsError();
  }

  if (!user.isEmailVerified) {
    throw new EmailNotVerifiedError(user.id);
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

export async function resetUserPassword(input: ResetPasswordBody) {
  const user = await findUserByEmail(input.email);

  if (!user) {
    throw new UserNotFoundError();
  }

  const passwordHash = await argon2.hash(input.password);
  await updateUserPassword(input.email, passwordHash);
}
