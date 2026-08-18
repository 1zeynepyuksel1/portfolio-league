import { z } from 'zod';

// Arkadaşlık isteği gönderme şeması (Hedef kullanıcının e-posta adresi)
export const sendFriendRequestSchema = z.object({
  addresseeEmail: z
    .string()
    .trim()
    .email('Geçerli bir e-posta adresi giriniz.')
    .transform((val) => val.toLowerCase()),
});

export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>;

// URL parametresi ID doğrulama şeması
export const friendshipIdParamSchema = z.object({
  id: z.string().uuid('Geçersiz istek ID formatı.'),
});

export type FriendshipIdParam = z.infer<typeof friendshipIdParamSchema>;
