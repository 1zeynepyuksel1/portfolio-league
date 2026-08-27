import { describe, expect, it } from 'vitest';
import { checkEmail } from './validation';

/**
 * ⚠️ BU TESTİN SEBEBİ GERÇEK BİR HATA.
 *
 * Kayıt ekranı `tanıtım@gmail.com`'u kabul ediyordu (deseni "@ ve boşluk
 * olmayan her şey"di), sunucu ise Zod'un `.email()`'i ile reddediyordu.
 * Kullanıcı "Gönderilen kayıt bilgileri geçersiz." mesajını görüyor ve
 * altı kutudan hangisinin sorunlu olduğunu anlayamıyordu.
 *
 * Aynı desen ÜÇ ekrana kopyalanmıştı — biri düzeltilse ötekiler eski
 * kalırdı. Artık tek yerde ve testli.
 */

describe('checkEmail · Türkçe karakter', () => {
  it('tanıtım@gmail.com reddedilir ve SEBEBİ söylenir', () => {
    const result = checkEmail('tanıtım@gmail.com');

    expect(result).not.toBeNull();
    // ⚠️ Sadece "reddedildi" yetmez. Hatanın tamamı kullanıcının SEBEBİ
    // görememesiydi; mesajın Türkçe karakterden bahsettiğini de sınıyoruz.
    expect(result).toContain('Türkçe karakter');
  });

  it.each([
    ['ş', 'kuruş@gmail.com'],
    ['ğ', 'dağ@gmail.com'],
    ['ü', 'gül@gmail.com'],
    ['ö', 'göz@gmail.com'],
    ['ç', 'çay@gmail.com'],
    ['İ', 'İsim@gmail.com'],
  ])('%s harfi reddedilir', (_harf, mail) => {
    expect(checkEmail(mail)).toContain('Türkçe karakter');
  });

  it('alan adında Türkçe karakter olsa da yakalanır', () => {
    // Yalnızca yerel kısmı denetleseydik bu geçerdi.
    expect(checkEmail('test@şirket.com')).toContain('Türkçe karakter');
  });
});

describe('checkEmail · biçim', () => {
  it.each([
    'tanitim@gmail.com',
    'a.b+c@alt.alan.co.uk',
    'x_1@y.dev',
  ])('%s geçerli', (mail) => {
    expect(checkEmail(mail)).toBeNull();
  });

  it.each([
    ['@ yok', 'tanitim.gmail.com'],
    ['nokta yok', 'tanitim@gmail'],
    ['yerel kısım yok', '@gmail.com'],
    ['alan yok', 'tanitim@'],
    ['boşluk var', 'tan itim@gmail.com'],
  ])('%s -> reddedilir', (_ad, mail) => {
    expect(checkEmail(mail)).not.toBeNull();
  });

  it('boş girdi ayrı mesaj alır', () => {
    // "Geçerli bir adres girin" demek, hiç yazmamış birine yanlış gelir.
    expect(checkEmail('')).toBe('E-posta adresi girin.');
    expect(checkEmail('   ')).toBe('E-posta adresi girin.');
  });

  it('baştaki/sondaki boşluk kırpılıyor', () => {
    // Telefon klavyeleri adresin sonuna boşluk eklemeye meyilli.
    expect(checkEmail('  tanitim@gmail.com  ')).toBeNull();
  });
});

describe('checkEmail · sıra', () => {
  /**
   * ⚠️ TÜRKÇE KONTROLÜ BİÇİM KONTROLÜNDEN ÖNCE OLMALI.
   *
   * `tanıtım@gmail.com` biçim olarak zaten geçerli görünüyor (@ var,
   * nokta var). Biçimi önce sorsaydık kontrol geçerdi ve kullanıcı hiçbir
   * uyarı almadan isteği gönderirdi — düzeltmeye çalıştığımız durumun ta
   * kendisi.
   */
  it('biçimi doğru ama Türkçe karakterli adreste Türkçe mesajı gelir', () => {
    const result = checkEmail('tanıtım@gmail.com');
    expect(result).toContain('Türkçe karakter');
    expect(result).not.toBe('Geçerli bir e-posta adresi girin.');
  });
});
