import { createHash, randomBytes } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';

const defaultAccessTokenTtlSeconds = 15 * 60;
const defaultRefreshTokenTtlDays = 30;

function getAuthConfig() {
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error('JWT_ACCESS_SECRET en az 32 karakter olmalıdır.');
  }

  const accessTokenTtlSeconds = Number(
    process.env.JWT_ACCESS_TTL_SECONDS ?? defaultAccessTokenTtlSeconds,
  );
  const refreshTokenTtlDays = Number(
    process.env.JWT_REFRESH_TTL_DAYS ?? defaultRefreshTokenTtlDays,
  );

  if (!Number.isInteger(accessTokenTtlSeconds) || accessTokenTtlSeconds <= 0) {
    throw new Error('JWT_ACCESS_TTL_SECONDS pozitif bir tam sayı olmalıdır.');
  }

  if (!Number.isInteger(refreshTokenTtlDays) || refreshTokenTtlDays <= 0) {
    throw new Error('JWT_REFRESH_TTL_DAYS pozitif bir tam sayı olmalıdır.');
  }

  return {
    secret,
    accessTokenTtlSeconds,
    refreshTokenTtlDays,
  };
}

export async function createAccessToken(userId: string) {
  const config = getAuthConfig();
  const secretKey = new TextEncoder().encode(config.secret);

  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${config.accessTokenTtlSeconds}s`)
    .sign(secretKey);
}

export async function verifyAccessToken(token: string) {
  const config = getAuthConfig();
  const secretKey = new TextEncoder().encode(config.secret);
  const verified = await jwtVerify(token, secretKey, {
    algorithms: ['HS256'],
  });

  if (!verified.payload.sub) {
    throw new Error('Access token içinde kullanıcı kimliği yok.');
  }

  return verified.payload.sub;
}

export function createRefreshToken() {
  const value = randomBytes(32).toString('base64url');
  const tokenHash = hashRefreshToken(value);
  const config = getAuthConfig();
  const expiresAt = new Date(
    Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  );

  return { value, tokenHash, expiresAt };
}

export function hashRefreshToken(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
