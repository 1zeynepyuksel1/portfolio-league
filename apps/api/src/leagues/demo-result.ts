import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { leagueEntries, leaguePeriods, users } from '../db/schema.js';

/**
 * demo-result.ts — lig sonucu kutlamasını ELDE SINAMAK için.
 *
 * ⚠️ NEDEN GEREKLİ: kutlama YALNIZCA lig kapandığında çıkıyor ve lig
 * haftada bir kapanıyor. Özelliği görmek için pazarı beklemek anlamsız.
 *
 * ⚠️ VE NEDEN CRON'U ELLE ÇALIŞTIRMIYORUZ: `closeAndRotateLeague()`
 * gerçek yarışmayı MÜHÜRLER — herkesin derecesini kalıcı olarak yazar ve
 * yeni bir dönem açar. Tam olarak `cron.test.ts`'in yaptığı ve 77 çöp
 * dönem bırakan hata buydu.
 *
 * Bu betik onun yerine TEK BİR SATIRA dokunuyor: senin kaydının
 * derecesini yazıyor ve "görüldü" damgasını siliyor. Başka hiçbir
 * kullanıcı, hiçbir dönem etkilenmiyor.
 *
 * Kullanım:
 *   npx tsx src/leagues/demo-result.ts <kullaniciAdi> [derece]
 *
 * Örnek:
 *   npx tsx src/leagues/demo-result.ts batuhanSwe 1
 *
 * Sonra uygulamayı aç: kutlama karşına çıkacak. Tekrar görmek için
 * betiği yeniden çalıştır.
 */

const [, , username, rankArg = '1'] = process.argv;

if (username === undefined) {
  console.error('Kullanım: npx tsx src/leagues/demo-result.ts <kullaniciAdi> [derece]');
  process.exit(1);
}

const rank = Number.parseInt(rankArg, 10);

if (!Number.isInteger(rank) || rank < 1) {
  console.error('Derece 1 veya daha büyük bir tam sayı olmalı.');
  process.exit(1);
}

const [user] = await db
  .select({ id: users.id, username: users.username })
  .from(users)
  .where(eq(users.username, username))
  .limit(1);

if (user === undefined) {
  console.error(`@${username} bulunamadı.`);
  process.exit(1);
}

/*
  ⚠️ YENİ DÖNEM AÇMIYORUZ, VAR OLANI KULLANIYORUZ.

  Uygulama "son KAPANMIŞ lig"e bakıyor (`findLastClosedLeague`). Betik
  kendi dönemini yaratsaydı veritabanına bir çöp dönem daha eklenirdi —
  zaten 77 tane var. Var olanı kullanmak hem gerçeğe daha yakın hem de
  arkasında iz bırakmıyor.
*/
const [period] = await db
  .select({ id: leaguePeriods.id, name: leaguePeriods.name })
  .from(leaguePeriods)
  .where(eq(leaguePeriods.status, 'closed'))
  .orderBy(desc(leaguePeriods.endsAt))
  .limit(1);

if (period === undefined) {
  console.error(
    'Kapanmış lig dönemi yok. Kutlama "son kapanan lig"e bakıyor; ' +
      'sınamak için önce bir dönemin kapanmış olması gerekiyor.',
  );
  process.exit(1);
}

const [mevcut] = await db
  .select({ userId: leagueEntries.userId })
  .from(leagueEntries)
  .where(
    and(eq(leagueEntries.periodId, period.id), eq(leagueEntries.userId, user.id)),
  )
  .limit(1);

if (mevcut === undefined) {
  /*
    ⚠️ Kayıt yoksa oluşturuluyor — ama başlangıç/bitiş değerleri
    UYDURULMUYOR, ikisi de eşit veriliyor. Böylece TWR %0,00 çıkıyor.
    Rastgele bir kâr yazsaydık ekranda gerçekmiş gibi görünen bir sayı
    olurdu; sınama verisi, gerçek veriden ayırt edilebilir kalmalı.
  */
  await db.insert(leagueEntries).values({
    periodId: period.id,
    userId: user.id,
    startValueCents: 10000000n,
    endValueCents: 10000000n,
    twrPct: '0.0000',
    rank,
    resultSeenAt: null,
  });
  console.log(`@${user.username} için yeni kayıt açıldı (TWR %0,00).`);
} else {
  await db
    .update(leagueEntries)
    .set({ rank, resultSeenAt: null })
    .where(
      and(eq(leagueEntries.periodId, period.id), eq(leagueEntries.userId, user.id)),
    );
  console.log(`@${user.username} kaydı güncellendi (mevcut TWR korundu).`);
}

console.log('');
console.log(`  dönem  : ${period.name}`);
console.log(`  derece : ${rank}`);
console.log('  görüldü: sıfırlandı');
console.log('');
console.log('Uygulamayı aç — kutlama karşına çıkacak.');
console.log('Bir daha görmek için betiği tekrar çalıştır.');

process.exit(0);
