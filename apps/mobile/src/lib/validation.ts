/**
 * validation.ts — kimlik ekranlarının ortak giriş kontrolleri.
 *
 * ⚠️ BU DOSYA BİR HATADAN DOĞDU — ve hata kuralın ÜÇ YERE KOPYALANMIŞ
 * olmasıydı.
 *
 * `LoginScreen`, `RegisterScreen` ve `ForgotPasswordScreen` aynı e-posta
 * desenini ayrı ayrı tanımlıyordu:
 *
 *     const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
 *
 * Yani "@ ve boşluk olmayan her şey". Bu desen `tanıtım@gmail.com`'u
 * GEÇİRİYOR. Sunucu ise Zod'un `.email()`'ini kullanıyor ve o ASCII
 * bekliyor — istek 400 dönüyor, kullanıcı "Gönderilen kayıt bilgileri
 * geçersiz." mesajını görüyor ve altı kutudan hangisinin sorunlu olduğunu
 * ANLAYAMIYOR.
 *
 * Türkçe klavyede `tanıtım` yazmak son derece doğal; `ı` ile `i` yan yana
 * neredeyse aynı görünüyor. Kullanıcının kendi başına bulması imkânsıza
 * yakın.
 *
 * ⚠️ EKRAN İLE SUNUCU AYNI KATILIKTA OLMALI:
 *
 *   ekran daha GEVŞEK -> kullanıcı reddedilecek isteği gönderir, sebebini
 *                        göremez  (yaşanan buydu)
 *   ekran daha KATI   -> sunucunun kabul edeceği geçerli adresi reddeder;
 *                        daha sinsi, çünkü hiçbir yerde hata görünmez
 */

/**
 * Yapısal biçim: `bir_şey@bir_şey.bir_şey`.
 *
 * Bilerek gevşek — e-postanın tam dilbilgisi (RFC 5322) tek bir düzenli
 * ifadeye sığmıyor ve denemek yaygın bir hatadır. Son sözü sunucu ve
 * doğrulama e-postası söylüyor; buradaki kontrol yalnızca kullanıcıyı
 * boşuna bir ağ turundan kurtarmak için.
 */
const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Yalnızca yazdırılabilir ASCII (boşluktan `~`'ye).
 *
 * Türkçe karakterler (ı ş ğ ü ö ç İ Ş Ğ Ü Ö Ç) bu aralığın dışında.
 */
const ASCII_ONLY = /^[\x20-\x7E]+$/;

/**
 * E-posta adresini denetler.
 *
 * @returns Sorun varsa kullanıcıya gösterilecek Türkçe mesaj, yoksa `null`.
 *
 * ⚠️ `boolean` DEĞİL, MESAJ DÖNÜYOR — ve bu bilinçli. `true/false`
 * dönseydi her çağıran kendi mesajını yazardı ve "geçersiz" ile "Türkçe
 * karakter var" ayrımı yine üç yere dağılırdı. Sebebi bilen taraf mesajı
 * da versin.
 */
export function checkEmail(value: string): string | null {
  const mail = value.trim();

  if (mail.length === 0) return 'E-posta adresi girin.';

  /*
    ⚠️ SIRA ÖNEMLİ: Türkçe karakter kontrolü BİÇİM kontrolünden ÖNCE.

    `tanıtım@gmail.com` biçim olarak zaten geçerli görünüyor (@ var, nokta
    var). Biçimi önce sorsaydık kontrol geçer, kullanıcı hiçbir uyarı
    almadan isteği gönderir ve sunucudan genel bir hata alırdı — yani
    düzeltmeye çalıştığımız durumun ta kendisi.
  */
  if (!ASCII_ONLY.test(mail)) {
    return (
      'E-posta adresinde Türkçe karakter kullanılamaz (ı ş ğ ü ö ç). ' +
      'İngilizce karşılıklarını yazın.'
    );
  }

  if (!EMAIL_SHAPE.test(mail)) return 'Geçerli bir e-posta adresi girin.';

  return null;
}
