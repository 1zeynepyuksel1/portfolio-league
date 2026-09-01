import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';

/**
 * cleanup-empty-periods.ts — testlerin ürettiği boş lig dönemlerini siler.
 *
 * ⚠️ NEDEN VARLAR: `cron.test.ts` bir dönem boyunca GERÇEK veritabanında
 * `closeAndRotateLeague()` çağırıyordu. Her `npm test` çalıştırması canlı
 * yarışmayı mühürleyip yeni bir dönem açıyordu. Ölçüldü: 76 dönem → 77.
 * Test düzeltildi, yeni çöp üretilmiyor; biriken 78 dönem duruyor.
 *
 * ⚠️ ASIL ZARAR GELECEKTE: `findCurrentOpenLeague` "başlamış ve bitmemiş"
 * dönemler arasından seçiyor. Boş kopyalar ileri bir tarihte başlıyor;
 * o tarih gelince sorgu 26 boş dönemden birini seçebilir ve lig tablosu
 * herkes için boşalır. Sebebi kodda olmadığı için bulunması çok zor olur.
 *
 * ⚠️ ÖLÇÜT "ESKİ" DEĞİL, "BOŞ". `league_entries` bu tabloya
 * `ON DELETE CASCADE` ile bağlı: dolu bir dönemi silmek o dönemin TÜM
 * sonuçlarını da götürür. Bu yüzden yalnızca hiç katılımcısı olmayan
 * dönemler siliniyor — hangi hafta oldukları önemsiz.
 *
 * ⚠️ VARSAYILAN KURU ÇALIŞMA. Betik `--apply` verilmeden hiçbir şey
 * silmiyor. Yıkıcı bir işlemin varsayılanı "yap" olamaz.
 *
 * Kullanım:
 *   npx tsx src/leagues/cleanup-empty-periods.ts            # rapor
 *   npx tsx src/leagues/cleanup-empty-periods.ts --apply    # sil
 */

const apply = process.argv.includes('--apply');

type Satir = {
  id: string;
  name: string;
  status: string;
  starts_at: string;
  ends_at: string;
  kisi: number;
};

const hepsi = (await db.execute(sql`
  SELECT p.id,
         p.name,
         p.status,
         p.starts_at::text AS starts_at,
         p.ends_at::text   AS ends_at,
         (SELECT count(*) FROM league_entries e WHERE e.period_id = p.id)::int AS kisi
  FROM league_periods p
  ORDER BY p.starts_at, p.status
`)) as unknown as Satir[];

const rows = Array.isArray(hepsi) ? hepsi : ((hepsi as { rows?: Satir[] }).rows ?? []);

const dolu = rows.filter((r) => r.kisi > 0);
const bos = rows.filter((r) => r.kisi === 0);

console.log(`TOPLAM DÖNEM: ${rows.length}`);
console.log('');
console.log(`KORUNACAK (katılımcısı olan) — ${dolu.length} dönem:`);
for (const r of dolu) {
  console.log(
    `   ${String(r.kisi).padStart(3)} kişi | ${r.status.padEnd(7)} | ${r.name} | ${r.starts_at.slice(0, 10)} → ${r.ends_at.slice(0, 10)}`,
  );
}

console.log('');
console.log(`SİLİNECEK (hiç katılımcısı yok) — ${bos.length} dönem:`);
const ozet = new Map<string, number>();
for (const r of bos) {
  const anahtar = `${r.status.padEnd(7)} | ${r.name} | ${r.starts_at.slice(0, 10)} → ${r.ends_at.slice(0, 10)}`;
  ozet.set(anahtar, (ozet.get(anahtar) ?? 0) + 1);
}
for (const [anahtar, adet] of ozet) {
  console.log(`   ${String(adet).padStart(3)} adet | ${anahtar}`);
}

if (!apply) {
  console.log('');
  console.log('KURU ÇALIŞMA — hiçbir şey silinmedi.');
  console.log('Silmek için: npx tsx src/leagues/cleanup-empty-periods.ts --apply');
  process.exit(0);
}

/*
  ⚠️ SİLME KOŞULU SORGUDA TEKRARLANIYOR, yukarıda hesaplanan kimlik
  listesi kullanılmıyor. Sebep: rapor ile silme arasında geçen sürede
  bir döneme katılımcı eklenmiş olabilir. Koşulu veritabanına yaptırmak,
  o yarışı yapısal olarak imkânsız kılıyor — liste bayatlasa bile dolu
  bir dönem silinmez.
*/
const silinen = (await db.execute(sql`
  DELETE FROM league_periods p
  WHERE NOT EXISTS (SELECT 1 FROM league_entries e WHERE e.period_id = p.id)
  RETURNING p.id
`)) as unknown as { id: string }[];

const silinenSayi = Array.isArray(silinen)
  ? silinen.length
  : ((silinen as { rows?: unknown[] }).rows?.length ?? 0);

const [kalan] = (await db.execute(sql`
  SELECT count(*)::int AS n FROM league_periods
`)) as unknown as { n: number }[];

console.log('');
console.log(`SİLİNDİ: ${silinenSayi} dönem`);
console.log(`KALAN  : ${kalan?.n ?? '?'} dönem`);

process.exit(0);
