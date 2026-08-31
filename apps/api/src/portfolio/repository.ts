import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  accounts,
  assets,
  cashMovements,
  holdings,
  orders,
} from '../db/schema.js';

/**
 * Portföy sorguları.
 *
 * NEDEN FİYATLAR BURADA ÇEKİLMİYOR:
 * `market/repository.ts` içindeki `listAssetsWithLatestPrice()` zaten aktif
 * varlıkları güncel fiyatlarıyla getiriyor ve testi de var. Aynı LATERAL
 * sorgusunu ikinci kez yazmak yerine onu kullanıyoruz; birleştirme
 * bellekte yapılıyor (varlık sayısı ~25, maliyeti yok).
 *
 * Sorguyu kopyalasaydık bir gün biri fiyat mantığını değiştirir, diğerini
 * unutur ve portföy ekranı piyasa ekranından farklı fiyat gösterirdi.
 */

/** Kullanıcının nakit bakiyesi (kuruş). */
export async function getCashCents(userId: string): Promise<bigint | null> {
  const [account] = await db
    .select({ cashCents: accounts.cashCents })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);

  return account?.cashCents ?? null;
}

export interface HoldingRow {
  symbol: string;
  name: string;
  /** numeric(28,10) -> string. Zincir korunuyor, float'a düşmüyor. */
  quantity: string;
}

/**
 * Kullanıcının pozisyonları.
 *
 * `quantity > 0` filtresi: kullanıcı bir varlığın tamamını sattığında satır
 * silinmiyor, miktarı 0 oluyor. Filtrelemezsek portföyde "0,00 BTC" satırı
 * kalır ve ekran çöp gösterir.
 */
export async function getHoldings(userId: string): Promise<HoldingRow[]> {
  return db
    .select({
      symbol: assets.symbol,
      name: assets.name,
      quantity: holdings.quantity,
    })
    .from(holdings)
    .innerJoin(assets, eq(assets.id, holdings.assetId))
    .where(and(eq(holdings.userId, userId), gt(holdings.quantity, '0')))
    .orderBy(assets.sortOrder);
}

export type LedgerRow = {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: string;
  netCents: bigint;
};

/**
 * Kullanıcının bütün emirleri — maliyet hesabı için.
 *
 * ⚠️ SIRALAMA ŞART, SÜS DEĞİL.
 * `calculateCostBasis` defteri baştan sona yürüyor: alımda maliyet ekliyor,
 * satışta oransal azaltıyor. Sıra bozuksa satış kendinden önceki alımı
 * göremez ve maliyet yanlış çıkar — hata vermez, sadece yanlış sayı üretir.
 *
 * `executed_at` eşit olabilir (aynı saniyede iki emir); `id` ikinci ölçüt
 * olarak sırayı deterministik yapıyor.
 */
export async function getOrderLedger(userId: string): Promise<LedgerRow[]> {
  return db
    .select({
      symbol: assets.symbol,
      side: orders.side,
      quantity: orders.quantity,
      netCents: orders.netCents,
    })
    .from(orders)
    .innerJoin(assets, eq(assets.id, orders.assetId))
    .where(eq(orders.userId, userId))
    .orderBy(orders.executedAt, orders.id);
}

/**
 * Hesaba dışarıdan giren toplam para: kayıt bonusu + günlük bonuslar.
 *
 * NEDEN SADECE BU İKİSİ: `cash_movements` alım, satım ve komisyonu da
 * tutuyor. Ama onlar İÇ hareketler — nakit varlığa dönüşüyor, servet
 * değişmiyor. Kâr/zarar hesabında maliyet sayılacak olan yalnızca dışarıdan
 * gelen para.
 *
 * `::bigint` dökümü şart: PostgreSQL'de SUM(bigint) `numeric` döndürür ve
 * sürücü onu "10000000.00" gibi ondalıklı bir metin verebilir — `BigInt()`
 * o metni kabul etmez, hata fırlatır.
 */
export async function getDepositedCents(userId: string): Promise<bigint> {
  const [row] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${cashMovements.amountCents}), 0)::bigint`,
    })
    .from(cashMovements)
    .where(
      and(
        eq(cashMovements.userId, userId),
        inArray(cashMovements.kind, ['signup_bonus', 'daily_bonus']),
      ),
    );

  return BigInt(row?.total ?? '0');
}

/**
 * Son işlemler — cüzdan ekranındaki "SON İŞLEMLER" bloğu.
 *
 * ⚠️ `getOrderLedger`'DAN AYRI ve sebebi anlam farkı.
 *
 * Defter maliyet hesabı için var: TÜM emirleri, en eskiden yeniye,
 * eksiksiz döndürmesi ŞART — bir tanesi eksik olsa ortalama maliyet
 * yanlış çıkar. Bu sorgu ise ekran için: en yeniden eskiye, sınırlı.
 *
 * Aynı fonksiyonu iki amaca birden kullansaydık, biri için eklenen
 * `LIMIT` diğerinin hesabını sessizce bozardı.
 */
export async function getRecentOrders(
  userId: string,
  limit: number,
): Promise<
  Array<{
    id: string;
    symbol: string;
    name: string;
    side: 'buy' | 'sell';
    quantity: string;
    priceTry: string;
    feeCents: bigint;
    netCents: bigint;
    executedAt: Date;
    /**
     * Kullanıcının emri verirken yazdığı gerekçe. Boş bırakılabilir.
     *
     * ⚠️ KOLON BAŞTAN BERİ VARDI AMA SEÇİLMİYORDU — yani veri yazılıyor,
     * okunmuyordu. `POST /orders` notu kabul edip kaydediyor; bu sorgu
     * onu geri getirmediği için ekran hiç göremiyordu.
     */
    note: string | null;
  }>
> {
  /*
    ⚠️ İKİ KAYNAK BİRLEŞTİRİLİYOR: EMİRLER + ÇARK ÖDÜLLERİ.

    "Son işlemler" listesi yalnızca alım-satımı göstermiyor; şans
    çarkından gelen günlük bonuslar da kullanıcının gözünde bir
    "işlem". Ayrı listeler olsaydı kullanıcı bakiyesinin neden
    değiştiğini iki yere bakarak anlamak zorunda kalırdı.

    ⚠️ İKİSİ AYRI SORGU VE PARALEL. Tek sorguda UNION yapılabilirdi ama
    kolonlar uyuşmuyor (emirde varlık ve fiyat var, bonusta yok);
    birleştirmeyi bellekte yapmak hem okunur hem esnek.

    ⚠️ HER İKİSİ DE `limit` KADAR ÇEKİLİYOR, SONRA BİRLEŞTİRİLİP TEKRAR
    KIRPILIYOR. Sebebi: hangisinin daha yeni olduğunu önceden
    bilemiyoruz. Yarısını birinden yarısını ötekinden alsaydık, çok emir
    verip hiç çark çevirmemiş bir kullanıcının listesi eksik kalırdı.
  */
  const [dbOrders, dbMovements] = await Promise.all([
    db
      .select({
        id: orders.id,
        symbol: assets.symbol,
        name: assets.name,
        side: orders.side,
        quantity: orders.quantity,
        priceTry: orders.priceTry,
        feeCents: orders.feeCents,
        netCents: orders.netCents,
        executedAt: orders.executedAt,
        note: orders.note,
      })
      .from(orders)
      .innerJoin(assets, eq(assets.id, orders.assetId))
      .where(eq(orders.userId, userId))
      // ⚠️ `id` ikincil sıralama ölçütü: aynı milisaniyede iki emir
      // geçebilir ve yalnızca zamana göre sıralarsak sıraları her
      // sorguda değişir — liste kullanıcının gözünde titrer.
      .orderBy(desc(orders.executedAt), desc(orders.id))
      .limit(limit),
    db
      .select()
      .from(cashMovements)
      .where(
        and(
          eq(cashMovements.userId, userId),
          eq(cashMovements.kind, 'daily_bonus'),
        ),
      )
      .orderBy(desc(cashMovements.createdAt), desc(cashMovements.id))
      .limit(limit),
  ]);

  const combined = [
    ...dbOrders,
    ...dbMovements.map((m) => ({
      id: m.id,
      symbol: 'ÇARK',
      name: 'Şans Çarkı',
      side: (m.amountCents >= 0n ? 'buy' : 'sell') as 'buy' | 'sell',
      quantity: m.amountCents >= 0n ? '+1' : '-1',
      priceTry: (
        Number(m.amountCents >= 0n ? m.amountCents : -m.amountCents) / 100
      ).toString(),
      feeCents: 0n,
      netCents: m.amountCents >= 0n ? m.amountCents : -m.amountCents,
      executedAt: m.createdAt,
      /*
        ⚠️ ÇARK SATIRINDA KARAR NOTU YOK — ve olamaz.

        Not, kullanıcının bir emri verirken yazdığı gerekçe. Çark
        ödülü bir KARAR değil, bir olay: kullanıcı "neden" diye bir
        şey yazmadı, yazamazdı da. Boş metin koysaydık ekran boş bir
        alıntı kutusu çizerdi.
      */
      note: null as string | null,
    })),
  ];

  combined.sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime());
  return combined.slice(0, limit);
}

export async function getPortfolioHistory(
  userId: string,
  since: Date | null,
  usdAssetId: string | null = null,
): Promise<
  Array<{
    ts: Date;
    totalValueCents: bigint;
    usdRate: string | null;
  }>
> {
  const lowerBound =
    since === null
      ? sql`TRUE`
      : sql`ts >= ${since.toISOString()}::timestamp`;

  const rateJoin =
    usdAssetId === null
      ? sql`NULL::text AS usd_rate`
      : sql`(
          SELECT u.price_try FROM price_history u
          WHERE u.asset_id = ${usdAssetId} AND u.ts <= s.ts
          ORDER BY u.ts DESC LIMIT 1
        ) AS usd_rate`;

  const result = await db.execute<{
    ts: string | Date;
    total_value_cents: string;
    usd_rate: string | null;
  }>(sql`
    SELECT s.ts, s.total_value_cents, ${rateJoin}
    FROM (
      SELECT ts, total_value_cents
      FROM portfolio_snapshots
      WHERE user_id = ${userId} AND ${lowerBound}
    ) s
    ORDER BY s.ts ASC
  `);

  return result.map((row) => ({
    ts: new Date(row.ts),
    totalValueCents: BigInt(row.total_value_cents),
    usdRate: row.usd_rate,
  }));
}
