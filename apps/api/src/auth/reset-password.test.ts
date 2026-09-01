import { beforeEach, describe, expect, it, vi } from 'vitest';
import argon2 from 'argon2';
import {
  NoSecurityQuestionError,
  SameAsOldPasswordError,
  TooManyAttemptsError,
  UserNotFoundError,
  WrongSecurityAnswerError,
  getSecurityQuestion,
  resetUserPassword,
} from './service.js';
import * as repository from './repository.js';
import { resetRateLimits } from '../lib/rate-limit.js';

/**
 * ⚠️ BU DOSYANIN ÖNCEKİ HÂLİ YEŞİLDİ VE AÇIK BİR GÜVENLİK DELİĞİNİ
 * KORUYORDU — bu projede öğrenilecek en pahalı ders burada.
 *
 * Eski `resetUserPassword` yalnızca `{ email, password }` alıyordu ve
 * kimliği HİÇ doğrulamıyordu: bir e-posta adresini bilen herkes o hesabı
 * ele geçirebiliyordu. Eski testler üç şey soruyordu:
 *
 *   - kullanıcı yoksa hata veriyor mu?
 *   - yeni şifre eskisiyle aynıysa hata veriyor mu?
 *   - şifreyi hash'leyip yazıyor mu?
 *
 * Üçü de doğruydu. Hiçbiri "PEKİ BU KİŞİ HESABIN SAHİBİ Mİ?" diye
 * sormuyordu. Test ancak sorduğu soruya cevap verir; sorulmayan soru
 * yeşil bir suitin arkasında yıllarca durabilir.
 *
 * Aşağıdaki ilk test tam olarak o eksik soruyu soruyor.
 */

vi.mock('./repository.js', () => ({
  findUserSecurity: vi.fn(),
  updateUserPasswordById: vi.fn(),
  updateSecurityQuestion: vi.fn(),
  findUserForLogin: vi.fn(),
  updateUserPassword: vi.fn(),
}));

vi.mock('argon2', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_value'),
    verify: vi.fn(),
  },
}));

const KAYITLI = {
  id: 'user-uuid',
  email: 'user@example.com',
  passwordHash: 'old_hashed_password',
  securityQuestion: 'İlk evcil hayvanının adı neydi?',
  securityAnswerHash: 'hashed_answer',
};

const GECERLI_GIRDI = {
  email: 'user@example.com',
  answer: 'Pamuk',
  password: 'newpassword123',
  confirmPassword: 'newpassword123',
};

beforeEach(() => {
  vi.clearAllMocks();
  // ⚠️ Sayaçlar testler arasında sıfırlanmalı: aksi hâlde önceki testin
  // denemeleri sonrakini hız sınırına takar ve hata "sızan durum" olur.
  resetRateLimits();
  vi.mocked(argon2.hash).mockResolvedValue('hashed_value' as never);
});

describe('resetUserPassword — kimlik doğrulaması', () => {
  /*
    ⚠️ AÇIĞI YAKALAYAN TEST BU. Eski kodda geçmezdi: cevap yanlış olsa
    bile şifre yazılıyordu. Bir düzeltmenin gerçekten düzeltme olduğunu
    ancak eski kodda KIRILAN bir test kanıtlar.
  */
  it('cevap yanlışsa şifreyi YAZMAZ', async () => {
    vi.mocked(repository.findUserSecurity).mockResolvedValueOnce(KAYITLI);
    vi.mocked(argon2.verify).mockResolvedValueOnce(false); // cevap tutmadı

    await expect(resetUserPassword(GECERLI_GIRDI)).rejects.toThrow(
      WrongSecurityAnswerError,
    );

    // Asıl iddia bu: hiçbir yazma işlemi olmadı.
    expect(repository.updateUserPasswordById).not.toHaveBeenCalled();
    expect(argon2.hash).not.toHaveBeenCalled();
  });

  it('cevap doğruysa şifreyi hash’leyip KULLANICI KİMLİĞİYLE yazar', async () => {
    vi.mocked(repository.findUserSecurity).mockResolvedValueOnce(KAYITLI);
    vi.mocked(argon2.verify)
      .mockResolvedValueOnce(true) // cevap doğru
      .mockResolvedValueOnce(false); // yeni şifre eskisinden farklı
    vi.mocked(repository.updateUserPasswordById).mockResolvedValueOnce({
      id: 'user-uuid',
    });

    await resetUserPassword(GECERLI_GIRDI);

    /*
      ⚠️ Güncelleme E-POSTAYLA değil KİMLİKLE yapılıyor. Doğrulamayı bir
      kayıt üzerinde yapıp yazmayı e-posta ile çalıştırmak, iki adımın
      farklı satırlara denk gelmesine kapı açardı.
    */
    expect(repository.updateUserPasswordById).toHaveBeenCalledWith(
      'user-uuid',
      'hashed_value',
    );
  });

  /*
    ⚠️ Cevap NORMALLEŞTİRİLEREK doğrulanıyor: kullanıcı "Pamuk" yazdı,
    karşılaştırma "pamuk" ile yapılıyor. Bu olmasaydı büyük/küçük harf ya
    da baştaki boşluk yüzünden doğru cevabı bilen kişi giremezdi.
  */
  it('cevabı normalleştirerek karşılaştırır', async () => {
    vi.mocked(repository.findUserSecurity).mockResolvedValueOnce(KAYITLI);
    vi.mocked(argon2.verify).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    vi.mocked(repository.updateUserPasswordById).mockResolvedValueOnce({
      id: 'user-uuid',
    });

    await resetUserPassword({ ...GECERLI_GIRDI, answer: '  PAMUK  ' });

    expect(argon2.verify).toHaveBeenNthCalledWith(1, 'hashed_answer', 'pamuk');
  });

  it('güvenlik sorusu kurulmamışsa ayrı bir hata verir', async () => {
    vi.mocked(repository.findUserSecurity).mockResolvedValueOnce({
      ...KAYITLI,
      securityQuestion: null,
      securityAnswerHash: null,
    });

    await expect(resetUserPassword(GECERLI_GIRDI)).rejects.toThrow(
      NoSecurityQuestionError,
    );
    expect(repository.updateUserPasswordById).not.toHaveBeenCalled();
  });

  it('kullanıcı yoksa hata verir ve yazma yapmaz', async () => {
    vi.mocked(repository.findUserSecurity).mockResolvedValueOnce(null);

    await expect(resetUserPassword(GECERLI_GIRDI)).rejects.toThrow(
      UserNotFoundError,
    );
    expect(repository.updateUserPasswordById).not.toHaveBeenCalled();
  });

  /*
    ⚠️ "Eski şifreyle aynı" kontrolü CEVAPTAN SONRA çalışıyor. Önce
    çalışsaydı, cevabı bilmeyen biri de bir şifre gönderip "bu, hesabın
    mevcut şifresi mi?" cevabını alabilirdi — sıfırlama ucu bir şifre
    doğrulama ucuna dönüşürdü.
  */
  it('eski şifreyle aynı olma kontrolü cevaptan SONRA yapılır', async () => {
    vi.mocked(repository.findUserSecurity).mockResolvedValueOnce(KAYITLI);
    vi.mocked(argon2.verify)
      .mockResolvedValueOnce(true) // cevap doğru
      .mockResolvedValueOnce(true); // şifre eskisiyle aynı

    await expect(resetUserPassword(GECERLI_GIRDI)).rejects.toThrow(
      SameAsOldPasswordError,
    );

    // İlk çağrı CEVAP karşılaştırması olmalı, şifre değil.
    expect(argon2.verify).toHaveBeenNthCalledWith(1, 'hashed_answer', 'pamuk');
  });

  it('çok fazla yanlış denemeden sonra kilitlenir', async () => {
    vi.mocked(repository.findUserSecurity).mockResolvedValue(KAYITLI);
    vi.mocked(argon2.verify).mockResolvedValue(false as never);

    // Sınır 5; altıncı deneme reddedilmeli.
    for (let i = 0; i < 5; i++) {
      await expect(resetUserPassword(GECERLI_GIRDI)).rejects.toThrow(
        WrongSecurityAnswerError,
      );
    }

    await expect(resetUserPassword(GECERLI_GIRDI)).rejects.toThrow(
      TooManyAttemptsError,
    );
  });
});

describe('getSecurityQuestion — 1. adım', () => {
  it('kayıtlı hesabın sorusunu döndürür', async () => {
    vi.mocked(repository.findUserSecurity).mockResolvedValueOnce(KAYITLI);

    await expect(getSecurityQuestion('user@example.com')).resolves.toEqual({
      question: 'İlk evcil hayvanının adı neydi?',
    });
  });

  /*
    ⚠️ Soru DIŞINDA hiçbir şey dönmemeli. Ad, kullanıcı adı ya da
    doğrulama durumu eklemek, kimlik doğrulaması olmayan bir uçtan
    kişisel veri sızdırmak olurdu.
  */
  it('yalnızca soruyu döndürür, başka alan sızdırmaz', async () => {
    vi.mocked(repository.findUserSecurity).mockResolvedValueOnce(KAYITLI);

    const sonuc = await getSecurityQuestion('user@example.com');

    expect(Object.keys(sonuc)).toEqual(['question']);
  });
});
