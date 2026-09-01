/**
 * repository.ts — davranış göstergelerinin veri katmanı.
 *
 * ⚠️ İŞ BÖLÜMÜ NET: burası SORGULUYOR, `indicators.ts` KARAR VERİYOR.
 *
 * Göstergelerin tamamı saf fonksiyon — veritabanına dokunmadıkları için
 * Docker kapalıyken test edilebiliyorlar. O ayrımın bedeli bu dosya:
 * gereken her şeyi önceden çekip düz veri olarak vermek.
 *
 * ⚠️ BURADA YALNIZCA BİR YENİ SORGU VAR. Nakit, pozisyon ve yatırılan para
 * `portfolio/` içinde zaten var ve testli; ikinci kez yazmak yerine
 * `service.ts` onları çağırıyor. Aynı sorguyu iki yere kopyalamak bu
 * projede bulunan hataların en sık türü.
 */

import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { toUtcDate } from '../lib/pg-time.js';
import {
  AMOUNT_SCALE,
  PRICE_SCALE,
  parseScaled,
  type Amount,
  type Penny,
} from '../lib/money.js';
import {
  PRICE_LOOKBACK_HOURS,
  type BehaviorPricedOrder,
} from './indicators.js';

/**
 * Sorgudan dönen ham satır — hepsi metin, dönüşüm aşağıda.
 *
 * `Record<string, unknown>` genişletiyor çünkü `db.execute` satır tipinin
 * indekslenebilir olmasını istiyor: ham SQL'de kolonların derleme anında
 * bilinmesi mümkün değil, Drizzle bunu tip parametresiyle bize bırakıyor.
 */
interface RawRow extends Record<string, unknown> {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  /** ⚠️ `Date` DEĞİL, METİN — sebebi `toUtcDate`'te. */
  executed_at: string;
  price_try: string;
  net_cents: string;
  fee_cents: string;
  quantity: string;
  price_before: string | null;
}

/**
 * Kullanıcının bütün emirleri + her emrin 24 saat öncesindeki fiyatı.
 *
 * ⚠️ NEDEN TEK SORGU — N+1'DEN KAÇINMAK İÇİN.
 *
 * Her emir için ayrı bir "24 saat önce ne kadardı" sorgusu atsaydık, 200
 * emri olan bir kullanıcı 201 gidiş-dönüş demek olurdu. `LATERAL` her
 * satır için alt sorguyu çalıştırıyor ama hepsi TEK turda dönüyor.
 * Aynı desen `what-if/repository.ts` `findMultiplesForDate` içinde de var.
 *
 * ⚠️ `<=` KULLANILIYOR, TAM EŞLEŞME DEĞİL — VE BU FORWARD-FILL DEMEK.
 *
 * "Tam 24 saat önce" diye bir fiyat kaydı çoğu zaman yok: kripto 15
 * saniyede bir yazılıyor ama TCMB hafta sonu ve tatilde kur YAYIMLAMIYOR.
 * Cuma günü alınan bir dövizin "24 saat öncesi" perşembeye denk gelir;
 * pazartesi alınan birininki cumaya. `ORDER BY ts DESC LIMIT 1` en yakın
 * ÖNCEKİ kaydı alıyor.
 *
 * Bu bilinçli: projenin baştan beri kayıtlı kuralı (`CLAUDE.md`, bilinen
 * tuzak 1). Tam eşleşme arasaydık döviz emirlerinin neredeyse hiçbiri
 * ölçülemezdi ve 5-6. göstergeler sessizce yalnızca kriptoya bakardı.
 *
 * ⚠️ VARLIĞIN O KADAR ESKİ VERİSİ YOKSA `null` DÖNÜYOR — sıfır değil.
 * Yeni listelenen bir varlığın 24 saat öncesi olmayabilir. `indicators.ts`
 * `null` olanları ölçümün DIŞINDA bırakıyor; sıfır dönseydik "%100
 * yükselmiş" gibi uydurma bir hareket üretirdi.
 */
export async function getBehaviorOrders(
  userId: string,
): Promise<BehaviorPricedOrder[]> {
  const rows = await db.execute<RawRow>(sql`
    SELECT
      o.id::text        AS id,
      a.symbol          AS symbol,
      o.side            AS side,
      o.executed_at     AS executed_at,
      o.price_try       AS price_try,
      o.net_cents::text AS net_cents,
      o.fee_cents::text AS fee_cents,
      o.quantity        AS quantity,
      p.price_before    AS price_before
    FROM orders o
    JOIN assets a ON a.id = o.asset_id
    LEFT JOIN LATERAL (
      SELECT ph.price_try AS price_before
      FROM price_history ph
      WHERE ph.asset_id = o.asset_id
        AND ph.ts <= o.executed_at - make_interval(hours => ${PRICE_LOOKBACK_HOURS})
      ORDER BY ph.ts DESC
      LIMIT 1
    ) p ON true
    WHERE o.user_id = ${userId}
    ORDER BY o.executed_at, o.id
  `);

  /*
    ⚠️ SIRALAMA SÜS DEĞİL. 3 ve 7. göstergeler defteri baştan sona
    yürüyüp maliyet biriktiriyor; sıra bozuksa satış kendinden önceki
    alımı göremez ve maliyet YANLIŞ ÇIKAR — hata vermeden.

    `executed_at` eşit olabilir (aynı saniyede iki emir), `id` ikinci
    ölçüt olarak sırayı deterministik yapıyor. Aynı gerekçe
    `portfolio/repository.ts` `getOrderLedger`'da da yazılı.
  */

  return rows.map(toBehaviorOrder);
}

/**
 * Ham satırı ölçekli `bigint`'lere çevirir.
 *
 * ⚠️ HER ŞEY METİN OLARAK GELİYOR — VE BU İYİ.
 *
 * `numeric` kolonları sürücü metin olarak veriyor; `bigint` kolonları da
 * (postgres.js int8'i varsayılan olarak metne çeviriyor, `db.execute` ham
 * sorgu olduğu için Drizzle'ın `mode: 'bigint'` dönüşümü devreye girmiyor).
 *
 * Metinden `bigint`'e geçmek KAYIPSIZ. Arada `Number`'a uğrasaydık
 * `money.ts`'in varlık sebebini çöpe atardık: 0,1 + 0,2 ≠ 0,3.
 */
function toBehaviorOrder(row: RawRow): BehaviorPricedOrder {
  return {
    id: row.id,
    symbol: row.symbol,
    side: row.side,
    executedAt: toUtcDate(row.executed_at),
    priceTry: parseScaled(row.price_try, PRICE_SCALE),
    netCents: BigInt(row.net_cents) as Penny,
    feeCents: BigInt(row.fee_cents) as Penny,
    quantity: parseScaled(row.quantity, AMOUNT_SCALE) as Amount,
    priceBeforeTry:
      row.price_before === null
        ? null
        : parseScaled(row.price_before, PRICE_SCALE),
  };
}

/*
  ⚠️ `toUtcDate` BURADAN TAŞINDI -> `lib/pg-time.ts`.

  Aynı tuzak `posts/service.ts`'te de vardı ve orada DÜZELTİLMEMİŞTİ:
  paylaşım kartındaki alış tarihi 3 saat erken okunuyordu. Bir yerde
  çözülüp diğerinde çözülmemesinin sebebi, düzeltmenin bu dosyanın
  içinde saklı olmasıydı — kimse başka bir modülde arayacağını bilmiyordu.

  Tuzağın tam anlatımı ve ölçümü artık `lib/pg-time.ts`'te; buradaki
  göstergeler için önemi şu: fark ölçenler (yıkama penceresi, elde tutma
  süresi) kaymadan etkilenmez, çünkü hepsi aynı yönde kayıp çıkarmada
  sadeleşir. Ama `detectOvertrading` "kaç ayrı günde işlem yapıldı"yı gün
  sınırına göre sayıyor — 09:45'lik emir 06:45'e kayınca gün değişebilir.
*/
