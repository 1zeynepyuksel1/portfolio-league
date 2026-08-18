import { describe, expect, it } from 'vitest';
import {
  friendshipIdParamSchema,
  sendFriendRequestSchema,
} from './friends.schema.js';
import {
  AlreadyFriendsError,
  CannotFriendSelfError,
  FriendRequestAlreadyPendingError,
  FriendshipNotFoundError,
  UnauthorizedFriendActionError,
  UserNotFoundError,
} from './service.js';

describe('Arkadaşlık Modülü Doğrulama ve Kural Testleri', () => {
  describe('Zod Şema Doğrulamaları', () => {
    it('geçerli bir e-postayı kabul etmeli, boşlukları kırpmalı ve küçük harfe çevirmeli', () => {
      const result = sendFriendRequestSchema.safeParse({
        addresseeEmail: '  AliYuksel@GMAIL.COM  ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.addresseeEmail).toBe('aliyuksel@gmail.com');
      }
    });

    it('geçersiz formatlı e-postaları reddetmeli', () => {
      const invalidEmails = ['gecersiz-eposta', '@gmail.com', 'ali@', 'ali@.com'];

      for (const email of invalidEmails) {
        const result = sendFriendRequestSchema.safeParse({
          addresseeEmail: email,
        });
        expect(result.success).toBe(false);
      }
    });

    it('geçerli bir UUID parametresini onaylamalı', () => {
      const validUuid = '0f687cc8-c89e-4631-bf47-926cdb133cfb';
      const result = friendshipIdParamSchema.safeParse({ id: validUuid });

      expect(result.success).toBe(true);
    });

    it('geçersiz ID formatını reddetmeli', () => {
      const result = friendshipIdParamSchema.safeParse({ id: '123-gecersiz-id' });

      expect(result.success).toBe(false);
    });
  });

  describe('İş Kuralı Hata Tipleri ve HTTP Durum Kodları', () => {
    it('kendine istek atma hatası 400 Bad Request dönmeli', () => {
      const error = new CannotFriendSelfError();
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('CANNOT_FRIEND_SELF');
    });

    it('kullanıcı bulunamadı hatası 404 Not Found dönmeli', () => {
      const error = new UserNotFoundError();
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('USER_NOT_FOUND');
    });

    it('zaten arkadaş olma hatası 409 Conflict dönmeli', () => {
      const error = new AlreadyFriendsError();
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('ALREADY_FRIENDS');
    });

    it('bekleyen istek varken tekrar atma hatası 409 Conflict dönmeli', () => {
      const error = new FriendRequestAlreadyPendingError();
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('FRIEND_REQUEST_PENDING');
    });

    it('yetkisiz işlem hatası 403 Forbidden dönmeli', () => {
      const error = new UnauthorizedFriendActionError();
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('UNAUTHORIZED_FRIEND_ACTION');
    });

    it('arkadaşlık kaydı bulunamadı hatası 404 Not Found dönmeli', () => {
      const error = new FriendshipNotFoundError();
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('FRIENDSHIP_NOT_FOUND');
    });
  });
});
