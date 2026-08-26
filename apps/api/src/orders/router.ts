import { Router } from 'express';
import { requireAccessToken } from '../auth/middleware.js';
import { toAmount } from '../lib/money.js';
import { OrderValidationError } from './calculate.js';
import { createOrderSchema, idempotencyKeySchema } from './orders.schema.js';
import { getRecentOrders } from '../portfolio/repository.js';
import { executeOrder } from './repository.js';

export const ordersRouter = Router();

/**
 * Emir motoru — HTTP KATMANI.
 *
 * Bu dosyanın işi çeviri: HTTP dünyasından iş mantığı dünyasına ve geri.
 * Para hesabı yok, kilit yok, SQL yok — hepsi alt katmanlarda.
 */

/**
 * Hata kodu -> HTTP durum kodu.
 *
 * NEDEN TABLO, NEDEN `if` ZİNCİRİ DEĞİL:
 * Eşleme tek yerde ve gözle okunabilir. Yeni bir kod eklendiğinde buraya
 * bir satır eklenir; unutulursa 500'e düşer ve bu FARK EDİLİR — sessizce
 * yanlış durum kodu dönmekten iyidir.
 *
 * Durum kodlarının anlamı (docs/01-plan.md 9):
 *   422 -> istek biçimsel olarak doğru ama iş kuralına takıldı
 *   404 -> istenen şey yok
 *   503 -> sunucu şu an veremiyor, SONRA TEKRAR DENE
 */
const STATUS_BY_CODE: Record<string, number> = {
  INVALID_QUANTITY: 422,
  INVALID_PRICE: 422,
  AMOUNT_TOO_SMALL: 422,
  INSUFFICIENT_FUNDS: 422,
  INSUFFICIENT_HOLDING: 422,
  ASSET_NOT_FOUND: 404,
  ACCOUNT_NOT_FOUND: 404,
  // Fiyat bayat ya da hiç yok: kullanıcının hatası değil, cron'un işi.
  // 4xx dönersek istemci "isteğimi düzelteyim" sanır; 503 "birazdan tekrar
  // dene" demek.
  STALE_PRICE: 503,
  NO_PRICE: 503,
  /**
   * Piyasa kapalı: 422, **503 DEĞİL**.
   *
   * 503 "hizmet geçici olarak yok, birazdan tekrar dene" demek ve
   * istemciler bunu genelde otomatik tekrar denemeyle karşılıyor. Ama
   * piyasa kapalıysa "birazdan" saatler, hafta sonuysa günler sonra —
   * tekrar denemek boşuna istek üretirdi.
   *
   * 422 ise "isteğin biçimsel olarak doğru ama şu anki durumda
   * işlenemez" demek. `INSUFFICIENT_FUNDS` ile aynı aile: kullanıcının
   * yapması gereken bir şey var (beklemek), sistemde arıza yok.
   */
  MARKET_CLOSED: 422,
};

/**
 * GET /orders?limit=20 — kullanıcının son işlemleri.
 *
 * Cüzdan ekranındaki "SON İŞLEMLER" bloğunu besliyor.
 *
 * ⚠️ Tutarlar STRING. JSON'da sayı yazsaydık istemcide `number` olarak
 * okunur ve float'a düşerdi; money.ts'ten buraya taşınan bigint disiplini
 * ağın öbür ucunda çökerdi.
 */
ordersRouter.get('/', requireAccessToken, async (request, response) => {
  const userId = response.locals.userId as string;

  const raw = Number(request.query.limit ?? 20);

  // ⚠️ Üst sınır ŞART. Sınırsız bırakırsak `?limit=1000000` tek istekle
  // bütün emir tablosunu okutur.
  const limit = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 100) : 20;

  try {
    const rows = await getRecentOrders(userId, limit);

    return response.json({
      orders: rows.map((row) => ({
        id: row.id,
        symbol: row.symbol,
        name: row.name,
        side: row.side,
        quantity: row.quantity,
        priceTry: row.priceTry,
        netCents: row.netCents.toString(),
        executedAt: row.executedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[GET /orders] beklenmeyen hata:', error);
    return response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'İşlemler okunamadı.' },
    });
  }
});

ordersRouter.post('/', requireAccessToken, async (request, response) => {
  const userId = response.locals.userId as string;

  // 1. Tekrar anahtarı — gövdede değil BAŞLIKTA.
  //    Sebebi: anahtar isteğin içeriği değil, isteğin kimliği. Aynı gövde
  //    farklı anahtarlarla gönderilirse iki ayrı emirdir; aynı anahtarla
  //    gönderilirse tek emrin tekrarıdır.
  const keyResult = idempotencyKeySchema.safeParse(
    request.get('idempotency-key'),
  );

  if (!keyResult.success) {
    return response.status(400).json({
      error: {
        code: 'MISSING_IDEMPOTENCY_KEY',
        message: 'Idempotency-Key başlığı gerekli.',
        details: keyResult.error.issues.map((issue) => issue.message),
      },
    });
  }

  // 2. Gövde doğrulaması.
  //    `safeParse` fırlatmıyor, sonuç nesnesi döndürüyor — akış try/catch'e
  //    girmeden okunur kalıyor.
  const bodyResult = createOrderSchema.safeParse(request.body);

  if (!bodyResult.success) {
    return response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'İstek gövdesi geçersiz.',
        details: bodyResult.error.issues.map(
          (issue) => `${issue.path.join('.')}: ${issue.message}`,
        ),
      },
    });
  }

  const body = bodyResult.data;

  try {
    // 3. Metin -> ölçekli bigint. Zincirin HTTP tarafındaki son çevrim noktası.
    //    Şema düzenli ifadeyle biçimi zaten garanti ettiği için burada
    //    `toAmount` hata fırlatmaz.
    //
    //    `note` koşullu yayılıyor (`...`), doğrudan atanmıyor. Sebebi
    //    tsconfig'deki `exactOptionalPropertyTypes: true`:
    //    "alan yok" ile "alan var ama undefined" ayrı şeyler sayılıyor.
    //    `note: undefined` yazmak ikincisi olurdu; biz birincisini istiyoruz.
    const result = await executeOrder({
      userId,
      symbol: body.symbol,
      side: body.side,
      quantity: toAmount(body.quantity),
      idempotencyKey: keyResult.data,
      ...(body.note !== undefined ? { note: body.note } : {}),
    });

    // 4. Cevap. Kuruş alanları STRING —
    //    JSON'da sayı yazsaydık istemci tarafında float'a düşerdi.
    //    Zeynep de aynı deseni kullanıyor (bonus/router.ts).
    //
    //    `replayed: true` ise bu istek daha önce işlenmişti; yeni emir
    //    yaratılmadı, var olanın sonucu dönüyor. Yine 201 dönüyoruz çünkü
    //    kullanıcı açısından sonuç aynı: emir var.
    return response.status(201).json({
      orderId: result.orderId,
      side: result.side,
      symbol: result.symbol,
      quantity: result.quantity,
      priceTry: result.priceTry,
      grossCents: result.grossCents.toString(),
      feeCents: result.feeCents.toString(),
      netCents: result.netCents.toString(),
      balanceCents: result.balanceCents.toString(),
      replayed: result.replayed,
    });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      // Bilinmeyen kod gelirse 500 — sessizce 422 dönmektense gürültü çıksın.
      const status = STATUS_BY_CODE[error.code] ?? 500;

      return response.status(status).json({
        error: { code: error.code, message: error.message },
      });
    }

    // Beklenmeyen hata: tamamı LOG'a, kullanıcıya sadece genel mesaj.
    // Ham hatayı göndermek veritabanı tablo adlarını ve dosya yollarını
    // sızdırır.
    console.error('[POST /orders] beklenmeyen hata:', error);

    return response.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Emir işlenirken beklenmeyen bir hata oluştu.',
      },
    });
  }
});
