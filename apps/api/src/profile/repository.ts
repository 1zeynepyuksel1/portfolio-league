import { and, eq, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { friendships, leagueEntries, users } from '../db/schema.js';

/**
 * profile/repository.ts — herkese açık profil için veri okuma.
 *
 * ⚠️ BU DOSYA KASITEN "AZ" OKUYOR.
 *
 * Profil başkasının gözüyle bakılan bir ekran. Buradan dönen her alan
 * dışarı sızabilecek bir alandır. O yüzden sorgular `select *` yapmıyor,
 * gösterilecek alanları TEK TEK sayıyor.
 *
 * Yeni bir kolon eklendiğinde (Zeynep şemaya bir şey eklerse) burası
 * kendiliğinden onu döndürmüyor — birinin bilerek eklemesi gerekiyor.
 * `select *` yazsaydık `password_hash` ya da `verification_code` bir gün
 * sessizce profil yanıtına düşerdi.
 */

export type ProfileUser = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  isPublic: boolean;
  allocationVisibility: string;
  /** 'user' | 'admin' — yönetim paneli düğmesi buna bakıyor. */
  role: string;
  avatarSeed: string | null;
  avatarStyle: string | null;
};

/** Kullanıcı adından profil sahibi. Bulunamazsa `null`. */
export async function findProfileByUsername(
  username: string,
): Promise<ProfileUser | null> {
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      lastName: users.lastName,
      isPublic: users.isPublic,
      allocationVisibility: users.allocationVisibility,
      role: users.role,
      avatarSeed: users.avatarSeed,
      avatarStyle: users.avatarStyle,
    })
    .from(users)
    // ⚠️ Kullanıcı adı benzersiz ve NOT NULL (0008 migration'ı) — o yüzden
    // eşleşme tek satır. Öyle olmasaydı "hangi profil" belirsiz kalırdı.
    .where(eq(users.username, username))
    .limit(1);

  return row ?? null;
}

/**
 * İki kullanıcı ARKADAŞ MI — yalnızca kabul edilmiş ilişki sayılır.
 *
 * ⚠️ `status` KONTROLÜ ŞART. `friendships` tablosunda bekleyen ve
 * engellenmiş ilişkiler de duruyor. Sadece satırın varlığına baksaydık,
 * karşı taraf isteği HENÜZ KABUL ETMEMİŞKEN portföyünü görürdük — istek
 * göndermek görme yetkisi kazandırırdı. Engellenmiş kullanıcı da görürdü.
 */
export async function areFriends(
  viewerId: string,
  ownerId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      and(
        eq(friendships.requesterId, viewerId),
        eq(friendships.addresseeId, ownerId),
        eq(friendships.status, 'accepted'),
      ),
    )
    .limit(1);

  if (row) return true;

  // Ters yön: isteği karşı taraf göndermiş olabilir.
  const [reverse] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      and(
        eq(friendships.requesterId, ownerId),
        eq(friendships.addresseeId, viewerId),
        eq(friendships.status, 'accepted'),
      ),
    )
    .limit(1);

  return reverse !== undefined;
}

/**
 * Aramızda BEKLEYEN bir istek var mı — ve varsa yönü ne.
 *
 * ⚠️ YÖN ÖNEMLİ. "İstek gönderdim, bekliyor" ile "bana istek geldi,
 * onaylamam lazım" ekranda AYNI görünemez: birinde düğme pasif
 * beklemeli, diğerinde "Kabul et" demeli. Tek bir boolean döndürseydik
 * profil ikisini ayırt edemezdi.
 */
export type PendingDirection = 'outgoing' | 'incoming' | null;

export async function pendingBetween(
  viewerId: string,
  ownerId: string,
): Promise<PendingDirection> {
  const [sent] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      and(
        eq(friendships.requesterId, viewerId),
        eq(friendships.addresseeId, ownerId),
        eq(friendships.status, 'pending'),
      ),
    )
    .limit(1);

  if (sent) return 'outgoing';

  const [received] = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(
      and(
        eq(friendships.requesterId, ownerId),
        eq(friendships.addresseeId, viewerId),
        eq(friendships.status, 'pending'),
      ),
    )
    .limit(1);

  return received ? 'incoming' : null;
}

/** Kullanıcının bir lig dönemindeki girişi — sıralama ve TWR. */
export async function findLeagueEntry(periodId: string, userId: string) {
  const [row] = await db
    .select({
      twrPct: leagueEntries.twrPct,
      rank: leagueEntries.rank,
    })
    .from(leagueEntries)
    .where(
      and(
        eq(leagueEntries.periodId, periodId),
        eq(leagueEntries.userId, userId),
      ),
    )
    .limit(1);

  return row ?? null;
}

/** Gizlilik tercihini günceller. */
export async function setProfileVisibility(
  userId: string,
  /*
    ⚠️ `| undefined` AÇIKÇA YAZILIYOR — `exactOptionalPropertyTypes`
    açık olduğu için "alan yok" ile "alan var ama undefined" ayrı
    şeyler sayılıyor. Zod'un çıktısı ikincisi; tip bunu kabul
    etmezse çağıran taraf alanları tek tek ayıklamak zorunda kalırdı.
  */
  ayarlar: { isPublic?: boolean | undefined; allocationVisibility?: string | undefined },
): Promise<void> {
  /*
    ⚠️ İMZA `isPublic: boolean`'DAN NESNEYE ÇEVRİLDİ — VE SEBEBİ BİR
    HATA.

    `allocationVisibility` (portföyü kimler görsün) veritabanında
    vardı, profil ekranında düzenlenebiliyordu, sunucuya
    gönderiliyordu — ama HİÇBİR UÇ ONU YAZMIYORDU:

      PATCH /users/me            -> `updateSchema` alanı tanımıyor,
                                    Zod bilinmeyen anahtarı SESSİZCE atıyor
      PATCH /users/me/visibility -> yalnızca `isPublic` yazıyor

    Sonuç: ayar hiç çalışmadı. 13 kullanıcının 13'ü de `private`
    kaldı — varsayılan olduğu için değil, DEĞİŞTİRİLEMEDİĞİ için.

    ⚠️ HATA HİÇBİR YERDE GÖRÜNMEDİ. İstek 200 dönüyordu, ekran
    "kaydedildi" diyordu, veritabanı değişmiyordu. Zod'un varsayılan
    davranışı bilinmeyen anahtarları atmak; `.strict()` kullanılsaydı
    400 dönerdi ve hata ilk denemede yakalanırdı.

    ⚠️ BOŞ NESNE İLE ÇAĞRILMAMALI — `set({})` Drizzle'da hata verir.
    Çağıran taraf en az bir alan olduğunu doğruluyor (router'daki
    `refine`), burada ayrıca korunuyor.
  */
  const degisiklikler: Record<string, unknown> = {};
  if (ayarlar.isPublic !== undefined) degisiklikler.isPublic = ayarlar.isPublic;
  if (ayarlar.allocationVisibility !== undefined) {
    degisiklikler.allocationVisibility = ayarlar.allocationVisibility;
  }

  if (Object.keys(degisiklikler).length === 0) return;

  await db.update(users).set(degisiklikler).where(eq(users.id, userId));
}

/**
 * Kabul edilmiş arkadaş sayısı.
 *
 * ⚠️ TEK SORGU, İKİ YÖN. Arkadaşlık tek satırda tutuluyor: kim istek
 * gönderdiyse `requester`, kim kabul ettiyse `addressee`. Sayarken iki
 * yönü de dahil etmek gerekiyor — yalnızca birine baksaydık, isteği
 * karşı taraftan gelen arkadaşlar sayılmazdı ve sayı kişiye göre
 * DEĞİŞİRDİ (aynı arkadaşlık birinde görünür, diğerinde görünmez).
 */
export async function countFriends(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'accepted'),
        or(
          eq(friendships.requesterId, userId),
          eq(friendships.addresseeId, userId),
        ),
      ),
    );

  return row?.n ?? 0;
}

/**
 * İki kullanıcının ORTAK arkadaş sayısı.
 *
 * ⚠️ NEDEN VAR: BAŞKASININ ARKADAŞ SAYISI ONUN BİLGİSİ.
 *
 * Bir kullanıcının kaç arkadaşı olduğu, o kişiye ait bir veri; ürünün
 * yabancılara söylemesi gereken bir şey değil. Ama "ortak arkadaşınız
 * var" bilgisi İKİ TARAFA DA ait ve tam da bir sosyal uygulamanın
 * işine yarayan şey: tanıdık biri mi, değil mi.
 *
 * ⚠️ İKİ YÖN DE SAYILIYOR — `countFriends` ile aynı sebep. Arkadaşlık
 * tek satırda duruyor ve isteği kimin gönderdiği rastgele. Yalnızca
 * bir yöne baksaydık aynı ortak arkadaş, kim kime baktığına göre
 * sayılır ya da sayılmazdı.
 *
 * Yöntem: her iki kullanıcının arkadaş kimlik kümesi çıkarılıp
 * kesişimi alınıyor. Küçük kümeler için SQL'de kesişim yazmaktan
 * daha okunur ve bu ölçekte daha hızlı.
 */
export async function countMutualFriends(
  viewerId: string,
  ownerId: string,
): Promise<number> {
  async function arkadasIdleri(userId: string): Promise<Set<string>> {
    const rows = await db
      .select({
        requesterId: friendships.requesterId,
        addresseeId: friendships.addresseeId,
      })
      .from(friendships)
      .where(
        and(
          eq(friendships.status, 'accepted'),
          or(
            eq(friendships.requesterId, userId),
            eq(friendships.addresseeId, userId),
          ),
        ),
      );

    return new Set(
      rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId)),
    );
  }

  const [a, b] = await Promise.all([arkadasIdleri(viewerId), arkadasIdleri(ownerId)]);

  let ortak = 0;
  for (const id of a) {
    /*
      ⚠️ KENDİLERİ SAYILMIYOR. Viewer ile owner arkadaşsa, viewer
      owner'ın arkadaş listesinde ve owner viewer'ınkinde olur;
      elemezsek "1 ortak arkadaş" gibi görünür — oysa o kişi
      karşındaki kişinin kendisi.
    */
    if (id === viewerId || id === ownerId) continue;
    if (b.has(id)) ortak += 1;
  }

  return ortak;
}

/**
 * Bekleyen GELEN istek sayısı — yalnızca kendi profilinde kullanılıyor.
 *
 * ⚠️ Yalnızca GELEN: gönderdiğin istekler senden bir şey beklemiyor.
 * İkisini toplasaydık rozet "3 işin var" derdi ama ikisi senin
 * onayını bekliyor olmazdı.
 */
export async function countIncomingRequests(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(friendships)
    .where(
      and(
        eq(friendships.addresseeId, userId),
        eq(friendships.status, 'pending'),
      ),
    );

  return row?.n ?? 0;
}
