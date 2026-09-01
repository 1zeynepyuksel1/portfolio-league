import { desc, eq, ilike, isNotNull, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { posts } from '../posts/schema.js';

/**
 * admin/service.ts — moderasyon işlemleri.
 *
 * ⚠️ BU MODÜL BİLEREK DAR. Yönetici paneli "her şeyi yapabilen" bir yer
 * değil; üç işi var: kullanıcı listele, banla/kaldır, gönderi sil.
 *
 * Gerekçe: yönetim uçları saldırganın en çok istediği uçlardır. Yüzey ne
 * kadar küçükse o kadar iyi. "İleride lazım olur" diye eklenen her uç,
 * bugünden itibaren korunması gereken bir kapıdır.
 *
 * ⚠️ BAKİYE DÜZENLEME KASITEN YOK. Yönetici birinin parasını
 * değiştirebilseydi lig adaleti tek bir tıkla biterdi ve bunun izi
 * `cash_movements`'ta bir "yönetici düzeltmesi" olarak görünmezdi.
 */

export class AdminTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminTargetError';
  }
}

/** Kullanıcı listesi — arama isteğe bağlı. */
export async function listUsers(query: string, limit = 50) {
  const temiz = query.trim();

  const base = db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      bannedAt: users.bannedAt,
      banReason: users.banReason,
      createdAt: users.createdAt,
    })
    .from(users);

  /*
    ⚠️ `ilike` + `%...%` — küçük veri için doğru, büyük veri için değil.
    Baştan joker kullanmak indeks taramasını imkânsız kılıyor; kullanıcı
    sayısı büyüdüğünde tam metin araması ya da trigram indeksi gerekir.
    Bugün onlarca kullanıcı var; erken iyileştirme yapmıyoruz ama sınırı
    biliyoruz.
  */
  const rows = temiz === ''
    ? await base.orderBy(desc(users.createdAt)).limit(limit)
    : await base
        .where(
          or(
            ilike(users.username, `%${temiz}%`),
            ilike(users.email, `%${temiz}%`),
            ilike(users.firstName, `%${temiz}%`),
            ilike(users.lastName, `%${temiz}%`),
          ),
        )
        .orderBy(desc(users.createdAt))
        .limit(limit);

  return rows;
}

/**
 * Kullanıcıyı banlar.
 *
 * ⚠️ YÖNETİCİ KENDİNİ BANLAYAMAZ. Teknik olarak mümkündü ve tek bir
 * yanlış tıkla sistemde hiç yönetici kalmayabilirdi — geri dönüşü
 * yalnızca doğrudan veritabanına girmek olurdu.
 *
 * ⚠️ BAŞKA BİR YÖNETİCİ DE BANLANAMAZ. Yöneticiler birbirini
 * kilitleyebilseydi, ele geçirilen tek bir yönetici hesabı diğerlerini
 * susturup ortalığı temizleyebilirdi.
 */
export async function banUser(actorId: string, targetId: string, reason: string) {
  if (actorId === targetId) {
    throw new AdminTargetError('Kendini banlayamazsın.');
  }

  const [target] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);

  if (target === undefined) throw new AdminTargetError('Kullanıcı bulunamadı.');
  if (target.role === 'admin') {
    throw new AdminTargetError('Yöneticiler banlanamaz.');
  }

  await db
    .update(users)
    .set({ bannedAt: new Date(), banReason: reason.trim().slice(0, 280) })
    .where(eq(users.id, targetId));
}

/**
 * Banı kaldırır.
 *
 * ⚠️ `banReason` DA TEMİZLENİYOR. Bırakılsaydı hesap açık ama sebep
 * dolu kalırdı; ileride "sebebi olan = banlı" varsayan bir kod yazan
 * kişi yanlış sonuca varırdı. Tek doğruluk kaynağı `bannedAt`.
 */
export async function unbanUser(targetId: string) {
  await db
    .update(users)
    .set({ bannedAt: null, banReason: null })
    .where(eq(users.id, targetId));
}

/**
 * Kullanıcı adından kimlik.
 *
 * ⚠️ NEDEN GEREKLİ: profil ekranı BAŞKASININ kimliğini bilmiyor.
 * `getPublicProfile` bilerek `id` döndürmüyor — dışarı sızması gereken
 * bir alan değil. Yönetici profilden banlarken elinde yalnızca kullanıcı
 * adı var.
 *
 * ⚠️ ÇÖZÜM "profile id ekle" DEĞİL. Öyle yapsaydık HER kullanıcının
 * kimliği herkese açık bir uçtan dağılırdı; oysa yalnızca yöneticinin
 * ihtiyacı var. Çeviriyi yetkili tarafta yapmak yüzeyi büyütmüyor.
 */
export async function findUserIdByUsername(username: string): Promise<string> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (row === undefined) throw new AdminTargetError('Kullanıcı bulunamadı.');
  return row.id;
}

/** Banlı kullanıcılar — panelin ilk açılışında gösterilen liste. */
export async function listBannedUsers() {
  return db
    .select({
      id: users.id,
      username: users.username,
      bannedAt: users.bannedAt,
      banReason: users.banReason,
    })
    .from(users)
    .where(isNotNull(users.bannedAt))
    .orderBy(desc(users.bannedAt));
}

/** Moderasyon için son gönderiler — sahibiyle birlikte. */
export async function listRecentPosts(limit = 50) {
  const rows = await db
    .select({
      id: posts.id,
      type: posts.type,
      caption: posts.caption,
      visibility: posts.visibility,
      createdAt: posts.createdAt,
      username: users.username,
      userId: users.id,
      bannedAt: users.bannedAt,
    })
    .from(posts)
    .leftJoin(users, eq(posts.userId, users.id))
    .orderBy(desc(posts.createdAt))
    .limit(limit);

  return rows;
}

/**
 * Gönderiyi siler — SAHİBİ KİM OLURSA OLSUN.
 *
 * ⚠️ `posts/service.ts`'teki `deletePost` SAHİPLİK ARIYOR (`userId`
 * eşleşmeli) ve bu doğru: normal kullanıcı yalnızca kendi gönderisini
 * silebilmeli. Yönetici için ayrı bir fonksiyon var çünkü aynı
 * fonksiyona "sahiplik kontrolünü atla" bayrağı eklemek, o bayrağın bir
 * gün yanlışlıkla `true` geçilmesi demektir.
 *
 * İki ayrı fonksiyon, iki ayrı yetki. Karıştırılamaz.
 */
export async function adminDeletePost(postId: string) {
  const [deleted] = await db
    .delete(posts)
    .where(eq(posts.id, postId))
    .returning({ id: posts.id });

  if (deleted === undefined) throw new AdminTargetError('Gönderi bulunamadı.');
}

/** Panel başlığındaki sayılar. */
export async function getAdminStats() {
  const [u] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  const [b] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(isNotNull(users.bannedAt));
  const [p] = await db.select({ n: sql<number>`count(*)::int` }).from(posts);

  return {
    totalUsers: u?.n ?? 0,
    bannedUsers: b?.n ?? 0,
    totalPosts: p?.n ?? 0,
  };
}

/**
 * Bir kullanıcıyı yönetici yapar / yöneticiliğini alır.
 *
 * ⚠️ BU FONKSİYON UÇTAN ERİŞİLEBİLİR DEĞİL — yalnızca betikten çağrılıyor.
 *
 * "Yönetici atama" ucunu açsaydık, ele geçirilen bir yönetici hesabı
 * kendine kalıcı arka kapılar açabilirdi. İlk yönetici ve sonrakiler
 * doğrudan veritabanından/betikten atanıyor; nadir bir işlem için
 * kalıcı bir kapı açmaya değmez.
 */
export async function setUserRole(username: string, role: 'user' | 'admin') {
  const [updated] = await db
    .update(users)
    .set({ role })
    .where(eq(users.username, username))
    .returning({ id: users.id, username: users.username, role: users.role });

  if (updated === undefined) throw new AdminTargetError('Kullanıcı bulunamadı.');
  return updated;
}
