# Batuhan — Şerit A · Piyasa & Portföy

Plan: [01-plan.md](01-plan.md) · İş bölümü: [02-gorev-paylasimi.md](02-gorev-paylasimi.md)

**Uçtan uca sorumluluğun:** Dış fiyat verisi → emir → portföy değeri → ekran.

Bu şerit projenin "backend gerçekten bir şey hesaplıyor" tarafı. Emir motoru ve para aritmetiği mülakatta anlatacağın şeyler.

---

## 📖 OKUMA BORCU — henüz okumadığın dosyalar

CLAUDE.md'nin en önemli kuralı: *yazılan her satırın **neden** öyle olduğunu anlatabilmelisin.*
Aşağıdakiler yazıldı ve çalışıyor ama sen okumadın. Tasarım işi bitince buraya dön.

### 40. Altı istek, dört gerçek hata — 1 Eyl 2026

**Değişti:** `0015` migration · `lib/rate-limit.ts` · `auth/google.ts` ·
`auth/security-question.schema.ts` · `auth/{service,router,repository,middleware}.ts` ·
`admin/{middleware,service,router,grant}.ts` · `leagues/{repository,service,router,cron.test}.ts` ·
`profile/{repository,service}.ts` · `lib/champion.ts` ·
`LeagueResultModal.tsx` · `AdminScreen.tsx` · `GoogleSignInButton.tsx` ·
`ForgotPasswordScreen.tsx` · `ProfileScreen.tsx` · `TabBar.tsx` ·
`DiscoveryScreen.tsx` · `LoginScreen.tsx` · `App.tsx`

> Bu bölüm altı özellik isteğini anlatıyor ama asıl içeriği **istekleri
> yaparken çıkan dört hata**. Sıra buna göre: önce hatalar.

---

#### 🔴 1. Şifre sıfırlama hesap ele geçirmeye açıktı

`POST /auth/reset-password` `{ email, password }` alıyor ve şifreyi
değiştiriyordu. `requireAccessToken` yok, jeton yok, eski şifre sorulmuyor.
**Bir e-posta adresini bilen herkes o hesabı ele geçirebiliyordu.**

⚠️ **VE 300 TEST YEŞİLDİ.** Eski test dosyası üç şey soruyordu — kullanıcı
yoksa hata veriyor mu, yeni şifre eskisiyle aynıysa hata veriyor mu, şifreyi
hash'leyip yazıyor mu. Üçü de doğruydu. Hiçbiri *"peki bu kişi hesabın
sahibi mi?"* diye sormuyordu.

**Test ancak sorduğu soruya cevap verir. Sorulmayan soru yeşil bir suitin
arkasında yıllarca durur.**

Çözüm iki adımlı akış: soruyu getir → cevapla + yeni şifreyi belirle.
Kritik ayrıntılar:

- Cevap `argon2` ile hash'leniyor — şifreyle aynı fonksiyon
- `toLocaleLowerCase('tr')`: Türkçe'de `I` yerele göre `ı` ya da `i` olur.
  Sabitlemeseydik aynı cevap sunucu yereline göre **farklı hash** üretirdi
- **"Eski şifreyle aynı" kontrolü cevaptan SONRA.** Önce olsaydı uç bir
  *şifre doğrulama* ucuna dönerdi: cevabı bilmeyen biri şifre deneyebilirdi
- Güncelleme e-postayla değil **kullanıcı kimliğiyle**
- Hız sınırı 5 deneme / 15 dk. Cevap uzayı birkaç yüz olan bir soru için bu
  özelliğin süsü değil, **çalışmasının ön koşulu**
- **Reddedilen deneme de sayılıyor** — yoksa sınır hiç kapanmazdı

**Soru:** e-posta ile tek kullanıcılık kod, güvenlik sorusundan neden daha
güvenli? Yine de neden bunu seçtik?

---

#### 🔴 2. Testler canlı ligi kapatıyordu

`cron.test.ts` gerçek veritabanında `closeAndRotateLeague()` çağırıyordu.
Her `npm test` yarışmayı mühürlüyor, herkesin derecesini yazıyor, yeni dönem
açıyordu.

```
test öncesi : 76 dönem, 50 kapalı
test sonrası: 77 dönem, 51 kapalı
```

Birikmiş hasar: **77 dönem, aynı hafta adı 25 kez**, katılımcılar 26 ayrı
"açık" lige dağılmış (çoğunda 0 kişi).

⚠️ **Yan etkisi olan bir fonksiyonu gerçek veriye karşı çalıştıran test,
test değil bir MİGRASYON'dur.** Zararı testin kendisinde değil, çalıştıktan
sonra geride bıraktığı durumda görünür — ve orada kimse aramaz.

İkinci kaynak: `findCurrentOpenLeague` **`endsAt`'i hiç kontrol etmiyordu**.
Bitmiş ama mühürlenmemiş dönem "şu anki açık lig" sayılıyor, sunucu açılışta
onu kapatıp `endsAt + 1sn`'den yenisini açıyor — o da geçmişte doğuyor, yani
zaten bitmiş. **Her yeniden başlatma bir dönem ekliyordu.**

---

#### 🔴 3. `origin/main` iki kez derlenmez hâlde

Zeynep'in `FriendsScreen` commit'i JSX dengesizliğiyle geldi. Benim
birleştirmem değil, dalın kendisi bozuktu (dosya olduğu gibi alınıp
denendi). Ayrıca `mode` props tipinde tanımlıydı ama **parametrelerden
alınmıyordu**; gövdede dört yerde okunuyordu.

⚠️ Dengesizlik **tahminle değil sayarak** bulundu: `<View>` derinliği 318.
satırda sıfırlanıyor, 319'daki kapanış fazla.

⚠️ `mode`'a varsayılan verildi. Varsayılansız bırakılsaydı `undefined`
olurdu, `mode !== 'profile'` yine `true` dönerdi ve davranış **kazara
doğru** çıkardı. Niyeti kodda yazmayan doğruluk, ilk değişiklikte bozulur.

---

#### 🔴 4. Bugün Zeynep'le BEŞ kez aynı işi yaptık

`0013` migration · `posts` düzeltmesi · logo+saat · `created_at` yazım
hatası · `mode` düzeltmesi. Beşi de iki kez yapıldı, beşi de birleştirmede
iş çıkardı.

**Bu bir araç sorunu değil, iletişim sorunu.** Aynı dosyaya iki kişi
dokunacaksa önce söylenmeli.

---

#### Özellikler

**Admin paneli** — `requireAccessToken` + `requireAdmin` **router
seviyesinde** (`adminRouter.use`): yarın eklenen uç otomatik korunuyor,
unutmak mümkün değil.

⚠️ **Rol token'dan değil veritabanından okunuyor.** Token'a gömseydik
yöneticiliği alınan kişi token ömrü boyunca yönetici kalırdı.

⚠️ **Ban kontrolü `requireAccessToken`'ın İÇİNDE.** Yalnızca girişte
kontrol etseydik ban işe yaramazdı: elinde geçerli token olan kullanıcı
devam ederdi. Doğrulandı — kurbanın **eski** token'ı ban'dan hemen sonra
403 döndü.

⚠️ Banlı kullanıcı **giriş de yapamıyor**. Önce yapabiliyordu (HTTP 200);
token işe yaramıyordu ama uygulama içeri alıp her ekranda hata gösterirdi.
Kontrol şifre doğrulandıktan **sonra** — önce olsaydı şifreyi bilmeyen biri
de bir hesabın banlı olup olmadığını öğrenirdi.

⚠️ **Yönetici atama ucu YOK**, betik var. Ele geçirilen yönetici hesabı
kendine kalıcı arka kapı açamasın. **Bakiye düzenleme de yok** — lig
adaleti tek tıkla biterdi.

**Google girişi** — kilitli karar korunuyor: Google bir **giriş yolu**,
kimlik sisteminin kendisi değil. Doğrulamadan sonra yine **bizim** JWT'imiz
üretiliyor; uygulamanın geri kalanı Google'ı hiç bilmiyor.

⚠️ **`aud` kontrolü en kritik satır.** Olmasaydı saldırgan KENDİ Google
uygulamasında kurbana giriş yaptırır, aldığı jetonu bize gönderir ve
hesaba girerdi — imza geçerli, kimlik gerçek, ama jeton bize ait değil.
Mutasyonla sınandı: kontrol kaldırılınca test kırmızıya dönüyor.

⚠️ Aynı e-postalı hesap **otomatik bağlanıyor** — ve bu ancak
`email_verified` kontrolüyle birlikte güvenli. İkisi tek bir bütün.

**Lig** — sekme Keşfet'e taşındı; `TabKey`'den çıkarılınca TypeScript
`App.tsx`'teki ölü dalı gösterdi. Kral tacı yalnızca **son kapanan** ligin
birincisinde (açık ligin lideri her gün değişir). Kutlamanın "görüldü"
bilgisi **sunucuda**; işaretleme **kapatırken** yapılıyor, açılırken değil —
açılışta işaretleseydik çökme durumunda kullanıcı kazandığını hiç
öğrenemezdi.

---

**Soru:** Bu bölümdeki dört hatanın ortak yanı ne? (İpucu: dördü de
"çalışıyor" görünüyordu.)

---

### 39. Logolar ve 3 saatlik zaman kayması — 1 Eyl 2026

**Değişti:** `lib/pg-time.ts` (yeni) · `lib/pg-time.test.ts` (yeni, 5 test) ·
`behavior/repository.ts` · `posts/service.ts` · `PostCard.tsx` ·
`GlobalShareMenu.tsx`

#### Logolar — "gelmiyordu" değil, hiç istenmiyordu

```tsx
pos.icon_url ? <Image src={pos.icon_url}/> : <harf rozeti>
```

Sunucu `icon_url`'i **her zaman `null`** gönderiyordu (`posts/service.ts`'te
sabit yazılıydı). Yani koşulun ilk dalı hiç çalışmadı, harf rozeti daima
kazandı. Ekranda "iki harflik gri kutu" gören biri bunu bir ağ/veri sorunu
sanıyor; oysa istek hiç yapılmıyordu.

⚠️ **`AssetLogo` zaten vardı ve HİÇBİR EKRANDA kullanılmıyordu** — yalnızca
`DesignKit.tsx` içinde. Kripto/hisse/döviz/maden dörtlüsünü tek görünümde
topluyor ve tanımadığı sembol için yedeği var. Sunucudan URL beklemek
yerine o kullanıldı: logolar zaten pakette, ağ isteği yok.

Aynı eksik paylaşım menüsünün varlık seçicilerinde de vardı — orada logo
hiç konmamıştı.

#### Saat isteği bir hatanın üstünü açtı

"Tarih yanına saat de olsun" küçük bir istekti. Eklemeden önce verinin
doğru olup olmadığına bakıldı — değildi:

```
ham deger  : "2026-08-26 09:45:19.888652"   <- metin, dilim işareti YOK
ESKİ KOD   : 2026-08-26T06:45:19Z           <- 3 saat erken
YENİ KOD   : 2026-08-26T09:45:19Z           <- doğru
```

⚠️ **HATANIN GÖRÜNÜRLÜĞÜ EKRANA BAĞLIYDI.** Yalnızca gün gösterilirken
kayma çoğu kayıtta fark edilmez; günü ancak yerel 03:00'ten önceki
kayıtlarda değiştirir. Saat eklenseydi **her kartta** yanlış görünecekti.
Yani "şimdiye kadar şikâyet gelmedi" hatanın yokluğunu göstermiyordu.

⚠️ **KAYMA HER YERDE DEĞİL — ÖNCE YANLIŞ SANDIM.** Drizzle'ın kendi
`select`'i doğru okuyor (`createdAt` ölçüldü, doğru çıktı). Bozuk olan
yalnızca **ham `db.execute`** yolu: o dilimsiz metni olduğu gibi döndürüyor
ve `new Date()` onu yerel sayıyor. Ölçüm beni düzeltti; sürücünün tamamını
değiştirmeye gerek yokmuş.

⚠️ **ÇÖZÜM İKİ PARÇALI, biri olmadan diğeri eksik:** sorguda `::text`
(sürücü araya girip kendi yorumunu yapmasın) + `toUtcIso` (metni UTC say).
Sürücü aynı kolonu bir çağrıda `string`, başka çağrıda `Date` döndürüyor ve
iki durumun düzeltmesi **ters yönde** — bu yüzden biçim sorguda sabitlendi.

⚠️ **`toUtcDate` `behavior/repository.ts` içinde SAKLIYDI.** Tuzak orada
uzun uzun belgelenmişti ama `posts/service.ts` aynı hatayı yapmaya devam
ediyordu — kimse düzeltmenin başka bir modülün içinde durduğunu bilmiyordu.
`lib/pg-time.ts`'e taşındı.

⚠️ **Eksik tarih artık `null`, "bugün" değil.** Eski kod alış bulunamayınca
`new Date()` koyuyordu; ekranda "bugün alınmış" yazıyordu ve yanlış olduğu
anlaşılmıyordu. Veri yokluğunu uydurma veriye çevirmek, boş bırakmaktan
her zaman kötü.

#### Test mutasyonla sınandı

5 test yazıldı, sonra `toUtcDate` bilerek `new Date(text)` yapıldı: **4 test
kırmızıya döndü.** Geçen bir test, sınadığı şeyi bozana kadar hiçbir şey
kanıtlamaz.

⚠️ Testler yerel saat diliminden bağımsız: "beklenen 09:45" yazılsaydı
yalnızca Türkiye'de geçerdi. Mutlak an (`toISOString`) karşılaştırılıyor.

**Soru:** `::text` yerine kolonları `timestamptz` yapmak da çözerdi.
Neden yapmadık, ve o yol hangi yeni tuzağı getirirdi?

---

### 38. `posts` tablosu neden silindi — drizzle.config'in gizli yetkisi — 1 Eyl 2026

**Değişti:** `apps/api/drizzle.config.ts` (tek satır + gerekçe yorumu)

**Belirti:** Paylaş ekranı açılıyor, "Paylaş"a basınca hata. Akış ekranı boş.
`/posts` altındaki HER uç 400 dönüyor.

**Sebep — ve bu bir tasarım tuzağı, dikkatsizlik değil:**

```
posts tablosu       ->  src/posts/schema.ts       (tanımlı)
drizzle.config.ts   ->  schema: './src/db/schema.ts'   (tek dosya)
```

drizzle-kit migration üretirken **iki şeyin farkını** alıyor:
`config'te sayılan şema` ile `veritabanının o anki hâli`. `posts` config'te
sayılmadığı için drizzle-kit onu hiç görmedi — ve veritabanında "şemada
karşılığı olmayan bir tablo" bulunca doğru davranışı yaptı:

```sql
DROP TABLE IF EXISTS "posts" CASCADE;   -- 0013_stale_ricochet.sql, 1. satır
```

Tablo ve üç enum (`post_type`, `post_scope`, `post_visibility`) gitti.
Doğrulandı: `information_schema` sorgusu `TABLOLAR: []` döndürüyor.

⚠️ **`schema` alanı bir "okuma ayarı" değil, SİLME YETKİSİ.** Buraya
eklenmeyen her tablo, bir sonraki `db:generate`'te silinme adayıdır.
Yeni bir `pgTable` dosyası açan herkes aynı anda config'i de güncellemek
zorunda — yoksa kimse fark etmeden veri gider.

⚠️ **Hata sessiz değildi ama GÖRÜNMEZDİ:** migration "başarıyla uygulandı",
testler geçti (posts'un testi yok), typecheck temiz (TypeScript
veritabanına bakmaz). Yalnızca ekranı açan kullanıcı görüyor.

**Düzeltme — ve iki kişi aynı hatayı aynı anda buldu.**

Ben `drizzle.config.ts`'in `schema` alanını diziye çevirmiştim (iki dosyayı
da say). Zeynep aynı saatlerde başka bir yerden çözmüş:

```ts
// db/schema.ts sonuna
export * from '../posts/schema.js';
```

⚠️ **Onunki kazandı, ve sebebi önemli.** İkisi de çalışıyor; fark
UNUTULMAYA DAYANIKLILIK. Benim çözümümde yeni bir `pgTable` dosyası açan
kişi İKİ yeri güncel tutmak zorunda: dosyayı yazmak ve config listesine
eklemek. Zeynep'inkinde tek giriş noktası var — `db/schema.ts`. Zaten o
dosyayı düzenliyorsun, `export *` satırı gözünün önünde.

İki mekanizmayı birlikte tutmak da yanlıştı: aynı işi iki yerden yapan
kod, biri bozulduğunda susar.

Kanıtlandı — config tek dosyaya döndürüldükten sonra:

```
posts 8 columns 0 indexes 1 fks        <- yeniden dışa aktarımdan görüyor
No schema changes, nothing to migrate  <- 0014 anlık görüntüsü şemayla birebir
```

İkinci satır asıl güvence: sıradaki `db:generate` artık hiçbir şey
üretmiyor, yani ortada bekleyen başka bir `DROP` kalmamış.

⚠️ **Migration'ı sonunda ben ürettim** (`0014_recreate_posts`), oysa
CLAUDE.md sahibini Zeynep diyor. Bilinçli bir istisna: tablo silinmişti ve
paylaşım tamamen ölüydü. Üretilen SQL yalnızca `CREATE` içeriyordu,
uygulamadan önce okundu. Yine de kural bu: bir dahaki sefere önce sor.

**Ayrıca — ikinci, daha küçük hata:** paylaşımda "Dönem Seç" adımı SÜS.
`GET /posts/share-preview/portfolio?period=week` isteği gidiyor ama
`router.ts` isteği `_req` diye alıyor ve `getPortfolioPreview(userId)`'yi
dönemsiz çağırıyor; `createPost` da `_periodParams`'ı kullanmıyor. Hafta /
ay / tüm zamanlar — üçü de aynı sonucu verecek.

**Soru:** `posts` tablosunu `src/db/schema.ts`'e taşımak mı daha iyi, yoksa
config listesini güncel tutmak mı? İkisinin de bir bedeli var — hangisi
unutulmaya daha dayanıklı?

---

### 37. Zeynep'in model değişikliği ve yetenek yoklaması — 1 Eyl 2026

**Değişti:** `behavior/gemini.ts` · `narrator.ts` · `chat.ts` · `.env`

Zeynep varsayılanı `gemini-3.6-flash`'a aldı ve `thinkingConfig`'i
kaldırdı. Sebebi haklıydı: `3.6` o ayarı **400 INVALID_ARGUMENT** ile
reddediyor.

⚠️ **AMA İLK ALARMIM YANLIŞTI, SONRA HAKLI ÇIKTI — İKİSİ DE ÖĞRETİCİ.**

3 gün önceki ölçümüme dayanarak "bu değişiklik özelliği kırar" dedim.
Kısa istemle sınadım: `3.6` **3 saniyede geçerli cevap** verdi. Yani
alarmım doğrulanmadı, geri almadım.

Sonra GERÇEK uçtan, tam bağlamla ölçtüm (`POST /me/behavior/chat`):

```
25,09 s  ->  ZAMAN AŞIMI (503)
22,60 s  ->  OK
 3,85 s  ->  OK
21,05 s  ->  OK
```

**Ders:** modeli "merhaba" ile ölçmek yanıltıyor. Sorun uzun bağlamda
çıkıyor — portföy + 20 işlem + uzun yönerge binince düşünme uzuyor ve
bütçeyi/süreyi patlatıyor.

**Ne sorulacak:**

1. Neden kısa istem testi yeterli değildi? Uzun bağlam neyi değiştiriyor?
2. `thinkingConfig` geri geldi ama artık **koşullu**: gönderiliyor,
   model 400 verirse ayarsız tekrarlanıyor. Neden model listesi tutmak
   yerine **yetenek yoklaması** yapıldı?
3. `catch` içindeki `if (!/INVALID_ARGUMENT|thinking/i.test(...)) throw e;`
   satırı neden şart? Olmasaydı hangi hatalar yanlışlıkla tekrarlanırdı?
4. `maxOutputTokens` 400 → 1200 ve 500 → 1500 oldu. Kullanılmayan bütçe
   neden maliyet değil?

⚠️ **BUGÜN KOTA TÜKENDİ — ve bu da bir ölçüm sınırı.** Üç modelin de
20'lik günlük kovası testlerle doldu, son karşılaştırmayı yapamadım.
Karar bugünkü gerçek uç ölçümlerine dayanıyor.

⚠️ **Bir ölçüm hatası daha yaptım:** üç modeli tek süreçte kıyaslamaya
çalıştım; `MODEL` sabiti `gemini.ts`'te **modül yüklenirken bir kez**
okunuyor, `chat.js`'i yeniden import etmek onu tazelemedi — üçü de aynı
modelle koştu. Model karşılaştırması AYRI SÜREÇLERDE yapılmalı.

### ✅ OKUNDU · `behavior/` modülü — özet — 31 Ağu 2026

> Sekiz bölümün (§24, §25, §26, §28, §29, §30, §32, §34) yerine geçiyor.
> Ayrıntı kodun içinde; burada yalnızca **kararlar ve neden öyle** var.

---

#### `indicators.ts` — yedi gösterge

| Karar | Neden |
|---|---|
| Yön önemli: `sat → al` yıkama, `al → sat` değil | İlki tereddüt (çıkıp geri girmek), ikincisi kâr al / zarar kes — meşru |
| İşlem SAYISI değil komisyon ORANI | 50 işlem / 5 ₺ zararsız; 10 işlem / 500 ₺ değil |
| Süre ölçülüyor, kâr miktarı değil (yerleşim etkisi) | Miktar şansı ölçer, süre alışkanlığı |
| Sonuç değil KARAR ölçülüyor (FOMO/panik) | "Aldıktan sonra düştü mü" geri görüş yanılgısı |
| Yoğunlaşmada payda nakdi de içeriyor | 90k nakit + 10k BTC tutan risk almıyor |
| Ortalama düşürmede eşik %75 (ötekiler %40) | Planlı kademeli alım aynı şekli üretir; ayıran şey SADECE düşüşte eklemek |

⚠️ **Önce çarp sonra böl.** `301n / 10_000_000n = 0n` — bigint kırpar.
Bölmeyi önce yapsak gösterge **hiç tetiklenmez** ve fark etmezdik: hata
"bulgu yok" olarak görünür, temiz kullanıcıdan ayırt edilemez.

⚠️ **Veri eksikliğini sıfır saymak uydurma bulgu üretir.** Fiyatı
çekilemeyen pozisyon sıfır sayılsaydı kalan varlık %100 çıkardı. Ölçülemeyen
alım paydaya konsaydı FOMO oranı düşerdi. İkisinde de bulgu iptal ediliyor.

---

#### `cost-basis.ts` — ayrıştırma

`applyBuy` / `applySell` / `calculateCostBasis` olarak bölündü. Sebep:
davranış modülü **her satışta o anki maliyeti** bilmek zorunda, oysa
`calculateCostBasis` yalnızca son durumu döndürüyor. Kopyalamak bu projede
bulunan hataların en sık türü.

⚠️ **Satılanın maliyeti ÇIKARMAYLA bulunuyor** (`eski − yeni`), ayrı bir
bölmeyle değil. İki bölme = iki yuvarlama; toplamları eski maliyeti
tutmayabilir, bir kuruş buharlaşır. Çıkarma bunu yapısal olarak imkânsız
kılıyor.

⚠️ **Alış zamanı miktara göre ağırlıklı ortalama.** 10:00'da 1, 14:00'te 3
alan biri: ilk alış → 175 dk (fazla), son alış → 75 dk (az), ağırlıklı →
100 dk ✓. Maliyeti harmanlıyorsak zamanı da harmanlamalıyız.

---

#### `repository.ts` — veri katmanı

Tek yeni sorgu: her emrin **24 saat öncesindeki fiyatı** (`LATERAL`).
`<=` kullanılıyor, tam eşleşme değil — forward-fill. Tam eşleşme arasaydık
döviz emirlerinin neredeyse hiçbiri ölçülemezdi.

⚠️ **`toUtcDate` olmasa her şey çalışır ve sessizce 3 saat kayardı.**

```
BOZULMAZ   yıkama penceresi, elde tutma süresi
           → hepsi aynı yönde kayıyor, ÇIKARMADA sadeleşiyor
BOZULUR    detectOvertrading'in activeDays sayımı
           → gün sınırına bakıyor; 09:45 → 06:45 olunca gün değişebilir
```

Ham `db.execute` her şeyi metin döndürüyor, zaman damgasını da — **dilim
işareti olmadan.** `new Date()` onu yerel saat sayıyor.

---

#### `service.ts` — iki dürüstlük eşiği

**`MIN_ORDERS_FOR_ANALYSIS = 5`** gerçek veriden doğdu: `deneme3` ve
`batuhanSwe` birer emirle "%100 yoğunlaşma" bulgusu alıyorlardı.
Matematiksel olarak doğru ama alışkanlık değil.

**Önceliklendirme kodda, modelde değil.** Model her çağrıda farklı sıralar
ve gerekçesini kimse açıklayamaz. Kural: *ödenmiş para > gerçekleşmiş zarar
> karar deseni > durum.*

⚠️ TypeScript sessiz bir hatayı yakaladı: `facts` indekslemesi `undefined`
dönebiliyor, ekranda "undefined işlemde 0 komisyon" çıkardı. `fact()` artık
eksik anahtarda fırlatıyor.

---

#### `gemini.ts` + `narrator.ts` + `chat.ts` — dört katman

```
1. VERİ     buildGrounding()    modele NE gönderdiğimiz
2. YÖNERGE  SYSTEM_INSTRUCTION  nasıl davranacağı
3. BİÇİM    gemini.ts           JSON şema, sıcaklık, token/süre sınırı
4. ÇIKTI    parseJson + slice   dönen cevabın doğrulanması
```

⚠️ **Yönerge bir RİCA, veri kısıtı bir GARANTİ.** "SAYI YAZMA" kuralına
model uymayabilir; ama `facts` hiç gönderilmediği için 14677'yi **görmüyor**
— yanlış yazamaz. Test bunu sınıyor: `expect(g).not.toContain('14677')`.

⚠️ **Model de dış dünyadır.** `responseSchema` vermek yetmiyor; çıktı yine
doğrulanıyor. Düşünme bütçesi hatasını tam bu doğrulama yakaladı.

⚠️ **Düşünme token'ları `maxOutputTokens`'tan sayılıyor.** Sınır 300'ken
286'sı düşünmeye gitti, cevaba 6 kaldı → `MAX_TOKENS`, yarım metin, `null`.
Belirtisi sinsiydi: istisna yok, HTTP 200. `thinkingBudget: 0`.

⚠️ **Tanımı VERMEK, kural yazmaktan güçlü.** Model "yıkama işlemi"ni ders
kitabındaki gibi *manipülasyon* diye açıkladı. "Manipülasyon deme" kuralı
zayıf kalırdı; tanımı `TANIMLAR` tablosuyla verince düzeldi. Sayıyı
VERMİYORUZ ki uyduramasın, tanımı VERİYORUZ ki uydurmasın.

⚠️ **Sohbette yeni tehdit:** kullanıcı serbest metin yazıyor ve geçmişi
İSTEMCİ gönderiyor. `sanitizeHistory` rolü, uzunluğu, sayıyı sınırlıyor.
Ama asıl koruma 1. katman: modelde fiyat verisi yok.

---

#### Model seçimi ve mimari — üç ders

**1 · Tek ölçüm ölçüm değildir.** `3.5-flash` için 1293 ms görüp seçtim;
sonraki dört çağrı 3580-7253 ms geldi. Beş örnekle yeniden ölçtüm.

**2 · Mimariyi ölçüm değiştirdi, fikir değil.** Yorum `GET /me/behavior`
içindeyken kartları da 5-10 sn bekletiyordu. Ayrı uca taşınınca kartlar
0,04 sn'ye indi. *Zaman aşımı, BEKLETTİĞİ ŞEYİN değerine göre seçilir* —
8 → 10 → 25 sn.

**3 · Ölçüm doğru, çıkarım yanlış olabilir.** `3.5` dolduğunda `2.5`
çalışıyordu; "demek ki sınırı yüksek" dedim. Yanlış — kota **model
başına**, `2.5`'in kendi 20'lik kovası dokunulmamıştı. Ertesi gün o da
doldu. Yanlış çıkarım koda yorum olarak yazıldığı için sonraki okuyanı da
yanıltacaktı.

⚠️ Ücretsiz katman: **model başına günde 20 istek.** Demo için yeter,
gerçek kullanım için yetmez.

---

### 33. Koç sekmesi — altıncı sekme ve taşınan bileşen — 31 Ağu 2026

**Yeni:** `apps/mobile/src/screens/CoachScreen.tsx`
**Değişti:** `TabBar.tsx` · `App.tsx` · `ProfileScreen.tsx` · `BehaviorCard.tsx`

Davranış analizi Profil'in içinden çıkarılıp kendi sekmesine alındı.

⚠️ **BU, KODDAKİ BİR NOTU ÇÜRÜTÜYOR — ve çürütmek doğruydu.**
`TabBar.tsx` "beşten fazlası alt çubuğu okunmaz yapar" diyordu ve kart bu
yüzden Profil'e konmuştu. Özellik büyüyünce (yedi gösterge + yapay zekâ
yorumu + sohbet) bir ayarlar sayfasının altında duracak kadar küçük
olmaktan çıktı.

**Ne sorulacak:**

1. Eski not yanlış mıydı, yoksa koşullar mı değişti? Bir yorumu
   çürüttüğünde onu SİLMEK mi güncellemek mi doğru? (Burada güncellendi:
   yeni not neden değiştiğini de anlatıyor.)
2. Etiket neden 'Koç' — üç harf? ('Alışkanlıklar' yazsaydık en uzun etiket
   olur ve altı sekmenin tamamını daraltırdı.)
3. Punto 10'dan 9'a indi. Neden 'Alsaydın'ı daha da kısaltmak yerine
   puntoyu düşürdük?
4. `BehaviorCard` Profil'den KALDIRILDI, iki yerde bırakılmadı. Neden?
5. `CoachScreen` neden hiç veri çekmiyor?
6. Ekran neden `username` parametresi almıyor?
7. Sekme simgesi neden robot/kıvılcım değil de konuşma balonu + grafik?
   (İçerik ÖLÇÜM; model onun üstüne konuşuyor. Robot simgesi özelliği
   modelin kendisi gibi gösterirdi.)

⚠️ **`BehaviorCard`'IN BAŞINDAKİ YORUM YALAN SÖYLEMEYE BAŞLAMIŞTI.**
"Bu bölüm Profil'in içinde" yazıyordu. Taşındıktan sonra güncellendi.
Kod taşınırken onu anlatan yorumun geride kalması, bu projede yorumların
neden koddan daha çabuk eskidiğinin örneği.

⚠️ **YEDİNCİ SEKME EKLENMEMELİ** — koda not düşüldü. Altı, etiketlerin
okunabildiği sınır.

### 36. KocAI maskotu — üç yerde tek yüz — 31 Ağu 2026

**Yeni:** `apps/mobile/assets/kocai/kocai.png` (256px) · `kocai-tab.png` (96px)
**Değişti:** `BehaviorChat.tsx` · `TabBar.tsx` · `CoachScreen.tsx`

Maskot görseli üç yerde: alt sekme simgesi, ekran başlığı, sohbet
balonlarındaki avatar. Aynı dosya — üç yerde farklı simge olsaydı
kullanıcı bunların aynı şey olduğunu bağlayamazdı.

**Ne sorulacak:**

1. Kaynak 1254×1254 / **1,6 MB** idi. Neden olduğu gibi kullanılmadı?
   (32 piksellik bir avatar için 1,6 MB taşımak paketi boşuna şişirir.
   İki boyut üretildi: 256px → 98 KB, 96px → 19 KB.)
2. Neden `require`, `import` değil? (Metro görselleri derleme anında
   topluyor; yolun SABİT olması gerekiyor. Değişkenden yol üretilseydi
   görsel pakete hiç girmez, çalışma anında sessizce boş kalırdı.)
3. Sekme simgesi neden `opacity` ile aktif/pasif oluyor, `color` ile
   değil? (Çizgi simgeler tek renkli, rengi değiştirilebiliyor. Maskot
   bir ÇİZİM — rengi değişmiyor.)
4. Avatar 28'den 34 piksele çıkarıldı. Neden?

⚠️ **İLK SÜRÜM ALT ÇUBUKTA "KARANLIK BİR KARE" GİBİ DURDU.**

İki ayrı sebebi vardı ve ikisi de ancak çalıştırınca görüldü:

1. Görselin **kendi arka planı** koyu lacivert; alt çubuğunki `#0F0F10`.
   İki farklı koyu ton yan yana gelince kenar belli oluyordu.
2. Robot dairenin içinde küçük kalıyor; 26 pikselde geriye koyu bir leke
   kalıyordu.

Çözüm iki adımlı: köşeler **dairesel maskeyle saydam** yapıldı (zemin
rengi ne olursa olsun oturuyor), ve sekme/avatar için kadraj robotun
**KAFASINA** yakınlaştırıldı. Kafa beyaz, gözler parlak — ikisi de açık
renk, koyu bir çubukta kendiliğinden ayrışıyor.

Sonuçta iki kırpım var ve **farkları boyut değil KADRAJ**:

```
kocai-head.png   kafaya yakın, saydam köşe  ->  sekme 26px, avatar 34px
kocai-full.png   tam maskot, halkasıyla     ->  ekran başlığı 40px
```

**Ne sorulacak:** Aynı görseli iki farklı kadrajda tutmak neden
gerekiyordu? Tek dosyayla idare etseydik hangi boyutta ne kaybederdik?

⚠️ **BEDELİ YAZILI: TEK RESİM SİMGE, BEŞ ÇİZGİ SİMGENİN ARASINDA.**
Diğer sekmeler `lucide` çizgi simgeleri; maskot onların sistemine ait
değil ve 24 pikselde detayı (gözlük, kravat, grafik) kayboluyor.
Karşılığında marka kimliği kazanılıyor — kullanıcı sekmeyi metni
okumadan tanıyor. İstemek makul, ama tutarsızlık da gerçek; ikisi de
koda yazıldı.

### 35. KocAI: cüzdan erişimi, sohbet geçmişi, karşılama — 31 Ağu 2026

**Yeni:** `mobile/src/lib/chat-store.ts`
**Değişti:** `behavior/chat.ts` · `behavior/service.ts` · `behavior/router.ts`
· `BehaviorChat.tsx`

**1 · Cüzdan ve işlem geçmişi modele veriliyor — AMA TUTARSIZ.**

```
gönderilen     sembol · pay yüzdesi · kâr/zarar yüzdesi · tarih · yön · KARAR NOTU
gönderilmeyen  TL tutarı · fiyat · komisyon
```

**Ne sorulacak:**

1. Oran gönderiliyor ama tutar gönderilmiyor. Neden bu ayrım?
   (Kartlar kesin rakamı gösteriyor; model "yaklaşık 150 lira" dediği an
   ekranla çelişir. Oranı yuvarlaması zararsız: "üçte ikisi" ile "%62"
   aynı şeyi söylüyor.)
2. Karar notunun modele verilmesi neyi mümkün kılıyor?
3. Nakit payı neden sunucuda hesaplanıp gönderiliyor, modele
   yaptırılmıyor?
4. `getChatContext` neden `getBehaviorReport`'tan ayrı bir fonksiyon?
5. Çark ödülleri neden işlem listesinden eleniyor? Filtrenin kırılgan
   yanı ne, ve bozulursa nasıl anlaşılır?

⚠️ **ÖZELLİĞİN ASIL DEĞERİ İLK DENEMEDE ORTAYA ÇIKTI.** "Cüzdanımı
yorumlar mısın?" sorusuna gelen cevaptan:

> *"BTC işlemlerinde 'kar aldım' notunu düşmene rağmen hemen geri alım
>  yaptığını fark ettim."*

Hiçbir gösterge bunu yakalayamaz — niyeti ölçemiyoruz. Ama kullanıcı
kendi yazmış, model karşılaştırdı. Karar notunu eklemenin karşılığı bu.

**2 · Sohbet geçmişi kalıcı oldu.**

⚠️ Koddaki bir not daha çürütüldü: `BehaviorChat.tsx` "sohbet bir danışma
anı, arşiv değil; ekran kapanınca silinsin" diyordu. Kullanım aksini
gösterdi.

Depo CİHAZDA (`chat-store.ts`), sunucuda değil — tablo migration ister,
migration'ların sahibi Zeynep. Bedeli açıkça yazıldı: telefon değişirse
geçmiş gelmez, iki cihaz farklı geçmiş görür.

**Ne sorulacak:** Bu takas sohbet geçmişi için neden kabul edilebilir,
emir defteri için neden asla olmazdı?

**3 · Karşılama + logo.**

⚠️ Karşılama YEREL METİN, model çağrısı değil. Modele "kendini tanıt"
dedirtseydik her ekran açılışı bir istek harcardı — günde 20 istek var,
kullanıcı sekmeye üç kez girse kotanın altısı selamlaşmaya giderdi.
Ayrıca değişmez olması iyi: karşılama botun ne yapabildiğini öğreten tek
yer, model her seferinde farklı yazsaydı bazı açılışlarda yetenek saymayı
unuturdu.

⚠️ **JSX'te `{'
'}` KULLANMA.** Karşılama metnini tek `Text` içinde
satır sonlarıyla yazmıştım; kaçış karakterleri düzenleyiciler arasında
taşınırken GERÇEK satır sonuna dönüşüp dosyayı bozdu (`TS1002:
Unterminated string literal`). Maddeler ayrı `Text` öğelerine bölündü.

### 31. Fiyat boşluklarını doldurma — artımlı yakalama — 31 Ağu 2026

**Yeni:** `apps/api/src/market/catch-up.ts`
**Değişti:** `market/repository.ts` (`granularity`) · `server.ts`

Senin sorduğun şeyden doğdu: *"2 gündür kullanmıyorum, o günlerin verisi
yok; sadece olmayanları getirse olmaz mı?"* Ölçtük, haklıydın:

```
BTC (7/24 açık, yani boşluk = veri kaybı)
  2026-08-29    0 satır
  2026-08-30    0 satır
  en büyük ardışık boşluk: 65,1 saat
```

⚠️ **BU SADECE GRAFİĞİ BOZMUYOR, GÖSTERGELERİ DE BOZUYOR.**
`behavior/repository.ts` "24 saat önceki fiyat"ı `ts <= executedAt - 24h`
ile buluyor. 65 saatlik delikte o sorgu 65+ saat öncesini döndürür — FOMO
ve panik göstergeleri günlük hareket sanıp üç günlük hareketi ölçer.

**ÇALIŞTIRMAK İKİ TASARIM HATAMI YAKALADI:**

1. **İlk sürüm sondaki boşluğa bakıyordu.** 0 satır yazdı. Sebep: sunucu
   AÇIK olduğu için son kayıt güncel; delik ORTADAYDI (28'inde ve 31'inde
   satır var, 29-30'da yok). Düzeltme: `LAG` ile ardışık farkları taramak.
2. **`getHistory`'ye gün hassasiyetinde tarih veriyordum.** Gün içi bir
   delikte iki uç aynı tarihe düşüyor ("2026-08-27" -> "2026-08-27"),
   aralık sıfır genişlikte kalıyor. Belirti yine sessizdi: hata yok,
   0 satır, "doldu" sanılıyor. Ölçünce göründü — kalan deliklerin HEPSİ
   tam 00:00'da başlıyordu.

```
65,1 saat  ->  11,9 saat  ->  1,0 saat
29-30 Ağustos: 0 satır -> 24'er satır
ikinci koşu: 0 satır yazıldı (tekrarlanabilir)
```

**Ne sorulacak:**

1. Neden YALNIZCA kripto dolduruluyor? Döviz ve hisse için "boşluk" neden
   çoğu zaman veri kaybı değil?
2. `granularity` kolonu neden şimdi kullanılmaya başlandı? Doldurulan
   satır neden canlı cron'un satırıyla aynı şey değil?
3. Açılışta neden `await` edilmiyor?
4. Kuru olmayan gün neden atlanıyor, sıfırla yazılmıyor?
5. USD kuru neden TCMB'den değil KENDİ veritabanımızdan okunuyor?

### 27. Alışkanlıklar ekranı — dört durum, bir yer kararı — 28 Ağu 2026

**Yeni:** `apps/mobile/src/components/BehaviorCard.tsx`
**Değişti:** `apps/mobile/src/screens/ProfileScreen.tsx`

**Ne sorulacak:**

1. Neden yeni bir SEKME açılmadı? (`TabBar.tsx` cevabı yazıyor: beş sekme
   var ve "beşten fazlası alt çubuğu okunmaz yapar".)
2. Bileşen neden yalnızca `profile.isSelf` içinde çiziliyor — ve bu
   istemci kontrolü neden **yeterli değil ama gerekli**? (Asıl koruma
   sunucuda: `GET /me/behavior` kimliği token'dan alıyor, ekranın
   `username` parametresi oraya hiç gitmiyor.)
3. **DÖRT durum var, üç değil.** "Yeterli veri yok" ile "veri var, bulgu
   yok" neden aynı kutuya indirilemez? (Biri "sana bir şey diyemem",
   diğeri "temizsin". Karıştıran kullanıcı ya boşuna güvenir ya boşuna
   endişelenir.)
4. Bulgu şeritleri neden hepsi kırmızı değil? `loss` / `warn` / `inkFaint`
   ayrımının mantığı ne?
5. `cancelled` bayrağı ne işe yarıyor? Olmasaydı ne olurdu?
6. Bu bölüm okunamazsa neden kırmızı hata bloğu basılmıyor?
7. "N işleme dayanıyor" satırı neden süs değil? (`indicators.ts`'teki
   `orderIds` sözleşmesini kullanıcıya görünür kılıyor.)
8. Alışkanlıklar neden GİZLİLİK bölümünden ÖNCE? (Sayfanın sonu "çıkış
   yap" bölgesi; kimse oraya kadar kaydırmaz.)

**Uçtan uca doğrulandı** — tunajr için gerçek token üretilip çağrıldı:

```
GET /me/behavior
{ "orderCount": 6, "hasEnoughData": true, "minOrders": 5,
  "findings": [ { "key": "wash_trade", "title": "Sat, hemen geri al",
    "message": "1 kez bir varlığı sattıktan sonra 60 dakika içinde geri
                aldın. Bu gidiş-dönüşlerin komisyonu 146,77 ₺.",
    "orderIds": [ 2 emir ] } ] }
```

⚠️ **Yanlış alarm — ve ders bunda.** Cevabı terminalde ilk gördüğümde
Türkçe karakterler bozuktu (`varlÄ±ÄŸÄ±`). Kodda hata sanılabilirdi.
Değildi: `Content-Type: application/json; charset=utf-8` doğru, JSON
UTF-8 olarak açıldığında metin de doğru. Bozan şey Windows konsolunun
kod sayfasıydı (cp1254 ₺ işaretini basamıyor bile).

**Ders:** çıktıyı gösteren aracın kodlaması, üretilen verinin kodlamasıyla
aynı değil. "Ekranda bozuk göründü" ile "veri bozuk" iki ayrı iddia —
ikincisini kanıtlamadan birincisine göre kod değiştirmek, olmayan bir
hatayı düzeltmeye çalışmaktır. Bu oturumda `App.tsx`'teki 386 bozuk
dizgi GERÇEKTİ; bu değildi. Ayrımı ölçerek yaptık.

### 23. `tanıtım@gmail.com` — iki doğrulamanın ayrışması — 27 Ağu 2026

| Dosya | Ne |
|---|---|
| `mobile/lib/validation.ts` 🆕 | Ortak e-posta kontrolü |
| `mobile/lib/validation.test.ts` 🆕 | **19 test — projenin ilk mobil testi** |
| `LoginScreen` · `RegisterScreen` · `ForgotPasswordScreen` | Kopyalanan desen kaldırıldı |
| `api/client.ts` | `ApiError` artık `fieldErrors` taşıyor |

**Belirti:** kayıt ekranı *"Gönderilen kayıt bilgileri geçersiz."* diyor,
altı kutudan hangisinin sorunlu olduğu belli değil.

**Sebep — iki doğrulama birbiriyle uyuşmuyordu:**

```
ekran   : /^[^@\s]+@[^@\s]+\.[^@\s]+$/   "@ ve boşluk olmayan her şey" -> ı GEÇER
sunucu  : z.string().email()                ASCII bekliyor              -> ı REDDEDİLİR
```

Ekran "tamam" deyip gönderiyor, sunucu 400 dönüyor, kullanıcı sebebi
göremiyor. **Türkçe klavyede `tanıtım` yazmak son derece doğal** ve `ı`
ile `i` yan yana neredeyse aynı görünüyor — kullanıcının kendi başına
bulması imkânsıza yakın.

⚠️ **KURAL ÜÇ DOSYAYA KOPYALANMIŞTI.** `LoginScreen`, `RegisterScreen` ve
`ForgotPasswordScreen` aynı deseni ayrı ayrı tanımlıyordu. Bugün podyum
renginde (§15) ve açılış sekmesinde (§18) yaşadığımızın aynısı: kural
kopyalanınca biri düzelir, ötekiler eski kalır.

⚠️ **EKRAN İLE SUNUCU AYNI KATILIKTA OLMALI:**

```
ekran daha GEVŞEK -> kullanıcı reddedilecek isteği gönderir, sebebini göremez
ekran daha KATI   -> sunucunun kabul edeceği geçerli adresi reddeder
                     (daha sinsi: hiçbir yerde hata görünmez)
```

⚠️ **KONTROL SIRASI ÖNEMLİ.** Türkçe karakter kontrolü BİÇİM
kontrolünden önce: `tanıtım@gmail.com` biçim olarak zaten geçerli
görünüyor (@ var, nokta var). Biçimi önce sorsaydık kontrol geçerdi ve
düzeltmeye çalıştığımız durum aynen sürerdi. Testi de var.

⚠️ **`checkEmail` `boolean` DEĞİL, MESAJ DÖNÜYOR.** `true/false`
dönseydi her çağıran kendi mesajını yazardı ve "geçersiz" ile "Türkçe
karakter var" ayrımı yine üç yere dağılırdı. Sebebi bilen taraf mesajı da
versin.

---

**İkinci bulgu: sunucu zaten hangi alanın hatalı olduğunu söylüyordu.**

```json
{"error":{"code":"VALIDATION_ERROR",
  "message":"Gönderilen kayıt bilgileri geçersiz.",
  "details":{"fieldErrors":{"email":["Geçerli bir e-posta adresi giriniz."]}}}}
```

`client.ts` `details`'i atıyordu, ekran yalnızca genel mesajı
gösteriyordu. Bugün §22'de düzelttiğim `ERROR_MESSAGES` ile **aynı sınıf
hata:** bilgi geliyor, istemci çöpe atıyor. `ApiError` artık
`fieldErrors`'ı da taşıyor ve kayıt ekranı alan hatalarını gösteriyor.

**Test: 211 → 230.** İlk mobil test dosyası bu.

### 22. UX turu — altı madde — 27 Ağu 2026

| # | İş | Dosya |
|---|---|---|
| 1 | Tanıtım turu **bağlandı** | `App.tsx` + `OnboardingScreen.tsx` |
| 2 | Sekme rozeti | `TabBar.tsx` + `App.tsx` |
| 3 | Piyasada "kapalı" işareti | `MarketScreen.tsx` |
| 4 | Ölü ekran silindi (898 satır) | `AuthScreen.tsx` |
| 5 | Aşağı çekip yenile | `LeaderboardScreen` · `ProfileScreen` |
| 7 | `ERROR_MESSAGES` ölü kodu dirildi | `client.ts` + `TradeScreen.tsx` |

*(6 — haptik — `expo-haptics` bağımlılığı gerektirdiği için ayrı karar.)*

---

**1 · Tanıtım turu 315 satır hazır duruyordu, hiç bağlanmamıştı.** Yeni
kullanıcı kayıt olup doğrudan boş bir cüzdana düşüyordu: ne lig, ne
günlük bonus, ne de ne yapması gerektiği söyleniyordu.

⚠️ **YALNIZCA KAYITTAN SONRA gösteriliyor, girişten sonra değil** — ve bu
seçim "görüldü mü" bilgisini saklama ihtiyacını tamamen ortadan
kaldırıyor. Sunucuda bayrak tutsak migration gerekirdi (Zeynep); cihazda
tutsak kullanıcı telefon değiştirince turu tekrar görürdü. Kayıt zaten
hesap başına bir kez olan bir olay.

⚠️ Turun son adımı gizlilik tercihi soruyor → `PATCH /users/me/visibility`.
**İstek başarısız olsa bile kullanıcı içeri alınıyor:** ağ o an koparsa
kullanıcıyı tanıtım ekranında kilitlemek, kaydedilememiş bir tercihten
çok daha kötü.

---

**2 · Sekme rozeti.** Bekleyen arkadaşlık isteği sayısı `FriendsScreen`
içinde zaten hesaplanıyordu — ama orası Lig sekmesinin altında bir
katman: görmek için ZATEN oraya bakıyor olman gerekiyordu. *Bildirimin
işi, bakmayan kişiye haber vermek.*

⚠️ **45 saniyede bir çekiliyor, 5 değil.** Fiyat ekranları 5 saniyede
tazeliyor; arkadaşlık isteği saniyede değişen bir şey değil. 5 saniye
olsaydı günde ~17.000 gereksiz istek olurdu.

⚠️ **Giriş yapılmamışken hiç çalışmıyor.** Çalışsaydı her tur 401 döner,
`client.ts` yenilemeyi dener, o da başarısız olur ve oturum-bitti
işleyicisi tetiklenirdi — giriş ekranındaki kullanıcı sürekli "oturumun
bitti" uyarısı alırdı.

⚠️ Rozet rengi `accent`, `gain`/`loss` **değil**: bu uygulamada yeşil ve
kırmızı YÖN demek. Yeşil rozet "kazandın", kırmızı "kaybettin" gibi
okunurdu; taşıdığı bilgi ise "bekleyen bir şey var".

---

**3 · Piyasada "kapalı" işareti.** Satır alt yazısı `AAPL · 9 sn önce`
diyor. ABD borsası kapalıyken bu `AAPL · 16 sa önce` oluyordu — yani
**arıza gibi**. Oysa hiçbir şey bozuk değil.

Emir motorunda bu ayrım zaten vardı (`MARKET_CLOSED` ≠ `STALE_PRICE`);
ekran da aynı ayrımı yapmalıydı.

---

**5 · Aşağı çekip yenile — 2/15 ekrandaydı.**

⚠️ `refreshing` AYRI state, `loading` değil. `loading` tüm ekranı
boşaltıp spinner gösteriyor; ilk açılışta doğru ama yenilemede liste bir
an kaybolur ve kullanıcı yerini şaşırır. Yenilemede içerik ekranda
kalmalı.

---

**7 · `ERROR_MESSAGES` ölü koduydu — dirildi.**

Sunucu her hatada `{ error: { code, message } }` gönderiyor ama
`client.ts` yalnızca `message`'ı alıp **`code`'u atıyordu**. `TradeScreen`
de mesaj METNİNİN içinde kod arıyordu:

```ts
raw.includes('INSUFFICIENT_FUNDS')   // "Bakiye yetersiz" bunu içermiyor
```

Yani tablo **hiç eşleşmiyordu** ve kullanıcı her zaman ham sunucu
mesajını görüyordu. Şans eseri çalışıyordu — sunucu mesajları zaten
Türkçe.

Çözüm: `client.ts` artık `ApiError` fırlatıyor, kodu taşıyor.

⚠️ `ApiError` `Error`'dan **türüyor**, yerine geçmiyor. Mevcut çağıranların
hepsi `err instanceof Error` ve `err.message` kullanıyor; ikisi de
çalışmaya devam ediyor.

⚠️ `MARKET_CLOSED` tabloya **bilerek eklenmedi**: mesajı dinamik
("Açılış: Perşembe 16:30"). Sabit metinle değiştirseydik açılış saatini
kaybederdik.

---

**Yan bulgu — iki bayat not düzeltildi.** `price_history.granularity`
kolonu **zaten var** (`open_usd`/`high_usd`/`low_usd` ile eklenmiş) ama
`price-backfill.ts` hâlâ "HENÜZ YOK" diyordu. Bu, `retention.ts`'in
Zeynep'e bağımlılığı olmadığı anlamına geliyor.

⚠️ **GÖRSEL OLARAK DOĞRULANMADI.** Typecheck ve 211 test geçiyor ama
hiçbiri gerçek cihazda görülmedi.

### 21. Ya Alsaydın ekranı — cevap önce — 27 Ağu 2026

| Dosya | Ne |
|---|---|
| `mobile/screens/WhatIfScreen.tsx` | Düzen baştan kuruldu · +448 / −250 |

**Sorun tek tek özelliklerde değildi, SIRADAYDI.** Ekran altı blok üst üsteydi:

```
başlık · TAKVİM · TUTAR+4 buton · ÖZEL GÜNLER · filtre · 50 satırlık LİSTE
```

Yani bir sayı görmek için dört kontrol bloğu kaydırılıyordu — ve dosyanın
kendi yorumu *"Cevap listede, sonuçta değil"* diyordu ama liste ekranın
dışında kalıyordu.

⚠️ **Ve en önemlisi: `date` başlangıçta `null`'dı.** Ekran BOŞ açılıyordu.
Bir soruyu cevaplamak için var olan ekran, cevapsız açılıyordu.

**Yeni düzen:**

```
soru   ->  "10.000 ₺ · 12 Mart 2020  ⌄"   tek satır, dokun→panel
cevap  ->  en çok kazandıran üç varlık, PARA olarak
liste  ->  tam liste + enflasyon eşiği
```

⚠️ **HİÇBİR KONTROL SİLİNMEDİ** — takvim, tutar, hazır tutarlar, özel
günler aynen duruyor, sadece varsayılan olarak katlı. *Kaldırmak* ile
*katlamak* arasındaki fark önemli: kullanıcının yapabildikleri aynı kaldı,
yalnızca sırası değişti.

⚠️ **Kat değil PARA gösteriliyor.** Liste "13,4×" diyor, vitrin
"≈ 134.000 ₺". Kat oranı doğru ama soyut; kullanıcının aklındaki soru
"param ne olurdu".

⚠️ **Float istisnası — sınırı bilerek çizildi.** `≈` işaretli önizleme
`Number(amount) × multiple` ile hesaplanıyor. Proje kuralı "para bigint".
İzin verilmesinin sebebi: bu sayıyla hesap yapılmıyor, emir verilmiyor,
hiçbir yere yazılmıyor — yalnızca ekrana basılıyor ve kullanıcı dokununca
sunucudan KESİN değeri görüyor. `multiple` zaten sunucudan `number`
geliyor (what-if'in bilinen float borcu), yani zincir burada kırılmıyor.

⚠️ **Sıralama renkle değil BOYUTLA anlatılıyor** — vitrinde birinci kart
daha büyük punto kullanıyor. Renk zaten enflasyon eşiğini anlatmakla
meşgul; ikinci bir anlam yüklemek ikisini de bulanıklaştırırdı.

**8 ölü stil silindi.** İkisi (`question`, `underlined`) zaten önceden
ölüydü — kaldırılan "cümle" tasarımından kalma. Sonuç: 55 stil, 0 ölü.

⚠️ **DOSYA BAŞLIĞI DA GÜNCELLENDİ.** Yorum hâlâ *"ekran bir form değil,
bir CÜMLE"* diyordu ama ekran çoktan forma dönüşmüştü. Kod ile gerekçesi
ayrılmış hâldeydi — okuyan kişi kodda göremediği bir tasarımı arar.

⚠️ **ÇAKIŞMA UYARISI:** Zeynep bu dosyayı 3 saat önce yeniden yazmıştı.
Düzen değişti ama onun getirdikleri korundu: `Calendar.tsx`'e hiç
dokunulmadı, "Hisse" filtre çipi ve tutar giriş alanı yerinde.

⚠️ **GÖRSEL OLARAK DOĞRULANMADI.** Typecheck ve testler geçiyor ama ekran
gerçek cihazda görülmedi. Telefonda bakılmalı.

### 20. `stock` migration'ı ve keşfedilen şema sapması — 26 Ağu 2026

| Dosya | Ne |
|---|---|
| `drizzle/0009_add_stock_asset_kind.sql` 🆕 | `ALTER TYPE ... ADD VALUE 'stock'` |
| `drizzle/meta/0009_snapshot.json` 🆕 | enum'a `stock` eklenmiş snapshot |
| `drizzle/meta/_journal.json` | 10. kayıt |

**Neden elle yazıldı.** `drizzle-kit generate` çalıştırılınca patladı:

```
promptColumnsConflicts -> Interactive prompts require a TTY
```

Yani üretici komut bir **kolon çatışması** soruyor. Sadece enum eklemesi
olsa sormazdı. Snapshot ile canlı veritabanını karşılaştırdım:

```
users → DB'de              : first_name, last_name
      → migration geçmişinde: display_name
```

Zeynep `display_name`'i ikiye bölmüş ama migration geçmişi bunu
yakalamamış. drizzle-kit "bu yeniden adlandırma mı, silme+ekleme mi"
diye soruyor ve cevaplayacak kimse yok.

⚠️ **BUNUN ANLAMI: `npm run db:generate` şu an HERKES İÇİN KIRIK.**
Zeynep'e söylenmeli — kendi refactor'ü, kendi düzeltmesi.

⚠️ **Tam diff üretmesine izin verilseydi** o refactor'u de kapsayan,
muhtemelen yıkıcı bir migration çıkardı (`0008_user_refactor.sql`
zaten `TRUNCATE` içeriyor). Elle yazılan dosya sadece enum değerini
ekliyor, başka hiçbir şeye dokunmuyor.

---

**Uygulamadan önce yapılan kontroller** — `0008` `TRUNCATE` içerdiği için:

| Kontrol | Sonuç |
|---|---|
| DB'deki son `created_at` | 1787654099261 (`0008`) |
| Yeni kaydın `when`'i | 1787760318227 → **sadece 0009 bekliyor** |
| PostgreSQL sürümü | 16.15 → `ADD VALUE` transaction içinde çalışır (PG 12+) |

Sonuç:

```
ONCE  -> kullanici: 6  varlik: 50  emir: 28
NOTICE: enum label "stock" already exists, skipping
SONRA -> kullanici: 6  varlik: 50  emir: 28
```

`IF NOT EXISTS` olmasaydı bu migration geliştirme makinesinde
"already exists" ile patlardı — çünkü değeri oraya elle eklemiştim.

⚠️ **Ders:** migration'ın idempotent olması "temiz kod" meselesi değil.
Aynı SQL'in farklı durumdaki iki veritabanında (biri elle değiştirilmiş,
biri sıfırdan) çalışması gerekiyor.

### 19. Hisse filtresi ve 30 şirket logosu — 26 Ağu 2026

| Dosya | Ne |
|---|---|
| `mobile/MarketScreen.tsx` | Çipler: Tümü · ABD Hissesi · Kripto · Döviz + kaydırılabilir satır |
| `mobile/components/AssetLogo.tsx` | 30 hisse logosu, dördüncü kaynak |
| `mobile/assets/logos/stocks/` 🆕 | 30 PNG, 408 KB |

**1 · Filtre çipleri.** Satır sabit genişlikte (`flexDirection: 'row'`,
kaydırma yok) ve beş çip sığmıyordu. Seçim gerekti: 30 hisse mi 2 maden mi.

⚠️ **Bedeli kayda geçsin:** gram altın ve gümüş artık yalnızca "Tümü"
altında ya da ARAMA ile bulunuyor. Kaybolmadılar, bir tık uzaktalar.
Satır ayrıca `ScrollView`'a çevrildi — ileride çip eklenirse etiketler
kırpılmayacak. Kırpılan etiket hata vermiyor, sadece okunmaz oluyor.

---

**2 · Logolar — ve ölçmenin nasıl yanılttığı.**

Kaynak arayışı: dört servis denendi, üçü elendi.

| Kaynak | Sonuç |
|---|---|
| **financialmodelingprep** | ✅ 100×100 PNG, RGBA, 30/30 |
| Clearbit | ❌ ölü |
| companiesmarketcap | ❌ gri tonlamalı |
| tradingview / parqet | ❌ SVG |

⚠️ **Yer tutucu kontrolü:** bazı servisler bulamadığı sembol için herkese
aynı boş görseli döndürür ve bu FARK EDİLMEZ — otuz varlık aynı gri
daireyle görünür, "logolar böyle" sanılır. Otuz dosyanın MD5'i alındı,
otuzu da benzersiz.

⚠️ **ASIL DERS — "ölçtüm" demek yetmiyor, DOĞRU ŞEYİ ölçmek gerekiyor.**

Koyu arayüzde hangi logolar kaybolur diye otuzunun saydam olmayan
piksellerinin **ortalama parlaklığını** hesapladım:

```
INTC    3   GORUNMEZ
NFLX   42   GORUNMEZ
XOM    55   GORUNMEZ
KO     65   zor secilir
...
sorunlu: 14 / 30
```

Sonra hepsini gerçek arayüz rengine (#0B132B) basıp **gözle** baktım:
**14'ün 13'ü gayet okunur.** Coca-Cola'nın kırmızısı ortalamada 65 ama
lacivert zeminde net görünüyor.

Ortalama yanıltıcıydı çünkü çok renkli bir logoda koyu ve açık pikseller
birbirini götürüyor. Gerçekten kaybolan tek logo **INTEL** — neredeyse
siyah bir yazı. Ona açık daire (`NEEDS_LIGHT_BACKDROP`), diğer 29'u
kripto gibi zeminsiz.

Sayıya güvenip 14 logoya beyaz daire koysaydım listenin yarısı beyaz
lekelerle dolardı ve "ölçerek karar verdim" derdim.

⚠️ **AAPL'ın beyaz karesi sorun değil:** `styles.base`'te `overflow:
hidden` + `borderRadius: size/2` var, kare daireye kırpılıyor.

⚠️ **Lisans:** logolar marka işareti, bir varlığı TANIMLAMAK için
kullanmak olağan kullanım (kripto logoları için verilen gerekçenin
aynısı). Dosyalar DEĞİŞTİRİLMEDİ — yeniden renklendirmek marka açısından
daha sorunlu olurdu.

---

**Yan bulgu:** `AssetLogo.tsx` uzun süredir `scripts/prepare-logos.mjs`'e
atıf yapıyordu — **o dosya repoda yok**, hiç commit'lenmemiş. "Nasıl
hazırlandı" sorusunun cevabı var olmayan bir dosyayı gösteriyordu.
Yorum, işlemi anlatacak şekilde yeniden yazıldı.

### 18. Açılış sekmesi ve App.tsx'in bozuk yorumları — 26 Ağu 2026

| Dosya | Ne |
|---|---|
| `mobile/App.tsx` | `START_TAB = 'wallet'` + `startSession()` · **72 satır bozuk yorum onarıldı** |

**1 · Uygulama artık cüzdanla açılıyor.** Önce lig açılıyordu; sıralama
ilgi çekici ama kullanıcının ilk sorusu "param ne durumda". Lig ancak
kendi portföyünü gördükten sonra anlam taşıyor.

İki ayrı yol vardı ve ikisi de kırıktı:

| Durum | Önce | Sonra |
|---|---|---|
| Uygulama açılışı | `useState<Tab>('league')` | `START_TAB` |
| Çıkış → giriş | **eski sekmede kalıyordu** | `startSession()` sıfırlıyor |

⚠️ İkincisi görünmez bir hataydı: `AppShell` çıkışta SÖKÜLMÜYOR, sadece
kimlik ekranlarını çiziyor — yani `activeTab` çıkıştan önceki değerinde
kalıyor. Profil sekmesindeyken çıkıp başka hesapla girersen doğrudan
**o hesabın profiline** düşüyordun. Kural tek sabitte (`START_TAB`)
toplandı; aynı hatanın "renk iki yere yazılmış" hâlini §15'te düzelttik.

---

**2 · `App.tsx`'in Türkçe yorumlarının 72 satırı okunamaz hâldeydi.**

```
// Giri┼ş yapm─▒┼ş kullan─▒c─▒ bilgisi        ← bozuk
// Arkadaşlar katmanı. `false` = kapalı.   ← doğru
```

Çift kodlama: UTF-8 baytları yanlış kod sayfasıyla okunup tekrar UTF-8
yazılmış (`ı` = `C4 B1` → `─▒`).

**Nereden geldiği git'le bulundu:**

| Commit | Tarih | Bozuk satır |
|---|---|---|
| `feb2226` | 24 Ağu | **0** |
| `7553183` | 24 Ağu | **82** ← merge |

Yani bozulma origin/main tarafından, **Zeynep'in editöründen** geldi.
Ona söylenmeli: editörünün kodlaması UTF-8 olmalı, yoksa her merge'de
tekrarlar.

⚠️ **Otomatik ters çevirme İŞE YARAMADI.** cp437, cp850, cp1254 ve
latin-1'in dördü de hata verdi — bozulma karışık: bazı baytlar cp437,
bazıları cp1254 üzerinden geçmiş. Tek kod sayfasıyla geri alınamıyor.

Çözüm: dosyadaki ASCII dışı dizileri sayıp eşleme tablosu kurmak.

| Bozuk | Doğru | | Bozuk | Doğru |
|---|---|---|---|---|
| `─▒` | ı | | `├╝` | ü |
| `─░` | İ | | `├ğ` | ç |
| `─ş` | ğ | | `├Â` | ö |
| `┼ş` | ş | | `├£` | Ü |
| `┼Ş` | Ş | | `├ó` | â |
| `ÔÇö` | — | | `ÔÜá´©Å` | ⚠️ |

386 dizi düzeltildi, kalan bozuk karakter: **0**. Kod değişmedi (hepsi
yorum ve bir metin sabiti), 211 test geçmeye devam ediyor.

⚠️ **Neden önemli:** bu dosya senin okuma listendeki dosyalardan biri.
Yorumların amacı "neden öyle yazıldığını anlatmak" — okunamayan yorum
hiçbir işe yaramıyor. Depoda başka bozuk dosya yok, tarandı.

### 17. ABD hisseleri — 26 Ağu 2026

**3 yeni dosya · 9 değişen · +20 test (191 → 211)**

| Dosya | Ne |
|---|---|
| `market/yahoo.ts` 🆕 | Yahoo Finance adaptörü, 30 sembol tablosu |
| `market/market-hours.ts` 🆕 | ABD borsası seans takvimi (ağ isteği YOK) |
| `market/market-hours.test.ts` 🆕 | 16 test — özellikle yaz/kış saati |
| `orders/repository.ts` | `MARKET_CLOSED` + türe göre bayatlık sınırı |
| `orders/router.ts` | `MARKET_CLOSED` → 422 |
| `market/price-cron.ts` | 4. dal + 60 sn hisse kadansı + `skipped` sayacı |
| `market/price-backfill.ts` | 4. aşama |
| `market/seed.ts` | 30 hisse |
| `market/router.ts` | `GET /assets` → `tradable` alanı |
| `db/schema.ts` | enum'a `stock` ⚠️ **migration bekliyor** |
| `mobile/TradeScreen.tsx` | Kapalıyken düğme pasif + gerekçe |

---

**Kaynak seçimi — tahminle değil, istek atarak.** (`docs/00-veri-saglayici-dogrulama.md` geleneği)

| Kaynak | Sonuç |
|---|---|
| **Yahoo `v8/chart`** | ✅ 30/30 sembol, 2017'den 2.425 günlük mum, anahtarsız |
| Stooq | ❌ JS proof-of-work koymuş, sunucudan çekilemiyor |
| Yahoo `v7/quote` (çoklu sembol) | ❌ 401 — sembol başına ayrı istek şart |

---

⚠️ **ASIL MESELE VERİ DEĞİL, YILIN %81,4'ÜNDE PİYASANIN KAPALI OLMASI.**

```
251 işlem günü × 6,5 saat = 1.631 saat / yıl
yılın toplamı             = 8.760 saat
-> açık oran              = %18,6
```

`MAX_PRICE_AGE_MS` (120 sn) hisseye uygulansaydı kalan %81,4'te her emir
`STALE_PRICE` ile reddedilirdi. Kural doğru çalışıyordu ama **yanlış şeyi
söylüyordu**:

```
kripto  ->  "fiyat bayat" = CRON BOZULDU   -> bizim arızamız
hisse   ->  "fiyat bayat" = PİYASA KAPALI  -> normal, beklenen
```

Çözüm üç parça: (1) `MARKET_CLOSED` kontrolü bayatlık kontrolünden **önce**,
(2) hisse için ayrı 300 sn sınırı, (3) `GET /assets`'te `tradable` alanı.

---

⚠️ **YAZ SAATİ — sessiz bir saat kayması.**

New York yazın UTC-4, kışın UTC-5. Saat dilimini sabit yazsaydık yılın
yarısında seans açılışında **60 dakika boyunca "kapalı"** derdik. Kod
`Intl.DateTimeFormat` kullanıyor, DST'yi işletim sistemi çözüyor.

Testte aynı UTC saati iki mevsimde farklı sonuç veriyor:

| | 13:30 UTC | 14:30 UTC |
|---|---|---|
| Ağustos (EDT) | AÇIK | açık |
| Ocak (EST) | KAPALI | AÇIK |

`hourCycle: 'h23'` de şart: `hour12: false` bazı ICU sürümlerinde gece
yarısını "24" veriyor → 1440 dakika → "gece yarısı seans açık".

---

⚠️ **BÖLÜNME (SPLIT) — ölçülerek doğrulandı.**

```
AAPL 24 Ağu 2020 gerçek fiyatı : ~503 USD
Yahoo'nun verdiği close        :  125,86 USD
31 Ağu 2020'de 4:1 bölündü     :  503 / 4 = 125,75  ✔
```

Yahoo düzeltilmiş veriyor. Ham veri kullansaydık "2019'da alsaydın" hesabı
**tam dört kat** şişerdi ve hiçbir yerde hata çıkmazdı.

**Ama düzeltme geriye dönük ve bu kalıcı bir borç:** Yahoo geçmişi BUGÜNKÜ
hisse adedine göre düzeltiyor. AAPL yine bölünürse kayıtlı geçmişimizin
tamamı yanlış olur ve o varlık silinip baştan doldurulmalı. Kripto ve
dövizde böyle bir şey yok.

`adjclose` bilerek kullanılmadı — o temettüyü de düzeltiyor, yani "toplam
getiri" modeli. Uygulama temettüyü nakit olarak modellemiyor.

---

⚠️ **İKİ TUZAK — ikisi de ölçülerek bulundu.**

**1. User-Agent olmadan 429.** Aynı URL, tek fark başlık:

```
UA yok       -> HTTP 429 (Too Many Requests)
UA "Mozilla" -> HTTP 200
```

Node'un `fetch`'i varsayılan olarak `node` gönderiyor. 429 "çok istek
attın" dediği için hata mesajı bizi hız sınırı aramaya yönlendirirdi;
oysa sorun kimlikte.

**2. `range=max` sessizce seyreltiyor.**

```
range=max&interval=1d       -> 168 mum   (1984-2026)
period1/period2&interval=1d -> 2.425 mum (2017-2026)
```

Hata vermiyor. Grafik çizilir, sadece geçmiş 14 kat seyrek olur.

---

⚠️ **FLOAT GÜRÜLTÜSÜ — ilk çalıştırmada patladı.**

`getLatest` çalıştı, geçmiş serisi düştü:

```
Fiyat çevrilemedi: 74.70249938964844      <- 14 ondalık basamak
```

`parseScaled` ölçekten (8) fazla ondalık gelince **bilerek** hata
fırlatıyor — kullanıcının girdiği değeri sessizce yutmamak için. Ama
buradaki fazla basamaklar veri değil, float gösterim gürültüsü.
`toString()` → `toFixed(PRICE_SCALE)`. Kırpma değil yuvarlama, dolayısıyla
sistematik yön hatası da yok.

---

**Cron kararı: hisseler 15 saniyelik tura girmiyor.**

| | 15 sn | 60 sn |
|---|---|---|
| İstek/gün (seans içi) | ~47.000 | **~11.700** |
| Emir bayatlık payı | — | 5 tur (300 sn sınır) |

Kapalıyken **hiç sorulmuyor** — ve bu sadece istek tasarrufu değil,
depolama kararı: yazsaydık hafta sonu 30 hisse × 2 gün × dakikada bir =
~86.000 kopya satır olurdu ve grafik düz çizgi çizerdi.

---

⚠️ **BEKLEYEN — `asset_kind` enum'ında `stock` yok.**

`db/schema.ts`'e eklendi ama migration ÜRETİLMEDİ (Zeynep'in şeridi).
Gereken tek satır:

```sql
ALTER TYPE asset_kind ADD VALUE IF NOT EXISTS 'stock';
```

O çalışana kadar kod derlenir ve testler geçer ama **hisseler
tohumlanamaz** — insert `invalid input value for enum` ile düşer.
Eksiklik sessiz değil, ilk denemede görünür.

---

**Yan bulgu — `TradeScreen`'deki `ERROR_MESSAGES` tablosu ölü kod.**

Sunucu `{code, message}` gönderiyor, `client.ts` sadece `message`'ı
alıyor, ekran ise mesaj METNİNİN İÇİNDE kod arıyor
(`raw.includes('INSUFFICIENT_FUNDS')`). "Bakiye yetersiz" metni o kodu
içermiyor → tablo hiç eşleşmiyor, kullanıcı sunucunun mesajını görüyor.
Şu an zararsız (sunucu mesajları zaten Türkçe) ve `MARKET_CLOSED`'ın
dinamik açılış saati de bu sayede bozulmadan geçiyor. Düzeltilmedi,
kayda geçti.

### 16. Eşzamanlılık testi — 26 Ağu 2026

**1 yeni dosya · 5 test · Faz 1'in bitiş kriteri**

| Dosya | Ne |
|---|---|
| `apps/api/src/orders/concurrency.test.ts` | Emir motorunun üç savunma katmanının testi |

Projenin anlatılacak sorusu buydu ve testi yoktu:

> *"Kullanıcı aynı anda iki alım emri gönderirse bakiyesi eksiye düşer mi?"*

**Senaryo (sayılar elle doğrulanabilir):** bakiye 100.000 TL, her emir
20.020 TL (20.000 brüt + %0,1 komisyon). 100.000 / 20.020 = 4,99 → **4 emir
sığıyor.** 10 emir aynı anda gönderiliyor, 4'ü geçmeli.

**Neden mock'la yazılamaz:** test edilen şey uygulama kodu değil, veritabanının
davranışı. Sahte bir `db` nesnesi `FOR UPDATE`'i bekletmez — mock testi
yazsaydık kilit satırını tamamen silsek bile YEŞİL kalırdı.

---

⚠️ **ASIL DERS — geçen bir test hiçbir şey kanıtlamaz.**

Testi yazdım, 5/5 geçti. Sonra kilidi koddan **sildim** ve tekrar çalıştırdım.
Üç deneme gerekti:

| Deneme | Test neyi sınıyordu | Kilit silinince |
|---|---|---|
| 1 | Ham SQL ile `FOR UPDATE NOWAIT` hata veriyor mu | ✅ **yine geçti** |
| 2 | Emir kilit tutulurken bekliyor mu | ✅ **yine geçti** |
| 3 | Emir bakiyeyi **okumadan önce** mi bekliyor | ❌ düştü |

**1. deneme neden yetersizdi:** `executeOrder`'a hiç dokunmuyordu. Sadece
"PostgreSQL `FOR UPDATE`'i onurlandırıyor mu" diyordu — onu zaten biliyoruz.

**2. deneme neden yetersizdi:** bu incesi. Kilit olmasa bile `UPDATE accounts`
kendi satır kilidini alıyor. Emir yine bekliyordu ama **yanlış yerde**: bakiyeyi
çoktan (eski değeriyle) okuduktan sonra.

```
FOR UPDATE VARSA  ->  önce BEKLER,        sonra GÜNCEL bakiyeyi okur
FOR UPDATE YOKSA  ->  önce ESKİ bakiyeyi okur, sonra yazarken bekler
                      ve araya giren değişikliği EZER
```

İkincisinin adı **kayıp güncelleme (lost update)**. 3. deneme onu kuruyor:
başka bağlantı bakiyeyi 10.000 TL'ye çekip kilidi tutuyor, 20.020 TL'lik emir
başlatılıyor, kilit bırakılıyor. Kilit varsa emir güncel bakiyeyi görüp
"yetersiz" der; yoksa 100.000'i okumuştur, geçer ve diğerinin yazdığını siler.

**Mutasyon sonucu (`.for("update")` silinmiş hâlde):**

```
× 10 emir aynı anda ...        -> 4 yerine 10 geçti
× kayıp güncelleme olmuyor     -> promise reddedilmedi, çözüldü
× aynı anahtarla 5 istek ...   -> 5 yerine 1 tamamlandı
✓ CHECK cash_cents >= 0        -> geçmeli, kilide bağlı değil
✓ UNIQUE(user, idem_key)       -> geçmeli, kilide bağlı değil
```

---

⚠️ **İZOLASYON — `leagues/cron.test.ts` bu hatayı yapıyor.** O test gerçek ligi
kapatıp yenisini açıyor; her `npm test` bir çöp lig dönemi ekliyor (bir ara 47
tane birikmişti, temizlemiştik). Yeni test kendi kullanıcısını ve kendi
varlığını yaratıp sonunda siliyor — `afterAll` sonrası veritabanında sıfır artık
kaldığı doğrulandı.

**Test sayısı: 186 → 191.**

### 15. Podyum rengi ve on hayalet sunucu — 26 Ağu 2026

**1 dosya · 1 kod düzeltmesi · 1 ortam bulgusu**

| Dosya | Ne değişti |
|---|---|
| `apps/mobile/src/screens/LeaderboardScreen.tsx` | `twrColor()` yardımcısı eklendi; podyumdaki sabit yeşil kaldırıldı; eksi rengi `accent` → `loss` |

**Hata neydi:** Lig ekranında 2. ve 3. sıradaki EKSİ getiriler **yeşil**
görünüyordu. Alttaki 4-5-6. sıradaki aynı sayılar kırmızıydı. Yani tek ekran
aynı bilgiyi iki farklı renkte gösteriyordu.

**Neden oldu:** Renk kuralı ekranda İKİ KEZ yazılıydı.

```
liste satırı :  item.twrPercentRaw >= 0 ? yeşil : kırmızı   ✅ işarete bakıyor
podyum       :  podiumTwr = { color: colors.gain }          ❌ SABİT yeşil
```

Kuralın kopyalanması hatanın kendisi değil, **hatanın sebebiydi.** Düzeltme de
buna göre: kural `twrColor()` içinde tek yerde, dört çağıran da onu kullanıyor.

**Gözden kaçmasının sebebi ilginç:** "podyumdakiler kazanıyor" varsayımı doğal
görünüyor. Halbuki podyum **sıralamayı** gösteriyor, kârı değil — piyasanın
düştüğü bir haftada birinci de ekside olur. Ekran yanlış olduğunu değil,
"herkes kazanıyor"u anlatıyordu.

**İkinci düzeltme — hangi kırmızı:** Lig ekranı, tüm uygulamada eksi sayı için
`accent` kullanan TEK yerdi.

| Token | Değer | İşi |
|---|---|---|
| `loss` | `#E5484D` | "para eridi" — Cüzdan, Profil, Alsaydın hepsi bunu kullanıyor |
| `accent` | `#ec3013` | marka rengi — düğme, bağlantı, grafik çizgisi |

Üstelik rozetin arka planı `accentSoft` idi ve o `rgba(229,72,77)` — yani
`loss`'un RGB'si. Arka plan `loss`, yazı `accent`: kimse fark etmemişti çünkü
ikisi de kırmızı. İkisi de `loss`'a çekildi.

---

**Ortam bulgusu — kod değil, makine.** Ölçüm yaparken çıktı: **10 tane
`npm run dev:api` aynı anda çalışıyordu** (12:27'den 15:18'e, her açılışta
eskisi ölmemiş).

| | Temizlik öncesi | Sonrası |
|---|---|---|
| `server.ts` süreci | 10 | 1 |
| Veritabanı bağlantısı | **51** (Postgres sınırı 100) | 8 |
| İşlem/saniye (boştayken) | 52,2 | 7,4 |
| Fiyat cron turu/dakika | 23-40 | 4 (olması gereken) |

⚠️ **Neden ölmüyorlar:** `server.ts` ilk satırda `db`'yi import ediyor →
`postgres.js` bağlantı havuzu açılıyor. Port 3000'i alamayan süreç sunucu
olarak çalışmıyor ama **havuz Node'un olay döngüsünü açık tutuyor**, süreç
hiç çıkmıyor. Sessiz sızıntı: CPU yakmıyor, log basmıyor, sadece bağlantı ve
cron turu tüketiyor.

⚠️ **Bunun asıl tehlikesi ölçüm yalanı:** ilk ölçümüm 52 işlem/saniye dedi ve
bunu "cron çok pahalı" diye okumaya hazırdım. Gerçek sayı 7,4'tü — 10 katı
şişikti. Ölçtüğün makinenin temiz olduğunu doğrulamadan çıkan sayıya güvenme.

**Bilmen gereken alışkanlık:** `npm run dev:api` yazmadan önce eski süreç var
mı bak. Terminali kapatmak süreci öldürmüyor.

### 13. Çıkmaz sokaklar, para birimi merceği ve Zeynep'in yeni cron'ları — 25 Ağu 2026

Bu turun ortak teması: **hata mesajı doğru, çıkış yolu yok.** Üç ayrı yerde
aynı sınıf hata çıktı ve üçü de ancak uygulamayı gerçekten kullanınca görüldü.

#### Oturum ve çıkmaz sokaklar
| Dosya | Ne sorulacak |
|---|---|
| `mobile/src/api/client.ts` (401 işleme) | Erişim token'ı 15 dakikada ölüyordu ve devreye giren hiçbir şey yoktu — uygulama neden KİLİTLENİYORDU? `isRetry` bayrağı hangi sonsuz döngüyü kesiyor? `refreshInFlight` kilidi olmasaydı 4 paralel istek 401 alınca ne olurdu? `/auth/` neden muaf? |
| `mobile/App.tsx` (`setSessionExpiredHandler`) | `client.ts` React'i tanımıyor — depoyu temizlemek neden YETMİYOR? Geri çağrı sökülürken neden `null`'a çekiliyor? |
| `mobile/src/screens/AssetDetailScreen.tsx` (sabit başlık) | "‹ Geri" ScrollView'un içindeyken neden kayboluyordu? Kaçış yolu neden her zaman görünür olmalı? |
| `mobile/src/screens/FriendsScreen.tsx` · `LeaderboardScreen.tsx` · `App.tsx` | Ekran YAZILMIŞ ve import EDİLMİŞ ama hiç çizilmiyordu — sonucu backend'de değil nerede görünüyordu? Rozet neden "bildirim" değil ama yine de gerekli? Sayaç neden AYRI try/catch içinde? |

#### Cüzdan ve para birimi merceği
| Dosya | Ne sorulacak |
|---|---|
| `mobile/src/screens/PortfolioScreen.tsx` (net tutar) | Net tutar neden yüzdenin SOLUNA konamadı? "Sütun eklemek yatay bütçeyi büyütmez" ne demek — 390 pikselde hesabı yap. `profitCents` neden ekranda hesaplanmıyor? |
| `market/repository.ts` (`usdRate` join) | Kur join'i neden seyreltmeden SONRA? Alt sorguya koysaydık kaç satır taranırdı? `usdRate` neden `null` olabiliyor ve çağıran neden `1` varsaymıyor? |
| `market/router.ts` (`?currency=` grafik + 24s) | ⚠️ Bütün eğriyi BUGÜNKÜ kura bölmek neden yanlış — eğrinin şekli ne olurdu? (Ölçüldü: BTC 3 ay, TL +%12,17 · dolar +%6,61.) 24 saat özeti neden güncel kurla çevrilebiliyor ama grafik çevrilemiyor? |
| `mobile/src/components/PriceChart.tsx` (`price` alanı) | Alan adı neden `priceTry` olmaktan çıktı? Birimi sayının ADINA gömmek neden tehlikeli? Çevrim neden ekranda değil sunucuda? |

#### Zeynep'in yeni yazdıkları — hiç okumadın
| Dosya | Ne sorulacak |
|---|---|
| `leagues/twr-engine.ts` | Faz 2'nin bitiş kriteriydi. `packages/contracts/src/twr.ts`'teki `calculateTwr` ile ilişkisi ne? Alt dönemler nasıl bölünüyor? |
| `leagues/cron.ts` | Haftalık lig nasıl kapanıp yenisi açılıyor? Kapanma anında sıralama neye göre donuyor? |
| `portfolio/cron.ts` | `portfolio_snapshots` TWR'nin girdisi — günde bir yazmak neden yeterli? |
| ✅ `market/price-cron.ts` (TWR senkronu) | ⚠️ Bu dosyayı OKUDUN ama sonra DEĞİŞTİ. Her turda `syncAllLeagueEntriesAndRanks` çağrılıyor — 15 saniyelik tur bütçesine etkisi ölçülmedi. |

### 14. Profil, arkadaşlık ve dokuz sessiz hata — 25-26 Ağu 2026

Bu turun tamamı tek bir dersin etrafında: **hiçbiri patlamıyordu.** Dokuz
hata çıktı, hepsi makul görünen yanlış sayı ya da görüntü üretiyordu.
Üçünü test, üçünü TypeScript, üçünü Batuhan ekrana bakarak buldu.

#### Profil — yeni modül
| Dosya | Ne sorulacak |
|---|---|
| `profile/service.ts` | Görünürlük kuralı neden TEK yerde? Arkadaşlık `is_public`'i neden EZİYOR? Kapalı profilde neden 404 değil de boş alanlar dönüyor? Arkadaş sayısı neden yalnızca kendi profilinde HESAPLANIYOR? |
| `profile/repository.ts` | Neden `select *` yok, alanlar tek tek sayılıyor? Neden yalnızca `accepted` arkadaşlık sayılıyor — sadece satırın varlığına baksaydık ne olurdu? `pendingBetween` neden yön döndürüyor, boolean değil? |
| `profile/router.ts` | Gizlilik neden Zod ile doğrulanıyor — `Boolean("false")` ne döner? Herkese açık profil neden yine de giriş istiyor? |
| `mobile/src/screens/ProfileScreen.tsx` | Kendi profilin ve başkasınınki neden TEK ekran? Gizlilik anahtarı neden ayrı state? Neden mutlak tutar hiçbir yerde yok? |
| `mobile/src/components/TabBar.tsx` | Beşinci sekme eklenince "Ya alsaydın" neden "Alsaydın" oldu? |
| `apps/api/src/app.ts` | ⚠️ İKİ router aynı adrese bağlıydı. Express bunu nasıl çözüyor ve neden tehlikeli? |

#### Lig kâr hesabı — iki hata
| Dosya | Ne sorulacak |
|---|---|
| `leagues/twr-engine.ts` | ⚠️ `buy`/`fee` neden DIŞ AKIŞ DEĞİL? Akış sayılınca TWR neden %99.900 çıkıyordu ve bu neden INSERT'i patlatıyordu? `signup_bonus` neden dış akış AMA alt dönem bölmüyor? Beyaz liste neden kara listeden güvenli? |
| `leagues/repository.ts` (sıralama) | ⚠️ `ORDER BY rank, twr` neden DAİRESEL? Sync bu listeyi alıp yeniden rank yazınca ne oluyordu? |
| `leagues/service.ts` | `username` repository'de seçiliyordu ama yanıta çıkmıyordu — alanları tek tek sayan eşlemelerin bedeli ne? |

#### Arkadaşlık
| Dosya | Ne sorulacak |
|---|---|
| `friends/friends.schema.ts` | ⚠️ Neden `toLocaleLowerCase('tr')` KALDIRILDI — "GMAIL.COM" ne oluyordu? Küçültme hangi katmana taşındı ve neden? ⚠️ `.min(1)` neden transform'dan SONRA olmalı — sadece "@" yazılınca ne oluyordu? |
| `friends/repository.ts` | Kullanıcı adı araması neden `lower() = lower()`? Bunun indeks maliyeti ne? |
| `friends/service.ts` | Tek alan iki anlam: ayrım nasıl yapılıyor? E-posta neden serviste küçültülüyor? |

#### Cüzdan ve dağılım çubuğu
| Dosya | Ne sorulacak |
|---|---|
| `mobile/src/screens/PortfolioScreen.tsx` (çubuk) | ⚠️ Dilimler neden `sorted` değil `barPositions`'tan kuruluyor? Kesilmiş listeden kurulunca NAKİT yüzdesine ne oluyordu? Çubuk ile satır rozetleri neden farklı renk gösteriyordu? |
| `mobile/src/components/AllocationBar.tsx` | ⚠️ Palet üç kez değişti. Kırmızı/yeşil neden önce çıkarıldı, sonra geri kondu? Kabul edilen risk ne? |
| `mobile/src/screens/AssetDetailScreen.tsx` (sabit çubuk) | Al/Sat neden `ScrollView` dışına alındı? "Ekranın iki ucu sabit" deseni başka nerede var? |

#### Ya alsaydın
| Dosya | Ne sorulacak |
|---|---|
| `what-if/repository.ts` | ⚠️ Aynı dosyada İKİ `endOfDay` var, biri `Date` biri metin — hangisi neden? Ham `sql` şablonuna `Date` bağlanınca ne oluyor? `::timestamptz` neden değil? |

#### Oturum ve para birimi (25 Ağu)
| Dosya | Ne sorulacak |
|---|---|
| `mobile/src/api/client.ts` | 401 işleme: `isRetry` hangi döngüyü kesiyor? `refreshInFlight` olmasaydı 4 paralel istek ne yapardı? |
| `market/router.ts` (`?currency=`) | Bütün eğriyi bugünkü kura bölmek neden yanlış — eğrinin ŞEKLİ ne olurdu? |

### 1. Döviz ve varlık listesi genişlemesi — 21 Ağu 2026
| Dosya | Ne sorulacak |
|---|---|
| ✅ `market/binance.ts` | `PAIRS` neden kural (`symbol + "USDT"`) değil elle tablo? Coin'lerin başlangıç tarihleri neden koda YAZILMADI? |
| ✅ `market/tcmb.ts` | `FX_UNITS` neden var? JPY neden 100'e bölünüyor? Önbellek neden kuru değil **belgeyi** tutuyor? `parseRate` neden önce `<Currency>` bloğunu izole ediyor? |
| ✅ `market/tcmb.test.ts` | "kur boşsa sonraki para biriminin kuruna sızmaz" testi hangi hatayı kilitliyor? |
| ✅ `market/evds.ts` | `fetchFxHistory` neden `Price` döndürüyor, ham metin değil? Seri kalıbı `TP.DK.{KOD}.A`'daki `.A` ne demek? |
| ✅ `market/price-cron.ts` | `asset.kind === 'fx'` dallanması neden eklendi? Öncesinde ne oluyordu? |
| ✅ `market/price-backfill.ts` | Döviz neden kriptodan **önce** çekiliyor? Döviz neden forward-fill edilmiş hâliyle yazılıyor? |
| ✅ `market/repository.ts` | `AssetKind` neden `$inferSelect`'ten türetiliyor, elle yazılmıyor? |
| ✅ `market/seed.ts` | Fiyat tohumlaması neden tamamen kaldırıldı? `INACTIVE_SYMBOLS` neden ayrı bir UPDATE gerektiriyor? |

### 2. Ayar yükleme ve hata görünürlüğü — 21 Ağu 2026
Bu ikisi **gerçek bir hata ayıklama oturumunun bedeliydi**: kayıt ve giriş
500 veriyordu, `/assets` çalışıyordu, sebebi yarım saat görünmedi.

| Dosya | Ne sorulacak |
|---|---|
| `lib/env.ts` | `.env` neden `import.meta.url`'den bulunuyor, `dotenv/config`'ten değil? `npm run dev:api` ile `npx tsx apps/api/src/server.ts` arasındaki fark neydi? `requireEnv` neden yedek değer kabul etmiyor? |
| `auth/router.ts` | `logUnexpected` neden eklendi? İstemciye giden mesaj neden **değişmedi**? |
| `server.ts` · `market/tufe-backfill.ts` | Tek satır: `dotenv/config` → `lib/env.js`. Neden hepsinin değişmesi gerekti? |

**Hikâye:** `.env` yalnızca repo kökünde. `import 'dotenv/config'` dosyayı
çalışma dizinine göre arıyor. `apps/api`'den başlatınca bulamıyor →
`JWT_ACCESS_SECRET` boş → auth patlıyor. `/assets` çalışmaya devam etti
çünkü `db/client.ts`'te bağlantı adresinin `?? 'varsayılan'` yedeği var.
**Ders:** yedek değer, eksik ayarı gizler.

### 3. Kimlik ekranları tasarımı — 21 Ağu 2026
| Dosya | Ne sorulacak |
|---|---|
| `mobile/src/theme.ts` | Renkler neden çoğunlukla `rgba`, opak hex değil? |
| `mobile/src/components/ChartBackground.tsx` | Her animasyonlu katman neden **ayrı** `Animated.View`? `useNativeDriver` ne yapıyor ve uzun iz neden onu kullanamıyor? `reduceMotion` neden sıfıra değil **orta değere** donduruyor? |
| `mobile/src/components/AuthControls.tsx` | Odak kenarı neden state ile yönetiliyor? `hitSlop` neden var? `loading` sırasında neden `disabled` da veriliyor? |
| `mobile/src/screens/LoginScreen.tsx` | E-posta deseni neden bilerek gevşek? Hata neden her tuş vuruşunda siliniyor? |
| `mobile/src/screens/RegisterScreen.tsx` | İstemci doğrulaması sunucununkini neden **tekrarlıyor**? |
| `mobile/src/screens/WelcomeScreen.tsx` | Başlıkta `lineHeight` neden punto'dan küçük? |
| `mobile/App.tsx` | Font yüklenmeden ekran neden çizilmiyor? Navigasyon kütüphanesi neden eklenmedi? |

⚠️ Tasarımdaki "SPK lisanslı" / "Komisyonsuz ilk 30 gün" / "THYAO-ASELS"
metinleri **kaldırıldı** — üçü de ürün için gerçek dışıydı. Gerekçeler
WelcomeScreen.tsx'in başındaki yorumda.

### 4. Al/Sat ekranı — 21 Ağu 2026 (Faz 1'i kapatan iş)
| Dosya | Ne sorulacak |
|---|---|
| `mobile/src/lib/order-math.ts` | Sunucunun ölçek matematiği neden **tekrarlandı**? `16` nereden geliyor? `divRound` neden düz bölme değil? `maxBuyableQuantity` neden komisyonu hesaba katıyor ve neden **aşağı** yuvarlıyor? |
| `mobile/src/screens/TradeScreen.tsx` | Idempotency anahtarı neden `useState` değil **`useRef`**? Hangi durumda sıfırlanıyor, hangisinde korunuyor — ve korunmasaydı ne olurdu? Ekrandaki tutar neden "tahmini" diye işaretli? |
| `mobile/src/screens/MarketScreen.tsx` | `onSelectAsset` neden **isteğe bağlı** bir prop? |
| `market/price-cron.test.ts` | "döviz varlığını Binance'e değil TCMB'ye sorar" testi hangi hatayı kilitliyor? |

**Ölçülen sonuç:** istemci tahmini ile sunucu sonucu birebir aynı çıktı —
`gross 369393 · fee 369 · net 369762`. İkisi ayrışsaydı kullanıcı ekranda
bir tutar görüp başka bir tutar öderdi.

### 5. Fiyat grafiği — 22 Ağu 2026
| Dosya | Ne sorulacak |
|---|---|
| `market/ranges.ts` | Kova boyutları neden bu sayılar? Hedef nokta aralığı neden 90-500? `max` için `lookbackSeconds` neden `null`, 0 değil? `startOf` neden `now`'u parametre alıyor? |
| `market/ranges.test.ts` | Test "kod çalışıyor mu"yu değil neyi sınıyor? |
| ✅ `market/repository.ts` (`getPriceSeries`) | `DISTINCT ON (bucket)` + `ORDER BY bucket, ts DESC` birlikte ne yapıyor? Neden `date_trunc` kullanılmadı? Neden ortalama değil **son** fiyat alınıyor? Tarih neden `Date` değil ISO metin + `::timestamp`? Neden `::timestamptz` değil? |
| `market/router.ts` | Seyreltme neden sunucuda, istemcide değil? `range` neden kapalı liste, serbest tarih aralığı değil? |
| `mobile/src/components/PriceChart.tsx` | `Number()` burada neden serbest, `format.ts`'te neden yasak? `y` neden ters çevriliyor? `max === min` olduğunda ne oluyor ve neden **sessiz** bir hata? |
| `mobile/src/screens/AssetDetailScreen.tsx` | Yüzde değişimde float neden kabul edilebilir? Seyrek veri uyarısı neden var? |
| `mobile/src/screens/WhatIfScreen.tsx` | `yearsFor` hangi hata mesajını ortadan kaldırıyor? Varlık değişince seçili yıl neden sınıra çekiliyor? `tooEarly` neden `dateString`'den SONRA tanımlanmak zorunda? |

**Yol boyunca çıkan hata:** iç içe `sql` parçasında JS `Date` bağlamak
`ERR_INVALID_ARG_TYPE` veriyor — düz sorguda çalışıyor, iç içe kullanımda
patlıyor. Beş aralık 0 nokta döndürüyordu ve **benim test betiğim bunu
gizledi** (`d.get('points', [])` yazdığım için 500 yanıtı "0 nokta" gibi
göründü). Ders: testin hatayı yutmadığından emin ol.

**Ölçülen sonuç:** `1y` 365 nokta · `max` 471 nokta (BTC) · SOL `max`
316 nokta, 2020-08-12'den başlıyor — varlık başına gerçek başlangıç.

### 6. `apps/api/src/what-if/` — sen hâlâ okumadın
`service.ts` · `repository.ts` · `what-if.test.ts`

**Zeynep'in yazdığı kısım:** reel getiri formülü `(1+nominal)/(1+enflasyon)−1`,
TÜFE endeksi kullanımı, tutar → miktar çevriminde ölçek matematiği
(`calcGross`'un tersi).

**Sonradan eklenen kısım:** `findTufeIndexOnOrBefore`.
**Ne sorulacak:** enflasyon verisi neden HER ZAMAN gecikmeli? Tam eşleşme
arasaydık ne olurdu? Yanıt neden istenen ayı değil **kullanılan** ayı
bildiriyor?

⚠️ Bu dosyalarda hesabın tamamı `parseFloat` ile yapılıyor — projenin
"para `bigint`, `float` yasak" kuralına aykırı. Gösterim için zararsız
olduğu için şimdilik bırakıldı ama **bilinçli bir borç**, kaza değil.

### 7. Grafiğe detay, yakınlaştırma ve pozisyon kârı — 23 Ağu 2026
| Dosya | Ne sorulacak |
|---|---|
| `market/hourly-backfill.ts` | Neden ayrı bir geri doldurma betiği? `PricePoint`'e `openTime` neden eklendi — `date` yetmiyor muydu? Yetmeseydi 24 saatlik mum ne olurdu? |
| `market/provider.ts` (`Candle`) | Binance'in `1m`'i ile `ranges.ts`'in `1m`'i neden **aynı şey değil**? Bu karışıklık nasıl işaretlendi? |
| `market/binance.ts` (`CANDLE_MS`) | Sayfalama neden sabit bir gün değil kova boyutu kadar ilerliyor? Sabit kalsaydı 5 dakikalık mumlarda ne olurdu? |
| `market/ranges.ts` (`BUCKET_LADDER`, `bucketFor`, `parseWindow`) | Merdivenin en küçüğü neden **5 dakika**? Daha küçük olsaydı kullanıcı ne yaşardı? `range`'in kapalı liste olma kararı neden geri alındı, karşılığında hangi iki koruma kondu? |
| ✅ `market/repository.ts` (`until` parametresi) | Üst sınır neden `null` varsayılanlı? Zorunlu olsaydı mevcut çağıranlar ne olurdu? |
| `portfolio/cost-basis.ts` | Maliyet neden **saklanmıyor**, emir defterinden türetiliyor? `grossCents` değil neden `netCents`? Satışta maliyet neden oranla azaltılıyor? `profitPercent` hangi iki durumda `null` dönüyor ve neden 0 dönmüyor? |
| `mobile/src/components/PriceChart.tsx` (eksen + yakınlaştırma) | Etiket biçimi neden kova boyutuna göre değişiyor? `scrubRef`/`zoomRef` neden var — `PanResponder` içinde doğrudan state okusaydık ne olurdu? İstek neden parmak kalkınca gidiyor, her karede değil? %15 eşiği ne işe yarıyor? |

**Ölçülen sonuç — yakınlaştırma gerçekten çözünürlük artırıyor:**
3 yıl → haftalık/157 · 1 yıl → günlük/365 · 1 ay → 6 saat/121 ·
1 hafta → saatlik/168 · 2 gün → **15 dakika**/193 · 6 saat → **5 dakika**/72.
1 aydan 6 saate inince kova 72 kat inceliyor.

**Ölçülen sonuç — komisyon maliyete gerçekten dahil:** fiyat hiç değişmemiş
bir pozisyon **−%0,10** gösterdi. Bu tam olarak komisyon oranı; `grossCents`
kullansaydık kâr **%0,00** çıkar ve kullanıcı ödediği komisyonu hiç görmezdi.

### 12. Denetim — listede olmayan üç test dosyası (25 Ağu 2026)

Bu üçü `market/` içinde duruyor ama okuma borcuna hiç girmemiş.
Aynı hata sınıfı: kod eklendi, listeye eklenmedi.

| Dosya | Ne sorulacak |
|---|---|
| `market/binance.test.ts` | Sayfalama testi hangi senaryoyu kuruyor? Sahte `fetch` nasıl veriliyor? |
| `market/lbma.test.ts` | Ons→gram beklenen değerleri nereden geldi? Mutfak onsu testi neyi kanıtlıyor? |
| `market/repository.test.ts` | Veritabanı olmadan repository nasıl test ediliyor? |

### 8. Denetim — listeye hiç girmemiş 13 dosya (23 Ağu 2026)

Bu bölüm bir **hatanın telafisi.** Yukarıdaki bölümler yazılırken "asıl iş"
sayılan dosyalar listelendi, yanlarında değişen dosyalar atlandı. Denetimde
13 tanesi çıktı — hepsi benim yazdığım ya da değiştirdiğim kod.

**Neden önemli:** okuma borcu eksikse borç yokmuş gibi görünür. Listeye
girmeyen dosya sorulmayan dosyadır.

#### Emir ve portföy tarafı
| Dosya | Ne sorulacak |
|---|---|
| `orders/orders.schema.ts` | `quantity` neden `number` değil **`string`**? Number olsaydı zincir tam olarak nerede kırılırdı — doğrulamadan önce mi sonra mı? Ondalık sınırı neden şemada, `toAmount` içinde değil? Düzenli ifade negatifi nasıl eliyor? |
| `orders/calculate.test.ts` | Hangi testler yuvarlamayı, hangileri ölçek matematiğini kilitliyor? |
| `portfolio/repository.ts` (`getOrderLedger`) | Emir defteri neden **tarih sırasına göre** okunuyor — sıra bozulsa maliyet ne olurdu? |
| `portfolio/service.ts` | Maliyet hesabı neden servis katmanında birleştiriliyor, repository'de değil? |
| `portfolio/router.ts` | `profitCents` ve `profitPercent` JSON'a nasıl yazılıyor — biri string biri sayı, neden? |
| `portfolio/calculate.test.ts` · `portfolio/cost-basis.test.ts` | Yarım satış testi hangi sayıyı kilitliyor? (735.510 → 367.755) |
| `mobile/src/screens/PortfolioScreen.tsx` | Yeşil/kırmızı kararı neye bakıyor — `profitCents` mi `profitPercent` mi? `profitPercent` `null` gelince ekran ne gösteriyor ve neden **%0 değil**? |

#### Altyapı
| Dosya | Ne sorulacak |
|---|---|
| `app.ts` | Router'lar neden bu sırayla monte ediliyor? `/assets` yolu neden `marketRouter`'a bağlı — dosya adıyla yol adı neden aynı değil? |
| `market/scheduler.ts` | ⚠️ Cron ifadesi neden **altı alan**, standart cron beş değil mi? Kopyalanıp başka sisteme taşınırsa ne olur? `running` bayrağı olmasaydı iki tur çakışınca ne olurdu — veritabanı korur mu, korursa bayrak neden var? |
| `market/evds.test.ts` | 1000 gözlem sınırı testte nasıl temsil ediliyor? |
| `mobile/src/lib/storage.ts` | ⚠️ Neden **iki farklı depo** — telefonda `SecureStore`, tarayıcıda `localStorage`? `AsyncStorage` neden bilerek reddedildi? Tarayıcıdaki düz metin saklama hangi gerekçeyle kabul edildi ve bu gerekçe **dağıtımda hâlâ geçerli mi**? |
| `mobile/src/api/client.ts` | Token yenileme (`refresh`) hangi anda tetikleniyor? Aynı anda iki istek 401 alırsa ne oluyor — iki kez mi yenileniyor? |
| `mobile/src/lib/format.ts` | ⚠️ Hiçbir fonksiyon neden `Number()` kullanmıyor? `decimalToCents` metni nasıl `bigint`e çeviriyor — ve neden `parseFloat` ile değil? |
| `mobile/src/screens/AuthScreen.tsx` | ⚠️ Bu dosya artık **hiçbir yerden çağrılmıyor** — Login/Register ekranları yerine geçti. Silinmeli mi, yoksa Zeynep hâlâ kullanıyor mu? Zeynep'e sorulacak. |

#### Benim borcum değil ama okunmamış (Zeynep'in yazdığı)
`db/schema.ts` · `market/tufe-cron.ts` · `what-if/schema.ts` ·
`screens/FriendsScreen.tsx` · `screens/LeaderboardScreen.tsx`

Bunları ben değiştirmedim, o yüzden yukarıdaki tablolarda yok. Ama
`db/schema.ts` bütün projenin veri modeli — okumadan portföy hesabının
neden öyle olduğu tam anlaşılmaz.

### 9. TL / USD gösterim düğmesi — 23 Ağu 2026
| Dosya | Ne sorulacak |
|---|---|
| `lib/fx.ts` (`tryToUsd`, `centsTryToUsd`, `parseCurrency`) | `usdToTry`'ın "simetriği" değil "tersi" demek ne fark yaratıyor? Ölçekten bağımsız `divideByRate` neden tek fonksiyon, iki sarmalayıcı? Geçersiz `?currency=eur` neden sessizce TL'ye düşmüyor? |
| `lib/fx.test.ts` | Gidiş-dönüş çevrim neden **kayıpsız değil** ve bu test neyi kilitliyor? Negatif tutar testi hangi ekran hatasını engelliyor? |
| ✅ `market/repository.ts` (`latestUsdTryRate`) | Kur neden ayrı tabloda değil, **normal bir varlık** olarak tutuluyor? `price_usd` kolonu eklenseydi ne olurdu? `null` dönünce çağıran neden `1` varsaymıyor? |
| `market/router.ts` · `portfolio/router.ts` | Kur neden yalnızca dolar istendiğinde okunuyor? `priceTry` alanının üzerine dolar yazsaydık hata **neden fark edilmezdi**? Kur yoksa neden 503 — sessizce TL döndürmek neden daha kötü? |
| `mobile/src/lib/currency.tsx` | ⚠️ Sağlayıcı neden **en dışta**, sadece iki sekmeyi sarmıyor? `App` kendi sağladığı context'i neden okuyamıyor? Depoda saçma değer varsa ne oluyor? ⚠️ `./storage` importunda uzantı neden **yok** — API tarafında neden zorunlu? |
| `mobile/src/lib/storage.ts` (`setPreference`) | Tercih neden token'larla aynı dosyada ama ayrı başlıkta? `clearTokens` tercihe neden dokunmuyor? |
| `mobile/src/lib/format.ts` (`symbolOf`) | Dolar biçiminde neden **Türkçe sayı yazımı** korundu (`1.234,56 $`)? |
| `mobile/src/components/CurrencyToggle.tsx` | Neden tek düğme değil, iki seçenek yan yana? |
| `mobile/src/screens/MarketScreen.tsx` · `PortfolioScreen.tsx` | ⚠️ `queryRef` neden var — zamanlayıcının içindeki `load` doğrudan `query` okusaydı hangi hata çıkardı ve **neden yalnızca otomatik yenilemede** görünürdü? `money()` yardımcısı hangi hatayı önlüyor? Yeşil/kırmızı kararı neden hep **TL** değerine bakıyor? |
| `mobile/src/screens/TradeScreen.tsx` · `WhatIfScreen.tsx` | `apiFetch<Asset[]>` tip iddiası neden **çalışma anında** korumuyor — `GET /assets` dizi olmaktan çıkınca tip kontrolü niye hata vermedi? |

**Ölçülen sonuç — çevrim doğrulandı:**
- USD varlığının kendi dolar fiyatı **tam 1,00000000** çıktı. Kur formülü
  yanlış olsaydı ilk bozulacak sayı buydu.
- BTC: `3.697.539,16 ₺ ÷ 47,8799 = 77.225,29 $` — elle hesapla birebir aynı.
- Nakit: `100.000,00 ₺ → 2.088,56 $` (`2088,5591` → ROUND_HALF_UP).
- Zarar `−18,50 ₺ → −0,39 $` — **işaret korundu**, yüzde iki görünümde de
  `−%0,10`, yani tam komisyon oranı.

**Yol boyunca çıkan hata:** `currency.tsx` içinde `./storage.js` yazdım —
API'nin `nodenext` alışkanlığı. `npm run typecheck` **temiz geçti**, hata
ancak `expo export` sırasında Metro'da çıktı. Tip kontrolü ile paketleme
iki farklı şeyi ölçüyor.

⚠️ **Doğrulama sırasında veritabanına iki tek kullanımlık kullanıcı eklendi**
(`fx-test-…@example.com`, `fx-pos-…@example.com`) ve biri 0,005 BTC aldı.
Lig sıralamasında görünürler; temizlenmeleri gerekiyor.

### 10. Tasarım dili birliği — 23 Ağu 2026
| Dosya | Ne sorulacak |
|---|---|
| `mobile/src/theme.ts` (yeni belirteçler) | Yeni renkler neden **mevcut üçünden türetildi**, palete dördüncü bir ton eklenmedi? `warn` neden `accent` (kırmızı) olamazdı? `readoutFill` neden yarı saydam değil **opak**? |
| `mobile/src/components/PriceChart.tsx` | `fontWeight: 'bold'` neden `fontFamily: fonts.semibold` ile değiştirildi — ikisi aynı şeyi yapmıyor mu? |
| `mobile/src/screens/*.tsx` (5 ekran) | Ham hex yerine anlamsal belirteç kullanmanın kazancı ne? `colors.gain` yerine `#10B981` kalsaydı "yükseliş rengini değiştir" isteği kaç dosyaya dokunurdu? |

**⚠️ Yol boyunca yapılan iki hata — ikisi de otomatik değiştirmeden:**

1. **JSX özniteliğinde süslü parantez unutuldu.** `tintColor="#10B981"` düz
   metin değişimiyle `tintColor=colors.gain` oldu — JSX'te sözdizimi hatası.
   Doğrusu `tintColor={colors.gain}`. Değer bağlamı (`'#fff'`) ile öznitelik
   bağlamı (`="#fff"`) farklı kurallara tabi.
2. **Import çok satırlı bir import'un ortasına girdi.** "`import ` ile
   başlayan son satır" ölçütü, `import {` ile başlayıp üç satır sonra
   `} from '...'` ile biten blokta yanlış yeri buluyor. Ölçüt **noktalı
   virgülle biten satır** olmalıydı.

İkisi de `npx tsc` ile anında yakalandı ve dosyalar `git checkout` ile geri
alınıp yeniden yapıldı. **Ders:** toplu değiştirme yaparken bağlamı olmayan
metin değişimi kırılgan — ve tip kontrolü bu kırılganlığın ağıdır.

**Kapsam kararı:** `FriendsScreen` ve `LeaderboardScreen` **değiştirilmedi**.
İkisi de Zeynep'in şeridi (`docs/02-gorev-paylasimi.md`). Uygulama şu an
karışık görünüyor — kendi ekranlarım kömür grisi, onunkiler lacivert. Bu
bilinçli: başkasının şeridine izinsiz girmek, karışık görünmekten kötü.

### 11. Tasarım entegrasyonu ve ürün eksikleri — 24 Ağu 2026

Bu tur `docs/export/`'taki dört ekranı uygulamaya taşıdı ve senin
bildirdiğin eksikleri kapattı. En büyük dosya yığını burada.

#### Tasarım sistemi
| Dosya | Ne sorulacak |
|---|---|
| `mobile/src/theme.ts` | Renkler neden **anlamsal** (`gain`) değil birebir (`#10B981`) adlandırıldı? "Yükseliş yeşilini değiştir" isteği eskiden kaç dosyaya dokunurdu? Yeni renkler neden mevcut üçünden **türetildi**, palete dördüncü ton eklenmedi? `inkFaint` ve `inkDisabled` tasarımdakinden neden **açıldı** — hangi kontrast oranları? |
| `mobile/src/components/DesignKit.tsx` | Seçili çip neden vurgu rengiyle değil **ters zeminle** anlatılıyor? Kırmızı yapsaydık kullanıcı ne okurdu? `BigAmount` tam kısmı ve kuruşu neden farklı puntoda? |
| `mobile/src/components/TabBar.tsx` | Sekme neden üstten **alta** taşındı? Beşten dörde inişin gerekçesi ne? İkonlar neden **emoji değil SVG** — emoji hangi üç platformda nasıl bozuluyor? |
| `mobile/src/components/AllocationBar.tsx` | Pasta değil **çubuk**: üç gerekçe neydi? Renkler önce **gri**ydi, neden değişti — ve karışma riski nasıl kapatıldı? `colorForLabel` neden indis değil **etiket** alıyor? |
| `mobile/src/components/AssetLogo.tsx` | ⚠️ `require` neden **dinamik olamaz**? Metro hangi anda karar veriyor? Elle eklenen logo hazır seti neden **eziyor**? Madeni paranın degrade `id`'si neden benzersiz olmak zorunda — aynı olsaydı ne görünürdü? |
| `mobile/scripts/prepare-logos.mjs` | İndirilen dosyalar neden **olduğu gibi kullanılamadı** — iki ayrı sebep? `WHITE_CUTOFF` neden 250 değil **230**? İki eşik arasındaki bant ne işe yarıyor? ⚠️ Fonksiyon adı neden `process` **olamaz**? |

#### Ekranlar
| Dosya | Ne sorulacak |
|---|---|
| `mobile/src/components/Calendar.tsx` | Verisi olmayan gün neden **silinmiyor da soluklaşıyor**? Dokunulunca neden sessiz kalmıyor? Ayın gün sayısı neden elle 28/30/31 tablosuyla değil `Date` ile bulunuyor? Çift ok neden var? |
| `mobile/src/screens/WhatIfScreen.tsx` | ⚠️ **Enflasyon eşiği** ne anlatıyor — 2020 için hangi varlıklar altında kaldı ve bu ne demek? Çizgi neden sabit konumda değil **hesaplanıyor**? Kat listesi neden tarihe bağlı ama **tutara bağlı değil**? Buton neden sabit? |
| `mobile/src/screens/WhatIfResultScreen.tsx` | Sonuç neden **ayrı ekran**? `104× ÷ 12,8× = 8,1×` üçlüsü neyi anlatıyor? Grafikte iki çizgi neden **aynı ölçekte** olmak zorunda? Enflasyon çizgisi neden **yaklaşım** olarak işaretli? Okuma satırı neden grafiğin **üstünde**? `pointsRef` olmasaydı hangi hata çıkardı? |
| `mobile/src/screens/PortfolioScreen.tsx` (sıralama) | Sıralama neden **üç durumlu**? `null` yüzdeler neden hep sona düşüyor — sıfır saysaydık hangi iki şey karışırdı? Sıralama neden `[...]` kopyası üzerinde? Değer neden `Number` değil `BigInt` ile karşılaştırılıyor? |
| `mobile/src/screens/LeaderboardScreen.tsx` | Başlık neden lig adı değil **tarih aralığı** gösteriyor? ⚠️ Bu dosya kimin şeridinde — hangi kısmına dokunuldu, hangisine dokunulmadı? |
| `mobile/src/components/AddFriend.tsx` | Davet düğmesi neden **boş durumda da** var? Kullanıcı adı değil **e-posta** ile olmasının sebebi ne? |

#### Sunucu
| Dosya | Ne sorulacak |
|---|---|
| ✅ `market/repository.ts` (`getDailyStats`) | 24 saat özeti neden **migration gerektirmiyor** ama mum grafiği gerektiriyor — aradaki ölçek farkı ne? Açılış/kapanış neden `MIN`/`MAX` ile alınamıyor? |
| ✅ `market/repository.ts` (24s değişim) | Neden **tam eşleşme** aranmıyor? Alt sınır neden 48 saat? ⚠️ SQL yorumunda **ters tırnak** neden kullanılamıyor? |
| `what-if/repository.ts` (`findMultiplesForDate`) | Tek sorgu neden şart — N+1 burada kaç sorgu ederdi? |
| `what-if/service.ts` (`calculateMultiples`) | Enflasyon katı nasıl hesaplanıyor? Liste neden **büyükten küçüğe** sıralı dönüyor? |
| `what-if/service.ts` (iki kur) | ⚠️ Başlangıç ve bugün kuru neden **ayrı** okunuyor? Tek kur kullansaydık 12 Mart 2020 bitcoin'i kaç dolar çıkardı? |
| `orders/router.ts` (`GET /orders`) | `limit` neden üst sınırlı? Bu sorgu maliyet defterinden neden **ayrı** — birleştirseydik hangi hesap bozulurdu? |
| `portfolio/repository.ts` (`getRecentOrders`) | İkincil sıralama ölçütü `id` neden var? |

**Ölçülen sonuçlar:**
- Enflasyon eşiği 2020-03-12 için **9,1×**. Üstünde 10 kripto/maden, altında
  **sekiz dövizin hepsi** — dolar tutmak o dönem alım gücü kaybettirmiş.
- BTC: lirada **128×**, dolarda **16×**. İkisini yan yana göstermenin sebebi.
- 12 Mart 2020 BTC = **4.800,00 $** (kur 6,15 ₺). Bugünkü kurla çevirseydik
  620 $ çıkardı.
- Altın 2017 Ocak **133,77 ₺/gram**, gerçeği ~137 ₺.

**Yol boyunca çıkan üç hata:**
1. SQL yorumundaki **ters tırnak** JS şablon dizesini erken kapattı; hata
   mesajı SQL'i değil TypeScript'i işaret ettiği için kaynağı bulmak sürdü.
2. Betikte `function process(...)` Node'un global `process` nesnesini
   gölgeledi — `process.argv` sessizce çökerdi.
3. Sunum penceresindeki bulanıklık **uygulamada değildi**: `demo.html`
   `transform: scale()` kullanıyordu, yazıyı çizip sonra küçültüyordu.

⚠️ **Bilerek yapılmayanlar** (hepsi migration bekliyor): satır içi mini
grafik (20 varlık × 7 gün ≈ 800.000 satır/5 sn), mum grafiği, `retention.ts`.
Ve CHF logosu — dosyada Shutterstock filigranı var.

### Küçük değişiklikler
- `mobile/src/screens/WhatIfScreen.tsx` — sabit 5 varlıklık liste kaldırıldı,
  `/assets`'ten çekiliyor. **Ne sorulacak:** liste koda gömülüyken sunucuya
  13 varlık eklendiğinde neden kimse hata almadı?

---

## ✅ Tamamlandı · EVDS anahtarı ve veri doğrulaması — 17 Ağustos 2026

Faz 0'ın veri kapısı **kapandı**. Dört kaynağın tamamı gerçek istekle doğrulandı: Kripto (Binance) · Döviz (TCMB) · Altın (**LBMA**) · TÜFE (**`TP.GENENDEKS.T1`**). Ayrıntı ve elenen adaylar: [rapor](00-veri-saglayici-dogrulama.md).

- [x] `evds3.tcmb.gov.tr` üzerinden ücretsiz kayıt ol, profilden API anahtarını al
- [x] EVDS web servis kılavuzunu oku: istek URL formatı ve anahtar nasıl gönderiliyor (header mı, query mi)
      → Base `https://evds3.tcmb.gov.tr/igmevdsms-dis/`, anahtar **header'da** `key: <anahtar>`. Ayrıntı: [rapor §5](00-veri-saglayici-dogrulama.md)
- [x] **Altın**: EVDS'de günlük altın fiyatı **yok** (hepsi aylık, tek işgünü serisi 2018'de arşivlenmiş)
      → Kaynak **LBMA PM fixing** oldu: `prices.lbma.org.uk/json/gold_pm.json`, anahtarsız, 1968'den bugüne, tek istekte tüm seri. Varlık: **gram altın (24 ayar)**. Ayrıntı ve elenen adaylar: [rapor §3](00-veri-saglayici-dogrulama.md)
- [x] **TÜFE**: `TP.FG.J0` **arşiv çıktı** (Ocak 2026'da donmuş). Doğru kod: **`TP.GENENDEKS.T1`** · aylık · 2003 → Tem 2026 · canlı
- [x] `TP.GENENDEKS.T1` için gerçek veri çağrısı — Ocak-Haziran 2020 verisi döndü
- [x] Sonucu `00-veri-saglayici-dogrulama.md`'ye ekle

⚠️ **Derinliği veri çağrısıyla ölçme.** 1000 gözlem sınırı bitiş tarihinden geriye işliyor — geniş aralık en eski değil en yeni veriyi döndürür. Derinlik `serieList/type=json&code=<KOD>` ucunun `Start_Date` alanından okunur.

**Dikkat:** Anahtar bir sırdır. `.env`'e koy, koda gömme, commit etme. `.gitignore`'da `.env` olduğundan emin olmadan anahtarı hiçbir dosyaya yazma.

**Bitti sayılır:** Her iki seri için gerçek yanıt alınmış, derinlik ve sıklık not edilmiş. Altın bulunamazsa MVP'den çıkarma kararı yazılı.

---

## Faz 0 · kalan görevlerin

### ✅ `money.ts` — tamamlandı, 17 Ağustos 2026
*Konum: `apps/api/src/lib/money.ts` · 9 test yeşil · typecheck temiz*

Amaç: hiçbir yerde `number` kullanmadan para hesabı yapmak. `0.1 + 0.2 !== 0.3` olduğu için para asla kayan noktalı sayıyla tutulmaz.

- [x] Üç ölçek: kuruş (`bigint`), fiyat (1e8 ölçekli), miktar (1e10 ölçekli)
- [x] `ROUND_HALF_UP` yapan bölme fonksiyonu — **tek yerde** (`divRound`)
- [x] Ondalık metni ölçekli `bigint`'e çeviren ayrıştırıcı (`parseScaled`)
- [x] Brüt tutar ve komisyon hesabı (`calcGross`, `calcCommission`)
- [x] Türkçe para biçimlendirme: `1234567n → "12.345,67 ₺"` (`formatTRY`)
- [x] Testler — 9 test: yuvarlama, tip koruması, ölçek matematiği, gidiş-dönüş

**Yazarken çıkan iki bulgu:**

1. **Markalı tip aritmetikte korumuyor.** `Penny + Price` derleniyor — `+` operatörü marka etiketini taşımıyor, sonuç düz `bigint` oluyor. Koruma yalnızca *atama* anında devreye giriyor. Çözüm: `addPenny`/`subPenny` fonksiyonları eklendi. **Kural: para üzerinde `+` ve `-` doğrudan kullanılmaz**, tıpkı `/` için `divRound` gibi.
2. **`@ts-expect-error` vitest'te çalışmaz.** Vitest esbuild ile tipleri sadece siler, kontrol etmez. Tip testleri `npm run typecheck` ile doğrulanır. Yani `npm test` ve `npm run typecheck` **iki farklı şeyi** ölçüyor, biri diğerinin yerini tutmuyor.

**Araştır:**
- `bigint` bölmesi neden kırpıyor (truncate) ve bu neden kullanıcı aleyhine kuruş kaybettirir
- Markalı tip (branded type) nedir — üç ölçeği birbirine karıştırmayı derleme anında engellemek için
- `Intl.NumberFormat` neden `bigint` ile doğrudan çalışmıyor

**Tuzaklar:**
- Ölçekten fazla ondalık basamak girilirse **sessizce kırpma, hata fırlat.** Sessiz kırpma kullanıcının girdiği değerin kaybolması demek
- Yarıyı yukarı yuvarlarken negatif sayıları unutma
- `parse` ve `format` gidiş-dönüşü kayıpsız olmalı — testini yaz

**Bitti sayılır:** Testler geçiyor, testlerin arasında "0.1 + 0.2 problemi bizde olmuyor" kanıtı var.

### `packages/contracts` tipleri
*(Zeynep ile birlikte, aynı oturumda)*

Varlık, fiyat, emir, portföy tipleri. Bu paket iki şeridin sözleşmesi — tek başına değiştirilmez.

---

## Faz 1 · yol haritan

- [x] `MarketDataProvider` arayüzü — `getLatest`, `getHistory`, **USD döner**
- [x] Binance adapter (`/api/v3/klines`, anahtarsız, 1000 mum limiti, sayfalama)
- [x] TCMB FX adapter + **hafta sonu forward-fill** kuralı ve testi
- [x] Fiyat çekme cron'u → `price_history` (15 sn aralık)
- [x] `GET /assets`
- [x] **Emir motoru** ← şeridin kalbi
      3 katman: `calculate.ts` (saf hesap) · `repository.ts` (transaction + `FOR UPDATE`) · `router.ts` (`POST /orders`)
      ✅ **Eşzamanlılık testi YAZILDI** — 26 Ağu 2026, `orders/concurrency.test.ts`
      Gerçek PostgreSQL'e bağlanıyor (mock'la yazılamazdı). Üç katmanı ayrı ayrı
      sınıyor ve **mutasyonla doğrulandı**: `.for("update")` silinince 3 test kırmızı.
      Faz 1'in bitiş kriteri artık gerçekten karşılanıyor.
- [x] `GET /portfolio`
      Çekirdeği ortak hesap: `toplam değer = nakit + Σ(miktar × güncel fiyat)`.
      Aynı fonksiyon gece cron'unu da besleyecek (`portfolio_snapshots`, `reason='daily'`).
      Emirde snapshot yazılmıyor — bkz. 01-plan.md 8.1
- [x] Piyasa ve Portföy ekranları
- [x] **Al/Sat ekranı** — 21 Ağu 2026, Faz 1 kapandı
      `TradeScreen.tsx`. Canlı doğrulandı: emir 201, aynı `Idempotency-Key` ile
      tekrar → aynı `orderId` ve bakiye değişmedi, bakiyeyi aşan emir → 422.
      İstemci tahmini sunucu sonucuyla birebir tuttu (`369393 / 369 / 369762`).

### Emir motoru hakkında şimdiden bilmen gerekenler

Bu, projenin anlatılacak hikâyesi. Cevaplaman gereken soru: *"Kullanıcı aynı anda iki alım emri gönderirse bakiyesi eksiye düşer mi?"*

Üç savunma katmanı olacak:
1. **Veritabanı kısıtı** — `accounts.cash_kurus CHECK >= 0`. Kod hatalı yazılsa bile veri bozulmaz
2. **Satır kilidi** — transaction içinde `SELECT ... FOR UPDATE`
3. **Idempotency** — `UNIQUE(user_id, idempotency_key)`, ağ hatasında tekrarlanan istek ikinci emri yaratmaz

Araştırman gerekenler: transaction izolasyon seviyeleri, `SELECT FOR UPDATE` ne yapıyor, idempotency key deseni neden var.

---

## Faz 2 · sende olanlar

- [x] **Döviz adapteri çok para birimine açıldı** — 21 Ağu 2026
      `parseUsdRate` → `parseRate(xml, kod, tarih)`. Arayüze `getRate(kod, tarih)`
      eklendi, `getUsdTry` onun kısayolu olarak kaldı. EVDS tarafında
      `fetchUsdTryHistory` → `fetchFxHistory(kod, ...)`, seri kalıbı `TP.DK.{KOD}.A`.
      Sekiz döviz: USD · EUR · GBP · CHF · CAD · AUD · SEK · JPY

      ⚠️ **`<Unit>` TUZAĞI — ölçüldü ve kapatıldı.** TCMB her kuru "1 birim"
      üzerinden yayımlamıyor: USD için `<Unit>1</Unit>`, **JPY için 100**.
      EVDS `TP.DK.JPY.A` 2 Ocak 2024 için `20.74670000` döndürüyor; gerçek
      1 JPY o gün ~0,207 TL. Çarpan tam 100.
      Birim tablosu `tcmb.ts` içindeki **`FX_UNITS`** — tek merkez, EVDS de
      oradan okuyor. XML'deki `<Unit>` tabloyla karşılaştırılıyor: uyuşmazsa
      hata fırlatıyor. Amaç sadece bölmek değil, TCMB birimi değiştirirse
      **fark etmek**.
      Sistem kuralı: `price_history` her zaman BİR BİRİMİN fiyatını tutar.

      ⚠️ **Ayrıştırıcıda gerçek bir hata da düzeldi.** Eski desen
      `CurrencyCode="USD"[\s\S]*?<ForexBuying>` idi. `[\s\S]*?` belge sonuna
      kadar gidebildiği için, aranan para biriminin kuru o gün boşsa
      (`<ForexBuying/>`) desen SONRAKİ para biriminin kurunu yakalardı —
      hata vermeden, makul görünen yanlış bir sayıyla. Artık önce
      `<Currency>...</Currency>` bloğu izole ediliyor, alanlar onun içinde
      aranıyor. Testi yazıldı.

      ⚠️ **Önbellek kuru değil BELGEYİ tutuyor.** TCMB bütün kurları tek
      dosyada yayımlıyor. "kod|tarih" anahtarlı önbellekte 8 döviz aynı
      dosyayı 8 kez indirirdi; cron 15 saniyede bir çalıştığı için bu günde
      ~46.000 gereksiz istek demekti. Testi var.
- [x] **Kıymetli maden (LBMA) adapteri** — 24 Ağu 2026
      `market/lbma.ts`. Altın `gold_pm.json`, gümüş `silver.json`, tek adapter.
      2.417 gün altın + 2.435 gün gümüş geri dolduruldu, ikisi de `is_active = true`.
      **Çapraz kontrol:** 2017 Ocak gram altın 133,77 ₺ çıktı, gerçeği ~137 ₺.
      ⚠️ Ons/gram çevrimi tek sabitte ve testli. Buradaki tehlikeli hata
      bariz olan değil: onsu hiç çevirmemek 31 kat sapar ve saniyede fark
      edilir, **mutfak onsunu** (28,349523125) kullanmak yalnızca %10 sapar
      ve asla yakalanmaz. Test iki sonucun ayrıştığını ölçüyor.
- [x] **Varlık listesi 5 → 18'e çıkarıldı** — 21 Ağu 2026
      10 kripto (BTC · ETH · BNB · SOL · XRP · ADA · DOGE · AVAX · LINK · LTC)
      + 8 döviz. `GRAM_ALTIN` kaynağı olmadığı için pasif.

      ⚠️ **ÜÇ VARLIK HER 15 SANİYEDE HATA BASIYORDU.** `price-cron.ts` bütün
      varlıkları Binance'e soruyordu; USD/EUR/GRAM_ALTIN'ın USDT paritesi
      olmadığı için her turda üç `MarketDataError` düşüyordu. Artık
      `asset.kind` kaynağı belirliyor: `crypto` → Binance + kur çevrimi,
      `fx` → doğrudan TCMB. Testi yazıldı, log temiz.

      ⚠️ **`seed.ts` UYDURMA FİYAT YAZIYORDU — kaldırıldı.** BTC/ETH/altın/USD
      için elle yazılmış fiyatları `12:00:00Z` damgasıyla ekliyordu; geri
      doldurma gerçekleri `00:00:00Z` ile yazıyor. `ORDER BY ts DESC LIMIT 1`
      aynı günde 12:00'ı seçer — yani **uydurma fiyat gerçeği eziyordu**.
      Ölçüldü: 12 Mar 2020 BTC tohumda 45.200 ₺, gerçekte 29.521 ₺.
      "Ya alsaydın" ekranının üç hazır düğmesi tam bu üç tarihe denk geliyor.
      Mevcut veritabanında o satırlar yoktu (kontrol edildi: 0 satır), yani
      hata **gizli kalmıştı** — ama seed her çalıştığında geri gelecekti.
      Kural: fiyatın tek kaynağı backfill (geçmiş) + cron (canlı). Tohum
      dosyası fiyata dokunmaz.
      `market/clean-seed-prices.ts` bu satırları arayıp silen betikti.
      **25 Ağu 2026'da SİLİNDİ** — görevini bitirmişti (ölçüldü: temizlenecek
      0 satır) ve durduğu yerde tehlikeliydi.

      ⚠️ **NEDEN TEHLİKELİYDİ — ders bu.** İkinci aşaması şu varsayıma
      dayanıyordu: *"GRAM_ALTIN'a cron hiç yazmıyor, o yüzden oradaki gece
      yarısı olmayan HER satır tohumdandır."* Yazıldığında doğruydu.
      24 Ağu'da LBMA adapteri eklenince `GRAM_ALTIN` aktif bir maden oldu ve
      cron 15 saniyede bir yazmaya başladı. Ölçüldü: `--apply` ile
      çalıştırılsa **1.844 geçerli fiyat kaydı** silinecekti, hata vermeden.

      Kod bozulmadı — **dünyası değişti.** Aynı tuzak `binance.ts`'te de
      uyarılıyor: koda gömülen bir gerçek, dünya değişince sessizce yalan
      söyler. Tek seferlik betikler işi bitince silinmeli.

- [x] **Geri doldurma betiği** — `market/price-backfill.ts`, 21 Ağu 2026
      Artık **18 varlığın hepsini** dolduruyor, iki ayrı akışla:
      döviz → EVDS `TP.DK.{KOD}.A` (her biri 2.421 yayımlanmış → 3.519 güne
      forward-fill), kripto → Binance USD + o günün kuruyla TL'ye çevrim.

      Ölçülen başlangıç tarihleri (koda YAZILMADI, `MIN(ts)`'ten okunacak):
      BTC/ETH 2017-08-17 · BNB 2017-11-06 · LTC 2017-12-13 · ADA 2018-04-17 ·
      XRP 2018-05-04 · LINK 2019-01-16 · DOGE 2019-07-05 · SOL 2020-08-11 ·
      AVAX 2020-09-22

      ⚠️ **Döviz de forward-fill edilmiş hâliyle yazılıyor**, yalnızca
      yayımlanan günler değil. Sebep ileriye dönük: kripto 7/24 işlem görüyor,
      TCMB hafta sonu kur yayımlamıyor. Yalnızca iş günlerini yazsaydık
      "dolar cinsinden göster" özelliği cumartesi `btcFiyatı ÷ usdFiyatı`
      hesabını yapamazdı — bölen o gün yok olurdu.

      ⚠️ Döviz ÖNCE çekiliyor: aynı USD kur haritası hem USD varlığının kendi
      geçmişi, hem de bütün kriptoların TL çevrimi için kullanılıyor.
      USD alınamazsa betik duruyor — kursuz kripto fiyatı yazmaktansa hiç
      yazmamak doğru.
      ⚠️ Kur için TCMB XML yerine **EVDS `TP.DK.USD.A`** kullanıldı: günlük XML
      3.300 ayrı istek demekti, EVDS aynı veriyi yıl başına tek istekle veriyor
      ⚠️ EVDS 1000 gözlem sınırı bitişten geriye işlediği için **yıl yıl** çekiliyor —
      tek istekte sorsaydık sessizce son 1000 günü alır, eksikliği fark etmezdik
      ⚠️ `granularity` kolonu hâlâ yok; günlük satırlar UTC gece yarısına yazılıyor.
      Kolon eklenince bu betik güncellenmeli, yoksa temizlik işi ikisini ayıramaz
      ⚠️ Yeni kripto eklerken başlangıç tarihini ölç: `startTime=0&limit=1`

      **Doğrulandı** — veriler gerçek piyasa geçmişiyle örtüşüyor:
      17 Ara 2017 → 72.277 ₺ (BTC ilk zirvesi) · 12 Mar 2020 → 29.521 ₺ (COVID çöküşü)
      9 Kas 2021 → 648.375 ₺ (BTC zirvesi)
- [x] **TÜFE geri doldurma** — `market/tufe-backfill.ts`, 21 Ağu 2026
      EVDS'den 2003-01 → 2026-07, **283 aylık gözlem** yazıldı.
      Yol boyunca `evds.ts`'te iki hata düzeltildi (ikisini de Faz 0 araştırman yakaladı):
      base URL `evds2.../service/evds` → **`evds3.../igmevdsms-dis`** (eskisi HTML döndürüyordu),
      seri kodu `TP.FG.J0` (arşiv) → **`TP.GENENDEKS.T1`**. Yanıt alanı artık seri kodundan türetiliyor.
      ⚠️ `seed.ts`'teki elle yazılmış TÜFE tablosu yaklaşıktır — 2026-07'de gerçek veriden %3,6 sapıyor.
      Yalnızca EVDS anahtarı olmayan ortam için yedek; gerçek veri backfill'den gelir
- [ ] **`retention.ts`** — günlük özet (23:55) + 7 günden eski dakikalık satırların temizliği (00:05)
      Sıra bağlayıcı: özet önce, silme sonra. Ters olursa veri özetlenmeden gider
- [x] ~~`PricePoint.currency` alanı~~ — **BAŞKA YOLLA ÇÖZÜLDÜ**
      Çift çevrim riski alana değil, cron'daki tür yönlendirmesine bağlandı:
      `asset.kind === 'fx'` ise kur doğrudan yazılıyor, `usdToTry`'a hiç
      girmiyor. Alan eklemek aynı bilgiyi ikinci bir yerde tutmak olurdu.
- [x] **Fiyat grafiği** — 22 Ağu 2026
      ⚠️ `date_trunc` KULLANILMADI: yalnızca sabit birimlerle (hour/day/week)
      çalışıyor, bize 5 dakikalık ve 6 saatlik kova da lazımdı. Epoch'a
      çevirip kova boyutuna bölerek tabana yuvarlamak her ölçüde çalışıyor.
      Üstüne yakınlaştırma da eklendi (`ranges.ts`, `bucketFor`).
- [x] ~~`GET /what-if` + reel getiri~~ — **Zeynep yazdı** (PR #9, 19 Ağu 2026)
      Şerit sınırı aşıldı ama kod çalışıyor ve testli; silmek israf olurdu. Karar: kabul edildi.
      ⚠️ **OKUNACAK — henüz okumadın.** `apps/api/src/what-if/` (service, repository, schema, test).
      Özellikle: reel getiri formülü `(1+nominal)/(1+enflasyon)−1`, TÜFE endeksi kullanımı,
      tutar → miktar çevriminde ölçek matematiği (`calcGross`'un tersi). Kendi şeridinin devamı orası.
      Faz 2'nin kalanı (geri doldurma, grafik, `retention.ts`, varlık detay ekranı) **sende kalıyor**.
- [x] **Varlık detay ekranı** — 22-24 Ağu 2026
      Grafik, aralık düğmeleri, dokunmalı fiyat okuma, iki parmakla
      yakınlaştırma, 24 saat özeti (yüksek/düşük/açılış/kapanış), canlı fiyat.
      ⚠️ **Karar notu alanı hâlâ YOK** — "bunu neden aldım" notu. Ayrı madde
      olarak aşağıda duruyor.
- [x] **ABD hisseleri (30 sembol)** — 26 Ağu 2026
      Yahoo Finance adaptörü, seans takvimi, `MARKET_CLOSED` kuralı.
      ⚠️ Migration bekliyor: `ALTER TYPE asset_kind ADD VALUE 'stock'` (Zeynep).
      ⚠️ Geri doldurma o migration'dan SONRA çalıştırılacak: `[4/4]` aşaması
      30 × 2.425 = ~72.750 satır yazacak (~10 MB).
- [ ] Karar notu alanı — emir verirken "neden" yazılabilsin, sonra geri okunsun
      ⚠️ **"Şema değişikliği gerektiriyor → Zeynep" NOTU YANLIŞTI** (27 Ağu 2026'da
      kontrol edildi). `orders.note` kolonu veritabanında, `schema.ts`'te, Zod
      şemasında ve emir motorunda ZATEN VAR; `POST /orders` notu kabul ediyor.
      Migration gerekmiyor, tamamı senin şeridinde. Eksik üç parça:
        1. `getRecentOrders` `note`'u seçmiyor → `GET /orders` dönmüyor (1 satır)
        2. Al/Sat ekranında not alanı yok
        3. Cüzdan'daki "SON İŞLEMLER" notu göstermiyor
      Veritabanında 33 emir var, 0'ı notlu — çünkü not girecek yer yok.
      Ayrıntı: `docs/03-kalan-isler.md` C1.

---

## Kendine sorman gereken sorular

Bu proje portfolyo için. Her görevden sonra şunu yazabildiğinden emin ol:

- Bu parçada hangi problemi çözdüm ve **neden başka türlü olmazdı?**
- Nerede tıkandım, nasıl çıktım?
- Bu kodu ikiye katlanan kullanıcıyla ne bozar?

Bunları not al. Mülakatta "en zorlandığın şey neydi" sorusunun cevabı bu notlarda.
