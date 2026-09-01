/**
 * google.ts — Google kimlik doğrulaması, SUNUCU TARAFI.
 *
 * ⚠️ EN ÖNEMLİ KURAL: İSTEMCİDEN GELEN PROFİLE ASLA GÜVENİLMEZ.
 *
 * Uygulama bize "ben ahmet@gmail.com'um" diye bir e-posta gönderebilir ve
 * bunu doğrulamadan kabul etseydik, herhangi biri istediği hesaba
 * girebilirdi — tek yapması gereken bir HTTP isteği atmak. Şifre
 * sıfırlamada kapattığımız açığın birebir aynısı, farklı kapıdan.
 *
 * İstemciden gelen tek şey Google'ın imzaladığı `id_token`. Bu jeton
 * Google'a DOĞRULATILIYOR ve kimlik yalnızca doğrulanmış içerikten
 * okunuyor.
 *
 * ⚠️ NEDEN `google-auth-library` DEĞİL DE `tokeninfo` UCU:
 *
 * Kütüphane Google'ın açık anahtarlarını çekip imzayı YEREL doğruluyor;
 * daha hızlı ve ağ hatasına dayanıklı. Doğru çözüm o. Burada uç
 * kullanılmasının iki sebebi var: (1) ne kontrol edildiği kodda açıkça
 * görünüyor — bu proje öğrenmek için var, (2) bir bağımlılık daha
 * eklenmiyor.
 *
 * Bedeli gerçek ve biliniyor: her girişte Google'a bir istek. Google
 * yavaşsa giriş yavaşlar, Google erişilemezse giriş çalışmaz.
 * `[DOĞRULANMALI]` değil, kabul edilmiş bir takas.
 */

const TOKENINFO = 'https://oauth2.googleapis.com/tokeninfo';

/** Google doğrulaması başarısız. */
export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleAuthError';
  }
}

export type GoogleIdentity = {
  /** Google'ın kalıcı kullanıcı kimliği. */
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
};

type TokenInfo = {
  aud?: string;
  iss?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
  exp?: string;
};

/**
 * İzin verilen `aud` değerleri.
 *
 * ⚠️ BİRDEN FAZLA OLABİLİR VE OLMAK ZORUNDA. Google, aynı uygulamanın
 * Android / iOS / web sürümlerine AYRI istemci kimlikleri veriyor;
 * jetonun `aud`'u hangi platformdan geldiyse o olur. Tek kimlik
 * beklersek uygulama yalnızca bir platformda çalışır ve diğerinde
 * "geçersiz jeton" der — sebebi de hiçbir yerde yazmaz.
 */
function izinliAudienceler(): string[] {
  return (process.env.GOOGLE_CLIENT_IDS ?? process.env.GOOGLE_CLIENT_ID ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

export function isGoogleEnabled(): boolean {
  return izinliAudienceler().length > 0;
}

/**
 * Google `id_token`'ını doğrular ve kimliği döndürür.
 *
 * ⚠️ ÜÇ KONTROL DE ŞART; biri eksikse doğrulama anlamsızlaşır.
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  const izinli = izinliAudienceler();

  if (izinli.length === 0) {
    throw new GoogleAuthError('Google girişi bu sunucuda yapılandırılmamış.');
  }

  const res = await fetch(`${TOKENINFO}?id_token=${encodeURIComponent(idToken)}`);

  if (!res.ok) {
    /*
      ⚠️ Google'ın hata gövdesi kullanıcıya GÖSTERİLMİYOR. İçinde jetonun
      kendisi ya da iç ayrıntılar geçebiliyor; dışarı sızmasına gerek yok.
    */
    throw new GoogleAuthError('Google oturumu doğrulanamadı.');
  }

  const info = (await res.json()) as TokenInfo;

  /*
    1) AUD — jeton BİZİM uygulamamız için mi üretilmiş?

    ⚠️ BU KONTROL OLMADAN HER ŞEY ÇALIŞIR VE SİSTEM TAMAMEN AÇILIR.
    Google'ın imzaladığı her jeton geçerli görünür; saldırgan KENDİ
    uygulamasında kurbanı Google ile giriş yaptırıp aldığı jetonu bize
    gönderir ve kurbanın hesabına girer. İmza doğru, kimlik doğru, ama
    jeton bize ait değil. En sık atlanan kontrol budur.
  */
  if (info.aud === undefined || !izinli.includes(info.aud)) {
    throw new GoogleAuthError('Bu Google oturumu bu uygulamaya ait değil.');
  }

  /*
    2) ISS — jetonu gerçekten Google mı verdi?
  */
  if (info.iss !== 'accounts.google.com' && info.iss !== 'https://accounts.google.com') {
    throw new GoogleAuthError('Google oturumu doğrulanamadı.');
  }

  /*
    3) EMAIL_VERIFIED — Google bu adresin sahipliğini doğrulamış mı?

    ⚠️ Doğrulanmamış e-posta ile hesap eşleştirmek TEHLİKELİ: biri
    kurbanın adresini kendi Google hesabına ekleyip (doğrulamadan)
    bizde o adrese bağlı hesabı ele geçirebilirdi.

    ⚠️ Alan bazen metin ("true"), bazen boolean geliyor — `tokeninfo` her
    şeyi metin döndürme eğiliminde. İkisi de kabul ediliyor; yalnızca
    `=== true` yazsaydık doğrulanmış hesaplar reddedilirdi.
  */
  const dogrulanmis = info.email_verified === true || info.email_verified === 'true';
  if (!dogrulanmis || info.email === undefined || info.sub === undefined) {
    throw new GoogleAuthError('Google hesabının e-postası doğrulanmamış.');
  }

  /*
    ⚠️ Ad/soyad OLMAYABİLİR. Google hesabında yalnızca tek bir ad
    bulunabiliyor. Boş bırakmak yerine makul bir yedek üretiliyor; ad
    alanı veritabanında `notNull`.
  */
  const tamAd = (info.name ?? '').trim();
  const firstName = (info.given_name ?? tamAd.split(' ')[0] ?? 'Kullanıcı').trim();
  const lastName = (info.family_name ?? tamAd.split(' ').slice(1).join(' ') ?? '').trim();

  return {
    sub: info.sub,
    email: info.email.toLowerCase(),
    firstName: firstName === '' ? 'Kullanıcı' : firstName,
    lastName: lastName === '' ? '-' : lastName,
  };
}
