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
    /**
     * ⚠️ ŞEMA ARTIK KÜÇÜK HARFE ÇEVİRMİYOR — ve bu testin kendisi sebebi.
     *
     * İlk yazımda şemada `toLocaleLowerCase("tr")` vardı. Bu test
     * "AliYuksel@GMAIL.COM" -> "aliyuksel@gmaıl.com" bulup patladı:
     * Türkçe yerelde "I" harfi "ı" oluyor ve E-POSTA BOZULUYOR.
     *
     * Küçültme doğru katmana taşındı: e-posta serviste düz
     * `toLowerCase()` ile, kullanıcı adı ise veritabanında harf duyarsız
     * karşılaştırmayla. Şema yalnızca kırpıyor ve baştaki "@" işaretini
     * atıyor — girdiyi BOZMUYOR.
     */
    it('e-postayı olduğu gibi bırakmalı, sadece boşlukları kırpmalı', () => {
      const result = sendFriendRequestSchema.safeParse({
        addressee: '  AliYuksel@GMAIL.COM  ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.addressee).toBe('AliYuksel@GMAIL.COM');
      }
    });

    /**
     * ⚠️ BU TEST ESKİDEN "geçersiz e-postaları reddetmeli" idi.
     *
     * Kural DEĞİŞTİ: alan artık kullanıcı adı da kabul ediyor, o yüzden
     * "gecersiz-eposta" geçerli bir GİRDİ (bir kullanıcı adı olabilir).
     * Eski testi silmek yerine yeni sözleşmeyi kilitliyoruz.
     */
    it('kullanıcı adını kabul etmeli ve baştaki @ işaretini atmalı', () => {
      const result = sendFriendRequestSchema.safeParse({
        addressee: '  @AliYuksel  ',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.addressee).toBe('AliYuksel');
      }
    });

    /**
     * ⚠️ BÜYÜK/KÜÇÜK HARF KORUNUYOR.
     *
     * Kullanıcı adları kayıtta olduğu gibi saklanıyor ("Batuhan").
     * Şemada küçültseydik "Batuhan" diye kayıtlı birini bulamazdık.
     * Harf duyarsızlığı SORGUDA sağlanıyor (lower() = lower()).
     */
    it('kullanıcı adının harf durumunu bozmamalı', () => {
      const result = sendFriendRequestSchema.safeParse({ addressee: 'ILKER' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.addressee).toBe('ILKER');
      }
    });

    it('boş girdiyi reddetmeli', () => {
      for (const value of ['', '   ', '@']) {
        const result = sendFriendRequestSchema.safeParse({ addressee: value });
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
