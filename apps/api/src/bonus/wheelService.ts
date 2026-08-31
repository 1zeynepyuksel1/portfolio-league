import { db } from '../db/client.js';
import { wheelRewards, wheelSpins } from '../db/schema.js';
import { desc, eq } from 'drizzle-orm';
import { grantDailyBonus } from './repository.js';

/**
 * Çark normalde günde bir kez çevrilir. Yerel sunum/test sırasında
 * `.env` içinden `WHEEL_COOLDOWN_SECONDS=60` vererek bunu bir dakikaya
 * indirebiliriz; üretimde değişken tanımlanmazsa güvenli varsayılan 24 saattir.
 */
const DEFAULT_WHEEL_COOLDOWN_SECONDS =
  process.env.NODE_ENV === 'production' ? 24 * 60 * 60 : 60;

export function getWheelCooldownMs(): number {
  const configuredSeconds = Number(process.env.WHEEL_COOLDOWN_SECONDS);
  const seconds =
    Number.isFinite(configuredSeconds) && configuredSeconds >= 1
      ? configuredSeconds
      : DEFAULT_WHEEL_COOLDOWN_SECONDS;

  return seconds * 1000;
}

export class WheelAlreadySpunError extends Error {
  constructor(cooldownMs = getWheelCooldownMs()) {
    const duration = cooldownMs < 60 * 60 * 1000 ? '1 dakika' : '24 saat';
    super(`Günün çarkını zaten çevirdin. Bir sonraki çevirme için ${duration} beklemelisin.`);
  }
}

export async function getActiveWheelRewards() {
  return db
    .select()
    .from(wheelRewards)
    .where(eq(wheelRewards.isActive, true));
}

export async function getLastWheelSpin(userId: string) {
  const [spin] = await db
    .select()
    .from(wheelSpins)
    .where(eq(wheelSpins.userId, userId))
    .orderBy(desc(wheelSpins.wonAt))
    .limit(1);
  return spin;
}

export async function spinDailyWheel(userId: string) {
  const lastSpin = await getLastWheelSpin(userId);
  if (lastSpin) {
    const millisecondsSinceLastSpin = Date.now() - lastSpin.wonAt.getTime();
    if (millisecondsSinceLastSpin < getWheelCooldownMs()) {
      throw new WheelAlreadySpunError(getWheelCooldownMs());
    }
  }

  const rewards = await getActiveWheelRewards();
  if (rewards.length === 0) {
    throw new Error('Aktif ödül bulunamadı.');
  }

  const totalWeight = rewards.reduce((sum, r) => sum + Number(r.weight), 0);
  let randomValue = Math.random() * totalWeight;
  
  let selectedReward = rewards[rewards.length - 1]!; 
  for (const reward of rewards) {
    randomValue -= Number(reward.weight);
    if (randomValue <= 0) {
      selectedReward = reward;
      break;
    }
  }

  await db.insert(wheelSpins).values({
    userId,
    rewardId: selectedReward.id,
  });

  if (selectedReward.rewardType === 'cash') {
    const val = selectedReward.rewardValue as { amount?: number };
    if (val && val.amount !== undefined) {
      const cents = BigInt(Math.round(val.amount * 100));
      await grantDailyBonus(userId, cents);
    }
  } else {
    console.log(`[WHEEL] Applied ${selectedReward.rewardType} for user ${userId}`);
  }

  return selectedReward;
}
