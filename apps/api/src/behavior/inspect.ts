/**
 * inspect.ts — göstergeleri GERÇEK veride koşturan tek seferlik betik.
 *
 * ⚠️ NEDEN SERVİSTEN ÖNCE BU.
 *
 * Yedi gösterge 44 testi geçiyor ama testlerin girdisini ben yazdım.
 * Uydurduğum senaryolarda çalışması, gerçek kullanıcıların defterinde bir
 * şey BULACAĞI anlamına gelmiyor. Eşikler çok yüksekse hiçbiri
 * tetiklenmez ve elimizde anlatacak hiçbir şey olmadan yapay zekâya para
 * ödemeye başlarız.
 *
 * Bu betik o soruyu ucuza cevaplıyor: uç, ekran ve model yazılmadan önce
 * "gösterge ne buluyor" görülüyor.
 *
 * KULLANIM (repo kökünden):
 *     npx tsx apps/api/src/behavior/inspect.ts
 */

import '../lib/env.js';

import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { getPortfolio } from '../portfolio/service.js';
import { getDepositedCents } from '../portfolio/repository.js';
import { getBehaviorOrders } from './repository.js';
import {
  detectAveragingDown,
  detectConcentration,
  detectDispositionEffect,
  detectFomoBuying,
  detectOvertrading,
  detectPanicSelling,
  detectWashTrades,
  type Indicator,
} from './indicators.js';

async function main(): Promise<void> {
  const users = await db.execute<{ id: string; username: string }>(sql`
    SELECT u.id::text AS id, u.username
    FROM users u
    JOIN orders o ON o.user_id = u.id
    GROUP BY u.id, u.username
    ORDER BY COUNT(o.id) DESC
  `);

  console.log(`${users.length} kullanıcının emri var.\n`);

  // Hangi gösterge kaç kullanıcıda tetikledi — eşiklerin makul olup
  // olmadığını asıl bu tablo söyleyecek.
  const hits = new Map<string, number>();

  for (const user of users) {
    const [orders, portfolio, depositedCents] = await Promise.all([
      getBehaviorOrders(user.id),
      getPortfolio(user.id),
      getDepositedCents(user.id),
    ]);

    const found: Indicator[] = [
      detectWashTrades(orders),
      detectOvertrading(orders, depositedCents as never),
      detectDispositionEffect(orders),
      detectConcentration(
        portfolio.positions.map((p) => ({
          symbol: p.symbol,
          valueCents: p.valueCents,
        })),
        portfolio.cashCents,
        orders,
      ),
      detectFomoBuying(orders),
      detectPanicSelling(orders),
      detectAveragingDown(orders),
    ].filter((i): i is Indicator => i !== null);

    const withPrice = orders.filter((o) => o.priceBeforeTry !== null).length;

    console.log(
      `── ${user.username}  ·  ${orders.length} emir  ·  ` +
        `${withPrice}'inde 24s önceki fiyat var  ·  ${found.length} bulgu`,
    );

    for (const indicator of found) {
      hits.set(indicator.key, (hits.get(indicator.key) ?? 0) + 1);
      console.log(`     ${indicator.key}`, indicator.facts);
    }
    console.log();
  }

  console.log('── ÖZET ──');
  for (const key of [
    'wash_trade',
    'overtrading',
    'disposition_effect',
    'concentration',
    'fomo_buying',
    'panic_selling',
    'averaging_down',
  ]) {
    console.log(`  ${key.padEnd(20)} ${hits.get(key) ?? 0} kullanıcı`);
  }

  // ⚠️ Havuz Node'un olay döngüsünü açık tutuyor; kapatmazsak betik
  // bitmesine rağmen süreç asılı kalır. Bu oturumda on hayalet sunucu
  // tam olarak böyle birikmişti.
  await db.$client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
