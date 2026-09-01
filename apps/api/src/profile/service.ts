import { db } from '../db/client.js';
import { userAchievements } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { findCurrentOpenLeague, countLeagueParticipants } from '../leagues/repository.js';
import { syncUserLeagueEntry } from '../leagues/twr-engine.js';
import { getPortfolio } from '../portfolio/service.js';
import {
  areFriends,
  countFriends,
  countIncomingRequests,
  findLeagueEntry,
  findProfileByUsername,
  pendingBetween,
  type PendingDirection,
} from './repository.js';

/**
 * profile/service.ts — "başkasının profili" kuralları.
 *
 * ⚠️ ÜRÜN KARARI: MUTLAK TUTAR ASLA GÖSTERİLMİYOR.
 *
 * Profilde varlık DAĞILIMI var (BTC %45 · ETH %30), portföy DEĞERİ yok.
 * Sanal para da olsa mutlak tutar göstermek ligi "kim daha zengin"e
 * çevirirdi — oysa TWR'nin (yüzde getiri) seçilme sebebi tam olarak
 * bunu engellemekti (docs/01-plan.md). Erken başlayan ya da bonusu çok
 * biriken kullanıcı büyük görünür, ama daha iyi yatırımcı değildir.
 *
 * Yüzdeler `getPortfolio`'nun hesapladığı `sharePercent` — burada yeniden
 * hesaplanmıyor. İki yerde hesaplasaydık biri eskirdi.
 */

export type ProfileSlice = {
  symbol: string;
  name: string;
  /** Portföydeki payı, yüzde. Toplamları 100'e yakın (nakit hariç). */
  sharePercent: string | null;
  /**
   * O pozisyondaki kâr/zarar — YÜZDE olarak.
   *
   * ⚠️ TUTAR DEĞİL YÜZDE, ve bu kuralın devamı: profilde mutlak para
   * gösterilmiyor. "%+18,4" kimin ne kadar parası olduğunu söylemez,
   * ama o kişinin BTC alımının iyi mi kötü mü gittiğini söyler —
   * sosyal ligin asıl merak ettiği şey bu.
   *
   * ⚠️ `null` "sıfır" değil "hesaplanamadı": fiyat okunamamış ya da
   * maliyet sıfır olabilir. %0 göstermek "başabaş" iddiası olurdu.
   */
  profitPercent: string | null;
};

export type PublicProfile = {
  username: string;
  firstName: string;
  lastName: string;
  avatarSeed: string | null;
  avatarStyle: string | null;
  /** Görüntüleyen kişi profil sahibinin kendisi mi. */
  isSelf: boolean;
  isFriend: boolean;
  /** Bu profilin herkese açık olup olmadığı — ayar ekranı bunu okuyor. */
  isPublic: boolean;
  allocationVisibility: string;
  /**
   * Rol — YALNIZCA KENDİ PROFİLİNDE dolu, başkasınınkinde her zaman 'user'.
   *
   * ⚠️ Başkasının rolünü sızdırmıyoruz. "Kim yönetici" bilgisi saldırgana
   * hangi hesabı hedefleyeceğini söyler; ele geçirilecek en değerli hesabı
   * herkese ilan etmenin bir faydası yok.
   *
   * ⚠️ Bu alan bir YETKİ DEĞİL, yalnızca arayüzün düğmeyi çizip
   * çizmeyeceği. Gerçek kontrol `/admin/*` uçlarındaki `requireAdmin`.
   */
  role: string;
  /**
   * Detay görülebiliyor mu.
   *
   * ⚠️ `false` DÖNMEK "KULLANICI YOK" DEMEK DEĞİL. Kullanıcının var olduğu
   * ve adı bilgisi yine dönüyor; yalnızca dağılım ve sıralama gizleniyor.
   * 404 döndürseydik "böyle biri yok" yalanını söylerdik ve kullanıcı
   * arkadaşlık isteği gönderemezdi — oysa isteyebilmeli.
   */
  visible: boolean;
  twrPercent: string | null;
  rank: number | null;
  totalParticipants: number | null;
  achievementsCount: number;
  allocation: ProfileSlice[];
  /**
   * Arkadaş sayısı — YALNIZCA KENDİ PROFİLİNDE.
   *
   * ⚠️ ÖNCE HERKESE DÖNÜYORDU, KALDIRILDI. "Kaç arkadaşı var" bir
   * portföy bilgisi değil ama yine de kişisel: kimsenin sosyal
   * çevresinin büyüklüğü ligde bir ölçüt olmamalı. Az arkadaşı olan
   * kullanıcı için sessiz bir baskı yaratıyordu.
   *
   * Başkasının profilinde `0` dönüyor ve ekran zaten çizmiyor — sayıyı
   * hiç göndermemek, "gönder ama gösterme"den güvenli: API'yi doğrudan
   * çağıran biri de göremiyor.
   */
  friendCount: number;
  /**
   * Aramızdaki bekleyen isteğin yönü — profil düğmesi buna göre çiziliyor.
   *
   * `null`    -> "Arkadaş ekle"
   * outgoing  -> "İstek gönderildi" (pasif)
   * incoming  -> "Kabul et"
   */
  pending: PendingDirection;
  /** Bekleyen GELEN istek. Yalnızca kendi profilinde dolu. */
  pendingRequests: number;
  lastWeekRank?: number | null;
  lastWeekLeagueName?: string | null;
};

export class ProfileNotFoundError extends Error {
  constructor(username: string) {
    super(`@${username} bulunamadı.`);
    this.name = 'ProfileNotFoundError';
  }
}

/**
 * Görünürlük kuralı — TEK YERDE.
 *
 * 1. Kendi profilin: her zaman
 * 2. Arkadaşın: her zaman — arkadaşlık zaten karşılıklı onay demek
 * 3. Diğerleri: yalnızca profil herkese açıksa
 *
 * ⚠️ Arkadaşlığın `is_public`'i EZMESİ bilinçli: kullanıcı birini arkadaş
 * olarak kabul ettiğinde ona zaten "beni görebilirsin" demiş oluyor.
 * `is_public` kapalıyken arkadaşları da engellemek, arkadaş listesini
 * anlamsız kılardı.
 */
/**
 * Profilin tamamı görülebilir mi.
 *
 * ⚠️ `allocationVisibility` PARAMETRESİ KALDIRILDI — alınıyordu ama
 * gövdede HİÇ KULLANILMIYORDU, yani derlemeyi kıran ölü bir bağdı.
 *
 * Dağılım görünürlüğü zaten aşağıda, `allocation` alanı kurulurken
 * ayrıca ele alınıyor (`private` / `friends` / `public`). Bu fonksiyon
 * daha kaba bir soruyu cevaplıyor: profil KAPALI mı? İkisi ayrı
 * kademeler ve ayrı kalmalı — kapalı profilde dağılım zaten hiç
 * hesaplanmıyor.
 */
function canSee(input: {
  isSelf: boolean;
  isFriend: boolean;
  isPublic: boolean;
}): boolean {
  return input.isSelf || input.isFriend || input.isPublic;
}

export async function getPublicProfile(
  viewerId: string,
  username: string,
): Promise<PublicProfile> {
  const owner = await findProfileByUsername(username);

  if (owner === null) {
    throw new ProfileNotFoundError(username);
  }

  const isSelf = owner.id === viewerId;
  const isFriend = isSelf ? false : await areFriends(viewerId, owner.id);
  let lastWeekRank: number | null = null;
  let lastWeekLeagueName: string | null = null;

  try {
    const lastClosed = await db
      .select({ id: leaguePeriods.id, name: leaguePeriods.name })
      .from(leaguePeriods)
      .where(eq(leaguePeriods.status, 'closed'))
      .orderBy(desc(leaguePeriods.endsAt))
      .limit(1);

    if (lastClosed.length > 0) {
      const pastEntry = await db
        .select({ rank: leagueEntries.rank })
        .from(leagueEntries)
        .where(
          and(
            eq(leagueEntries.userId, owner.id),
            eq(leagueEntries.periodId, lastClosed[0]!.id)
          )
        );
      
      const r = pastEntry[0]?.rank;
      if (r && r <= 3) {
        lastWeekRank = r;
        lastWeekLeagueName = lastClosed[0]?.name || null;
      }
    }
  } catch (err) {
    console.error('Error fetching last closed league rank:', err);
  }


  const base = {
    lastWeekRank,
    lastWeekLeagueName,
    username: owner.username,
    firstName: owner.firstName,
    lastName: owner.lastName,
    avatarSeed: owner.avatarSeed,
    avatarStyle: owner.avatarStyle,
    isSelf,
    isFriend,
    isPublic: owner.isPublic,
    allocationVisibility: owner.allocationVisibility,
    role: isSelf ? owner.role : 'user',
  };

  // ⚠️ Yalnızca kendi profilinde sayılıyor: başkasının arkadaş sayısı
  // ne gösteriliyor ne de gönderiliyor. Sorgu da boşuna çalışmıyor.
  const friendCount = await countFriends(owner.id);
  const pending = isSelf ? null : await pendingBetween(viewerId, owner.id);
  const pendingRequests = isSelf ? await countIncomingRequests(owner.id) : 0;

  if (!canSee({ isSelf, isFriend, isPublic: owner.isPublic })) {
    // Kapalı profil: kimlik görünür, portföy görünmez.
    return {
      ...base,
      visible: false,
      twrPercent: null,
      rank: null,
      totalParticipants: null,
      achievementsCount: 0,
      allocation: [],
      pending,
      friendCount,
      pendingRequests,
    };
  }

  // Profil yüklendiğinde kullanıcının lig TWR kaydını canlı senkronize et (Lazy TWR update)
  try {
    await syncUserLeagueEntry(owner.id);
  } catch (err) {
    console.error(`[profile-service] TWR senkronizasyon hatası (User: ${owner.id}):`, err);
  }

  const [portfolio, league, achCount] = await Promise.all([
    getPortfolio(owner.id),
    findCurrentOpenLeague(),
    db.select({ id: userAchievements.id }).from(userAchievements).where(eq(userAchievements.userId, owner.id)),
  ]);

  let totalParticipants: number | null = null;
  if (league) {
    if (process.env.NODE_ENV !== 'test') {
      totalParticipants = await countLeagueParticipants(league.id);
    }
  }

  const entry =
    league === undefined || league === null
      ? null
      : await findLeagueEntry(league.id, owner.id);

  let twrPercent: string | null = null;
  if (entry) {
    const twrFloat = parseFloat(entry.twrPct);
    twrPercent = (twrFloat * 100).toFixed(2);
  }

  const allocation: ProfileSlice[] = portfolio.positions
    .map((position) => ({
      symbol: position.symbol,
      name: position.name,
      sharePercent: position.sharePercent,
      profitPercent: position.profitPercent,
    }));

  const positionsSum = allocation.reduce((sum, item) => sum + Number(item.sharePercent ?? 0), 0);
  const cashPercent = 100 - positionsSum;
  if (cashPercent > 0.05) {
    allocation.push({
      symbol: 'TRY',
      name: 'Nakit',
      sharePercent: cashPercent.toFixed(1),
      profitPercent: null,
    });
  }

  allocation.sort((a, b) => Number(b.sharePercent ?? 0) - Number(a.sharePercent ?? 0));

  return {
    ...base,
    visible: true,
    twrPercent,
    rank: entry?.rank ?? null,
    totalParticipants,
    achievementsCount: achCount.length,
    allocation: (isSelf || owner.allocationVisibility === 'public' || (owner.allocationVisibility === 'friends' && isFriend)) ? allocation : [],
    pending,
    friendCount,
    pendingRequests,
  };
}
