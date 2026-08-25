import cron from 'node-cron';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { getPortfolio } from './service.js';
import { createPortfolioSnapshot } from '../leagues/twr-engine.js';

/**
 * Tüm kullanıcıların anlık portföy değerlerini veritabanına 'daily' etiketli snapshot olarak kaydeder.
 */
export async function takeDailySnapshots(): Promise<void> {
  console.log('[portfolio-cron] Günlük portföy snapshot özetleri kaydediliyor...');
  
  try {
    const allUsers = await db.select({ id: users.id }).from(users);
    
    for (const user of allUsers) {
      try {
        const portfolio = await getPortfolio(user.id);
        await createPortfolioSnapshot(user.id, portfolio.totalValueCents, 'daily');
      } catch (err) {
        console.error(`[portfolio-cron] Kullanıcı ${user.id} için günlük snapshot kaydedilemedi:`, err);
      }
    }
    
    console.log('[portfolio-cron] Tüm günlük portföy snapshot özetleri başarıyla kaydedildi.');
  } catch (err) {
    console.error('[portfolio-cron] Günlük snapshot kaydetme işlemi tamamen başarısız oldu:', err);
  }
}

/**
 * Her gece 23:55'te çalışan günlük portföy özetleme robotunu başlatır.
 */
export function startPortfolioCron(): void {
  // Zaman Deseni: "55 23 * * *" -> Her gece 23:55'te uyanır
  cron.schedule('55 23 * * *', async () => {
    await takeDailySnapshots();
  });

  console.log('[portfolio-cron] Günlük portföy özetleme robotu kuruldu (Her gün 23:55).');
}
