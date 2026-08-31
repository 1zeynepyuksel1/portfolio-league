import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { fortuneLines } from './src/db/schema.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is missing');

const client = postgres(connectionString);
const db = drizzle(client);

const lines = [
  ['main', 'Yıldızlar bu gece {asset} üzerine fısıldıyor, kulak ver evladım.'],
  ['main', 'Fincanının dibinde net bir işaret var: {asset} bugün senin yanında.'],
  ['main', 'Kader çizgin bugün {asset} ile kesişiyor, bu tesadüf değil.'],
  ['main', 'Bugün {asset} sana göz kırpıyor, sen de ona bir şans ver.'],
  ['main', "Kahve telvesinde bir yükseliş gördüm, adı {asset}'tı."],
  ['main', 'Yıldız haritan bugün {asset} yönünde parlıyor, gözünü ayırma.'],
  ['main', 'Kristal kürem bugün çok net konuştu: {asset} bugün şanslı.'],
  ['main', 'Ellerindeki çizgiler bana {asset} diyor, sen ne dersin?'],
  ['main', 'Bugün rüzgar {asset} yönünden esiyor, hisset bakalım.'],
  ['main', 'Falımda {asset} çıktı, bu güzel bir işaret evladım.'],
  ['cautious', 'Bugün sabırlı ol evladım, {asset} biraz nazlanabilir.'],
  ['cautious', 'Yıldızlar bugün net konuşmuyor ama {asset} adını sık sık geçiriyor.'],
  ['cautious', '{asset} bugün dalgalı sularda, ama iyi denizci fırtınadan korkmaz.'],
  ['cautious', 'Bugün acele etme, {asset} zamanla olgunlaşacak bir işaret veriyor.'],
  ['cautious', 'Merkür retrosu bitmek üzere, {asset} için biraz daha bekle.'],
  ['cautious', 'Fincanında bulanık bir görüntü var, {asset} bugün temkinli olmanı istiyor.'],
  ['cautious', 'Yıldızlar bugün ikircikli, {asset} konusunda acele etme derim.'],
  ['cautious', 'Bugün gökyüzü kararsız, {asset} de öyle olabilir, dikkatli ol.'],
  ['playful', "İçimden bir ses '{asset}' diyor, dinlemek sana kalmış."],
  ['playful', 'Falcı ablan {asset} gördü ama falcı ablan da bazen kahve içmeden yanılır.'],
  ['playful', "Bugün {asset}'a bakmak istedim, yıldızlar da onayladı galiba."],
  ['playful', 'Kristal kürem bugün biraz tozluydu ama {asset} net çıktı.'],
  ['playful', "Bu bilgiyi cebine at evladım: bugün gözün {asset}'ta olsun."],
  ['playful', 'Yıldızlar şaka yapmaz, ama ben bazen yaparım — bugün {asset} diyorum!'],
].map(([category, text]) => ({
  category: category as 'main' | 'cautious' | 'playful',
  text,
  assetKey: null,
  isActive: true,
}));

const specificLines = [
  ['GRAM_ALTIN', "Ninelerimiz boşuna 'altın her zaman kazandırır' dememiş, bugün de öyle görünüyor."],
  ['USD', 'Yeşil banknot bugün rüyalarıma girdi, hayra yorulur derler.'],
  ['EUR', "Okyanus ötesinden bugün Euro'ya dair iyi bir rüzgar esiyor."],
  ['BTC', "Dijital kristal kürem bugün Bitcoin'de bir titreşim yakaladı."],
  ['ETH', 'Zincirler bugün Ethereum lehine şıngırdıyor.'],
].map(([assetKey, text]) => ({
  category: 'asset_specific' as const,
  text,
  assetKey,
  isActive: true,
}));

const closingLines = [
  '...ama unutma, yıldızlar tavsiye vermez, sadece eğlendirir.',
  '...falcı ablan söyledi demedi deme!',
  '...gerisi sana kalmış evladım, kararı sen ver.',
  '...bu sadece bir fal, cüzdanını dinle.',
].map((text) => ({
  category: 'closing' as const,
  text,
  assetKey: null,
  isActive: true,
}));

async function seed(): Promise<void> {
  // Bu script yalnızca sağlanan sabit içerik havuzunu yeniden kurar.
  await db.delete(fortuneLines);
  await db.insert(fortuneLines).values([...lines, ...specificLines, ...closingLines]);
  console.log(`Fortune content seeded: ${lines.length + specificLines.length + closingLines.length} lines.`);
  await client.end();
}

seed().catch(async (error) => {
  console.error('Fortune seed failed:', error);
  await client.end();
  process.exitCode = 1;
});
