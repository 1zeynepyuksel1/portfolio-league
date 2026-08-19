import { z } from 'zod';

/**
 * POST /orders gövde doğrulaması.
 *
 * ⚠️ EN ÖNEMLİ KARAR: `quantity` STRING, number DEĞİL.
 *
 * JSON'da sayı olarak kabul etseydik zincir daha doğrulamaya gelmeden
 * kırılırdı. İstemci `0.1234567891` gönderdiğinde JavaScript onu IEEE 754
 * float'a çevirir ve son basamaklar sessizce kayar — biz `toAmount`'a
 * verdiğimizde iş işten geçmiş olur.
 *
 * String olarak alırsak metin hiç float'a uğramadan `parseScaled`'a gider.
 * money.ts'ten GET /assets'e kadar kurduğumuz disiplinin giriş kapısı burası.
 */
export const createOrderSchema = z.object({
  /**
   * Bizim varlık kodumuz: "BTC", "ETH". Borsanın çifti ("BTCUSDT") değil —
   * o BinanceAdapter'ın içinde kalıyor, dışarı sızmıyor.
   */
  symbol: z
    .string()
    .trim()
    .min(1, 'Varlık kodu gerekli.')
    .max(20, 'Varlık kodu çok uzun.')
    .transform((value) => value.toUpperCase()),

  side: z.enum(['buy', 'sell'], {
    message: "Yön 'buy' veya 'sell' olmalı.",
  }),

  /**
   * Ondalık ayırıcı NOKTA, binlik ayırıcı YOK — makine biçimi.
   * En fazla 10 basamak, çünkü AMOUNT_SCALE = 10.
   *
   * Sınırı burada koymazsak `toAmount` "10'dan fazla ondalık" diye hata
   * fırlatır ve kullanıcı 500 görür. Burada yakalanınca temiz bir 400 oluyor.
   *
   * Düzenli ifade negatifi de eliyor (başta `-` kabul etmiyor).
   */
  quantity: z
    .string()
    .trim()
    .regex(
      /^\d+(\.\d{1,10})?$/,
      'Miktar pozitif bir sayı olmalı, en fazla 10 ondalık basamak (örn. "0.5").',
    ),

  /** Karar notu — "neden aldım". Portföy ekranında işlemin yanında görünecek. */
  note: z.string().trim().max(500, 'Not en fazla 500 karakter olabilir.').optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/**
 * Idempotency-Key başlığı.
 *
 * İstemci butona bastığında üretir ve YENİDEN DENERKEN AYNISINI gönderir.
 * Sunucu üretemez — iki isteğin "aynı istek" mi yoksa "iki ayrı alım" mı
 * olduğunu ancak istemci bilir.
 */
export const idempotencyKeySchema = z
  .string({ message: 'Idempotency-Key başlığı gerekli.' })
  .trim()
  .min(8, 'Idempotency-Key en az 8 karakter olmalı.')
  .max(128, 'Idempotency-Key çok uzun.');
