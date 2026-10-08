/**
 * catch-up.ts — sunucu kapalıyken oluşan fiyat boşluğunu doldurur.
 *
 * ⚠️ BU DOSYA ÖLÇÜLMÜŞ BİR VERİ KAYBINDAN DOĞDU (31 Ağu 2026).
 *
 * 15 saniyelik cron yalnızca sunucu açıkken yazıyor. Kapalı kaldığı süre
 * `price_history`'de delik kalıyor ve hiçbir şey onu doldurmuyor:
 * `price-backfill.ts` tüm geçmişi 2017'den çekiyor, yani her açılışta
 * çalıştırılamaz.
 *
 * Ölçülen gerçek durum — BTC (7/24 işlem görüyor, yani boşluk = veri kaybı):
 *
 *   2026-08-27    440 satır   ~%8 kapsama   (beklenen ~5760)
 *   2026-08-28   1966 satır  ~%34
 *   2026-08-29      — YOK
 *   2026-08-30      — YOK
 *   2026-08-31    201 satır   ~%3
 *
 *   En büyük ardışık boşluk: 65,1 saat
 *
 * ⚠️ VE BU YALNIZCA GRAFİĞİ BOZMUYOR — DAVRANIŞ GÖSTERGELERİNİ DE BOZUYOR.
 *
 * `behavior/repository.ts` her emir için "24 saat öncesindeki fiyat"ı
 * `ts <= executedAt - 24 saat ORDER BY ts DESC LIMIT 1` ile buluyor.
 * 65 saatlik bir boşluk varsa o sorgu 65+ saat öncesinin fiyatını
 * döndürür — yani FOMO ve panik göstergeleri "günlük hareket" sanıp
 * aslında üç günlük hareketi ölçer. Sessizce yanlış sayı üretir.
 *
 * ⚠️ BOŞLUKLAR SONDA DEĞİL, ORTADA — VE İLK SÜRÜM BUNU KAÇIRDI.
 *
 * İlk yazdığım hâli "son kayıt ne zaman, oradan bugüne kadar doldur"
 * diyordu. Çalıştırınca 0 satır yazdı ve sebebi öğreticiydi: sunucu o an
 * AÇIK olduğu için son kayıt güncel, yani sondaki boşluk yok. Delik
 * 29-30 Ağustos'ta, yani serinin ORTASINDA — 28'inde ve 31'inde satır
 * var.
 *
 * Sondaki boşluğa bakan bir kod içerideki deliği hiçbir zaman göremez.
 * Doğrusu ardışık iki kayıt arasındaki farkı taramak: `LAG` ile.
 *
 * ⚠️ YALNIZCA KRİPTO DOLDURULUYOR — VE BU BİLEREK.
 *
 * Kripto 7/24 işlem gördüğü için boşluk KESİNLİKLE veri kaybıdır. Döviz,
 * maden ve hisse için aynı şey söylenemez: TCMB hafta sonu kur
 * yayımlamıyor, LBMA yalnızca iş günü, ABD borsası gece ve hafta sonu
 * kapalı. Oralarda "boşluk" çoğu zaman piyasanın kapalı olması demek.
 *
 * Kapalı bir piyasaya fiyat yazmak, olmayan bir işlemi varmış gibi
 * göstermek olur — `price-cron.ts` bunu zaten açıkça reddediyor
 * ("piyasa kapalıyken hiç sorulmuyor"). Aynı gerekçe burada da geçerli:
 * eksik veri, uydurma veriden iyidir.
 */

import '../lib/env.js';
import { sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { PRICE_SCALE, formatScaled, parseScaled, type Price } from '../lib/money.js';
import { usdToTry } from '../lib/fx.js';
import { BinanceAdapter } from './binance.js';
import type { Candle, MarketDataProvider } from './provider.js';
import { insertPrices, listActiveAssets } from './repository.js';

/**
 * Bundan küçük boşluklar doldurulmuyor.
 *
 * ⚠️ SIFIR OLAMAZ. Cron açıkken son kayıt her zaman birkaç saniye
 * öncesindedir; eşik olmasaydı her açılışta anlamsız bir yakalama turu
 * çalışır ve Binance'e gereksiz istek giderdi.
 *
 * Bir saat, en ince mumumuzdan (1 saat) küçük olamayacağı için de doğal
 * bir alt sınır.
 */
const MIN_GAP_MS = 60 * 60 * 1000;

/**
 * Bundan büyük boşluklar da doldurulmuyor.
 *
 * ⚠️ ÜST SINIR ŞART. Bir aydır kapalı duran bir kurulumda bu betik
 * binlerce mum çekip on binlerce satır yazmaya çalışır — o iş
 * `price-backfill.ts`'in işi, bunun değil. Sınırı aşan durum bir
 * "yakalama" değil, "yeniden kurulum"dur ve elle karar verilmeli.
 */
const MAX_GAP_MS = 30 * 24 * 60 * 60 * 1000; // 30 gün

/** Delik taraması bu kadar geriye bakıyor. */
/**
 * Delik taraması varsayılan olarak bu kadar geriye bakar.
 *
 * ⚠️ AÇILIŞ İÇİN GENİŞ OLMAK ZORUNDA: sunucu üç gün mü iki hafta mı
 * kapalı kaldı bilmiyoruz, o yüzden geniş bakmak gerekiyor.
 *
 * ⚠️ AMA PERİYODİK ÇAĞRI İÇİN İSRAF. Açılışta 30 gün zaten tarandı ve
 * dolduruldu; geçmiş bir daha değişmiyor. Saatlik çağrının cevaplaması
 * gereken tek soru "son bir saatte delik açıldı mı?".
 *
 * Ölçüldü (602 bin satırlık tabloda):
 *   30 gün ->  ~1.700.000 satır okur  ->  322 ms
 *    6 saat ->     ~14.000 satır okur ->  2,3 ms
 *
 * Aynı iş, 140 kat ucuz. O yüzden pencere artık PARAMETRE.
 */
const LOOKBACK_DAYS = 30;

/** Periyodik yakalama penceresi — saatlik çağrı için fazlasıyla yeterli. */
const PERIODIC_LOOKBACK_DAYS = 0.25; // 6 saat

/** Periyodik yakalama ne sıklıkla çalışıyor. */
const PERIODIC_INTERVAL_MS = 60 * 60 * 1000; // 1 saat

/**
 * Boşluğun büyüklüğüne göre mum aralığı.
 *
 * ⚠️ DOLDURULAN VERİ CANLI CRON'LA AYNI ÇÖZÜNÜRLÜKTE DEĞİL — VE
 * OLAMAZ DA. Cron 15 saniyede bir yazıyor; Binance'in bize verdiği en
 * ince mum bu projede 5 dakika. Yani boşluk daha kaba doluyor.
 *
 * Bu bir eksiklik değil, veri kaynağının doğası. Önemli olan bunun
 * KAYITLI olması: satırlar `granularity` ile işaretleniyor, böylece
 * ileride temizlik işi (`retention.ts`) hangi satırın nereden geldiğini
 * ayırt edebilecek.
 */
function candleFor(gapMs: number): Candle {
  const saat = gapMs / 3_600_000;

  /*
    ⚠️ EŞİK 12 SAATTEN 24 SAATE ÇIKARILDI (4 Eyl 2026) — VE SEBEBİ
    ÖLÇÜLDÜ, TAHMİN DEĞİL.

    Yerel geliştirmede bilgisayar her gece kapanıyor; oluşan delik tipik
    olarak 13-15 saat oluyor (ölçülen: 3 Eyl 21:49 -> 4 Eyl 11:29, 13,7
    saat). Eski eşik bunu "12 saatten büyük" sayıp SAATLİK muma düşürüyordu:
    gece boyunca saatte 1 nokta, gündüzün 5 dakikalık yoğunluğunun 12'de
    biri. Grafikte gece dilimi belirgin şekilde seyrek görünüyordu.

    ⚠️ NEDEN 24 GÜVENLİ: 24 saat 5 dakikalık mumla 288 mum eder, Binance'in
    istek başına 1000 mum sınırının çok altında — tek sayfada geliyor,
    ek istek maliyeti yok. 12'nin bir teknik gerekçesi yoktu, temkinli
    bir tahmindi.

    ⚠️ 24'ÜN ÜSTÜ HÂLÂ SAATLİK: bir haftalık kesinti 5 dakikalık mumla
    2.016 mum demek — sayfalama gerekir ve o kadar ince veri o kadar
    eski bir boşluk için anlamsız.
  */
  if (saat <= 24) return '5m'; // ~288 mum
  if (saat <= 24 * 7) return '1h'; // en fazla ~168 mum
  return '1d'; // 30 güne kadar ~30 mum
}

/** `granularity` kolonuna yazılan değer — mum aralığıyla birebir. */
const GRANULARITY: Record<Candle, string> = {
  '5m': '5m',
  '1h': '1h',
  '1d': '1d',
};

export interface CatchUpResult {
  /** Yazılan satır sayısı. */
  written: number;
  /** Boşluğu eşiğin altında olduğu için atlananlar. */
  skipped: string[];
  /** Denendi ama olmadı. */
  failed: string[];
  /** Doldurulan varlık başına özet — log için. */
  filled: Array<{ symbol: string; gapHours: number; candle: Candle; rows: number }>;
}

/**
 * USD/TRY kurunu GÜN GÜN, kendi veritabanımızdan okur.
 *
 * ⚠️ TCMB'YE SORMUYORUZ — VE SEBEBİ HEM BASİTLİK HEM TUTARLILIK.
 *
 * Kur zaten `price_history`'de bir varlık olarak duruyor (USD). Dışarıya
 * yeniden sormak, aynı bilginin iki kaynağı olması demek: bir gün
 * ikisi ayrışır ve hangisinin doğru olduğu belirsizleşir.
 *
 * ⚠️ "O GÜN YA DA ÖNCESİ" ARANIYOR — forward-fill. TCMB hafta sonu kur
 * yayımlamıyor; cumartesi mumunu cuma kuruyla çeviriyoruz. Bu uydurma
 * değil, piyasa gerçeği: hafta sonu kur değişmiyor. Aynı kural
 * `what-if/repository.ts` ve `price-backfill.ts`'te de yazılı.
 */
async function usdRateFor(dates: string[]): Promise<Map<string, Price>> {
  const map = new Map<string, Price>();
  if (dates.length === 0) return map;

  const sirali = [...dates].sort();
  const ilk = sirali[0]!;
  const son = sirali.at(-1)!;

  /*
    ⚠️ DİZİYİ SQL'E GEÇİRMEYE ÇALIŞTIM, SÜRÜCÜ KABUL ETMEDİ.

    İlk hâli `unnest(${dates}::date[])` idi; sürücü JS dizisini dizi
    değil DEMET olarak bağlıyor (`($1, $2)::date[]`) ve sorgu patlıyor.

    Onun yerine pencereyi tek sorguyla çekip forward-fill'i burada
    yapıyoruz. Satır sayısı küçük (en fazla birkaç haftalık kur), ve
    kural JS'te daha okunur duruyor.

    ⚠️ 10 GÜN GERİDEN BAŞLIYOR: aranan ilk gün hafta sonuna ya da uzun
    bir tatile denk gelirse ondan önceki iş gününü de yakalamak
    gerekiyor. Tam o günden başlasaydık dizi boş dönebilir ve bütün
    mumlar kursuz kalırdı.
  */
  const rows = await db.execute<{ gun: string; rate: string }>(sql`
    SELECT to_char(ph.ts, 'YYYY-MM-DD') AS gun, ph.price_try AS rate
    FROM price_history ph
    JOIN assets a ON a.id = ph.asset_id
    WHERE a.symbol = 'USD'
      AND ph.ts >= ${ilk}::date - interval '10 days'
      AND ph.ts < ${son}::date + interval '1 day'
    ORDER BY ph.ts
  `);

  if (rows.length === 0) return map;

  // Gün -> o günün SON kuru.
  const gunluk = new Map<string, string>();
  for (const r of rows) gunluk.set(r.gun, r.rate);

  const gunler = [...gunluk.keys()].sort();

  for (const hedef of sirali) {
    // "O gün ya da öncesi" — forward-fill.
    let secilen: string | undefined;
    for (const g of gunler) {
      if (g <= hedef) secilen = g;
      else break;
    }

    if (secilen !== undefined) {
      map.set(hedef, parseScaled(gunluk.get(secilen)!, PRICE_SCALE) as Price);
    }
  }

  return map;
}

/** Serideki tek bir delik. */
interface Gap {
  /** Deliğin başladığı an (son var olan kayıt). */
  from: Date;
  /** Deliğin bittiği an (bir sonraki kayıt, ya da şimdi). */
  to: Date;
}

/**
 * Bir varlığın fiyat serisindeki DELİKLERİ bulur.
 *
 * ⚠️ `LAG` ARDIŞIK İKİ SATIR ARASINDAKİ FARKI VERİYOR. Eşiği aşan her
 * fark bir delik demek. Sondaki boşluk ayrıca ekleniyor: son kayıttan
 * şimdiye kadar geçen süre de bir delik olabilir (sunucu şu anda yeni
 * açılmışsa).
 *
 * `LOOKBACK` penceresi taramayı sınırlıyor — 2017'ye kadar her deliği
 * aramak hem yavaş hem anlamsız; eski veri zaten günlük çözünürlükte
 * ve `price-backfill.ts`'in işi.
 */
async function findGaps(
  assetId: string,
  now: number,
  lookbackDays: number = LOOKBACK_DAYS,
): Promise<Gap[]> {
  const rows = await db.execute<{ onceki: string; sonraki: string }>(sql`
    SELECT onceki::text AS onceki, ts::text AS sonraki
    FROM (
      SELECT ts, LAG(ts) OVER (ORDER BY ts) AS onceki
      FROM price_history
      WHERE asset_id = ${assetId}
        AND ts > now() - make_interval(secs => ${Math.round(lookbackDays * 86400)})
    ) t
    WHERE onceki IS NOT NULL
      AND ts - onceki > make_interval(secs => ${MIN_GAP_MS / 1000})
    ORDER BY onceki
  `);

  const gaps: Gap[] = rows.map((r) => ({
    from: toUtcDate(r.onceki),
    to: toUtcDate(r.sonraki),
  }));

  // Sondaki boşluk: en son kayıttan şimdiye.
  const [son] = await db.execute<{ ts: string }>(sql`
    SELECT MAX(ts)::text AS ts FROM price_history WHERE asset_id = ${assetId}
  `);

  if (son?.ts) {
    const sonTs = toUtcDate(son.ts);
    if (now - sonTs.getTime() > MIN_GAP_MS) {
      gaps.push({ from: sonTs, to: new Date(now) });
    }
  }

  return gaps;
}

/**
 * PostgreSQL zaman damgası metnini UTC olarak `Date`'e çevirir.
 *
 * ⚠️ Ham sorgu dilim işareti OLMADAN metin döndürüyor
 * ("2026-08-28 15:52:19"). `new Date()` böyle bir metni YEREL saat sayar;
 * kolon dilimsiz, cron ise UTC yazıyor — Türkiye'de 3 saat kayardı ve
 * boşluk sınırları yanlış hesaplanırdı. Aynı tuzak
 * `behavior/repository.ts`'te de belgeli.
 */
function toUtcDate(text: string): Date {
  return new Date(`${text.replace(' ', 'T')}Z`);
}

/**
 * Boşlukları doldurur.
 *
 * @param market Test edilebilirlik için enjekte edilebilir.
 */
export async function catchUpPrices(
  market: MarketDataProvider = new BinanceAdapter(),
  lookbackDays: number = LOOKBACK_DAYS,
): Promise<CatchUpResult> {
  const assets = await listActiveAssets();
  const result: CatchUpResult = {
    written: 0,
    skipped: [],
    failed: [],
    filled: [],
  };

  const now = Date.now();

  for (const asset of assets) {
    // Yalnızca kripto — gerekçesi dosyanın başında.
    if (asset.kind !== 'crypto') continue;

    /*
      try/catch DÖNGÜNÜN İÇİNDE. BTC çekilemezse ETH yine doldurulmalı.
      Aynı desen `price-cron.ts`'te de var ve aynı sebeple.
    */
    try {
      const gaps = await findGaps(asset.id, now, lookbackDays);

      if (gaps.length === 0) {
        result.skipped.push(`${asset.symbol} (delik yok)`);
        continue;
      }

      for (const gap of gaps) {
        const gapMs = gap.to.getTime() - gap.from.getTime();

        if (gapMs > MAX_GAP_MS) {
          result.skipped.push(`${asset.symbol} (delik 30 günden büyük)`);
          continue;
        }

        const candle = candleFor(gapMs);

        /*
          ⚠️ BİTİŞE BİR GÜN EKLENİYOR — VE BU DA ÇALIŞTIRARAK BULUNDU.

          `getHistory` tarihi GÜN hassasiyetinde alıyor, delikler ise
          gün İÇİNDE olabiliyor. İlk hâli deliğin iki ucunu da olduğu
          gibi geçiriyordu; gün içi bir delikte ikisi AYNI tarihe
          düşüyor ("2026-08-27" -> "2026-08-27") ve aralık sıfır
          genişlikte kalıyordu.

          Belirtisi yine sessizdi: hata yok, 0 satır yazılıyor, "boşluk
          doldu" sanılıyordu. Ölçünce görüldü — kalan deliklerin HEPSİ
          tam 00:00'da başlıyordu, yani hepsi gün içiydi.

          Fazladan çekilen mumlar zararsız: aşağıdaki filtre deliğin
          dışında kalanları zaten eliyor.
        */
        const bitis = new Date(gap.to.getTime() + 24 * 3_600_000);

        const points = await market.getHistory(
          asset.symbol,
          gap.from.toISOString().slice(0, 10),
          bitis.toISOString().slice(0, 10),
          candle,
        );

        /*
          ⚠️ MUM ARALIĞI GÜN HASSASİYETİNDE İSTENİYOR, DELİK İSE SAAT
          HASSASİYETİNDE. Yani gelen mumların bir kısmı deliğin dışında
          kalıyor; onları eliyoruz.

          `onConflictDoNothing` zaten çakışanları yutardı ama boşuna
          satır göndermek anlamsız — ve daha önemlisi, kaç satırın
          GERÇEKTEN eklendiğini bilmek istiyoruz.
        */
        const icerde = points.filter(
          (p) =>
            p.openTime > gap.from.getTime() && p.openTime < gap.to.getTime(),
        );

        if (icerde.length === 0) continue;

        const rates = await usdRateFor([...new Set(icerde.map((p) => p.date))]);

        const rows = [];

        for (const point of icerde) {
          const rate = rates.get(point.date);

          /*
            ⚠️ KURU OLMAYAN GÜN ATLANIYOR, SIFIRLA YAZILMIYOR.

            Kur bulunamıyorsa TL fiyatı hesaplanamaz. Sıfır ya da tahmini
            bir değer yazmak, sessizce yanlış bir fiyatı geçmişe gömmek
            olurdu — grafikte ve "ya alsaydın" hesabında görünür, ama
            yanlış olduğu görünmez.
          */
          if (rate === undefined) continue;

          rows.push({
            assetId: asset.id,
            ts: new Date(point.openTime),
            priceTry: formatScaled(usdToTry(point.price, rate), PRICE_SCALE),
            granularity: GRANULARITY[candle],
          });
        }

        await insertPrices(rows);

        result.written += rows.length;
        result.filled.push({
          symbol: asset.symbol,
          gapHours: Math.round(gapMs / 3_600_000),
          candle,
          rows: rows.length,
        });
      }
    } catch (error) {
      result.failed.push(
        `${asset.symbol}: ${(error as Error).message.slice(0, 80)}`,
      );
    }
  }

  return result;
}

/**
 * Periyodik yakalama — saatte bir, dar pencereyle.
 *
 * ⚠️ NEDEN VAR: 15 saniyelik cron yalnızca sunucu ayaktayken yazıyor.
 * Ağ birkaç saat koparsa delik açılıyor ve `catchUpPrices` yalnızca
 * AÇILIŞTA çalıştığı için o delik, sunucu yeniden başlatılana kadar
 * duruyordu.
 *
 * Ölçülen sonuç: 1 günlük grafikte 288 nokta yerine 49 nokta, aralarında
 * 60 dakikalık boşluklar. Grafik iki nokta arasına düz çizgi çekiyor —
 * yani "fiyat bu bir saatte düz gitti" diyor. Bilmediğimiz bir şeyi
 * iddia ediyor.
 *
 * ⚠️ ASIL KAZANÇ ÇÖZÜNÜRLÜKTE, DOLDURMADA DEĞİL. `candleFor()` delik
 * 12 saati aşarsa saatlik mum kullanıyor. Delik hiç 12 saati aşmazsa
 * her zaman 5 dakikalık mum kullanılıyor — yani 12 kat yoğun veri.
 *
 *   şimdi:  delik 23 saat -> 1h mum -> saatte 1 nokta
 *   sonra:  delik  1 saat -> 5m mum -> 5 dakikada 1 nokta
 *
 * ⚠️ DELİK YOKSA AĞA ÇIKMIYOR. Cron düzgün çalışırken 1 saatlik eşiği
 * aşan boşluk olmuyor; tarama 0 delik buluyor ve Binance'e hiç istek
 * gitmiyor. Maliyet yalnızca 2,3 ms'lik veritabanı taraması.
 *
 * ⚠️ ÖNCEKİ TUR BİTMEDEN YENİSİ BAŞLAMIYOR. Bir tur uzun sürerse
 * (çok delik, yavaş ağ) iki tur aynı deliği aynı anda doldurmaya
 * kalkar; ikisi de aynı `ts` değerini yazar ve PK çakışır. Boşuna
 * istek. Aynı bayrak deseni `scheduler.ts`'te de var.
 */
let periyodikCalisiyor = false;

export function startCatchUpCron(): NodeJS.Timeout {
  const timer = setInterval(() => {
    void (async () => {
      if (periyodikCalisiyor) {
        console.warn('[catch-up] önceki tur sürüyor, bu tur atlandı');
        return;
      }

      periyodikCalisiyor = true;
      try {
        const r = await catchUpPrices(new BinanceAdapter(), PERIODIC_LOOKBACK_DAYS);

        /*
          ⚠️ YALNIZCA İŞ YAPILDIYSA LOG. Her saat "0 satır yazıldı"
          basmak, log'u gerçekten önemli satırların görünmediği bir
          gürültüye çevirir.
        */
        if (r.written > 0) {
          console.log(
            `[catch-up] periyodik: ${r.written} satır yazıldı, ` +
              `${r.filled.length} delik dolduruldu`,
          );
        }
        if (r.failed.length > 0) {
          console.warn(`[catch-up] periyodik başarısız: ${r.failed.join(', ')}`);
        }
      } catch (error) {
        /*
          ⚠️ EN DIŞ KATMAN. Buradan kaçan hata yakalanmamış promise
          reddi olur ve Node sürecini düşürebilir — cron API sunucusuyla
          aynı süreçte çalışıyor, yani tüm uygulama çöker.
        */
        console.error(
          '[catch-up] periyodik tur tamamen başarısız:',
          error instanceof Error ? error.message : error,
        );
      } finally {
        periyodikCalisiyor = false;
      }
    })();
  }, PERIODIC_INTERVAL_MS);

  console.log('[catch-up] periyodik yakalama başladı, aralık: 1 saat');
  return timer;
}
