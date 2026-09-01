/**
 * pg-time.ts — PostgreSQL zaman damgalarını doğru okumak.
 *
 * ⚠️ BU DOSYA OLMASA HER ŞEY ÇALIŞIR VE SESSİZCE 3 SAAT KAYAR.
 *
 * Projedeki `timestamp` kolonları DİLİMSİZ (`timestamp`, `timestamptz`
 * değil). Veritabanının saat dilimi UTC, yani saklanan duvar saati UTC.
 * Ham sorgu bunu şöyle döndürüyor:
 *
 *     "2026-08-26 09:45:19.888652"      <- araya boşluk, sonda dilim yok
 *
 * `new Date()` böyle bir metni YEREL saat sayar. Türkiye'de (UTC+3) her
 * zaman damgası 3 saat geriye kayar. `T` ekleyip `Z` ile bitirmek ISO 8601
 * veriyor ve `Date` onu kesin olarak UTC kabul ediyor.
 *
 * ⚠️ ÖLÇÜLDÜ, TAHMİN DEĞİL. Doğrulama:
 *
 *     DB saat dilimi     : UTC
 *     DB now()::timestamp: 09:36:41
 *     gerçek an          : 09:36:41Z
 *     düzeltmesiz okuma  : 06:36:41Z     <- 3 saat erken
 *
 * ⚠️ HATANIN GÖRÜNÜRLÜĞÜ EKRANA GÖRE DEĞİŞİYOR — EN SİNSİ TARAFI BU.
 * Yalnızca GÜN gösterilirken hata çoğu zaman fark edilmez; kayma günü
 * ancak yerel saat 03:00'ten önceki kayıtlarda değiştirir. SAAT
 * gösterildiği anda ise her kayıtta gözle görünür hâle gelir.
 * Yani "şimdiye kadar sorun çıkmadı" bu hatanın yokluğunu göstermiyordu.
 */

/**
 * Dilimsiz PostgreSQL zaman damgası metnini `Date`'e çevirir — UTC olarak.
 *
 * ⚠️ GİRDİ METİN OLMAK ZORUNDA, VE BU ÇAĞIRANIN SORUMLULUĞU.
 *
 * Sürücünün ne döndüreceği çağrı biçimine göre DEĞİŞİYOR: aynı kolon bir
 * yerde `string`, başka yerde parse edilmiş `Date` olarak geliyor. İkisini
 * de kabul eden bir fonksiyon yazmak mümkündü ama yanlış olurdu — çünkü
 * `Date` olarak gelen değer sürücü tarafından ZATEN yerel sayılıp
 * kaydırılmış oluyor ve düzeltmesi ters yönde. Tek bir fonksiyonun iki
 * farklı düzeltme yapması, hangi yolun kullanıldığını bilmeyi gerektirir.
 *
 * Bunun yerine kural sorguda: zaman damgası `::text` ile çekilecek.
 * Sürücü metne dokunmuyor, dolayısıyla girdi her zaman aynı biçimde.
 */
export function toUtcDate(text: string): Date {
  return new Date(`${text.replace(' ', 'T')}Z`);
}

/**
 * Aynı çevrimin ISO metni döndüren hâli — API yanıtları için.
 *
 * ⚠️ `null` GİRDİ `null` ÇIKIYOR, "şimdi" DEĞİL. Eksik tarihi bugüne
 * çevirmek, veri yokluğunu uydurma bir veriye dönüştürür: ekranda
 * "bugün alınmış" yazar ve kimse yanlış olduğunu anlamaz.
 */
export function toUtcIso(text: string | null | undefined): string | null {
  if (text === null || text === undefined || text === '') return null;
  return toUtcDate(text).toISOString();
}
