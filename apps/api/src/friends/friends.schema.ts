import { z } from 'zod';

/**
 * Arkadaşlık isteği — KULLANICI ADI ya da E-POSTA.
 *
 * ⚠️ TEK ALAN, İKİ ANLAM. Ayrı alanlar (`username` / `email`) koysaydık
 * ekranda iki kutu ya da bir seçici gerekirdi; oysa kullanıcı elindeki
 * neyse onu yazmak istiyor. Ayrım sunucuda yapılıyor: içinde "@"
 * geçiyorsa e-posta, geçmiyorsa kullanıcı adı.
 *
 * ⚠️ BAŞTAKİ "@" TEMİZLENİYOR. Kullanıcılar profilde "@deneme1" görüp
 * aynen yazıyor; işareti bırakırsak "@deneme1" diye bir kullanıcı
 * aranır ve "bulunamadı" denir. Hata mesajı doğru olur ama sebebi
 * görünmez — kullanıcı adı doğru yazmıştır.
 */
export const sendFriendRequestSchema = z.object({
  addressee: z
    .string()
    .trim()
    /**
     * ⚠️ SIRA: ÖNCE TEMİZLE, SONRA UZUNLUĞU KONTROL ET.
     *
     * İlk yazımda `.min(1)` transform'dan ÖNCEYDİ. Test yakaladı:
     * kullanıcı yalnızca "@" yazınca min(1) geçiyor (uzunluk 1), sonra
     * "@" atılınca elde BOŞ DİZE kalıyordu. Doğrulama başarılı dönüyor,
     * servise boş bir arama gidiyordu.
     *
     * Zod'da `transform` ile `refine` arasındaki sıra bu yüzden önemli:
     * kontrol, DÖNÜŞMÜŞ değeri görmeli.
     */
    .transform((val) => val.replace(/^@/, ''))
    .refine((val) => val.length > 0, 'Kullanıcı adı ya da e-posta girin.'),
  //
  // ⚠️ BURADA KÜÇÜK HARFE ÇEVİRMİYORUZ — VE BU BİR HATANIN DÜZELTMESİ.
  //
  // İlk yazımda `toLocaleLowerCase("tr")` konmuştu. Test yakaladı:
  // "AliYuksel@GMAIL.COM" -> "aliyuksel@gmaıl.com". Türkçe yerelde
  // "I" harfi "ı" oluyor ve E-POSTA ADRESİ BOZULUYOR.
  //
  // Düz `toLowerCase()` de doğru değil: kullanıcı adları kayıtta
  // OLDUĞU GİBİ saklanıyor (register.schema.ts küçük harfe çevirmiyor),
  // yani "Batuhan" diye kayıtlı birini "batuhan" ile arayamazdık.
  //
  // Doğru yer sorgu: e-posta servis katmanında küçültülüyor (ASCII,
  // güvenli), kullanıcı adı ise veritabanında harf duyarsız
  // karşılaştırılıyor. Girdiyi bozmadan iki tarafı da çözüyor.
});

export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>;

// URL parametresi ID doğrulama şeması
export const friendshipIdParamSchema = z.object({
  id: z.string().uuid('Geçersiz istek ID formatı.'),
});

export type FriendshipIdParam = z.infer<typeof friendshipIdParamSchema>;
