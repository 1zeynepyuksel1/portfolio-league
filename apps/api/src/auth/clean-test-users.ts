/**
 * Doğrulama sırasında açılan tek kullanımlık hesapları siler.
 * ELLE ÇALIŞTIRILAN, TEK SEFERLİK BETİK.
 *
 *     npx tsx apps/api/src/auth/clean-test-users.ts          (sadece listeler)
 *     npx tsx apps/api/src/auth/clean-test-users.ts --apply  (siler)
 *
 * ⚠️ NEDEN GEREKLİ.
 *
 * Bir özelliğin gerçekten çalıştığını görmenin tek yolu gerçek istek atmak.
 * TL/USD çevrimini doğrularken üç hesap açıldı ve biri 0,005 BTC aldı.
 * Bunlar silinmezse **lig sıralamasında görünürler** — üstelik hiç işlem
 * yapmadıkları için tepede ya da dipte, gerçek kullanıcıların arasında.
 *
 * ⚠️ ÖLÇÜT E-POSTA DESENİ, TARİH DEĞİL.
 *
 * "Bugün açılanları sil" demek çok daha tehlikeli: aynı gün kaydolan
 * gerçek bir kullanıcıyı da silerdi. Desen, betiğin kendi açtığı hesapları
 * hedefliyor ve başka hiçbir şeye dokunmuyor.
 *
 * ⚠️ SİLME SIRASI ÖNEMLİ DEĞİL — foreign key'ler `ON DELETE CASCADE`.
 * `users` satırı silinince accounts, orders, refresh_tokens kendiliğinden
 * gidiyor. Cascade olmasaydı sıra kritik olurdu ve yanlış sırada silmek
 * yabancı anahtar hatası verirdi.
 */

import '../lib/env.js';
import { like, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';

/**
 * Betiklerin kullandığı e-posta desenleri.
 *
 * Hepsi `@example.com` ile bitiyor — RFC 2606 bu alan adını tam olarak
 * bu iş için ayırmış: gerçek kimseye ait olamaz.
 */
const TEST_PATTERNS = ['fx-test-%', 'fx-pos-%', 'diag-%'] as const;

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');

  const condition = or(
    ...TEST_PATTERNS.map((pattern) => like(users.email, `${pattern}@example.com`)),
  );

  if (condition === undefined) {
    console.log('Desen yok — yapacak bir şey yok.');
    process.exit(0);
  }

  const found = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(condition);

  if (found.length === 0) {
    console.log('✅ Test hesabı yok — veritabanı zaten temiz.');
    process.exit(0);
  }

  console.log(`${found.length} test hesabı bulundu:\n`);
  for (const user of found) {
    console.log(`  ${user.email}`);
  }

  if (!apply) {
    console.log('\nSilmek için:');
    console.log('  npx tsx apps/api/src/auth/clean-test-users.ts --apply');
    process.exit(0);
  }

  await db.delete(users).where(condition);

  console.log(`\n✅ ${found.length} test hesabı silindi (emirleri ve bakiyeleriyle).`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Betik çöktü:', error instanceof Error ? error.message : error);
  process.exit(1);
});
