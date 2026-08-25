import { z } from 'zod';

export const resetPasswordBodySchema = z
  .object({
    email: z.string().email('Geçerli bir e-posta adresi giriniz.').trim().toLowerCase(),
    password: z
      .string()
      .min(8, 'Şifre en az 8 karakter olmalıdır.')
      .max(64, 'Şifre en fazla 64 karakter olabilir.'),
    confirmPassword: z
      .string()
      .min(8, 'Şifre tekrarı en az 8 karakter olmalıdır.')
      .max(64, 'Şifre tekrarı en fazla 64 karakter olabilir.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Şifreler birbiriyle eşleşmiyor.',
    path: ['confirmPassword'],
  });

export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
