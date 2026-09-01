import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db/client.js';
import { accounts, cashMovements, portfolioSnapshots, refreshTokens, users } from '../db/schema.js';

export async function findUserByEmail(email: string) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return user;
}

export async function findUserByUsername(username: string) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  return user;
}

export async function findUserForLogin(email: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
      passwordHash: users.passwordHash,
      isEmailVerified: users.isEmailVerified,
      /*
        ⚠️ BAN DURUMU GİRİŞ SORGUSUNA EKLENDİ.

        Ban kontrolü `requireAccessToken`'da zaten var ve token'ı anında
        geçersiz kılıyor. Ama GİRİŞ ayrı bir kapı: banlı kullanıcı giriş
        yapabiliyor, geçerli görünen bir token alıyor ve sonra her
        ekranda 403 görüyordu. Ölçüldü — giriş HTTP 200 dönüyordu.

        Teknik olarak güvenli (token hiçbir işe yaramıyor) ama
        kullanılabilirlik açısından bozuk: kullanıcı içeri girdiğini
        sanıp neden hiçbir şeyin çalışmadığını anlamıyordu. Girişte
        durdurmak hem dürüst hem anlaşılır.
      */
      bannedAt: users.bannedAt,
      banReason: users.banReason,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    isEmailVerified: user.isEmailVerified,
    bannedAt: user.bannedAt,
    banReason: user.banReason,
    displayName: `${user.firstName} ${user.lastName}`,
    username: user.username,
  };
}

export async function findUserById(id: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
      isPublic: users.isPublic,
      isEmailVerified: users.isEmailVerified,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    isPublic: user.isPublic,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    displayName: `${user.firstName} ${user.lastName}`,
    username: user.username,
  };
}

export async function findUserVerificationInfo(id: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
      isEmailVerified: users.isEmailVerified,
      verificationCode: users.verificationCode,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    isEmailVerified: user.isEmailVerified,
    verificationCode: user.verificationCode,
    displayName: `${user.firstName} ${user.lastName}`,
    username: user.username,
  };
}

export async function updateVerificationCode(id: string, code: string) {
  await db
    .update(users)
    .set({ verificationCode: code })
    .where(eq(users.id, id));
}

export async function markEmailVerified(id: string) {
  await db
    .update(users)
    .set({ isEmailVerified: true, verificationCode: null })
    .where(eq(users.id, id));
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
  firstName: string;
  lastName: string;
  username: string;
  verificationCode: string;
  refreshTokenHash: string;
  refreshTokenExpiresAt: Date;
}) {
  return db.transaction(async (transaction) => {
    const userValues: typeof users.$inferInsert = {
      email: input.email,
      passwordHash: input.passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      username: input.username,
      isEmailVerified: true,
      verificationCode: input.verificationCode,
    };

    const [user] = await transaction
      .insert(users)
      .values(userValues)
      .returning({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        username: users.username,
        isEmailVerified: users.isEmailVerified,
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

    // 3. İlk portföy snapshot kaydı (100.000 TL = 10000000 kuruş)
    await transaction.insert(portfolioSnapshots).values({
      userId: user.id,
      totalValueCents: 10000000n,
      reason: 'league',
    });

    // 4. İlk refresh token'ı tanımla
    await transaction.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: input.refreshTokenHash,
      expiresAt: input.refreshTokenExpiresAt,
    });

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      isEmailVerified: user.isEmailVerified,
      displayName: `${user.firstName} ${user.lastName}`,
    };
  });
}

export async function updateUserPassword(email: string, passwordHash: string) {
  const [updated] = await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.email, email))
    .returning({ id: users.id });

  return updated;
}

/**
 * Şifre sıfırlama için gereken güvenlik alanları.
 *
 * ⚠️ AYRI BİR FONKSİYON, `findUserForLogin`'e EKLENMEDİ.
 *
 * Giriş akışının güvenlik sorusu hash'ine ihtiyacı yok. Aynı sorguya
 * eklemek onu her girişte belleğe taşırdı; hiçbir yerde kullanılmayan
 * bir sırrı dolaştırmak, kazayla loglanma ihtimalini bedava artırır.
 */
export async function findUserSecurity(email: string) {
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      securityQuestion: users.securityQuestion,
      securityAnswerHash: users.securityAnswerHash,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return row ?? null;
}

/** Güvenlik sorusunu ve hash'lenmiş cevabını yazar. */
export async function updateSecurityQuestion(input: {
  userId: string;
  question: string;
  answerHash: string;
}) {
  const [updated] = await db
    .update(users)
    .set({
      securityQuestion: input.question,
      securityAnswerHash: input.answerHash,
    })
    .where(eq(users.id, input.userId))
    .returning({ id: users.id });

  return updated ?? null;
}

/**
 * Şifreyi KULLANICI KİMLİĞİYLE günceller — e-postayla değil.
 *
 * ⚠️ `updateUserPassword` e-posta alıyor ve o imza sıfırlama akışında
 * tehlikeli: doğrulamayı bir e-posta üzerinde yapıp güncellemeyi başka
 * bir e-postayla çalıştırmak mümkün olurdu. Kimlikle çalışan bu sürümde
 * "kimi doğruladıysak onu güncelliyoruz" bağı kopmuyor.
 */
export async function updateUserPasswordById(userId: string, passwordHash: string) {
  const [updated] = await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  return updated ?? null;
}
