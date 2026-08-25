import cron from 'node-cron';
import {
  createLeaguePeriod,
  findCurrentOpenLeague,
  getLeaderboardByLeagueId,
  updateEntryRank,
  updateLeaguePeriodStatus,
} from './repository.js';
import { syncAllLeagueEntriesAndRanks, createPortfolioSnapshot } from './twr-engine.js';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { getPortfolio } from '../portfolio/service.js';


/**
 * Süresi dolmuş aktif lig dönemini kapatır, dereceleri mühürler ve yeni lig dönemini açar.
 */
export async function closeAndRotateLeague(): Promise<{
  closedLeagueId?: string;
  newLeagueId?: string;
  totalRanked: number;
}> {
  const currentOpen = await findCurrentOpenLeague();

  if (!currentOpen) {
    console.log('[league-cron] Açık lig dönemi bulunamadı.');
    return { totalRanked: 0 };
  }

  // 1. Lig kapatılmadan önce tüm katılımcıların TWR puanlarını son kez hesapla ve dereceleri güncelle
  await syncAllLeagueEntriesAndRanks();

  // 2. Güncel TWR sıralamasına göre katılımcıları getir
  const entries = await getLeaderboardByLeagueId(currentOpen.id, 10000, 0);

  // 3. Katılımcıların resmi derecelerini (1., 2., 3...) mühürle
  let rank = 1;
  for (const entry of entries) {
    await updateEntryRank(currentOpen.id, entry.userId, rank);
    rank++;
  }

  // 4. Mevcut lig dönemini mühürle (open -> closed)
  await updateLeaguePeriodStatus(currentOpen.id, 'closed');
  console.log(`[league-cron] Lig dönemi kapatıldı: "${currentOpen.name}" (ID: ${currentOpen.id}), ${entries.length} yarışmacı mühürlendi.`);

  // 5. Gelecek hafta için yeni lig dönemini başlat
  const nextStartsAt = new Date(currentOpen.endsAt.getTime() + 1000); // Pazartesi 00:00:00
  const nextEndsAt = new Date(nextStartsAt);
  nextEndsAt.setUTCDate(nextStartsAt.getUTCDate() + 6);
  nextEndsAt.setUTCHours(23, 59, 59, 999);

  // Yıl ve hafta numarası
  const weekNumber = Math.ceil(
    ((nextStartsAt.getTime() - new Date(nextStartsAt.getUTCFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7,
  );
  const nextName = `${nextStartsAt.getUTCFullYear()} - ${weekNumber}. Hafta Ligi`;

  const newPeriod = await createLeaguePeriod({
    name: nextName,
    startsAt: nextStartsAt,
    endsAt: nextEndsAt,
    status: 'open',
  });

  console.log(`[league-cron] Yeni haftalık lig dönemi başlatıldı: "${newPeriod.name}" (ID: ${newPeriod.id})`);

  // 6. Tüm aktif kullanıcılar için yeni ligin başlangıç snapshot'ını oluştur
  const allUsers = await db.select({ id: users.id }).from(users);
  for (const user of allUsers) {
    try {
      const portfolio = await getPortfolio(user.id);
      await createPortfolioSnapshot(user.id, portfolio.totalValueCents, 'league', nextStartsAt);
    } catch (err) {
      console.error(`[league-cron] Yeni lig başlangıç snapshot hatası (User: ${user.id}):`, err);
    }
  }

  return {
    closedLeagueId: currentOpen.id,
    newLeagueId: newPeriod.id,
    totalRanked: entries.length,
  };
}

/**
 * Süresi bittiği halde açık kalmış lig varsa kontrol edip kapatır
 */
export async function checkAndCloseExpiredLeagues(): Promise<void> {
  const currentOpen = await findCurrentOpenLeague();
  if (currentOpen && Date.now() >= currentOpen.endsAt.getTime()) {
    console.log(`[league-cron] Süresi dolmuş lig tespit edildi: "${currentOpen.name}". Kapatma başlatılıyor...`);
    await closeAndRotateLeague();
  }
}

/**
 * Her Pazar gecesi 23:59:59'da çalışan haftalık lig kapanış cron robotu
 */
export function startLeagueClosingCron(): void {
  // Zaman Deseni: "59 23 * * 0" -> Her Pazar günü 23:59:59'da uyanır
  cron.schedule('59 23 * * 0', async () => {
    console.log('[league-cron] Pazar gecesi lig kapanış nöbeti başladı...');
    await checkAndCloseExpiredLeagues();
  });

  // Sunucu ayağa kalktığında süresi geçmiş lig kalmış mı kontrol et
  checkAndCloseExpiredLeagues().catch((err) => {
    console.error('[league-cron] Lig kapanış kontrol hatası:', err);
  });

  console.log('[league-cron] Haftalık lig kapanış robotu kuruldu (Her Pazar 23:59:59).');
}
