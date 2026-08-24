import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { assets, priceHistory } from "../db/schema.js";

/**
 * Varlık türü — şemadaki enum'dan TÜRETİLİYOR, elle yazılmıyor.
 *
 * Elle yazsaydık ('crypto' | 'fx' | 'metal') şemadaki 'bist' değerini
 * kaçırırdık ve tip hatası alırdık; daha kötüsü, enum ileride büyüdüğünde
 * buradaki liste sessizce eskirdi. `$inferSelect` şemayı tek doğruluk
 * kaynağı yapıyor.
 */
export type AssetKind = (typeof assets.$inferSelect)['kind'];

export type AssetRow = {
  id: string;
  symbol: string;
  name: string;
  /**
   * Fiyatın hangi kaynaktan çekileceğini belirler:
   *   crypto -> Binance (USD) + TCMB kuruyla TL'ye çevrim
   *   fx     -> doğrudan TCMB kuru
   *   metal  -> kaynağı henüz yok (bu varlıklar is_active=false)
   *   bist   -> Faz 3
   */
  kind: AssetKind;
};

/** İşlem görebilir durumdaki varlıklar. */
export async function listActiveAssets(): Promise<AssetRow[]> {
  const rows = await db
    .select({
      id: assets.id,
      symbol: assets.symbol,
      name: assets.name,
      kind: assets.kind,
    })
    .from(assets)
    .where(eq(assets.isActive, true))
    .orderBy(assets.sortOrder);

  return rows;
}

/**
 * Bir fiyat kaydı yazar.
 *
 * `priceTry` NEDEN STRING?
 *
 * Kolon tipi numeric(24,8). Drizzle bu tipi string olarak alıp verir — ve bu
 * tam olarak istediğimiz şey. Zincir hiçbir yerde kırılmıyor:
 *
 *   Binance "63718.01" (string)
 *     -> toPrice()     -> bigint (1e8 ölçekli)
 *     -> usdToTry()    -> bigint
 *     -> formatScaled() -> "3058462.79489100" (string)
 *     -> numeric(24,8)  (veritabanı)
 *
 * Hiçbir adımda `number` kullanılmıyor, dolayısıyla float hatası giremiyor.
 *
 * `onConflictDoNothing`: PK(asset_id, ts) aynı anı iki kez yazmayı engelliyor.
 * Cron iki kez tetiklenirse ikinci yazma sessizce atlanır, hata fırlatmaz.
 * Idempotency'nin veritabanı tarafındaki hâli.
 */
export async function insertPrice(
  assetId: string,
  ts: Date,
  priceTry: string,
): Promise<void> {
  await db
    .insert(priceHistory)
    .values({ assetId, ts, priceTry })
    .onConflictDoNothing();
}

/**
 * Çok sayıda fiyat kaydını TEK sorguda yazar.
 *
 * NEDEN AYRI FONKSİYON: geri doldurma varlık başına ~3.300 satır yazıyor.
 * `insertPrice`'ı döngüde çağırsaydık her satır için ayrı bir gidiş-dönüş
 * olurdu — 3.300 tur. Toplu yazmada tek sorgu.
 *
 * Çağıran taraf listeyi makul parçalara bölmeli; on binlerce satırlık tek
 * INSERT hem belleği hem sorgu boyutu sınırlarını zorlar.
 */
export async function insertPrices(
  rows: Array<{ assetId: string; ts: Date; priceTry: string }>,
): Promise<void> {
  if (rows.length === 0) return;

  await db.insert(priceHistory).values(rows).onConflictDoNothing();
}

/** Bir varlığın en son yazılmış fiyatı. */
export async function latestPrice(assetId: string) {
  const rows = await db
    .select({ ts: priceHistory.ts, priceTry: priceHistory.priceTry })
    .from(priceHistory)
    .where(eq(priceHistory.assetId, assetId))
    // desc() ŞART: artan sıralamada limit(1) en ESKİ kaydı verir.
    .orderBy(desc(priceHistory.ts))
    .limit(1);

  return rows[0] ?? null;
}

export type AssetWithPrice = {
  symbol: string;
  name: string;
  priceTry: string | null;
  asOf: Date | null;
  /**
   * Bu varlığın EN ESKİ fiyat kaydı.
   *
   * ⚠️ NEDEN GEREKLİ: her varlık aynı tarihe gitmiyor. BTC 17 Ağustos
   * 2017'de başlıyor, SOL 11 Ağustos 2020'de. Ekran bunu bilmezse
   * kullanıcıya SOL için 2017'yi seçtirir ve "kayıt bulunamadı" hatası
   * alır — hata mesajı doğru ama seçenek en baştan sunulmamalıydı.
   *
   * "Ya alsaydın" ekranındaki tarih seçici ve grafiğin "Tümü" aralığı
   * bu değerden besleniyor.
   */
  firstAvailable: Date | null;
};

/**
 * Aktif varlıklar ve her birinin EN GÜNCEL fiyatı — tek sorguda.
 *
 * NEDEN TEK SORGU?
 *
 * Kolay yol şu olurdu: varlıkları çek, sonra her biri için latestPrice çağır.
 * 2 varlıkta 3 sorgu, 50 varlıkta 51 sorgu. Buna N+1 problemi denir ve veri
 * büyüdükçe sessizce yavaşlar — kod doğru görünür, sadece yavaştır.
 *
 * LATERAL JOIN her varlık için "en son fiyat" alt sorgusunu bir kez çalıştırır
 * ve hepsini tek sonuçta döndürür. Fiyatı hiç yazılmamış varlıklar da listede
 * kalır (LEFT JOIN), sadece price_try NULL gelir.
 */
export async function listAssetsWithLatestPrice(): Promise<AssetWithPrice[]> {
  const result = await db.execute<{
    symbol: string;
    name: string;
    price_try: string | null;
    // Ham SQL sonucunda sürücü timestamp'i STRING olarak veriyor
    // ("2026-08-18 09:19:00.17"), Date olarak değil.
    ts: string | Date | null;
    first_ts: string | Date | null;
  }>(sql`
    SELECT a.symbol, a.name, p.price_try, p.ts, f.first_ts
    FROM assets a
    LEFT JOIN LATERAL (
      SELECT price_try, ts
      FROM price_history
      WHERE asset_id = a.id
      ORDER BY ts DESC
      LIMIT 1
    ) p ON true
    LEFT JOIN LATERAL (
      -- ⚠️ MIN(ts) yerine ORDER BY ts ASC LIMIT 1.
      -- İkisi de aynı sonucu verir ama planları farklı: MIN() toplama
      -- fonksiyonu, LIMIT 1 ise birincil anahtarın (asset_id, ts) indeksinden
      -- İLK SATIRI okuyup durur. 3.500 satırlık varlıkta fark küçük,
      -- ama satır sayısı büyüdükçe ikincisi sabit maliyette kalır.
      SELECT ts AS first_ts
      FROM price_history
      WHERE asset_id = a.id
      ORDER BY ts ASC
      LIMIT 1
    ) f ON true
    WHERE a.is_active = true
    ORDER BY a.sort_order
  `);

  return result.map((row) => ({
    symbol: row.symbol,
    name: row.name,
    priceTry: row.price_try,
    asOf: toUtcDate(row.ts),
    firstAvailable: toUtcDate(row.first_ts),
  }));
}

/**
 * Bir aralık için grafik noktaları — SEYRELTİLMİŞ.
 *
 * ⚠️ SEYRELTME NEDEN ŞART.
 * Cron 15 saniyede bir yazıyor: varlık başına günde 5.760 satır. Bir aylık
 * aralık ~170.000 satır demek. Hepsini göndermek üç yeri birden boğar —
 * sorgu, ağ, ve çizim. Üstelik 390 piksel genişliğinde bir ekrana 170.000
 * nokta çizmenin görsel karşılığı da yok; her piksele 400 nokta düşer.
 *
 * ÇÖZÜM: zamanı kovalara böl, her kovadan SON fiyatı al. Bu tam olarak bir
 * mum grafiğinin "kapanış" mantığı — ortalama almak yerine son değeri
 * almak, fiyatın gerçekten olduğu bir değeri gösterir. Ortalama alsaydık
 * hiçbir an var olmamış bir fiyat çizerdik.
 *
 * ⚠️ NEDEN `date_trunc` DEĞİL.
 * `date_trunc` yalnızca sabit birimlerle çalışıyor (hour, day, week...).
 * Bize 5 dakikalık ve 6 saatlik kova da lazım. Epoch saniyesine çevirip
 * kova boyutuna bölerek tabana yuvarlamak her ölçüde çalışıyor.
 *
 * ⚠️ BU, EKSİK `granularity` KOLONUNA OLAN İHTİYACI GRAFİK İÇİN KALDIRIYOR.
 * Satır ister günlük geri doldurmadan ister 15 saniyelik cron'dan gelsin,
 * kova mantığı ikisini de aynı şekilde seyreltiyor. Kolon yine gerekli —
 * ama temizlik/özetleme işi için (docs/01-plan.md §5.1), grafik için değil.
 */
export type PricePoint = { ts: Date; priceTry: string };

export async function getPriceSeries(
  assetId: string,
  bucketSeconds: number,
  since: Date | null,
  /**
   * Üst sınır — yalnızca yakınlaştırmada kullanılıyor.
   *
   * Sabit aralıklarda ("son 1 ay") üst sınır her zaman "şimdi", yani
   * gereksiz. Serbest pencerede kullanıcı geçmişte bir bölgeye
   * yakınlaştırabiliyor ve o zaman iki uç da lazım.
   */
  until: Date | null = null,
): Promise<PricePoint[]> {
  /**
   * `since === null` -> "Tümü": alt sınır yok, varlığın ilk kaydından başlar.
   *
   * ⚠️ TARİH METİN OLARAK GEÇİLİYOR VE AÇIKÇA `::timestamp`'e ÇEVRİLİYOR.
   *
   * `sql\`ts >= ${since}\`` yazmak — yani JS `Date` nesnesini doğrudan
   * bağlamak — DÜZ bir sorguda çalışıyor ama İÇ İÇE bir `sql` parçasında
   * `ERR_INVALID_ARG_TYPE` ile patlıyor. Parça dışarıda kurulup `${...}`
   * ile gömüldüğü için sürücü değerin tipini kaybediyor.
   *
   * Ölçüldü: aynı sorgu `Date` ile patlıyor, ISO metin + cast ile 365 nokta
   * döndürüyor.
   *
   * ⚠️ `::timestamp` ŞART, `::timestamptz` DEĞİL. Kolon saat dilimsiz
   * (`timestamp`) ve cron UTC yazıyor. `timestamptz`'e çevirseydik sürücü
   * sunucunun yerel saat dilimini uygular ve Türkiye'de 3 saat kayardı —
   * sorgu yine çalışır, sonuç sessizce yanlış olurdu.
   */
  const lowerBound =
    since === null
      ? sql`TRUE`
      : sql`ts >= ${since.toISOString()}::timestamp`;

  // Aynı gerekçe: iç içe parçada Date bağlanamıyor, ISO metin + cast.
  const upperBound =
    until === null
      ? sql`TRUE`
      : sql`ts <= ${until.toISOString()}::timestamp`;

  const result = await db.execute<{
    ts: string | Date;
    price_try: string;
  }>(sql`
    SELECT DISTINCT ON (bucket) ts, price_try
    FROM (
      SELECT
        ts,
        price_try,
        floor(extract(epoch FROM ts) / ${bucketSeconds}) AS bucket
      FROM price_history
      WHERE asset_id = ${assetId} AND ${lowerBound} AND ${upperBound}
    ) s
    -- DISTINCT ON (bucket) + ORDER BY bucket, ts DESC = her kovanın EN YENİ
    -- satırı. Sıralamanın ilk alanı DISTINCT ON ile aynı olmak ZORUNDA;
    -- olmazsa PostgreSQL hata veriyor.
    --
    -- Sonuç kova sırasına göre artan geliyor, yani grafiğin soldan sağa
    -- çizim sırası. Ayrıca sıralamaya gerek yok.
    ORDER BY bucket, ts DESC
  `);

  return result.map((row) => ({
    // toUtcDate null dönmez çünkü ts NOT NULL — ama tip öyle demiyor.
    ts: toUtcDate(row.ts) as Date,
    priceTry: row.price_try,
  }));
}

/** Sembolden varlık kimliği. Grafik ucu sembolle çağrılıyor. */
export async function findAssetIdBySymbol(
  symbol: string,
): Promise<{ id: string; name: string } | null> {
  const rows = await db
    .select({ id: assets.id, name: assets.name })
    .from(assets)
    .where(eq(assets.symbol, symbol.toUpperCase()))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * PostgreSQL timestamp değerini Date'e çevirir.
 *
 * ⚠️ BURASI `timestamp` (timezone'suz) SEÇİMİNİN BEDELİ.
 *
 * Sürücü ham SQL sonucunda "2026-08-18 09:19:00.17" gibi bir string veriyor —
 * içinde saat dilimi bilgisi YOK. `new Date(...)` bunu doğrudan alırsa
 * YEREL saat sanar ve Türkiye'de 3 saat kaydırır. Cron UTC yazdığı için
 * sonda "Z" ekleyerek "bu UTC" demek zorundayız.
 *
 * Kolon `timestamptz` olsaydı bu fonksiyona hiç gerek kalmazdı; sürücü
 * saat dilimini kendisi taşırdı. Öneri Zeynep'e iletildi.
 */
export function toUtcDate(value: string | Date | null): Date | null {
  if (value === null) return null;
  if (value instanceof Date) return value;

  const iso = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(iso.endsWith("Z") ? iso : `${iso}Z`);
}

/**
 * En güncel USD/TRY kuru — dolar görünümünün tek kaynağı.
 *
 * KARAR: KUR AYRI BİR TABLODA DEĞİL, NORMAL BİR VARLIK OLARAK TUTULUYOR.
 *
 * `price_history`'ye `price_usd` kolonu eklemek migration ister
 * (sahibi Zeynep) ve her varlığı iki kez yazmak demekti. Bunun yerine USD
 * `assets` tablosunda sıradan bir varlık; kuru da diğer fiyatlar gibi
 * `price_history`'de duruyor. Herhangi bir varlığın dolar fiyatı
 * `priceTry(varlık) ÷ priceTry(USD)` ile TÜRETİLİYOR.
 *
 * Kazancı: migration yok, tek doğruluk kaynağı var, geçmiş kur zaten
 * elimizde (EVDS geri doldurması 2.421 günü yazdı).
 *
 * ⚠️ `null` DÖNEBİLİR ve bu sessizce geçilmemeli. USD fiyatı hiç
 * yazılmamışsa dolar görünümü hesaplanamaz. Çağıran taraf ya açık bir
 * hata döndürmeli ya da TL'de kalmalı — `1` varsayıp devam etmek
 * kullanıcıya TL tutarını dolar diye göstermek olurdu.
 */
export async function latestUsdTryRate(): Promise<{
  rate: string;
  asOf: Date;
} | null> {
  const usd = await findAssetIdBySymbol("USD");

  if (usd === null) return null;

  const row = await latestPrice(usd.id);

  if (row === undefined || row === null) return null;

  const asOf = toUtcDate(row.ts);

  if (asOf === null) return null;

  return { rate: row.priceTry, asOf };
}
