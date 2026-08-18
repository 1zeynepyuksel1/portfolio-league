import { and, desc, eq, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import { friendships, users } from '../db/schema.js';

// E-posta ile kullanıcı arama
export async function findUserByEmail(email: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      isPublic: users.isPublic,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return user;
}

// İki kullanıcı arasında zaten bir ilişki var mı? (A -> B veya B -> A)
export async function findFriendshipBetweenUsers(userAId: string, userBId: string) {
  const [relation] = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(
          eq(friendships.requesterId, userAId),
          eq(friendships.addresseeId, userBId),
        ),
        and(
          eq(friendships.requesterId, userBId),
          eq(friendships.addresseeId, userAId),
        ),
      ),
    )
    .limit(1);

  return relation;
}

// Yeni arkadaşlık isteği oluşturma
export async function createFriendRequest(requesterId: string, addresseeId: string) {
  const [created] = await db
    .insert(friendships)
    .values({
      requesterId,
      addresseeId,
      status: 'pending',
    })
    .returning();

  if (!created) {
    throw new Error('Arkadaşlık isteği oluşturulamadı.');
  }

  return created;
}

// ID ile arkadaşlık kaydı bulma
export async function findFriendshipById(id: string) {
  const [relation] = await db
    .select()
    .from(friendships)
    .where(eq(friendships.id, id))
    .limit(1);

  return relation;
}

// Arkadaşlık durumunu güncelleme (accepted / blocked)
export async function updateFriendshipStatus(id: string, status: 'accepted' | 'blocked') {
  const [updated] = await db
    .update(friendships)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(eq(friendships.id, id))
    .returning();

  if (!updated) {
    throw new Error('Arkadaşlık durumu güncellenemedi.');
  }

  return updated;
}

// Kabul edilmiş arkadaşları listeleme
export async function getAcceptedFriends(userId: string) {
  // 1. Kullanıcının istek gönderdiği ve kabul edilen arkadaşlar
  const asRequester = await db
    .select({
      friendshipId: friendships.id,
      friendId: users.id,
      displayName: users.displayName,
      email: users.email,
      isPublic: users.isPublic,
      since: friendships.updatedAt,
    })
    .from(friendships)
    .innerJoin(users, eq(friendships.addresseeId, users.id))
    .where(
      and(
        eq(friendships.requesterId, userId),
        eq(friendships.status, 'accepted'),
      ),
    );

  // 2. Kullanıcıya istek gelen ve kabul edilen arkadaşlar
  const asAddressee = await db
    .select({
      friendshipId: friendships.id,
      friendId: users.id,
      displayName: users.displayName,
      email: users.email,
      isPublic: users.isPublic,
      since: friendships.updatedAt,
    })
    .from(friendships)
    .innerJoin(users, eq(friendships.requesterId, users.id))
    .where(
      and(
        eq(friendships.addresseeId, userId),
        eq(friendships.status, 'accepted'),
      ),
    );

  return [...asRequester, ...asAddressee];
}

// Bekleyen gelen ve giden istekleri listeleme
export async function getPendingRequests(userId: string) {
  // Gelen istekler (Kullanıcının onaylaması gerekenler)
  const incoming = await db
    .select({
      requestId: friendships.id,
      senderId: users.id,
      senderDisplayName: users.displayName,
      senderEmail: users.email,
      createdAt: friendships.createdAt,
    })
    .from(friendships)
    .innerJoin(users, eq(friendships.requesterId, users.id))
    .where(
      and(
        eq(friendships.addresseeId, userId),
        eq(friendships.status, 'pending'),
      ),
    )
    .orderBy(desc(friendships.createdAt));

  // Giden istekler (Kullanıcının gönderdiği ve karşıdan onay bekleyenler)
  const outgoing = await db
    .select({
      requestId: friendships.id,
      recipientId: users.id,
      recipientDisplayName: users.displayName,
      recipientEmail: users.email,
      createdAt: friendships.createdAt,
    })
    .from(friendships)
    .innerJoin(users, eq(friendships.addresseeId, users.id))
    .where(
      and(
        eq(friendships.requesterId, userId),
        eq(friendships.status, 'pending'),
      ),
    )
    .orderBy(desc(friendships.createdAt));

  return { incoming, outgoing };
}

// Arkadaşlığı veya isteği silme
export async function deleteFriendship(id: string) {
  const [deleted] = await db
    .delete(friendships)
    .where(eq(friendships.id, id))
    .returning({ id: friendships.id });

  return deleted;
}
