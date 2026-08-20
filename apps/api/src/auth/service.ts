import argon2 from 'argon2';
import {
  addRefreshToken,
  createUserWithAccount,
  findUserByEmail,
  findUserForLogin,
  revokeRefreshToken,
  rotateRefreshToken,
} from './repository.js';
import type { LoginBody } from './login.schema.js';
import type { RegisterBody } from './register.schema.js';
import type { RefreshBody } from './refresh.schema.js';
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

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

export async function registerUser(input: RegisterBody) {
  const existingUser = await findUserByEmail(input.email);

  if (existingUser) {
    throw new EmailAlreadyInUseError();
  }

  const passwordHash = await argon2.hash(input.password);
  const refreshToken = createRefreshToken();

  try {
    const user = await createUserWithAccount({
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      username: input.username,
      refreshTokenHash: refreshToken.tokenHash,
      refreshTokenExpiresAt: refreshToken.expiresAt,
    });

    const accessToken = await createAccessToken(user.id);

    return {
      user,
      accessToken,
      refreshToken: refreshToken.value,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new EmailAlreadyInUseError();
    }

    throw error;
  }
}

export async function loginUser(input: LoginBody) {
  const user = await findUserForLogin(input.email);

  if (!user || !(await argon2.verify(user.passwordHash, input.password))) {
    throw new InvalidCredentialsError();
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
