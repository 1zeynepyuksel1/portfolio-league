import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleAuthError, isGoogleEnabled, verifyGoogleIdToken } from './google.js';

/**
 * ⚠️ BU DOSYA BİR GÜVENLİK SÖZLEŞMESİNİ SINIYOR, BİR ÖZELLİĞİ DEĞİL.
 *
 * `verifyGoogleIdToken`'ın üç kontrolünden HERHANGİ BİRİ kaldırılırsa kod
 * çalışmaya devam eder, giriş başarılı olur ve hiçbir hata görünmez —
 * yalnızca sistem açılır. Böyle hataları ancak test yakalar.
 *
 * En kritiği `aud` kontrolü: saldırgan KENDİ Google uygulamasında kurbana
 * giriş yaptırır, aldığı jetonu bize gönderir. Jetonun imzası geçerli,
 * kimliği gerçek — ama jeton bize ait değil. `aud` bakılmazsa bu saldırı
 * çalışır ve loglarda normal bir giriş gibi görünür.
 */

const GECERLI = {
  aud: 'benim-istemci-kimligim',
  iss: 'https://accounts.google.com',
  sub: '1234567890',
  email: 'kullanici@gmail.com',
  email_verified: 'true',
  given_name: 'Ahmet',
  family_name: 'Yılmaz',
};

function fetchDondur(govde: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok, json: async () => govde } as Response),
  );
}

beforeEach(() => {
  process.env.GOOGLE_CLIENT_IDS = 'benim-istemci-kimligim,ikinci-platform';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.GOOGLE_CLIENT_IDS;
  delete process.env.GOOGLE_CLIENT_ID;
});

describe('verifyGoogleIdToken', () => {
  it('geçerli jetondan kimliği çıkarır', async () => {
    fetchDondur(GECERLI);

    await expect(verifyGoogleIdToken('jeton')).resolves.toEqual({
      sub: '1234567890',
      email: 'kullanici@gmail.com',
      firstName: 'Ahmet',
      lastName: 'Yılmaz',
    });
  });

  /*
    ⚠️ BU TESTİN KORUDUĞU ŞEY: başka bir uygulama için üretilmiş jetonla
    hesap ele geçirme. `aud` kontrolü silinirse bu test kırmızıya döner.
  */
  it('BAŞKA bir uygulama için üretilmiş jetonu reddeder', async () => {
    fetchDondur({ ...GECERLI, aud: 'saldirganin-istemci-kimligi' });

    await expect(verifyGoogleIdToken('jeton')).rejects.toThrow(GoogleAuthError);
  });

  /*
    ⚠️ Google aynı uygulamanın Android/iOS/web sürümlerine AYRI istemci
    kimliği veriyor. Tek kimlik beklersek uygulama yalnızca bir platformda
    çalışır — ve hata mesajı sebebi hiç söylemez.
  */
  it('yapılandırılmış İKİNCİ platform kimliğini de kabul eder', async () => {
    fetchDondur({ ...GECERLI, aud: 'ikinci-platform' });

    await expect(verifyGoogleIdToken('jeton')).resolves.toMatchObject({
      sub: '1234567890',
    });
  });

  it('Google dışı bir vericinin jetonunu reddeder', async () => {
    fetchDondur({ ...GECERLI, iss: 'https://kotu-site.example' });

    await expect(verifyGoogleIdToken('jeton')).rejects.toThrow(GoogleAuthError);
  });

  /*
    ⚠️ Doğrulanmamış e-posta kabul edilseydi: saldırgan kendi Google
    hesabına kurbanın adresini (doğrulamadan) ekler, Google ile giriş
    yapar ve `loginWithGoogle` o adrese ait yerel hesabı ona bağlardı.
    Otomatik bağlama kararı ANCAK bu kontrolle birlikte güvenli.
  */
  it('e-postası doğrulanmamış hesabı reddeder', async () => {
    fetchDondur({ ...GECERLI, email_verified: 'false' });

    await expect(verifyGoogleIdToken('jeton')).rejects.toThrow(GoogleAuthError);
  });

  /*
    ⚠️ `tokeninfo` bu alanı bazen metin bazen boolean döndürüyor.
    Yalnızca `=== true` yazsaydık doğrulanmış hesapların bir kısmı
    reddedilirdi — ve hata "bazı kullanıcılarda giriş çalışmıyor" diye
    görünürdü, aranması en zor tür.
  */
  it('email_verified boolean geldiğinde de kabul eder', async () => {
    fetchDondur({ ...GECERLI, email_verified: true });

    await expect(verifyGoogleIdToken('jeton')).resolves.toMatchObject({
      email: 'kullanici@gmail.com',
    });
  });

  it('Google jetonu reddederse hata verir', async () => {
    fetchDondur({ error: 'invalid_token' }, false);

    await expect(verifyGoogleIdToken('jeton')).rejects.toThrow(GoogleAuthError);
  });

  /*
    ⚠️ Google hesabında ad/soyad OLMAYABİLİR ama `first_name` kolonu
    `notNull`. Yedek üretilmezse kayıt veritabanı hatasıyla düşerdi.
  */
  it('ad/soyad eksikse makul bir yedek üretir', async () => {
    fetchDondur({
      aud: GECERLI.aud,
      iss: GECERLI.iss,
      sub: GECERLI.sub,
      email: GECERLI.email,
      email_verified: 'true',
    });

    const kimlik = await verifyGoogleIdToken('jeton');

    expect(kimlik.firstName).not.toBe('');
    expect(kimlik.lastName).not.toBe('');
  });

  it('yapılandırma yoksa doğrulamayı hiç denemez', async () => {
    delete process.env.GOOGLE_CLIENT_IDS;
    const sahteFetch = vi.fn();
    vi.stubGlobal('fetch', sahteFetch);

    await expect(verifyGoogleIdToken('jeton')).rejects.toThrow(GoogleAuthError);
    // ⚠️ Ağ isteği hiç gitmemeli: yapılandırma yoksa doğrulanacak bir
    // şey de yok, boşuna Google'a istek atmak anlamsız.
    expect(sahteFetch).not.toHaveBeenCalled();
  });
});

describe('isGoogleEnabled', () => {
  it('yapılandırma varsa true', () => {
    expect(isGoogleEnabled()).toBe(true);
  });

  it('yapılandırma yoksa false', () => {
    delete process.env.GOOGLE_CLIENT_IDS;
    expect(isGoogleEnabled()).toBe(false);
  });
});
