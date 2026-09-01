import { z } from 'zod';

/**
 * security-question.schema.ts — güvenlik sorusu akışının girdi sözleşmesi.
 *
 * ⚠️ CEVAP NORMALLEŞTİRİLİYOR — VE BU ŞART, SÜS DEĞİL.
 *
 * Kullanıcı cevabı bugün "Pamuk", altı ay sonra " pamuk" yazar. İkisi
 * farklı hash üretir ve doğru cevabı bilen kişi hesabına giremez.
 * Şifrede normalleştirme YAPILMAZ (şifre tam olarak yazıldığı gibidir),
 * ama güvenlik cevabı bir şifre değil, HATIRLANAN bir metindir.
 *
 * Bedeli: normalleştirme cevabın entropisini biraz düşürür ("Pamuk" ile
 * "pamuk" artık aynı). Kullanılabilirlik uğruna bilerek ödeniyor —
 * hatırlanamayan bir cevap hesabı zaten kilitler.
 */

/**
 * ⚠️ TÜRKÇE'DE `toLowerCase()` TEHLİKELİ: "I" harfi Türkçe yerelde "ı"ya,
 * İngilizce yerelde "i"ya dönüşür. Aynı cevap, çalıştığı ortamın yereline
 * göre FARKLI hash üretebilirdi — sunucu yerelini değiştirdiğimiz gün
 * kimse şifresini sıfırlayamazdı ve sebebi hiçbir yerde yazmazdı.
 *
 * `toLocaleLowerCase('tr')` yereli sabitliyor: davranış ortamdan bağımsız.
 */
export function normalizeAnswer(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ') // araya kaçan çift boşlukları tekle
    .toLocaleLowerCase('tr');
}

const answerField = z
  .string()
  .trim()
  .min(2, 'Cevap en az 2 karakter olmalıdır.')
  .max(120, 'Cevap en fazla 120 karakter olabilir.');

const questionField = z
  .string()
  .trim()
  .min(8, 'Soru en az 8 karakter olmalıdır.')
  .max(160, 'Soru en fazla 160 karakter olabilir.');

/** 1. adım: "bu e-postanın güvenlik sorusu ne?" */
export const securityQuestionLookupSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi giriniz.').trim().toLowerCase(),
});

/**
 * 2. adım: cevabı ve yeni şifreyi birlikte gönder.
 *
 * ⚠️ CEVAP VE YENİ ŞİFRE TEK İSTEKTE — İKİ AŞAMAYA BÖLÜNMEDİ.
 *
 * "Önce cevabı doğrula, sonra şifreyi al" daha rahat bir akış olurdu ama
 * araya bir SIFIRLAMA JETONU koymayı gerektirirdi: aksi hâlde ikinci
 * istek hiçbir şeye dayanmaz ve ilk günkü açığın aynısı geri gelirdi.
 * Jeton üretmek, saklamak ve süresini yönetmek ayrı bir iş; tek istek
 * aynı güvenceyi kod eklemeden veriyor.
 */
export const resetWithAnswerSchema = z
  .object({
    email: z.string().email('Geçerli bir e-posta adresi giriniz.').trim().toLowerCase(),
    answer: answerField,
    password: z
      .string()
      .min(8, 'Şifre en az 8 karakter olmalıdır.')
      .max(64, 'Şifre en fazla 64 karakter olabilir.'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Şifreler birbiriyle eşleşmiyor.',
    path: ['confirmPassword'],
  });

/** Giriş yapmış kullanıcının güvenlik sorusunu kurması / değiştirmesi. */
export const setSecurityQuestionSchema = z.object({
  question: questionField,
  answer: answerField,
});

export type SecurityQuestionLookupBody = z.infer<typeof securityQuestionLookupSchema>;
export type ResetWithAnswerBody = z.infer<typeof resetWithAnswerSchema>;
export type SetSecurityQuestionBody = z.infer<typeof setSecurityQuestionSchema>;
