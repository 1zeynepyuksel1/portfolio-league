import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { accounts, cashMovements, refreshTokens, users } from '../db/schema.js';

export async function findUserByEmail(email: string) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return user;
}

export async function findUserForLogin(email: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return user;
}

export async function findUserById(id: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      isPublic: users.isPublic,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  return user;
}

export async function addRefreshToken(input: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}) {
  await db.insert(refreshTokens).values(input);
}

export async function revokeRefreshToken(tokenHash: string) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)),
    );
}

export async function rotateRefreshToken(input: {
  currentTokenHash: string;
  newTokenHash: string;
  newTokenExpiresAt: Date;
}) {
  return db.transaction(async (transaction) => {
    const [currentToken] = await transaction
      .select({ userId: refreshTokens.userId })
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, input.currentTokenHash),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!currentToken) {
      return null;
    }

    const revoked = await transaction
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.tokenHash, input.currentTokenHash),
          isNull(refreshTokens.revokedAt),
        ),
      )
      .returning({ id: refreshTokens.id });

    if (revoked.length === 0) {
      return null;
    }

    await transaction.insert(refreshTokens).values({
      userId: currentToken.userId,
      tokenHash: input.newTokenHash,
      expiresAt: input.newTokenExpiresAt,
    });

    return currentToken;
  });
}

export async function createUserWithAccount(input: {
  email: string;
  passwordHash: string;
  displayName: string;
  refreshTokenHash: string;
  refreshTokenExpiresAt: Date;
}) {
  return db.transaction(async (transaction) => {
    const [user] = await transaction
      .insert(users)
      .values(input)
      .returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
      });

    if (!user) {
      throw new Error('Kullanıcı oluşturulamadı.');
    }

    // 1. 100,000 TL bakiye tanımla (10000000 kuruş)
    await transaction.insert(accounts).values({ userId: user.id });

    // 2. Cüzdan hareket kaydı (audit trail / ekstre)
    await transaction.insert(cashMovements).values({
      userId: user.id,
      kind: 'signup_bonus',
      amountCents: 10000000n,
    });

    // 3. İlk refresh token'ı tanımla
    await transaction.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: input.refreshTokenHash,
      expiresAt: input.refreshTokenExpiresAt,
    });

    return user;
  });
}
