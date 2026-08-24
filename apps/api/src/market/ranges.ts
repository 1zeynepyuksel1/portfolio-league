/**
 * ranges.ts — grafik aralıkları ve her birinin seyreltme kovası.
 *
 * NEDEN AYRI DOSYA: bu tablo hem router'da (istek doğrulama) hem testte
 * kullanılıyor, ve saf veri — veritabanına da ağa da dokunmuyor. Ayrı
 * durunca mock'suz test edilebiliyor.
 */

export const RANGES = ['1d', '1w', '1m', '3m', '1y', 'max'] as const;

export type Range = (typeof RANGES)[number];

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

type RangeSpec = {
  /** Kaç saniye geriye bakılacak. `null` = sınır yok (varlığın başlangıcı). */
  lookbackSeconds: number | null;
  /** Kova boyutu, saniye. */
  bucketSeconds: number;
};

/**
 * Aralık başına pencere ve kova.
 *
 * ⚠️ KOVA BOYUTU KEYFİ DEĞİL — hedef her aralıkta 90-470 arası nokta.
 *
 *   1d  → 5 dakika  →  288 nokta
 *   1w  → 1 saat    →  168
 *   1m  → 6 saat    →  120
 *   3m  → 1 gün     →   90
 *   1y  → 1 gün     →  365
 *   max → 1 hafta   →  ~470  (2017'den bugüne)
 *
 * Alt sınır neden 90: daha az noktada çizgi köşeli görünür, fiyat
 * hareketinin şekli kaybolur. Üst sınır neden ~500: 390 piksel genişliğinde
 * bir ekranda daha fazlası aynı piksele düşer — veri taşınır ama görünmez.
 *
 * ⚠️ 1d ve 1w İÇİN VERİ HENÜZ SEYREK OLABİLİR.
 * 15 saniyelik cron yalnızca çalıştığı andan itibaren yazıyor; ondan
 * öncesi için elimizde sadece günlük geri doldurma var. Yani "1 gün"
 * aralığı cron birkaç gündür çalışmıyorsa 288 değil 1-2 nokta döndürür.
 * Bu bir hata değil, verinin gerçek durumu — ekran boş grafik yerine
 * "yeterli veri yok" demeli.
 */
const SPECS: Record<Range, RangeSpec> = {
  '1d': { lookbackSeconds: DAY, bucketSeconds: 5 * MINUTE },
  '1w': { lookbackSeconds: 7 * DAY, bucketSeconds: HOUR },
  '1m': { lookbackSeconds: 30 * DAY, bucketSeconds: 6 * HOUR },
  '3m': { lookbackSeconds: 90 * DAY, bucketSeconds: DAY },
  '1y': { lookbackSeconds: 365 * DAY, bucketSeconds: DAY },
  max: { lookbackSeconds: null, bucketSeconds: 7 * DAY },
};

export function isRange(value: unknown): value is Range {
  return typeof value === 'string' && (RANGES as readonly string[]).includes(value);
}

export function specOf(range: Range): RangeSpec {
  return SPECS[range];
}

/**
 * Aralığın başlangıç anı. `max` için `null` — alt sınır yok.
 *
 * `now` parametre olarak alınıyor, içeride `new Date()` çağrılmıyor:
 * böylece test sabit bir ana göre yazılabiliyor. Zamana bağlı kod test
 * edilemez hâle gelmesin diye.
 */
export function startOf(range: Range, now: Date): Date | null {
  const { lookbackSeconds } = SPECS[range];

  if (lookbackSeconds === null) return null;

  return new Date(now.getTime() - lookbackSeconds * 1000);
}

// ---------------------------------------------------------------------------
// SERBEST PENCERE — yakınlaştırma için
// ---------------------------------------------------------------------------

/**
 * Kullanılabilir kova boyutları, küçükten büyüğe.
 *
 * ⚠️ EN KÜÇÜK 5 DAKİKA — VE BU KEYFİ DEĞİL.
 * Elimizdeki en ince veri 5 dakikalık mumlar (hourly-backfill.ts).
 * Daha küçük kova seçseydik her kovaya bir satır düşer, seyreltme hiçbir
 * şey yapmaz ve kullanıcı "daha çok yakınlaştırdım ama detay artmadı"
 * derdi. Merdiven, verinin gerçek çözünürlüğünde bitiyor.
 */
const BUCKET_LADDER = [
  5 * MINUTE,
  15 * MINUTE,
  HOUR,
  6 * HOUR,
  DAY,
  7 * DAY,
] as const;

/** Bir istekte dönebilecek en fazla nokta. */
export const MAX_POINTS = 500;

/** Serbest pencerenin en dar hâli. Daha darı tek noktaya iner. */
export const MIN_WINDOW_SECONDS = 15 * MINUTE;

/**
 * Verilen pencere için en ince uygun kovayı seçer.
 *
 * Merdivenin en küçüğünden başlayıp nokta sayısı sınırın altına düşen
 * ilki alınıyor — yani her zaman mümkün olan EN ÇOK detay.
 *
 * Örnek: bir haftalık pencere (604.800 sn)
 *    5dk  -> 2016 nokta  (çok fazla)
 *   15dk  ->  672        (çok fazla)
 *    1sa  ->  168        ✅ seçilen
 *
 * Hiçbiri sığmazsa (çok geniş pencere) en büyüğü dönüyor; nokta sayısı
 * sınırı aşabilir ama veri kaybetmektense fazla nokta göndermek yeğdir.
 */
export function bucketFor(windowSeconds: number): number {
  for (const bucket of BUCKET_LADDER) {
    if (windowSeconds / bucket <= MAX_POINTS) return bucket;
  }

  return BUCKET_LADDER[BUCKET_LADDER.length - 1] as number;
}

export type WindowResult =
  | { ok: true; from: Date; to: Date; bucketSeconds: number }
  | { ok: false; message: string };

/**
 * `?from=&to=` parametrelerini doğrular ve kova boyutunu seçer.
 *
 * ⚠️ NEDEN BU KAPI VAR — VE ÖNCEKİ KARARI GERİ ALIYOR.
 *
 * `range` bilerek kapalı bir listeydi: altı sabit aralık önbelleklenebilir,
 * serbest aralık her istekte farklı olduğu için önbelleklenemez.
 * Yakınlaştırma bu kararı geri almayı gerektiriyor — kullanıcının
 * seçebileceği pencere sayısı sonsuz.
 *
 * Karşılığında iki koruma kondu: pencere en az MIN_WINDOW_SECONDS,
 * nokta sayısı en fazla MAX_POINTS. Sınırsız bir uç, tek bir istekle
 * milyonlarca satır okutulabilirdi.
 */
export function parseWindow(
  fromRaw: unknown,
  toRaw: unknown,
): WindowResult {
  if (typeof fromRaw !== 'string' || typeof toRaw !== 'string') {
    return { ok: false, message: '`from` ve `to` metin olmalı (ISO tarih).' };
  }

  const from = new Date(fromRaw);
  const to = new Date(toRaw);

  // `new Date("saçma")` hata FIRLATMIYOR, Invalid Date döndürüyor —
  // ve onunla yapılan her hesap NaN üretip sessizce yayılıyor.
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { ok: false, message: 'Geçersiz tarih biçimi.' };
  }

  if (from >= to) {
    return { ok: false, message: '`from`, `to`dan önce olmalı.' };
  }

  const windowSeconds = (to.getTime() - from.getTime()) / 1000;

  if (windowSeconds < MIN_WINDOW_SECONDS) {
    return {
      ok: false,
      message: `Pencere en az ${MIN_WINDOW_SECONDS / 60} dakika olmalı.`,
    };
  }

  return { ok: true, from, to, bucketSeconds: bucketFor(windowSeconds) };
}
