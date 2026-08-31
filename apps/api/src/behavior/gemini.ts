/**
 * gemini.ts — Gemini çağrısının TEK yeri.
 *
 * ⚠️ BU DOSYA BİR KOPYALAMAYI ÖNLEMEK İÇİN VAR.
 *
 * İkinci bir özellik (sohbet) aynı modeli çağırmaya başlayınca anahtar,
 * model adı, zaman aşımı, düşünme ayarı ve JSON doğrulaması iki dosyada
 * birden yaşayacaktı. Bu projede bulunan hataların en sık türü tam olarak
 * bu: bir kural iki yerde durur, biri düzeltilir, öteki eski kalır.
 *
 * Somut örnek: düşünme bütçesi hatası (`thinkingBudget: 0`) bir hata
 * ayıklama oturumuna mal oldu. Kopyalanmış olsaydı sohbet katmanı aynı
 * hatayı sıfırdan yaşardı — üstelik belirtisi yine sessiz olurdu.
 */

import { GoogleGenAI } from '@google/genai';

/**
 * ⚠️ `requireEnv` KULLANILMIYOR — VE BU FARK ÖNEMLİ.
 *
 * `requireEnv` eksik değişkende PATLIYOR ve `JWT_ACCESS_SECRET` için doğru
 * davranış bu: gizli anahtarsız çalışan bir kimlik sistemi güvenlik açığı.
 *
 * Burada durum farklı: Gemini anahtarı yoksa özellik KAPANMALI, uygulama
 * değil. Kartlar zaten şablon metinlerle dolu. Açılışta patlasaydık
 * anahtarı olmayan herkes uygulamayı hiç açamazdı.
 *
 * Kural: eksik ayar UYGULAMAYI BOZUYORSA patla, yalnızca bir özelliği
 * kapatıyorsa sessizce kapan.
 */
const API_KEY = process.env.GEMINI_API_KEY ?? null;

/**
 * Kullanılan model — SABİT SÜRÜM, "latest" TAKMA ADI DEĞİL.
 *
 * ⚠️ EN YENİ MODEL EN İYİ MODEL DEĞİL. Adaylar aynı istemle, beşer örnekle
 * ölçüldü (28 Ağu 2026):
 *
 *                          ortanca   en kötü   yayılım
 *   gemini-2.5-flash        973 ms   3275 ms   2390 ms
 *   gemini-3.5-flash       1228 ms   1408 ms    317 ms  <- seçilen
 *   gemini-3.6-flash       ❌ düşünme KAPATILAMIYOR (400), 25 saniye
 *   gemini-3.7-flash       ❌ 503, aşırı yoğunluk
 *
 * ⚠️ SONRA KOTA HER ŞEYİ DEĞİŞTİRDİ — VE SEÇİM `2.5-flash`'A DÖNDÜ.
 *
 * Sohbet katmanını denerken ücretsiz katman kotası doldu ve hata mesajı
 * gerçek sınırları açık etti:
 *
 *   gemini-3.5-flash  ->  GÜNDE 20 istek  (ve dakikada 5)
 *   gemini-2.5-flash  ->  aynı anda hâlâ çalışıyor, günlük sınırı çok yüksek
 *
 * Günde 20 istek bir sohbet özelliği için kullanılamaz; hatta anlatıcı
 * bile 20 kullanıcıda tükenirdi. Gecikme farkı (ortanca 973 ms ile
 * 1228 ms) bunun yanında önemsiz.
 *
 * ⚠️ VE `2.5`'İN ZAYIF YANI ARTIK ZARARSIZ. Onu elemiş sebep yayılımının
 * geniş olmasıydı (en kötü 3275 ms), çünkü o sırada çağrı KARTLARI
 * bekletiyordu. Yorum ayrı uca taşınınca bu çağrı hiçbir şeyi
 * bekletmiyor — geniş yayılım artık sadece "yorum biraz geç gelir"
 * demek.
 *
 * Yani karar zinciri şu: mimariyi değiştirdik -> gecikme kriteri
 * değersizleşti -> kota kriteri öne çıktı -> model değişti.
 *
 * ⚠️ ESKİ GEREKÇE (artık geçerli değil ama neden değiştiğini gösteriyor):
 * ORTANCA DEĞİL EN KÖTÜ DURUM SEÇTİRDİ. `2.5` daha hızlı bir ortanca
 * veriyor ama yayılımı yedi kat geniş. Zaman aşımıyla sınırlı bir çağrıda
 * önemli olan tipik süre değil, sınırı aşma ihtimali.
 *
 * ⚠️ İLK ÖLÇÜM TEK ÖRNEKTİ VE YANILTTI: `3.5` için 1293 ms görüp seçmiştim,
 * sonraki dört çağrı 3580-7253 ms geldi. Tek ölçüm ölçüm değildir.
 *
 * ⚠️ `gemini-flash-latest` TAKMA ADI KULLANILMADI. Takma ad cazip: model
 * eskimez. Ama Google onu bir gün `3.6` gibi bir sürüme bağlarsa
 * özelliğimiz BİZ HİÇBİR ŞEY YAPMADAN bozulur — üstelik sessizce, çünkü
 * her hata `null`'a çevriliyor. Sabit sürüm eskiyebilir; eskimesi görünür
 * bir sorundur, kendiliğinden bozulması değil.
 */
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

/**
 * SUNUCU GENELİ HIZ SINIRI — dakikada kaç model çağrısı.
 *
 * ⚠️ GOOGLE'IN SINIRI PROJE BAŞINA, KULLANICI BAŞINA DEĞİL.
 *
 * Ölçüldü (kota dolunca hata mesajı açık etti):
 *
 *   GenerateRequestsPerMinutePerProjectPerModel-FreeTier  ->  5
 *   GenerateRequestsPerDayPerProjectPerModel-FreeTier     ->  20 (3.5-flash)
 *
 * `chat.ts`'teki kullanıcı başına sınır tek bir kişinin kotayı
 * yakmasını engelliyor ama ÜÇ KİŞİ AYNI ANDA konuşursa yetmiyor:
 * her biri kendi sınırının altında kalır, toplam yine 5'i aşar.
 *
 * O yüzden koruma iki katmanlı: kişisel sınır adaleti sağlıyor,
 * buradaki ortak sınır kotayı koruyor.
 *
 * ⚠️ 4 SEÇİLDİ, 5 DEĞİL. Sınıra tam oturmak, saniyelik kaymalarda
 * yine 429 yemek demek. Bir birim pay bırakmak, hata mesajı yerine
 * düzgün bir "biraz bekle" cevabı üretiyor.
 */
const GLOBAL_LIMIT = 4;
const GLOBAL_WINDOW_MS = 60_000;

let globalHits: number[] = [];

/**
 * Ortak kotadan bir pay ayırır.
 *
 * @returns Çağrı yapılabilir mi.
 */
function takeGlobalSlot(now: number): boolean {
  globalHits = globalHits.filter((t) => now - t < GLOBAL_WINDOW_MS);

  if (globalHits.length >= GLOBAL_LIMIT) return false;

  globalHits.push(now);
  return true;
}

/** Anahtar tanımlı mı — çağıranlar boşuna istek kurmasın diye. */
export const isGeminiEnabled = (): boolean => API_KEY !== null;

export interface ModelCall {
  /** Modelin uyacağı kurallar. */
  systemInstruction: string;
  /** Kullanıcı tarafındaki içerik. */
  contents: string;
  /** Beklenen JSON şeması. */
  responseSchema: unknown;
  /** Çıktı üst sınırı (token). */
  maxOutputTokens: number;
  /** Bu süreyi aşarsa iptal (ms). */
  timeoutMs: number;
}

/**
 * Modeli çağırır ve JSON cevabını çözer.
 *
 * @returns Ayrıştırılmış nesne, ya da herhangi bir başarısızlıkta `null`.
 *
 * ⚠️ HER BAŞARISIZLIK `null` — VE HİÇBİRİ FIRLATMIYOR.
 *
 * Anahtar yok, kota bitti, ağ gitti, model yarım cevap verdi: hepsinin
 * sonucu aynı. Çağıranlar `null`'ı normal bir cevap olarak ele alıyor;
 * yapay zekâ bu uygulamada bir SÜS, süsün başarısızlığı içeriği
 * götürmemeli.
 */
export async function callModel<T>(call: ModelCall): Promise<T | null> {
  if (API_KEY === null) return null;

  /*
    ⚠️ SINIR ÇAĞRIDAN ÖNCE — istek hiç kurulmuyor. Google'a gidip 429
    yemek de "çalışır" ama kotadan sayılır mı belirsiz, ve her denemede
    ağ turu israf olur. Kapıda durdurmak hem ucuz hem kesin.
  */
  if (!takeGlobalSlot(Date.now())) {
    console.warn('[behavior/gemini] sunucu geneli hız sınırı — çağrı atlandı');
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: call.contents,
      config: {
        systemInstruction: call.systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: call.responseSchema,

        /*
          ⚠️ DÜŞÜK SICAKLIK. Kurallardan sapma ihtimalini azaltıyor —
          ve buradaki kurallar üslup değil, doğruluk meselesi.
        */
        temperature: 0.3,

        /*
          ⚠️ DÜŞÜNME KAPALI — VE BU BİR HATA AYIKLAMA OTURUMUNUN BEDELİYDİ.

          Gemini cevaptan ÖNCE "düşünüyor" ve o düşünme token'ları
          `maxOutputTokens` bütçesinden SAYILIYOR. Ölçülen gerçek çağrılar:

            varsayılan düşünme, sınır 300 -> 286 token düşünmeye gitti,
              cevaba 6 kaldı, finishReason MAX_TOKENS, metin yarım kaldı
              ("Here is the JSON requested:")
            thinkingBudget 0, sınır 400   -> STOP, 63 token cevap, geçerli JSON

          Belirtisi sinsiydi: istisna YOK, HTTP 200, sonuç `null`. Sunucu
          sağlıklı görünüyordu. Yakalayan şey aşağıdaki JSON doğrulaması
          oldu.
        */
        thinkingConfig: { thinkingBudget: 0 },

        maxOutputTokens: call.maxOutputTokens,
        abortSignal: AbortSignal.timeout(call.timeoutMs),
      },
    });

    return parseJson<T>(response.text);
  } catch (error) {
    // Log'a düşsün ki kota/anahtar sorunu görünür olsun; ama isteği bozmasın.
    console.warn('[behavior/gemini] çağrı başarısız:', error);
    return null;
  }
}

/**
 * Modelin JSON cevabını çözer.
 *
 * ⚠️ ŞEMA VERMİŞ OLMAK YETMİYOR, YİNE DE DOĞRULUYORUZ.
 *
 * `responseSchema` modelin JSON üretmesini sağlıyor ama garanti bir
 * sözleşme değil: cevap boş dönebilir, bütçe bitip yarım kalabilir,
 * ayrıştırma patlayabilir. Dış dünyadan gelen her veri gibi
 * doğrulanıyor — MODEL DE DIŞ DÜNYADIR.
 *
 * Nitekim düşünme bütçesi hatasını bu doğrulama yakaladı: yarım JSON
 * ayrıştırılamadı ve `null` döndü. Olmasaydı ekranda yarım bir cümle
 * görünürdü.
 */
function parseJson<T>(raw: string | undefined): T | null {
  if (raw === undefined || raw.trim() === '') return null;

  try {
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== 'object' || parsed === null) return null;

    return parsed as T;
  } catch {
    return null;
  }
}
