/**
 * Eşzamanlılık kanıtı — ELLE ÇALIŞTIRILAN BETİK.
 *
 *     npx tsx apps/api/src/orders/concurrency-check.ts
 *
 * NEDEN VITEST DEĞİL:
 * Bu betiğin kanıtladığı şey PostgreSQL'in satır kilidi davranışı. Sahte bir
 * `db` nesnesi kilitlemez — mock'la yazsaydık mock'u test etmiş olurduk.
 * Gerçek veritabanı gerektiği için `npm test` akışına sokmuyoruz (Docker
 * bağımlılığı, testler arası temizlik ayrı bir karar). Elle çalıştırılıyor.
 *
 * NE KANITLIYOR (docs/01-plan.md 14):
 *   1. Aynı anda iki alım -> bakiye eksiye DÜŞMEZ, biri reddedilir
 *   2. Aynı Idempotency-Key ile iki paralel istek -> TEK emir
 *
 * Birincisi `SELECT ... FOR UPDATE` kilidini, ikincisi kilit + UNIQUE
 * kısıtının birlikte çalışmasını sınıyor.
 */

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { accounts, assets, priceHistory, users } from '../db/schema.js';
import { toAmount } from '../lib/money.js';
import { OrderValidationError } from './calculate.js';
import { executeOrder } from './repository.js';

/** Test verisi gerçek varlıklara karışmasın diye ayrı bir sembol. */
const TEST_SYMBOL = 'ZZ_CONCURRENCY_TEST';
const START_BALANCE = 10_000_000n; // 100.000 TL
const PRICE_TRY = '3000000.00000000'; // 1 birim = 3.000.000 TL
const QUANTITY = '0.02'; // 60.000 TL -> iki tanesi bakiyeyi aşar

async function setup(): Promise<{ userId: string; assetId: string }> {
  // Her çalıştırmada yeni kullanıcı — önceki denemeden kalan bakiye
  // sonucu bozmasın.
  const [user] = await db
    .insert(users)
    .values({
      email: `concurrency-${Date.now()}@test.local`,
      passwordHash: 'x',
      displayName: 'Concurrency Test',
    })
    .returning({ id: users.id });

  if (!user) throw new Error('kullanıcı oluşturulamadı');

  await db.insert(accounts).values({
    userId: user.id,
    cashCents: START_BALANCE,
  });

  const [asset] = await db
    .insert(assets)
    .values({
      symbol: TEST_SYMBOL,
      name: 'Concurrency Test Asset',
      kind: 'crypto',
      isActive: true,
      sortOrder: 9999,
    })
    .returning({ id: assets.id });

  if (!asset) throw new Error('varlık oluşturulamadı');

  // Fiyatı BİZ yazıyoruz: cron çalışmıyor olabilir ve emir motoru
  // 120 saniyeden eski fiyatı reddediyor.
  await db.insert(priceHistory).values({
    assetId: asset.id,
    ts: new Date(),
    priceTry: PRICE_TRY,
  });

  return { userId: user.id, assetId: asset.id };
}

async function cleanup(userId: string, assetId: string): Promise<void> {
  // users ve assets silinince orders/holdings/cash_movements/price_history
  // yabancı anahtar CASCADE ile birlikte gidiyor.
  await db.delete(users).where(eq(users.id, userId));
  await db.delete(assets).where(eq(assets.id, assetId));
}

async function currentBalance(userId: string): Promise<bigint> {
  const [account] = await db
    .select({ cashCents: accounts.cashCents })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);

  return account?.cashCents ?? 0n;
}

/** Hata nesnesinden okunabilir bir etiket üretir. */
function describe(result: PromiseSettledResult<unknown>): string {
  if (result.status === 'fulfilled') return 'BAŞARILI';
  const error = result.reason;
  return error instanceof OrderValidationError
    ? `RED (${error.code})`
    : `HATA (${error instanceof Error ? error.message : String(error)})`;
}

// ---------------------------------------------------------------------------
// SENARYO 1 — aynı anda iki alım
// ---------------------------------------------------------------------------

async function scenarioParallelBuys(): Promise<boolean> {
  const { userId, assetId } = await setup();

  try {
    console.log('\n--- SENARYO 1: aynı anda iki alım ---');
    console.log(`Bakiye     : ${START_BALANCE} kuruş (100.000 TL)`);
    console.log(`Her emir   : ${QUANTITY} birim x 3.000.000 TL = 60.000 TL + komisyon`);
    console.log('İkisi birden geçerse 120.000 TL harcanmış olur -> bakiye eksiye düşer.\n');

    // Promise.all DEĞİL, allSettled: biri reddedilecek ve bu BEKLENEN sonuç.
    // Promise.all ilk redde diğerini beklemeden çıkardı.
    const results = await Promise.allSettled([
      executeOrder({
        userId,
        symbol: TEST_SYMBOL,
        side: 'buy',
        quantity: toAmount(QUANTITY),
        idempotencyKey: 'parallel-a',
      }),
      executeOrder({
        userId,
        symbol: TEST_SYMBOL,
        side: 'buy',
        quantity: toAmount(QUANTITY),
        idempotencyKey: 'parallel-b',
      }),
    ]);

    results.forEach((result, index) => {
      console.log(`  Emir ${index + 1}: ${describe(result)}`);
    });

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const balance = await currentBalance(userId);

    console.log(`\nSonraki bakiye: ${balance} kuruş`);

    const passed = succeeded === 1 && balance >= 0n;

    console.log(
      passed
        ? '✅ GEÇTİ — tam olarak biri geçti, bakiye eksiye düşmedi'
        : `❌ KALDI — ${succeeded} emir geçti, bakiye ${balance}`,
    );

    return passed;
  } finally {
    await cleanup(userId, assetId);
  }
}

// ---------------------------------------------------------------------------
// SENARYO 2 — aynı Idempotency-Key ile iki paralel istek
// ---------------------------------------------------------------------------

async function scenarioDuplicateKey(): Promise<boolean> {
  const { userId, assetId } = await setup();

  try {
    console.log('\n--- SENARYO 2: aynı Idempotency-Key, iki paralel istek ---');
    console.log('Kullanıcının ağı koptu, aynı emri iki kez gönderdi.');
    console.log('İkisi de işlenirse iki kez para öder.\n');

    const sameKey = 'retry-same-key';

    const results = await Promise.allSettled([
      executeOrder({
        userId,
        symbol: TEST_SYMBOL,
        side: 'buy',
        quantity: toAmount(QUANTITY),
        idempotencyKey: sameKey,
      }),
      executeOrder({
        userId,
        symbol: TEST_SYMBOL,
        side: 'buy',
        quantity: toAmount(QUANTITY),
        idempotencyKey: sameKey,
      }),
    ]);

    const orderIds = new Set<string>();
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        orderIds.add(result.value.orderId);
        console.log(
          `  İstek ${index + 1}: BAŞARILI  orderId=${result.value.orderId.slice(0, 8)}…  replayed=${result.value.replayed}`,
        );
      } else {
        console.log(`  İstek ${index + 1}: ${describe(result)}`);
      }
    });

    const balance = await currentBalance(userId);
    const spent = START_BALANCE - balance;

    console.log(`\nHarcanan: ${spent} kuruş`);
    console.log(`Farklı emir sayısı: ${orderIds.size}`);

    // Tek emir yaratılmış olmalı: 60.000 TL + komisyon = 6.006.000 kuruş
    const passed = orderIds.size === 1 && spent === 6_006_000n;

    console.log(
      passed
        ? '✅ GEÇTİ — tek emir yaratıldı, para bir kez düşüldü'
        : `❌ KALDI — ${orderIds.size} farklı emir, ${spent} kuruş düşüldü`,
    );

    return passed;
  } finally {
    await cleanup(userId, assetId);
  }
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Emir motoru eşzamanlılık kontrolü');
  console.log('='.repeat(50));

  const results = [
    await scenarioParallelBuys(),
    await scenarioDuplicateKey(),
  ];

  console.log(`\n${'='.repeat(50)}`);
  const allPassed = results.every(Boolean);
  console.log(
    allPassed
      ? '✅ TÜM SENARYOLAR GEÇTİ'
      : '❌ EN AZ BİR SENARYO KALDI — kilit mantığı gözden geçirilmeli',
  );

  // Çıkış kodu: CI'ya bağlanmak istersek başarısızlık fark edilsin.
  process.exit(allPassed ? 0 : 1);
}

main().catch((error) => {
  console.error('Betik çöktü:', error);
  process.exit(1);
});
