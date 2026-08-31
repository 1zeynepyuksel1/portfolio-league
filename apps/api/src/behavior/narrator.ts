/**
 * narrator.ts — ölçülmüş bulguları tek paragraflık yoruma çevirir.
 *
 * ⚠️ MODEL SAYI YAZMIYOR — VE BU DOSYANIN TEMEL KARARI.
 *
 * Modele "bu bulguları anlat" deyip metnin tamamını ona yazdırmak en kolay
 * yoldu. Yapmadık: model 146,77 ₺ yerine 147 ₺ yazsa, ya da "3 kez" yerine
 * "birkaç kez" dese kimse fark etmezdi. Ekranda gördüğün sayı ölçtüğümüz
 * sayı olmak zorunda.
 *
 * Bunun yerine iş bölümü şu:
 *
 *   kartlar   -> `service.ts`'in şablon metinleri, sayılar BİZİM
 *   paragraf  -> modelin işi: bulguları BİRLEŞTİRMEK ve NE YAPILACAĞINI söylemek
 *
 * Model bulguları bulmuyor, sıralamıyor, saymıyor. Yalnızca aralarındaki
 * bağı kuruyor ve bir öneri veriyor. Uydurursa bile ortada uydurulmuş bir
 * SAYI olmuyor.
 *
 * ⚠️ ANAHTAR SUNUCUDA. Uygulamaya koysaydık herkes paketten çıkarır ve
 * bizim hesabımızdan harcardı. Çağrının tamamı `gemini.ts`'te — hem
 * burası hem sohbet katmanı oradan geçiyor, yani model ayarları TEK
 * yerde yaşıyor.
 */

import { createHash } from 'node:crypto';
import { callModel, isGeminiEnabled } from './gemini.js';
import type { BehaviorFinding } from './service.js';

/**
 * Model çağrısı bu süreden uzun sürerse iptal.
 *
 * ⚠️ 8 → 10 → 25 SANİYE OLDU, VE HER DEĞİŞİKLİĞİN SEBEBİ AYRI.
 *
 * Yorum eskiden `GET /me/behavior` içinde üretiliyordu, yani bu bekleme
 * KARTLARI da tutuyordu; sınır dar olmak zorundaydı. Ölçüldü: ilk çağrı
 * 5-10 saniye sürüyor, biri 10 saniyeyi aşıp iptal oldu.
 *
 * Yorum ayrı bir uca (`/me/behavior/comment`) taşınınca durum değişti.
 * Kartlar 0,04 saniyede geliyor; bu çağrı artık hiçbir şeyi bekletmiyor,
 * yalnızca kendi bloğunu geciktiriyor. Cömert sınır artık BEDAVA.
 *
 * Kural: zaman aşımı, BEKLETTİĞİ ŞEYİN değerine göre seçilir. Aynı sayı
 * kartları bekletirken kötü, tek başına bir yorum bloğunu bekletirken
 * makul.
 */
const TIMEOUT_MS = 25_000;

// ---------------------------------------------------------------------------
// ÖNBELLEK
// ---------------------------------------------------------------------------

/**
 * ⚠️ ÖNBELLEK BELLEKTE, VERİTABANINDA DEĞİL — BİLİNÇLİ TERCİH.
 *
 * Tablo daha kalıcı olurdu ama migration gerektirirdi ve migration'ların
 * sahibi Zeynep — özellik onun sırasını beklerdi. Bellekteki önbellek
 * sunucu yeniden başlayınca sıfırlanıyor; bedeli birkaç fazladan model
 * çağrısı, o kadar.
 */
const TTL_MS = 60 * 60 * 1000; // 1 saat

/**
 * ⚠️ ÜST SINIR OLMAYAN ÖNBELLEK, YAVAŞ ÇALIŞAN BİR BELLEK SIZINTISIDIR.
 *
 * Her kullanıcı için bir kayıt tutulsa ve hiç silinmese, kullanıcı sayısı
 * arttıkça bellek büyür ve süreç bir gün ölür. Sebebi de bulunamaz: kod
 * "çalışıyor", yalnızca haftalar içinde şişiyor.
 *
 * Sınıra gelince en eski kayıt atılıyor (`Map` ekleme sırasını koruyor).
 */
const MAX_ENTRIES = 500;

const cache = new Map<string, { text: string; at: number }>();

/**
 * Önbellek anahtarı: kullanıcı + BULGULARIN İÇERİĞİ.
 *
 * ⚠️ YALNIZCA `userId` KULLANSAYDIK YORUM BAYATLARDI. Kullanıcı yeni
 * işlem yapar, bulguları değişir, ama bir saat boyunca eski yorumu
 * görürdü — üstelik artık geçerli olmayan bir yorumu. İçeriği anahtara
 * katınca bulgular değiştiği an önbellek kendiliğinden ıskalıyor.
 */
function cacheKey(userId: string, findings: BehaviorFinding[]): string {
  const shape = findings.map((f) => ({ key: f.key, facts: f.facts }));

  return createHash('sha1')
    .update(userId)
    .update(JSON.stringify(shape))
    .digest('hex');
}

// ---------------------------------------------------------------------------
// İSTEM
// ---------------------------------------------------------------------------

/**
 * Modelin uyacağı kurallar.
 *
 * ⚠️ "PANİKLEDİN" DEMESİ YASAK — VE BU KOD TARAFINDAKİ KARARIN DEVAMI.
 *
 * `detectPanicSelling` disiplinli zarar kesmeyi panikten ayıramıyor;
 * niyeti ölçmedik. Şablon metinler bu yüzden gözlem diliyle yazıldı.
 * Model serbest bırakılsaydı aynı veriden "panik yaptın" cümlesini
 * kurardı ve ölçmediğimiz bir şeyi iddia etmiş olurduk.
 *
 * ⚠️ FİYAT TAHMİNİ YASAK. Bir yatırım uygulamasında model "BTC yükselir"
 * derse kullanıcı ciddiye alır. Sorulmasa bile kendiliğinden söyleyebilir.
 *
 * ⚠️ BU LİSTE SÜS DEĞİL — ÖLÇTÜK. Kısaltılmış bir yönergeyle aynı model
 * "sahte işlemler" (dolandırıcılık ima ediyor) ve "wash trade" (İngilizce
 * jargon) yazdı. Tam yönergeyle üç örnekte de temiz çıktı.
 */
const SYSTEM_INSTRUCTION = `
Sen bir sanal yatırım ligi uygulamasının davranış yorumcususun.

Sana kullanıcının işlem geçmişinden ÖLÇÜLMÜŞ bulgular veriliyor.
Görevin bu bulguları BİRLEŞTİREN tek bir kısa paragraf yazmak.

KURALLAR:
- Türkçe yaz. En fazla 3 cümle.
- Kullanıcıya "SEN" diye hitap et, "siz" değil. ("kaçınabilirsin",
  "kaçınabilirsiniz" değil.)
- SAYI YAZMA. Tutar, yüzde, adet yok — onlar zaten ekranda gösteriliyor.
- Bulgular arasındaki BAĞI kur ve somut bir öneri ver.
- Gözlem dili kullan. "Panikledin", "hata yaptın", "kötü yatırımcısın" deme.
  Bunun yerine "düşüşlerde satış yapmışsın" gibi ölçülene sadık kal.
- Fiyat tahmini yapma, hangi varlığın alınacağını söyleme, yatırım
  tavsiyesi verme. Yalnızca DAVRANIŞ hakkında konuş.
- Suçlayıcı değil, yardımcı ol. Kullanıcı öğrenmeye çalışıyor.
`.trim();

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    comment: {
      type: 'string',
      description: 'Bulguları birleştiren, en fazla 3 cümlelik Türkçe yorum.',
    },
  },
  required: ['comment'],
};

/**
 * Bulgular için yorum paragrafı üretir.
 *
 * @returns Yorum metni, ya da üretilemediyse `null`.
 *
 * ⚠️ HER BAŞARISIZLIK `null` — VE HİÇBİRİ İSTEĞİ DÜŞÜRMÜYOR.
 *
 * Anahtar yok, kota bitti, ağ gitti, model saçmaladı: hepsinin sonucu
 * aynı, yorum yok. Kartlar zaten kendi ucundan geliyor. Yorum bir SÜS;
 * süsün başarısızlığı içeriği götürmemeli.
 */
export async function narrate(
  userId: string,
  findings: BehaviorFinding[],
): Promise<string | null> {
  if (!isGeminiEnabled() || findings.length === 0) return null;

  const key = cacheKey(userId, findings);
  const hit = cache.get(key);

  if (hit !== undefined && Date.now() - hit.at < TTL_MS) return hit.text;

  /*
    ⚠️ MODELE GİDEN VERİDE KİMLİK YOK.

    Kullanıcı adı, e-posta, kullanıcı kimliği, emir kimlikleri — hiçbiri
    gönderilmiyor. Yalnızca ölçüm anahtarları ve başlıklar. Bu veri
    Google'ın sunucusuna gidiyor; gitmesi gerekmeyen hiçbir şey gitmemeli.

    `facts` de gönderilmiyor: model zaten sayı yazmayacak, sayıları
    görmesine gerek yok. Görseydi kurallara rağmen kullanma ihtimali
    doğardı.
  */
  const summary = findings
    .map((f, i) => `${i + 1}. ${f.title} (${f.key})`)
    .join('\n');

  const result = await callModel<{ comment?: unknown }>({
    systemInstruction: SYSTEM_INSTRUCTION,
    contents: `Ölçülen bulgular:\n${summary}`,
    responseSchema: RESPONSE_SCHEMA,
    maxOutputTokens: 400,
    timeoutMs: TIMEOUT_MS,
  });

  const comment = result?.comment;

  if (typeof comment !== 'string' || comment.trim() === '') return null;

  /*
    ⚠️ UZUNLUK SINIRI — MODEL "3 CÜMLE" KURALINI TUTMAYABİLİR.

    İstem kuralı bir rica; `maxOutputTokens` sert sınır ama kelime değil
    token sayıyor. Ekran tasarımı üç cümlelik bir paragrafa göre yapıldı;
    900 karakterlik bir metin kartı taşırırdı.
  */
  const text = comment.trim().slice(0, 400);

  remember(key, text);
  return text;
}

/** Önbelleğe yazar, sınırı aşarsa en eski kaydı atar. */
function remember(key: string, text: string): void {
  if (cache.size >= MAX_ENTRIES) {
    // `Map` ekleme sırasını koruyor: ilk anahtar en eski kayıt.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }

  cache.set(key, { text, at: Date.now() });
}
