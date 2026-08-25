import { z } from 'zod';

export const verifyEmailSchema = z.object({
  userId: z.string().uuid('Geçerli bir kullanıcı kimliği giriniz.'),
  code: z.string().trim().length(6, 'Doğrulama kodu 6 haneli olmalıdır.'),
});

export const resendCodeSchema = z.object({
  userId: z.string().uuid('Geçerli bir kullanıcı kimliği giriniz.'),
});

export type VerifyEmailBody = z.infer<typeof verifyEmailSchema>;
export type ResendCodeBody = z.infer<typeof resendCodeSchema>;
