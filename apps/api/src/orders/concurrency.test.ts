/**
 * EMİR MOTORU — EŞZAMANLILIK TESTİ
 *
 * Bu dosya projenin tek bir sorusunu kanıtlıyor:
 *
 *   "Kullanıcı aynı anda iki alım emri gönderirse bakiyesi eksiye düşer mi?"
 *
 * ⚠️ NEDEN MOCK'LA YAZILAMAZ — VE BU TESTİN VAROLUŞ SEBEBİ BU.
 *
 * Test edilen şey uygulama kodu değil, VERİTABANININ DAVRANIŞI:
 * `SELECT ... FOR UPDATE`'in ikinci transaction'ı gerçekten bekletmesi,
 * `CHECK` kısıtının gerçekten reddetmesi, `UNIQUE`in gerçekten çakışması.
 * Sahte bir `db` nesnesi bunların hiçbirini yapmaz — mock testi yazsaydık
 * kilit satırını tamamen silsek bile YEŞİL kalırdı. Yani en çok korumak
 * istediğimiz kodu hiç test etmemiş olurduk.
 *
 * Bu yüzden burada gerçek PostgreSQL'e bağlanılıyor. Docker kapalıysa test
 * kırmızı olmuyor, ATLANIYOR (aşağıdaki `dbReady`) — Zeynep'in makinesinde
 * Docker kapalıyken `npm test` patlamasın diye.
 *
 * ⚠️ İZOLASYON KURALI — `leagues/cron.test.ts` BU HATAYI YAPIYOR.
 * O test gerçek ligi kapatıp yenisini açıyor; her `npm test` çalıştırmasında
 * veritabanına bir çöp lig dönemi ekliyor (bir ara 47 tane birikmişti).
 * Bu test kendi kullanıcısını ve kendi varlığını yaratıyor, sonunda siliyor.
 * Senin gerçek hesabına, gerçek varlıklara, gerçek fiyatlara dokunmuyor.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import postgres from 'postgres';
import { db } from '../db/client.js';
import {
  accounts,
  assets,
  cashMovements,
  holdings,
  orders,
  priceHistory,
  users,
} from '../db/schema.js';
import { toAmount } from '../lib/money.js';
import { executeOrder } from './repository.js';
import { OrderValidationError } from './calculate.js';

// ---------------------------------------------------------------------------
// SENARYONUN SAYILARI — hepsi elle doğrulanabilsin diye yuvarlak
// ---------------------------------------------------------------------------
//
// fiyat        100,00 TL      (1 birim)
// miktar       200 birim
// brüt         20.000,00 TL = 2.000.000 kuruş
// komisyon     %0,1         =     2.000 kuruş   (FEE_BASIS_POINTS = 10)
// NET (alım)   20.020,00 TL = 2.002.000 kuruş   -> hesaptan çıkan
//
// başlangıç bakiyesi   100.000,00 TL = 10.000.000 kuruş
//
// 10.000.000 / 2.002.000 = 4,995...  ->  SIĞAN EMİR SAYISI: 4
//   4 emir   ->  8.008.000 kuruş
//   5. emir 10.010.000 ister, bakiye yetmez.
//
// Kalan bakiye: 10.000.000 - 8.008.000 = 1.992.000 kuruş = 19.920,00 TL

const START_BALANCE = 10_000_000n; // kuruş
const NET_PER_ORDER = 2_002_000n; // kuruş (brüt + komisyon)
const AFFORDABLE_ORDERS = 4;
const EXPECTED_END_BALANCE =
  START_BALANCE - NET_PER_ORDER * BigInt(AFFORDABLE_ORDERS);

/** Aynı anda gönderilecek emir sayısı — sığandan fazlası bilerek. */
const CONCURRENT_ORDERS = 10;

const PRICE_TEXT = '100.00000000';
const QUANTITY_TEXT = '200';

// Paralel çalıştırmada çakışmasın diye her koşuya özel son ek.
const SUFFIX = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const TEST_SYMBOL = `ZZTEST${SUFFIX}`.slice(0, 24);

let userId = '';
let assetId = '';
let dbReady = false;

// ---------------------------------------------------------------------------
// KURULUM
// ---------------------------------------------------------------------------

beforeAll(async () => {
  try {
    await db.execute(sql`SELECT 1`);
    dbReady = true;
  } catch {
    // Docker kapalı. Testler atlanacak, kırmızı olmayacak.
    return;
  }

  // 1. Kendi varlığımız.
  //
  // ⚠️ `is_active = true` ZORUNLU: `executeOrder` pasif varlığı reddediyor
  // ("delisting" davranışı). Yani test süresince (~1 sn) bu varlık
  // `GET /assets` cevabında da görünür. Sembol `ZZTEST...` seçildi ki
  // gerçek bir sembolle karışmasın, `sortOrder` ile de en sona düşsün.
  const [createdAsset] = await db
    .insert(assets)
    .values({
      symbol: TEST_SYMBOL,
      name: 'Eşzamanlılık Testi Varlığı',
      kind: 'crypto',
      isActive: true,
      sortOrder: 9999,
    })
    .returning({ id: assets.id });

  assetId = createdAsset!.id;

  // 2. Taze fiyat.
  //
  // ⚠️ `MAX_PRICE_AGE_MS = 120_000` — fiyat 120 saniyeden eskiyse emir
  // STALE_PRICE ile reddedilir. Damgayı cron'un yazdığı gibi düz `Date`
  // olarak veriyoruz: gidiş ve dönüş aynı yoldan geçtiği için saat dilimi
  // sorunu doğmuyor (kolon `timestamp`, yani saat dilimsiz).
  await db.insert(priceHistory).values({
    assetId,
    ts: new Date(),
    priceTry: PRICE_TEXT,
  });

  // 3. Kendi kullanıcımız.
  const [createdUser] = await db
    .insert(users)
    .values({
      email: `concurrency+${SUFFIX}@test.local`,
      username: `conc_${SUFFIX}`,
      passwordHash: 'test-not-a-real-hash',
      firstName: 'Eszamanlilik',
      lastName: 'Testi',
      isEmailVerified: true,
      isPublic: false,
    })
    .returning({ id: users.id });

  userId = createdUser!.id;

  await db.insert(accounts).values({ userId, cashCents: START_BALANCE });
});

afterAll(async () => {
  if (!dbReady) return;

  // Kullanıcıyı silmek accounts / orders / holdings / cash_movements'ı,
  // varlığı silmek price_history / orders / holdings'i CASCADE ile götürüyor.
  // Şemadaki ilgili yabancı anahtarların hepsi ON DELETE CASCADE.
  if (userId) await db.delete(users).where(eq(users.id, userId));
  if (assetId) await db.delete(assets).where(eq(assets.id, assetId));
});

// ---------------------------------------------------------------------------
// KATMAN 1 — SATIR KİLİDİ (SELECT ... FOR UPDATE)
// ---------------------------------------------------------------------------

describe('Katman 1 · satır kilidi', () => {
  it(
    `${CONCURRENT_ORDERS} emir aynı anda gönderilince yalnızca ${AFFORDABLE_ORDERS} tanesi geçer`,
    async () => {
      if (!dbReady) return;

      /*
        ⚠️ `Promise.all` DEĞİL `allSettled`.

        `Promise.all` ilk reddedilende kısa devre yapar ve geri kalanın
        sonucunu ATAR. Burada reddedilenler asıl kanıtın parçası: "bakiye
        yetersiz" diyen 6 emrin gerçekten öyle reddedildiğini görmemiz lazım.
      */
      const results = await Promise.allSettled(
        Array.from({ length: CONCURRENT_ORDERS }, (_unused, index) =>
          executeOrder({
            userId,
            symbol: TEST_SYMBOL,
            side: 'buy',
            quantity: toAmount(QUANTITY_TEXT),
            // Her emir AYRI anahtar — burada idempotency'yi değil kilidi
            // sınıyoruz. Aynı anahtarı verseydik 9 tanesi "tekrar" sayılır,
            // kilit hiç test edilmezdi.
            idempotencyKey: `conc-${SUFFIX}-${index}`,
          }),
        ),
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      // --- 1. Tam olarak sığan kadarı geçti mi ---
      //
      // ⚠️ ASIL KANIT BU SATIR. Kilit olmasaydı 10 emrin HEPSİ bakiyeyi
      // 10.000.000 olarak okur, hepsi "yeterli" der ve hepsi yazardı.
      // Sonuç: 10 emir ve bakiye 7.998.000 (en son yazanın değeri).
      // Yani `.for("update")` silinirse bu satır 4 yerine 10 görür.
      expect(succeeded).toHaveLength(AFFORDABLE_ORDERS);
      expect(failed).toHaveLength(CONCURRENT_ORDERS - AFFORDABLE_ORDERS);

      // --- 2. Reddedilenlerin SEBEBİ doğru mu ---
      //
      // Sayı tutup sebep tutmuyorsa test yalan söylüyor demektir: emirler
      // başka bir nedenden (fiyat bayat, varlık yok) düşmüş olabilir ve
      // kilit yine hiç sınanmamış olurdu.
      for (const rejection of failed) {
        const reason = (rejection as PromiseRejectedResult).reason;
        expect(reason).toBeInstanceOf(OrderValidationError);
        expect((reason as OrderValidationError).code).toBe('INSUFFICIENT_FUNDS');
      }

      // --- 3. Bakiye ---
      const [account] = await db
        .select({ cashCents: accounts.cashCents })
        .from(accounts)
        .where(eq(accounts.userId, userId));

      expect(account!.cashCents).toBe(EXPECTED_END_BALANCE);
      expect(account!.cashCents >= 0n).toBe(true);

      // --- 4. Defter tutarlı mı ---
      //
      // Bakiyenin doğru olması yetmez: emir sayısı, holding ve nakit
      // hareketleri de aynı hikâyeyi anlatmalı. Biri tutup diğeri tutmuyorsa
      // transaction'ın bir parçası kaçmış demektir.
      const orderRows = await db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.userId, userId), eq(orders.assetId, assetId)));

      expect(orderRows).toHaveLength(AFFORDABLE_ORDERS);

      const [holding] = await db
        .select({ quantity: holdings.quantity })
        .from(holdings)
        .where(and(eq(holdings.userId, userId), eq(holdings.assetId, assetId)));

      // 4 emir x 200 birim = 800
      expect(Number(holding!.quantity)).toBe(800);

      // Her emir İKİ nakit hareketi yazıyor (işlem + komisyon ayrı satır).
      const movements = await db
        .select({ amountCents: cashMovements.amountCents })
        .from(cashMovements)
        .where(eq(cashMovements.userId, userId));

      expect(movements).toHaveLength(AFFORDABLE_ORDERS * 2);

      // Hareketlerin toplamı bakiyedeki düşüşe birebir eşit olmalı.
      const movementSum = movements.reduce(
        (total, m) => total + m.amountCents,
        0n,
      );
      expect(movementSum).toBe(-(NET_PER_ORDER * BigInt(AFFORDABLE_ORDERS)));
    },
    30_000,
  );

  it(
    'kilit BAKİYEYİ OKUMADAN ÖNCE alınıyor — kayıp güncelleme olmuyor',
    async () => {
      if (!dbReady) return;

      /*
        ⚠️ ÜSTTEKİ TEST TEK BAŞINA YETMİYOR, VE İLK İKİ DENEMEM YETERSİZDİ.
        Yol kayıt için burada duruyor — asıl ders bu.

        1. DENEME: ham SQL ile kilit alıp `FOR UPDATE NOWAIT` ile ikinci
           okumanın hata verdiğini sınadım. `executeOrder`'a hiç dokunmuyordu:
           sadece "PostgreSQL FOR UPDATE'i onurlandırıyor mu" diyordu.
           Kilit koddan TAMAMEN silindiğinde bile yeşil kaldı.

        2. DENEME: kilidi dışarıdan tutup emrin BEKLEDİĞİNİ sınadım. O da
           yeşil kaldı — çünkü `UPDATE accounts` zaten kendi satır kilidini
           alıyor. Emir yine bekliyordu, ama YANLIŞ YERDE: bakiyeyi çoktan
           (eski değeriyle) okuduktan sonra.

        Aradaki fark bütün hatanın kaynağı:

          FOR UPDATE VARSA   -> önce BEKLER, sonra GÜNCEL bakiyeyi okur
          FOR UPDATE YOKSA   -> önce ESKİ bakiyeyi okur, sonra yazarken bekler
                                ve araya giren değişikliği EZER

        İkincisinin adı KAYIP GÜNCELLEME (lost update). Bu test onu kuruyor:

          a) Bakiye 100.000 TL.
          b) Başka bağlantı satırı kilitler ve bakiyeyi 10.000 TL yapar,
             henüz COMMIT etmez.
          c) 20.020 TL'lik emir başlatılır. 100.000'e sığar, 10.000'e sığmaz.
          d) Kilit bırakılır.

        FOR UPDATE varsa emir (b)'yi görür ve "bakiye yetersiz" der.
        Yoksa 100.000'i okumuştur, emri geçirir ve (b)'nin yazdığını siler.
      */
      const connectionString =
        process.env.DATABASE_URL ??
        'postgresql://postgres:postgrespassword@127.0.0.1:5433/portfolio_league';

      // İKİNCİ, AYRI bağlantı. Kilidi paylaşılan havuzdan alsaydık emir
      // kendi kilidimizi beklerdi ve test asılı kalırdı.
      const otherClient = postgres(connectionString, { max: 1 });

      // (a) Temiz başlangıç — üstteki test bakiyeyi tüketti.
      await db
        .update(accounts)
        .set({ cashCents: START_BALANCE })
        .where(eq(accounts.userId, userId));

      // Emrin sığmayacağı yeni bakiye: 10.000 TL. Emir 20.020 TL istiyor.
      const REDUCED_BALANCE = 1_000_000n;

      /*
        ⚠️ `!` (kesin atama iddiası) — değişken CALLBACK İÇİNDE atanıyor.
        TypeScript kapanış içindeki atamayı takip edemiyor; `= null` ile
        başlatsaydık `await` noktasında tipi hâlâ `null` sanardı.
      */
      let orderPromise!: Promise<Awaited<ReturnType<typeof executeOrder>>>;

      try {
        await otherClient.begin(async (tx) => {
          // (b) Satırı kilitle ve DEĞİŞTİR — henüz COMMIT yok.
          await tx`
            SELECT cash_cents FROM accounts
            WHERE user_id = ${userId}::uuid
            FOR UPDATE
          `;
          await tx`
            UPDATE accounts SET cash_cents = ${REDUCED_BALANCE.toString()}::bigint
            WHERE user_id = ${userId}::uuid
          `;

          // (c) Emri başlat — bitmesini BEKLEMEDEN.
          orderPromise = executeOrder({
            userId,
            symbol: TEST_SYMBOL,
            side: 'buy',
            quantity: toAmount(QUANTITY_TEXT),
            idempotencyKey: `lostupdate-${SUFFIX}`,
          });

          // Reddedilirse "yakalanmamış promise" uyarısı çıkmasın.
          void orderPromise.catch(() => undefined);

          // Emrin kilide dayanması için kısa bir pay. Bloktan çıkınca
          // `begin` COMMIT ediyor, yani (d) kilidi bırakıyor.
          await new Promise((resolve) => setTimeout(resolve, 400));
        });
      } finally {
        await otherClient.end();
      }

      // (d) sonrası: emir güncel bakiyeyi görmüş olmalı ve reddedilmeli.
      //
      // ⚠️ ASIL KANIT. Kilit yoksa emir 100.000 okumuş olur, geçer,
      // ve aşağıdaki `rejects` tutmaz.
      await expect(orderPromise).rejects.toMatchObject({
        code: 'INSUFFICIENT_FUNDS',
      });

      // Araya giren yazma EZİLMEDİ mi — kayıp güncellemenin doğrudan ölçüsü.
      const [account] = await db
        .select({ cashCents: accounts.cashCents })
        .from(accounts)
        .where(eq(accounts.userId, userId));

      expect(account!.cashCents).toBe(REDUCED_BALANCE);
    },
    30_000,
  );
});

// ---------------------------------------------------------------------------
// KATMAN 2 — CHECK cash_cents >= 0
// ---------------------------------------------------------------------------

describe('Katman 2 · veritabanı kısıtı', () => {
  it('bakiyeyi eksiye çekmeye çalışan HAM sorgu reddedilir', async () => {
    if (!dbReady) return;

    /*
      ⚠️ BU KATMAN NEDEN AYRI TEST EDİLİYOR.

      Birinci katmanı (kilit) ELLE yazıyoruz. Yani hata yapabiliriz: birisi
      `.for("update")` satırını "gereksiz" diye silebilir, ya da yeni bir kod
      yolu bakiyeye kilidi hiç almadan dokunabilir.

      `CHECK` kısıtı kimseye güvenmiyor. Uygulama kodu tamamen yanlış olsa
      bile VERİ bozulmuyor.

      Test bilerek `executeOrder`'ı KULLANMIYOR — doğrudan UPDATE atıyor.
      Amaç uygulamayı değil, kısıtın hâlâ orada durduğunu sınamak.
    */
    await expect(
      db.execute(
        sql`UPDATE accounts SET cash_cents = -1 WHERE user_id = ${userId}::uuid`,
      ),
    ).rejects.toThrow();

    // Reddedilen UPDATE hiçbir iz bırakmamalı.
    const [account] = await db
      .select({ cashCents: accounts.cashCents })
      .from(accounts)
      .where(eq(accounts.userId, userId));

    expect(account!.cashCents >= 0n).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// KATMAN 3 — UNIQUE(user_id, idempotency_key)
// ---------------------------------------------------------------------------

describe('Katman 3 · idempotency', () => {
  it('aynı anahtarla eşzamanlı 5 istek tek emir yaratır ve bakiyeden bir kez düşer', async () => {
    if (!dbReady) return;

    // Bakiyeyi temiz başlangıca çek — üstteki test onu tüketti.
    await db
      .update(accounts)
      .set({ cashCents: START_BALANCE })
      .where(eq(accounts.userId, userId));

    const sharedKey = `idem-${SUFFIX}`;

    /*
      Gerçek senaryo: kullanıcı "Al" düğmesine bastı, ağ takıldı, telefon
      isteği yeniden gönderdi. İki istek sunucuya AYNI ANDA ulaşabilir.

      Beklenen: bir emir yaratılır, diğerleri var olanın sonucunu döner
      (`replayed: true`). Bakiyeden BİR kez düşer.
    */
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        executeOrder({
          userId,
          symbol: TEST_SYMBOL,
          side: 'buy',
          quantity: toAmount(QUANTITY_TEXT),
          idempotencyKey: sharedKey,
        }),
      ),
    );

    const fulfilled = results.filter(
      (
        r,
      ): r is PromiseFulfilledResult<
        Awaited<ReturnType<typeof executeOrder>>
      > => r.status === 'fulfilled',
    );

    // Hiçbiri hata almamalı — tekrar gönderim bir HATA değil, aynı sonuç.
    expect(fulfilled).toHaveLength(5);

    // Tam olarak biri "yeni emir", dördü "tekrar".
    const fresh = fulfilled.filter((r) => r.value.replayed === false);
    const replays = fulfilled.filter((r) => r.value.replayed === true);
    expect(fresh).toHaveLength(1);
    expect(replays).toHaveLength(4);

    // Hepsi AYNI emri işaret etmeli.
    const distinctOrderIds = new Set(fulfilled.map((r) => r.value.orderId));
    expect(distinctOrderIds.size).toBe(1);

    // Veritabanında o anahtarla tek satır var.
    const rows = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(eq(orders.userId, userId), eq(orders.idempotencyKey, sharedKey)),
      );

    expect(rows).toHaveLength(1);

    // Bakiyeden yalnızca BİR emir düştü.
    const [account] = await db
      .select({ cashCents: accounts.cashCents })
      .from(accounts)
      .where(eq(accounts.userId, userId));

    expect(account!.cashCents).toBe(START_BALANCE - NET_PER_ORDER);
  }, 30_000);

  it('UNIQUE kısıtı uygulama kodundan bağımsız olarak da çakışmayı engeller', async () => {
    if (!dbReady) return;

    /*
      Katman 2'deki gerekçenin aynısı: `executeOrder` içindeki "bu anahtar
      daha önce kullanılmış mı" kontrolünü ELLE yazdık, yanlış yazmış
      olabiliriz. Kısıt yine de ikinci satırı reddetmeli.
    */
    const key = `raw-${SUFFIX}`;

    const row = {
      userId,
      assetId,
      side: 'buy' as const,
      quantity: '1.0000000000',
      priceTry: PRICE_TEXT,
      grossCents: 10_000n,
      feeCents: 10n,
      netCents: 10_010n,
      idempotencyKey: key,
    };

    await db.insert(orders).values(row);

    await expect(db.insert(orders).values(row)).rejects.toThrow();
  });
});
