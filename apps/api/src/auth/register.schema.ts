import { z } from 'zod';

export const registerBodySchema = z
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
    firstName: z.string().trim().min(2, 'İsim en az 2 karakter olmalıdır.').max(50),
    lastName: z.string().trim().min(2, 'Soyisim en az 2 karakter olmalıdır.').max(50),
    username: z
      .string()
      .trim()
      .min(3, 'Kullanıcı adı en az 3 karakter olmalıdır.')
      .max(30, 'Kullanıcı adı en fazla 30 karakter olabilir.')
      .regex(/^[a-zA-Z0-9_]+$/, 'Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir.'),
  })
  .refine(
    (data) => data.password === data.confirmPassword,
    {
      message: 'Şifreler birbiriyle eşleşmiyor.',
      path: ['confirmPassword'],
    },
  );

export type RegisterBody = z.infer<typeof registerBodySchema>;
