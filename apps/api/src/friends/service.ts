import {
  createFriendRequest,
  deleteFriendship,
  findFriendshipBetweenUsers,
  findFriendshipById,
  findUserByEmail,
  findUserByUsername,
  getAcceptedFriends,
  getPendingRequests,
  updateFriendshipStatus,
} from './repository.js';

// Özel Hata Sınıfları
export class FriendshipError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = 'FriendshipError';
  }
}

export class CannotFriendSelfError extends FriendshipError {
  constructor() {
    super('Kendinize arkadaşlık isteği gönderemezsiniz.', 'CANNOT_FRIEND_SELF', 400);
  }
}

export class UserNotFoundError extends FriendshipError {
  constructor() {
    super('Belirtilen e-posta adresine sahip kullanıcı bulunamadı.', 'USER_NOT_FOUND', 404);
  }
}

export class AlreadyFriendsError extends FriendshipError {
  constructor() {
    super('Bu kullanıcıyla zaten arkadaşsınız.', 'ALREADY_FRIENDS', 409);
  }
}

export class FriendRequestAlreadyPendingError extends FriendshipError {
  constructor() {
    super('Bu kullanıcıyla aranızda zaten bekleyen bir arkadaşlık isteği var.', 'FRIEND_REQUEST_PENDING', 409);
  }
}

export class FriendshipNotFoundError extends FriendshipError {
  constructor() {
    super('Arkadaşlık kaydı bulunamadı.', 'FRIENDSHIP_NOT_FOUND', 404);
  }
}

export class UnauthorizedFriendActionError extends FriendshipError {
  constructor() {
    super('Bu arkadaşlık işlemi için yetkiniz yok.', 'UNAUTHORIZED_FRIEND_ACTION', 403);
  }
}

// Arkadaşlık İsteği Gönderme
/**
 * Arkadaşlık isteği gönderir.
 *
 * `addressee` KULLANICI ADI ya da E-POSTA olabilir; ayrım burada
 * yapılıyor. Ölçüt "@" içeriyor mu: kullanıcı adlarında bu karakter
 * yok, e-posta adreslerinde her zaman var.
 */
export async function sendFriendRequest(requesterId: string, addressee: string) {
  // 1. Hedef kullanıcıyı bul — girilen değerin biçimine göre.
  const targetUser = addressee.includes('@')
    // ⚠️ E-postada DÜZ `toLowerCase()`: adresler ASCII, Türkçe yerel
    // burada "I" harfini "ı" yapıp adresi bozardı.
    ? await findUserByEmail(addressee.toLowerCase())
    // Kullanıcı adı olduğu gibi geçiyor; karşılaştırma sorguda harf
    // duyarsız yapılıyor.
    : await findUserByUsername(addressee);
  if (!targetUser) {
    throw new UserNotFoundError();
  }

  // 2. Kendine istek atamaz
  if (targetUser.id === requesterId) {
    throw new CannotFriendSelfError();
  }

  // 3. Mevcut ilişkiyi kontrol et
  const existing = await findFriendshipBetweenUsers(requesterId, targetUser.id);
  if (existing) {
    if (existing.status === 'accepted') {
      throw new AlreadyFriendsError();
    }
    if (existing.status === 'pending') {
      throw new FriendRequestAlreadyPendingError();
    }
    if (existing.status === 'blocked') {
      throw new FriendshipError('Bu kullanıcıyla bağlantı kurulamaz.', 'BLOCKED_RELATION', 403);
    }
  }

  // 4. İsteği oluştur
  const request = await createFriendRequest(requesterId, targetUser.id);
  return {
    request,
    targetUser: {
      id: targetUser.id,
      displayName: targetUser.displayName,
      email: targetUser.email,
    },
  };
}

// Gelen İsteği Kabul Etme
export async function acceptFriendRequest(userId: string, requestId: string) {
  const friendship = await findFriendshipById(requestId);
  if (!friendship) {
    throw new FriendshipNotFoundError();
  }

  // Sadece isteği alan kişi kabul edebilir
  if (friendship.addresseeId !== userId) {
    throw new UnauthorizedFriendActionError();
  }

  if (friendship.status === 'accepted') {
    throw new AlreadyFriendsError();
  }

  return updateFriendshipStatus(requestId, 'accepted');
}

// Gelen İsteği Reddetme
export async function rejectFriendRequest(userId: string, requestId: string) {
  const friendship = await findFriendshipById(requestId);
  if (!friendship) {
    throw new FriendshipNotFoundError();
  }

  // Sadece isteği alan kişi reddedebilir
  if (friendship.addresseeId !== userId) {
    throw new UnauthorizedFriendActionError();
  }

  return deleteFriendship(requestId);
}

// Arkadaşları Listeleme
export async function listFriends(userId: string) {
  return getAcceptedFriends(userId);
}

// Bekleyen İstekleri Listeleme (Gelen ve Giden)
export async function listPendingRequests(userId: string) {
  return getPendingRequests(userId);
}

// Arkadaşlıktan Çıkarma veya Gönderilen İsteği İptal Etme
export async function removeFriendOrRequest(userId: string, friendshipId: string) {
  const friendship = await findFriendshipById(friendshipId);
  if (!friendship) {
    throw new FriendshipNotFoundError();
  }

  // Sadece bu arkadaşlığın taraflarından biri silebilir
  if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
    throw new UnauthorizedFriendActionError();
  }

  return deleteFriendship(friendshipId);
}
