/**
 * rate-limit.ts — kayan pencereli deneme sayacı.
 *
 * ⚠️ NEDEN VAR: GÜVENLİK SORUSUNUN CEVABI DENENEBİLİR.
 *
 * Şifre uzun ve rastgele olabilir; güvenlik sorusunun cevabı olamaz.
 * "İlk evcil hayvanınızın adı" için makul cevap sayısı birkaç yüz.
 * Sınırsız deneme hakkı verilirse cevap dakikalar içinde bulunur ve
 * güvenlik sorusu hesabı korumaz, sadece koruyormuş gibi yapar.
 *
 * Hız sınırı bu yüzden özelliğin süsü değil, ÇALIŞMASININ ÖN KOŞULU.
 *
 * ⚠️ BELLEKTE, VERİTABANINDA DEĞİL — ve bunun bilinen bir bedeli var:
 * sunucu yeniden başlayınca sayaçlar sıfırlanır. Saldırgan sunucuyu
 * yeniden başlatamadığı için bu pratikte sömürülebilir değil; ama
 * uygulama BİRDEN FAZLA sunucuda çalışırsa her sunucunun kendi sayacı
 * olur ve gerçek sınır kat kat artar. Tek sunucuda doğru, ölçeklenince
 * Redis'e taşınmalı. `[DOĞRULANMALI]` değil, bilinen sınır.
 */

type Pencere = { damgalar: number[] };

/**
 * ⚠️ ÜST SINIRI OLMAYAN SAYAÇ, YAVAŞ ÇALIŞAN BİR BELLEK SIZINTISIDIR.
 *
 * Her farklı e-posta yeni bir anahtar açar. Saldırgan bir milyon farklı
 * adres deneyerek belleği şişirebilirdi — üstelik hiçbiri kayıtlı
 * olmasa bile. Sınıra gelince en eski kayıt atılıyor.
 *
 * Aynı ders `behavior/narrator.ts`'teki önbellekte de var.
 */
const MAX_ANAHTAR = 10_000;

const kovalar = new Map<string, Pencere>();

export type RateLimitSonuc = {
  ok: boolean;
  /** Sınıra takıldıysa kaç saniye sonra tekrar denenebilir. */
  retryAfterSeconds: number;
};

/**
 * Bir anahtar için deneme hakkı kalmış mı — ve denemeyi kaydeder.
 *
 * ⚠️ SAYAÇ SADECE `ok` OLDUĞUNDA ARTMIYOR, HER ÇAĞRIDA ARTIYOR.
 * Reddedilen denemeleri saymasaydık, sınıra takılan saldırgan bekleme
 * süresini sıfırlamadan denemeye devam edebilirdi: her ret bir sonraki
 * pencereye yer açardı. Reddedilen deneme de denemedir.
 *
 * @param key    Sayacın kimliği. Ne seçildiği ÖNEMLİ — aşağıdaki nota bak.
 * @param limit  Pencere içindeki en fazla deneme.
 * @param windowMs Pencere uzunluğu (ms).
 */
export function hit(key: string, limit: number, windowMs: number): RateLimitSonuc {
  const simdi = Date.now();
  const mevcut = kovalar.get(key) ?? { damgalar: [] };

  // Pencereden düşenleri at.
  const pencere = mevcut.damgalar.filter((t) => simdi - t < windowMs);
  pencere.push(simdi);

  if (kovalar.size >= MAX_ANAHTAR && !kovalar.has(key)) {
    // `Map` ekleme sırasını koruyor: ilk anahtar en eski kayıt.
    const enEski = kovalar.keys().next().value;
    if (enEski !== undefined) kovalar.delete(enEski);
  }
  kovalar.set(key, { damgalar: pencere });

  if (pencere.length > limit) {
    const enEskiDamga = pencere[0] ?? simdi;
    const kalan = Math.ceil((windowMs - (simdi - enEskiDamga)) / 1000);
    return { ok: false, retryAfterSeconds: Math.max(kalan, 1) };
  }

  return { ok: true, retryAfterSeconds: 0 };
}

/** Testler için — sayaçları temizler. */
export function resetRateLimits(): void {
  kovalar.clear();
}
