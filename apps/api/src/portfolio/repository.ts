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
    netCents: bigint;
    executedAt: Date;
  }>
> {
  return db
    .select({
      id: orders.id,
      symbol: assets.symbol,
      name: assets.name,
      side: orders.side,
      quantity: orders.quantity,
      priceTry: orders.priceTry,
      netCents: orders.netCents,
      executedAt: orders.executedAt,
    })
    .from(orders)
    .innerJoin(assets, eq(assets.id, orders.assetId))
    .where(eq(orders.userId, userId))
    // ⚠️ `id` ikincil sıralama ölçütü: aynı milisaniyede iki emir
    // geçebilir ve yalnızca zamana göre sıralarsak sıraları her
    // sorguda değişir — liste kullanıcının gözünde titrer.
    .orderBy(desc(orders.executedAt), desc(orders.id))
    .limit(limit);
}
