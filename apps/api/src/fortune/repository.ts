import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  assets,
  dailyFortunes,
  fortuneLines,
  fortuneCategoryEnum,
} from '../db/schema.js';

export type FortuneCategory = (typeof fortuneCategoryEnum.enumValues)[number];

export type FortuneLine = {
  id: string;
  category: FortuneCategory;
  text: string;
  assetKey: string | null;
};

export async function getActiveFortuneLines(): Promise<FortuneLine[]> {
  return db
    .select({
      id: fortuneLines.id,
      category: fortuneLines.category,
      text: fortuneLines.text,
      assetKey: fortuneLines.assetKey,
    })
    .from(fortuneLines)
    .where(eq(fortuneLines.isActive, true));
}

export async function getActiveFortuneAssets() {
  return db
    .select({
      id: assets.id,
      symbol: assets.symbol,
      name: assets.name,
    })
    .from(assets)
    .where(eq(assets.isActive, true));
}

export async function findDailyFortune(userId: string, fortuneDate: string) {
  const [fortune] = await db
    .select({
      date: dailyFortunes.fortuneDate,
      content: dailyFortunes.content,
      createdAt: dailyFortunes.createdAt,
      asset: {
        symbol: assets.symbol,
        name: assets.name,
      },
    })
    .from(dailyFortunes)
    .innerJoin(assets, eq(dailyFortunes.assetId, assets.id))
    .where(
      and(
        eq(dailyFortunes.userId, userId),
        eq(dailyFortunes.fortuneDate, fortuneDate),
      ),
    )
    .limit(1);

  return fortune ?? null;
}

/**
 * Aynı anda iki istek aynı falı üretmeye çalışırsa benzersiz kullanıcı+tarih
 * kısıtı ikinci yazımı atar. Servis ardından mevcut cache kaydını yeniden okur.
 */
export async function createDailyFortune(input: {
  userId: string;
  fortuneDate: string;
  assetId: string;
  content: string;
}): Promise<void> {
  await db
    .insert(dailyFortunes)
    .values(input)
    .onConflictDoNothing({
      target: [dailyFortunes.userId, dailyFortunes.fortuneDate],
    });
}
