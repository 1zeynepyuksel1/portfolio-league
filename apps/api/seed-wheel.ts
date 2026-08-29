import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import 'dotenv/config';
import { wheelRewards } from './src/db/schema.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is missing');
}

const client = postgres(connectionString);
const db = drizzle(client);

const rewards = [
  {
    key: 'small_win_50',
    displayName: 'Küçük Kazanç',
    description: 'Cebine 50 TL girdi, fena değil!',
    rewardType: 'cash',
    rewardValue: { amount: 50 },
    weight: '22',
  },
  {
    key: 'empty_interest_rate',
    displayName: 'Merkez Bankası Faiz Artırdı',
    description: 'Bu sefer piyasa senden yana değildi, yarın tekrar dene.',
    rewardType: 'none',
    rewardValue: null,
    weight: '18',
  },
  {
    key: 'good_win_100',
    displayName: 'İyi Gidiyor',
    description: '100 TL kazandın, devam et!',
    rewardType: 'cash',
    rewardValue: { amount: 100 },
    weight: '15',
  },
  {
    key: 'inflation_hit',
    displayName: 'Enflasyon Vurdu',
    description: 'Enflasyon cebini yaktı, 10 TL kaybettin.',
    rewardType: 'cash',
    rewardValue: { amount: -10 },
    weight: '10',
  },
  {
    key: 'lucky_day_250',
    displayName: 'Güzel Gün',
    description: '250 TL ile bugün şanslı gündeyiz.',
    rewardType: 'cash',
    rewardValue: { amount: 250 },
    weight: '10',
  },
  {
    key: 'crypto_winter_over',
    displayName: 'Kripto Kışı Bitti',
    description: 'Günlük bonusun 1 saat erken açıldı!',
    rewardType: 'early_unlock',
    rewardValue: { hours: 1 },
    weight: '6',
  },
  {
    key: 'bull_market',
    displayName: 'Boğa Piyasası',
    description: 'Yarınki günlük bonusun 2 katına çıktı!',
    rewardType: 'bonus_multiplier',
    rewardValue: { multiplier: 2, duration_days: 1 },
    weight: '5',
  },
  {
    key: 'insider_info',
    displayName: 'İçeriden Bilgi',
    description: 'Bugün yapacağın ilk işlemde komisyon yarı fiyatına!',
    rewardType: 'fee_discount',
    rewardValue: { discount_pct: 50, trades: 1 },
    weight: '5',
  },
  {
    key: 'big_heist_500',
    displayName: 'Büyük Vurgun',
    description: '500 TL ile gerçekten şanslı bir gün yaşıyorsun!',
    rewardType: 'cash',
    rewardValue: { amount: 500 },
    weight: '4',
  },
  {
    key: 'whale_alert',
    displayName: 'Balina Alarmı!',
    description: '24 saat boyunca komisyonsuz işlem yapabilirsin!',
    rewardType: 'fee_free_period',
    rewardValue: { hours: 24 },
    weight: '2.5',
  },
  {
    key: 'sparkling_moment',
    displayName: 'Işıltılı An',
    description: '24 saatliğine özel bir avatar çerçevesi kazandın!',
    rewardType: 'avatar_frame',
    rewardValue: { frame_id: 'sparkle', hours: 24 },
    weight: '1.5',
  },
  {
    key: 'vault_busted',
    displayName: 'Kasa Patladı!',
    description: '1.000 TL! Bugün gerçekten efsane bir gün.',
    rewardType: 'cash',
    rewardValue: { amount: 1000 },
    weight: '0.7',
  },
  {
    key: 'legendary_day',
    displayName: 'Efsane Gün!',
    description: '1.000 TL + kalıcı özel profil çerçevesi kazandın! Bu çok nadir bir an, tebrikler.',
    rewardType: 'avatar_frame',
    rewardValue: { amount: 1000, frame_id: 'legendary', duration: 'permanent' },
    weight: '0.2',
  },
  {
    key: 'star_of_the_day',
    displayName: 'Günün Yıldızı',
    description: 'Bugün Keşfet akışında adının yanında yıldız parlıyor!',
    rewardType: 'badge',
    rewardValue: { badge_id: 'star_of_the_day', hours: 24 },
    weight: '0.1',
  }
];

async function seed() {
  console.log('Clearing existing wheel rewards...');
  await db.delete(wheelRewards);
  
  console.log('Inserting 14 custom wheel rewards...');
  // @ts-ignore
  await db.insert(wheelRewards).values(rewards);
  
  console.log('Wheel rewards seeded successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Error seeding wheel rewards:', err);
  process.exit(1);
});
