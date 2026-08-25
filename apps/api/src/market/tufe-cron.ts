import cron from 'node-cron';
import { db } from '../db/client.js';
import { inflationIndex } from '../db/schema.js';
import { fetchTufeFromEvds } from './evds.js';

/**
 * En son ayın TÜFE enflasyon verisini EVDS'den çekip veritabanına kaydeder
 */
export async function fetchAndStoreLatestTufe(): Promise<boolean> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

  try {
    // 1. Eğer EVDS API Key varsa internetten canlı çek
    if (process.env.EVDS_API_KEY) {
      const items = await fetchTufeFromEvds(`01-${currentMonth}-${currentYear}`, `31-${currentMonth}-${currentYear}`);
      if (items.length > 0) {
        const latest = items[items.length - 1];
        if (latest) {
          await db
            .insert(inflationIndex)
            .values({
              month: latest.month,
              tufeIndex: latest.tufeIndex.toFixed(4),
            })
            .onConflictDoUpdate({
              target: inflationIndex.month,
              set: {
                tufeIndex: latest.tufeIndex.toFixed(4),
              },
            });

          console.log(`[tufe-cron] EVDS'den yeni TÜFE kaydedildi: ${latest.month} -> ${latest.tufeIndex}`);
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('[tufe-cron] TÜFE çekilirken hata oluştu:', error);
    return false;
  }
}

/**
 * Her ayın 3'ünde saat 10:05'te çalışan cron robotu
 * (TÜİK her ayın 3'ünde saat 10:00'da açıklar, robot 10:05'te çeker)
 */
export function startTufeCron(): void {
  // Zaman Deseni: "5 10 3 * *" -> Her ayın 3. günü saat 10:05
  cron.schedule('5 10 3 * *', async () => {
    console.log('[tufe-cron] Aylık TÜFE çekme nöbeti başladı...');
    await fetchAndStoreLatestTufe();
  }, {
    timezone: 'Europe/Istanbul'
  });

  console.log('[tufe-cron] Aylık TÜFE cron robotu kuruldu (Her ayın 3\'ünde saat 10:05 TSİ).');
}
