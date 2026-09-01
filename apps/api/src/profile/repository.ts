import { db } from '../db/client.js';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema.js';

/** Profil bilgisini tutan DTO. */
export type ProfileUser = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  isPublic: boolean;
  /**
   * Varlık dağılımını kim görebilir: 'private' | 'friends' | 'public'.
   */
  allocationVisibility: string;
  avatarSeed: string | null;
  avatarStyle: string | null;
};

/** Kullanıcı adından profil sahibi. Bulunamazsa null. */
export async function getProfileByUsername(username: string): Promise<ProfileUser | null> {
  const [u] = await db.select({
    id: users.id,
    username: users.username,
    firstName: users.firstName,
    lastName: users.lastName,
    isPublic: users.isPublic,
    allocationVisibility: users.allocationVisibility,
    avatarSeed: users.avatarSeed,
    avatarStyle: users.avatarStyle
  }).from(users).where(eq(users.username, username));
  return (u as ProfileUser) || null;
}
