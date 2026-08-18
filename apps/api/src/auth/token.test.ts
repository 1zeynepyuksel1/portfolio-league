import { beforeAll, describe, expect, it } from 'vitest';
import argon2 from 'argon2';
import {
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  verifyAccessToken,
} from './token.js';

describe('Auth & Token Güvenlik Motoru', () => {
  beforeAll(() => {
    // Testler için en az 32 karakterlik JWT Secret ayarlanır
    process.env.JWT_ACCESS_SECRET = 'super_secret_jwt_key_that_is_at_least_32_chars_long!';
    process.env.JWT_ACCESS_TTL_SECONDS = '900';
    process.env.JWT_REFRESH_TTL_DAYS = '30';
  });

  describe('JWT Access Token', () => {
    it('geçerli bir kullanıcı kimliği (userId) ile token üretmeli ve doğrulamalı', async () => {
      const mockUserId = '0f687cc8-c89e-4631-bf47-926cdb133cfb';
      const token = await createAccessToken(mockUserId);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT: header.payload.signature

      const verifiedUserId = await verifyAccessToken(token);
      expect(verifiedUserId).toBe(mockUserId);
    });

    it('değiştirilmiş veya bozuk bir token geldiğinde hata fırlatmalı', async () => {
      const validToken = await createAccessToken('user-123');
      const tamperedToken = validToken.slice(0, -5) + 'xxxxx';

      await expect(verifyAccessToken(tamperedToken)).rejects.toThrow();
    });

    it('tamamen anlamsız bir metin token olarak verildiğinde hata fırlatmalı', async () => {
      await expect(verifyAccessToken('gecersiz-ve-sahte-token')).rejects.toThrow();
    });
  });

  describe('Refresh Token & SHA-256', () => {
    it('32 baytlık rastgele ve benzersiz token üretmeli', () => {
      const token1 = createRefreshToken();
      const token2 = createRefreshToken();

      expect(token1.value).not.toBe(token2.value);
      expect(token1.tokenHash).not.toBe(token2.tokenHash);
      expect(token1.value.length).toBeGreaterThanOrEqual(32);
    });

    it('son geçerlilik tarihini yaklaşık 30 gün sonraya ayarlamalı', () => {
      const { expiresAt } = createRefreshToken();
      const now = Date.now();
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

      const diff = expiresAt.getTime() - now;
      expect(diff).toBeGreaterThan(thirtyDaysInMs - 5000); // 5 saniye tolerans
      expect(diff).toBeLessThan(thirtyDaysInMs + 5000);
    });

    it('aynı değer için tutarlı SHA-256 hash üretmeli', () => {
      const secret = 'my-super-refresh-token';
      const hash1 = hashRefreshToken(secret);
      const hash2 = hashRefreshToken(secret);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex çıktısı 64 karakterdir
    });
  });

  describe('Argon2 Şifreleme', () => {
    it('şifreyi güvenli bir şekilde hashlemeli ve doğru şifreyi doğrulamalı', async () => {
      const plainPassword = 'GuvenliSifre123!';
      const hash = await argon2.hash(plainPassword);

      expect(hash).not.toBe(plainPassword);
      expect(hash.startsWith('$argon2')).toBe(true);

      const isValid = await argon2.verify(hash, plainPassword);
      expect(isValid).toBe(true);
    });

    it('yanlış şifre verildiğinde doğrulamayı reddetmeli', async () => {
      const plainPassword = 'GuvenliSifre123!';
      const hash = await argon2.hash(plainPassword);

      const isWrongValid = await argon2.verify(hash, 'YanlisSifre456!');
      expect(isWrongValid).toBe(false);
    });
  });
});
