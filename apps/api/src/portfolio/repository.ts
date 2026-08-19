import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { accounts, assets, cashMovements, holdings } from '../db/schema.js';

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
