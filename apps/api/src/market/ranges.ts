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
