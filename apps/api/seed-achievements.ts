import { db } from './src/db/client.js';
import { achievements } from './src/db/schema.js';

async function seed() {
  const badges = [
    { key: 'first_place', title: 'Şampiyon', description: 'Herhangi bir haftalık ligi 1. sırada bitirdin.', iconName: 'Trophy' },
    { key: 'top3_streak_3', title: 'Seri Başarılı', description: 'Üst üste 3 hafta ilk 3 te yer aldın.', iconName: 'Flame' },
    { key: 'diamond_hands', title: 'Diamond Hands', description: '30 gün boyunca hiç varlık satmadın.', iconName: 'Gem' }
  ];
  
  for (const b of badges) {
    try {
      await db.insert(achievements).values(b);
      console.log('Inserted:', b.key);
    } catch(err) {
      console.error('Error:', err.message);
    }
  }
  process.exit(0);
}

seed();
