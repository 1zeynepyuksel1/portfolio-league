import { and, desc, eq, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import { friendships, users } from '../db/schema.js';

// E-posta ile kullanıcı arama
export async function findUserByEmail(email: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      isPublic: users.isPublic,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    displayName: `${user.firstName} ${user.lastName}`,
    isPublic: user.isPublic,
  };
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
      firstName: users.firstName,
      lastName: users.lastName,
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
      firstName: users.firstName,
      lastName: users.lastName,
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

  const mappedRequester = asRequester.map((row) => ({
    friendshipId: row.friendshipId,
    friendId: row.friendId,
    displayName: `${row.firstName} ${row.lastName}`,
    email: row.email,
    isPublic: row.isPublic,
    since: row.since,
  }));

  const mappedAddressee = asAddressee.map((row) => ({
    friendshipId: row.friendshipId,
    friendId: row.friendId,
    displayName: `${row.firstName} ${row.lastName}`,
    email: row.email,
    isPublic: row.isPublic,
    since: row.since,
  }));

  return [...mappedRequester, ...mappedAddressee];
}

// Bekleyen gelen ve giden istekleri listeleme
export async function getPendingRequests(userId: string) {
  // Gelen istekler (Kullanıcının onaylaması gerekenler)
  const incoming = await db
    .select({
      requestId: friendships.id,
      senderId: users.id,
      senderFirstName: users.firstName,
      senderLastName: users.lastName,
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
      recipientFirstName: users.firstName,
      recipientLastName: users.lastName,
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

  const mappedIncoming = incoming.map((row) => ({
    requestId: row.requestId,
    senderId: row.senderId,
    senderDisplayName: `${row.senderFirstName} ${row.senderLastName}`,
    senderEmail: row.senderEmail,
    createdAt: row.createdAt,
  }));

  const mappedOutgoing = outgoing.map((row) => ({
    requestId: row.requestId,
    recipientId: row.recipientId,
    recipientDisplayName: `${row.recipientFirstName} ${row.recipientLastName}`,
    recipientEmail: row.recipientEmail,
    createdAt: row.createdAt,
  }));

  return { incoming: mappedIncoming, outgoing: mappedOutgoing };
}

// Arkadaşlığı veya isteği silme
export async function deleteFriendship(id: string) {
  const [deleted] = await db
    .delete(friendships)
    .where(eq(friendships.id, id))
    .returning({ id: friendships.id });

  return deleted;
}
