import { Router } from 'express';
import { requireAccessToken } from '../auth/middleware.js';
import { PortfolioNotFoundError } from '../portfolio/service.js';
import { MAX_MESSAGE_LENGTH, answer, sanitizeHistory } from './chat.js';
import { narrate } from './narrator.js';
import {
  MIN_ORDERS_FOR_ANALYSIS,
  getBehaviorReport,
} from './service.js';

export const behaviorRouter = Router();

/**
 * GET /me/behavior — kullanıcının yatırım alışkanlıkları.
 *
 * ⚠️ NEDEN `/me` ALTINDA VE BAŞKASININ KULLANICI ADINI ALMIYOR.
 *
 * Bu veri kişinin kendi hataları. Arkadaş profilinde gösterilseydi
 * ("bak bu adam panik satıyor") özellik alay konusuna dönerdi ve kimse
 * gerçek portföyünü paylaşmak istemezdi. Kullanıcı kimliği token'dan
 * geliyor, adresten değil — yani başkasınınkini istemek mümkün değil.
 *
 * KARAR: sayısal alanlar STRING. Aynı gerekçe GET /portfolio'da yazılı:
 * JSON'da sayı yazsaydık istemcide `number` olarak okunur, float'a düşerdi.
 * `facts` içindeki kuruş ve baz puan değerleri zaten metin olarak üretiliyor.
 */
behaviorRouter.get('/behavior', requireAccessToken, async (_request, response) => {
  const userId = response.locals.userId as string;

  try {
    const report = await getBehaviorReport(userId);

    /*
      ⚠️ YAPAY ZEKÂ YORUMU BU UÇTA YOK — AYRI BİR UÇTA. VE BU DÜZELTME
      ÖLÇÜMDEN DOĞDU.

      Önce yorum burada üretiliyordu: `await narrate(...)`. Sonuç, gerçek
      isteklerde ölçüldü:

        istek1  10,10 s  -> zaman aşımı, comment null
        istek2   5,29 s  -> başarılı
        sonraki  0,01 s  -> önbellek

      Yani kullanıcı profili İLK açtığında 5-10 saniye bekliyordu, üstelik
      bazen sonunda yorumsuz kalıyordu. Oysa kartların modele hiç ihtiyacı
      yok: sayıları biz hesaplıyoruz, veritabanı sorgusu milisaniyeler
      sürüyor.

      Ayırınca kartlar hemen çiziliyor, yorum hazır olunca üstlerine
      düşüyor. Ağın yavaşlığı artık yalnızca yorumu geciktiriyor,
      ölçümü değil.
    */
    return response.json({
      orderCount: report.orderCount,
      hasEnoughData: report.hasEnoughData,
      minOrders: MIN_ORDERS_FOR_ANALYSIS,
      findings: report.findings,
    });
  } catch (error) {
    /*
      Portföy okunamıyorsa yoğunlaşma göstergesi de hesaplanamaz.
      Hesabı olmayan bir kullanıcı için 404 doğru cevap — 500 değil,
      çünkü ortada bir arıza yok.
    */
    if (error instanceof PortfolioNotFoundError) {
      return response.status(404).json({
        error: { code: 'ACCOUNT_NOT_FOUND', message: error.message },
      });
    }

    console.error('[GET /me/behavior] beklenmeyen hata:', error);

    return response.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Alışkanlıklar okunurken beklenmeyen bir hata oluştu.',
      },
    });
  }
});

/**
 * GET /me/behavior/comment — bulguların yapay zekâ yorumu.
 *
 * ⚠️ AYRI UÇ OLMASININ SEBEBİ HIZ DEĞİL, BAĞIMLILIK YÖNÜ.
 *
 * Ölçüm modele bağlı değil; yorum ölçüme bağlı. İkisi tek uçta olsaydı
 * yavaş olan hızlıyı bekletirdi — nitekim bekletiyordu (yukarıdaki not).
 * Şimdi Google çökse bile kartlar zamanında geliyor.
 *
 * ⚠️ Bulgular BURADA YENİDEN HESAPLANIYOR. Sorgu ucuz (milisaniye) ve
 * alternatifi bulguları istemciden geri almak olurdu — yani modele giden
 * veriye istemcinin karışabilmesi. Sunucunun kendi ölçtüğü veriyi
 * kullanması hem daha güvenli hem daha basit.
 */
behaviorRouter.get(
  '/behavior/comment',
  requireAccessToken,
  async (_request, response) => {
    const userId = response.locals.userId as string;

    try {
      const report = await getBehaviorReport(userId);
      const comment = await narrate(userId, report.findings);

      /*
        `null` normal bir cevap, hata değil: anahtar yok, kota bitti,
        Google yavaş, ya da gösterilecek bulgu yok. Ekran bu durumda
        hiçbir şey çizmiyor.
      */
      return response.json({ comment });
    } catch (error) {
      console.error('[GET /me/behavior/comment] beklenmeyen hata:', error);

      // Yorum bir süs; başarısızlığı 500 ile büyütmüyoruz.
      return response.json({ comment: null });
    }
  },
);

/**
 * POST /me/behavior/chat — kendi ölçümleri hakkında sınırlı sohbet.
 *
 * ⚠️ POST, GET DEĞİL — VE SEBEBİ İKİ TANE.
 *
 * Mesaj ve geçmiş gövdede taşınıyor; sorgu dizesine sığmaz ve orada
 * durursa sunucu log'larına düşer. Ayrıca bu istek bir MODEL ÇAĞRISI
 * tetikliyor, yani yan etkisi ve maliyeti var — GET'in "güvenli
 * (safe) yöntem" sözleşmesine aykırı. GET olsaydı bir tarayıcı ön
 * yüklemesi bile kota harcayabilirdi.
 *
 * ⚠️ GEÇMİŞ İSTEMCİDEN GELİYOR VE TEMİZLENİYOR (`sanitizeHistory`).
 * Sunucuda geçmiş tutmuyoruz — migration istemesin diye. Bedeli:
 * istemci geçmişi uydurabilir. Savunmalar `chat.ts`'te belgeli.
 *
 * ⚠️ BULGULAR İSTEMCİDEN ALINMIYOR, YENİDEN HESAPLANIYOR. Alsaydık
 * modele giden veriye istemci karışabilirdi — "benim bulgum şu" deyip
 * olmayan bir davranış üzerine konuşturabilirdi.
 */
behaviorRouter.post(
  '/behavior/chat',
  requireAccessToken,
  async (request, response) => {
    const userId = response.locals.userId as string;
    const body = request.body as { message?: unknown; history?: unknown };

    if (typeof body?.message !== 'string' || body.message.trim() === '') {
      return response.status(400).json({
        error: { code: 'EMPTY_MESSAGE', message: 'Bir soru yaz.' },
      });
    }

    if (body.message.length > MAX_MESSAGE_LENGTH) {
      return response.status(400).json({
        error: {
          code: 'MESSAGE_TOO_LONG',
          message: `Soru en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir.`,
        },
      });
    }

    try {
      const report = await getBehaviorReport(userId);

      const outcome = await answer(
        userId,
        body.message,
        sanitizeHistory(body.history),
        report.findings,
      );

      if (outcome.ok) return response.json({ reply: outcome.reply });

      /*
        ⚠️ HATA TÜRLERİ AYRI KODLARLA DÖNÜYOR — çünkü ekranda farklı
        şeyler söylenmeli. Hepsini tek mesaja indirseydik "biraz
        bekle" ile "bu özellik kapalı" aynı görünürdü.
      */
      const durum = {
        rate_limited: {
          status: 429,
          code: 'RATE_LIMITED',
          message: 'Çok fazla soru sordun, biraz bekle.',
        },
        disabled: {
          status: 503,
          code: 'AI_DISABLED',
          message: 'Yapay zekâ şu an kapalı.',
        },
        failed: {
          status: 503,
          code: 'AI_FAILED',
          message: 'Cevap üretilemedi, tekrar dene.',
        },
        empty: {
          status: 400,
          code: 'EMPTY_MESSAGE',
          message: 'Bir soru yaz.',
        },
      }[outcome.reason];

      return response
        .status(durum.status)
        .json({ error: { code: durum.code, message: durum.message } });
    } catch (error) {
      console.error('[POST /me/behavior/chat] beklenmeyen hata:', error);

      return response.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Sohbet sırasında beklenmeyen bir hata oluştu.',
        },
      });
    }
  },
);
