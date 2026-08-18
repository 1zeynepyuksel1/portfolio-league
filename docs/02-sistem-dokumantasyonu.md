# 📘 Portföy Ligi (Portfolio League) — Kapsamlı Sistem ve Mimari Dokümantasyonu

Bu döküman, projemizde bugüne kadar geliştirilen tüm modülleri, kullanılan teknolojileri ve kütüphaneleri, neden o kütüphaneleri seçtiğimizi, veritabanı yapısını, tip güvenliği kurallarını ve kritik mühendislik kararlarını detaylı olarak açıklamaktadır.

---

## 🛠️ 1. Teknoloji Yığını ve Kütüphane Tercihleri

| Kütüphane / Araç | Sürüm | Ne İçin Kullanıldı? | Neden Bu Kütüphane Seçildi? |
|---|---|---|---|
| **TypeScript** | `^5.7` | Dil ve Derleyici | `strict: true` ve `noUncheckedIndexedAccess` kurallarıyla tam tip güvenliği sağlamak, çalışma anı (runtime) hatalarını derleme aşamasında yakalamak için. |
| **Express.js** | `^4.21` | HTTP Web Sunucusu | Node.js ekosisteminin en kararlı, hafif, modüler ve sektör standardı yönlendiricisi (Router) olduğu için. |
| **Drizzle ORM** | `^0.39` | Veritabanı Katmanı & Migration | Prisma gibi ağır ve bellek harcayan bir engine yerine, doğrudan SQL'e derlenen, sıfır çalışma anı yükü olan ve tam TypeScript uyumlu en modern ORM olduğu için. |
| **PostgreSQL (`postgres`)** | `^3.4` | İlişkisel Veritabanı & Sürücü | Finansal verilerde ACID (Atomiklik, Tutarlılık, İzolasyon, Dayanıklılık) garantisi, `CHECK` kısıtları ve `numeric(28,10)` hassasiyeti için. |
| **Zod** | `^3.24` | Girdi Doğrulama (Validation) | Dış dünyadan (HTTP body/params) gelen verileri kapıda denetlemek, tip çıkarımı (`z.infer`) yapmak ve veriyi güvenle dönüştürmek (`trim`, `toLowerCase`, `uuid`) için. |
| **Argon2 (`argon2`)** | `^0.41` | Şifre Hashleme | OWASP ve uluslararası kriptografi otoritelerinin tavsiye ettiği, GPU ve ASIC donanımlı hacker saldırılarına karşı bellek-zorlu (memory-hard) **Argon2id** standardını kullandığı için. |
| **JOSE (`jose`)** | `^5.9` | JWT (JSON Web Token) | Eski `jsonwebtoken` kütüphanesine göre modern WebCrypto API standartlarına tam uyumlu, hafif, asenkron ve `HS256` dijital imzalarını kusursuz işlediği için. |
| **Node.js Crypto (`node:crypto`)** | Yerleşik | Kriptografik Rastgelelik & SHA-256 | Kırılması imkânsız 32-baytlık oturum anahtarları üretmek (`randomBytes`) ve bunları veritabanına yazmadan önce tek yönlü özetlemek (`createHash('sha256')`) için. |
| **Vitest** | `^3.2` | Otomatik Birim & Entegrasyon Testleri | Jest'e göre 10 kat daha hızlı çalışan, TypeScript'i doğrudan yerel olarak tanıyan ve mock desteği mükemmel olan test kütüphanesi olduğu için. |

---

## 🗄️ 2. Veritabanı Mimarisi (9 Tablo & 3 Enum)

PostgreSQL veritabanımız Drizzle ORM ile 5 migration (`0000` - `0004`) halinde versiyonlanmıştır:

```text
[users] ──(1'e 1)──► [accounts] (Kasa: cash_cents >= 0)
   │
   ├──(1'e Çok)──► [refresh_tokens] (Oturumlar: SHA-256 Hash)
   │
   ├──(1'e Çok)──► [cash_movements] (Banka Dekontları / Ekstre)
   │
   ├──(Çok'a Çok)──► [friendships] (Arkadaşlıklar: pending / accepted)
   │
   ├──(1'e Çok)──► [orders] (Alım/Satım Fişleri & Idempotency)
   │
   └──(Çok'a Çok)──► [holdings] (Varlık Cüzdanı: BTC, Altın, USD >= 0)
                        │
                        ▼
                   [assets] (Varlık Kataloğu & sort_order)
                        │
                        ▼
                 [price_history] (Dakikalık TL Fiyat Kayıtları)
```

### Tablolar ve Görevleri:
1. **`users`**: Kullanıcı kimlikleri (UUID, e-posta, Argon2 şifre hash'i, takma isim, profil gizlilik durumu).
2. **`accounts`**: Kullanıcının nakit TL kasası (`cash_cents bigint`, `CHECK cash_cents >= 0`, varsayılan 100.000 TL).
3. **`refresh_tokens`**: 30 günlük oturum anahtarlarının SHA-256 özetleri ve iptal tarihleri (`revoked_at`).
4. **`cash_movements`**: Cüzdana giren/çıkan her kuruşun değişmez resmi dekontu (`signup_bonus`, `daily_bonus`, `buy`, `sell`, `fee`).
5. **`assets`**: Desteklenen enstrümanlar (`BTC`, `ETH`, `USD`, `EUR`, `GRAM_ALTIN`) ve vitrin sıralaması (`sort_order`).
6. **`price_history`**: Canlı dakikalık TL fiyat arşivi (`numeric(24,8)`).
7. **`holdings`**: Kimin elinde kaç adet varlık olduğunu tutan cüzdan (`numeric(28,10)`, `CHECK quantity >= 0`).
8. **`orders`**: Verilen tüm alım-satım emirlerinin resmi kaydı ve mükerrer emir engeli (`UNIQUE(user_id, idempotency_key)`).
9. **`friendships`**: Kullanıcılar arasındaki sosyal bağlantılar (`pending`, `accepted`, `blocked`).

---

## 🧩 3. Modül Modül Geliştirilen Özellikler

### 🔐 A. Kimlik ve Güvenlik Modülü (`auth/`)
* **Kayıt Olma (`POST /auth/register`):** Tek bir SQL Transaction içinde kullanıcıyı açar, 100.000 TL bakiye tanımlar, kayıt bonusu dekontunu yazar ve oturum başlatır.
* **Giriş Yapma (`POST /auth/login`):** Kullanıcı varlığı veya şifre hatasında tek bir genel hata mesajı (`InvalidCredentialsError`) dönerek *User Enumeration (Kullanıcı Sayma)* saldırılarını engeller.
* **Token Rotasyonu (`POST /auth/refresh`):** 15 dakikalık Access Token bittiğinde eski Refresh Token'ı anında iptal edip yerine yenisini verir. Çalınan token'ların tekrar kullanılmasını engeller.
* **Çıkış Yapma (`POST /auth/logout`):** Refresh Token'ı veritabanında `revoked_at` ile kalıcı olarak öldürür.
* **Profil Kapısı (`GET /me`):** `requireAccessToken` middleware'i ile gelen JWT'yi doğrular ve kullanıcı profilini döner.

### 💰 B. Kasa ve Günlük Bonus Modülü (`bonus/`)
* **24 Saat Kuralı (`POST /bonus/daily`):** Kullanıcının son 24 saat içinde bonus alıp almadığını milisaniye hassasiyetinde kontrol eder. Almışsa `409 Conflict` döner.
* **Atomik Bakiye Ekleme:** `accounts.cashCents` bakiyesine 1.000 TL (100.000 kuruş) eklerken eş zamanlı olarak `cash_movements` tablosuna dekont kaydeder.
* **Ekstre Listeleme (`GET /bonus/movements`):** Kullanıcının tüm finansal hareketlerini tarihe göre ters sırada listeler.

### 👥 C. Sosyal Katman: Arkadaşlık Modülü (`friends/`)
* **İstek Gönderme (`POST /friends/requests`):** Kendine istek atmayı, sistemde olmayan kullanıcıyı veya mükerrer istekleri engeller.
* **Onaylama & Reddetme (`POST /requests/:id/accept`, `reject`):** Sadece isteğin hedefindeki kullanıcının işlem yapabilmesini denetler (`UnauthorizedFriendActionError` - 403).
* **Çift Yönlü Arkadaş Listesi (`GET /friends`):** Hem gönderilen hem alınan onaylanmış arkadaşlıkları tek bir sorguda birleştirir.
* **Arkadaşlıktan Çıkarma (`DELETE /friends/:id`):** İlişkiyi siler.

### 📈 D. Piyasa ve Dış Entegrasyon Modülü (`market/` & `lib/fx.ts`)
* **Binance Entegrasyonu (`binance.ts`):** `BTCUSDT` ve `ETHUSDT` fiyatlarını 1000'er mumluk sayfalama (pagination) ile çeker.
* **Merkez Bankası Entegrasyonu (`tcmb.ts`):** Günlük resmi TCMB XML bültenini okur. Hafta sonu ve resmi tatillerde geriye doğru arama (Forward-fill, `MAX_LOOKBACK_DAYS = 10`) yaparak son Cuma kurunu kullanır.
* **Döviz Çevirici (`fx.ts`):** Binance'ten gelen dolar fiyatı ile TCMB kurunu çarparak saf TL fiyatını üretir.

### 🧮 E. Lig Sıralaması ve Getiri Modülü (`contracts/src/twr.ts`)
* **Zaman Ağırlıklı Getiri (TWR):** Nakit girişlerini (bonusları) kâr/zarar saymayan adalet formülü:
  $$\text{TWR} = \prod_{i=1}^n (1 + r_i) - 1$$
* **Türkçe Finansal Formatlama:** Getiri oranlarını Türkçe standartlarında ekrana basar: `+%39,63`, `-%4,13`, `%0,00`.

---

## 💎 4. Kritik Mühendislik Kuralları ve Tip Güvenliği

### 1. Parada Float Yasağı & `bigint` Kuruş Kuralı
JavaScript'teki `0.1 + 0.2 === 0.30000000000000004` kayan nokta hatası yüzünden sistemde para ASLA `number` ile tutulmaz.
* $100.000\text{ TL} = 10.000.000\text{ Kuruş } (10000000\text{n } \text{bigint})$.

### 2. Markalı Tipler (Branded Types - `lib/money.ts`)
Farklı ölçeklerdeki tam sayıların birbirine yanlışlıkla toplanmasını TypeScript derleme anında engeller:
* `Penny`: Kuruş ($10^2$ ölçekli)
* `Price`: Fiyat ($10^8$ ölçekli)
* `Amount`: Varlık Miktarı ($10^{10}$ ölçekli)

### 3. `divRound` (ROUND_HALF_UP Yuvarlama)
`bigint` bölmesi virgülden sonrasını attığı (`7n / 2n === 3n`) için, tüm bölmeler `divRound` fonksiyonu ile ticari standarda (`2.5 -> 3`) göre yuvarlanır.

### 4. Üç Katmanlı Savunma (Defense in Depth)
1. **1. Katman (Giriş):** Zod şemaları formatı ve türü denetler.
2. **2. Katman (İş Mantığı):** Servis fonksiyonları bakiyeyi ve kuralları kontrol eder.
3. **3. Katman (Veritabanı):** PostgreSQL `CHECK (cash_cents >= 0)` ve `CHECK (quantity >= 0)` kısıtları sayesinde kodda hata olsa bile bakiye fiziksel olarak eksiye düşemez.

### 5. Çift Token & Kriptografik Güvenlik Mimarisi
* **Access Token:** 15 dakikalık, `jose` ile `HS256` imzalı JWT.
* **Refresh Token:** 32-bayt CSPRNG rastgele anahtar; veritabanında sadece **SHA-256 Hash**'i saklanır.
* **Şifreler:** Sadece **Argon2id** ile tuzlanmış (salted) hash olarak tutulur.

---

## 🧪 5. Otomatik Test Güvencesi (59 Test)

Projemizde `npm test` komutuyla çalışan 7 test dosyasında toplam **59 test** bulunmaktadır:

* ✅ **`friends.test.ts` (10 test):** E-posta küçük harf çevrimi, kendine istek atamama, mükerrer istekler ve hata durum kodları.
* ✅ **`token.test.ts` (8 test):** JWT üretimi, imza doğrulama, tahrif edilmiş (tampered) token reddi, Argon2 şifreleme ve SHA-256.
* ✅ **`binance.test.ts` (12 test):** 1000 mumluk sayfalama, UTC zaman dönüşümü, HTTP hata yakalama.
* ✅ **`tcmb.test.ts` (9 test):** XML ayrıştırma, hafta sonu geriye gitme (forward-fill), önbellek (cache) mekanizması.
* ✅ **`money.test.ts` (9 test):** Kuruş aritmetiği, `divRound`, `formatTRY` Türkçe para metni (`12.345,67 ₺`).
* ✅ **`twr.test.ts` (6 test):** Çok dönemli TWR formülü, sadece bonus toplayanın `%0,00` çıkması, Türkçe yüzde formatı (`+%39,62`).
* ✅ **`fx.test.ts` (5 test):** Dolar/TL çarpımı ve ölçek yuvarlaması.

---

*Bu dökümantasyon projenin ana kaynağı olup, geliştirilen yeni özelliklerle birlikte güncellenmeye devam edecektir.*
