# 📊 Günlük Çalışma & İlerleme Raporu

* **Geliştirici:** Zeynep Yüksel
* **Rol / Sorumluluk:** Şerit B — Kimlik, Sosyal, Veritabanı Altyapısı & Lig Hakemliği
* **Tarih:** 17 Ağustos 2026
* **Proje:** Portföy Ligi (`portfolio-league`)

---

## 🎯 1. Bugün Neler Tamamlandı?

### 🔐 A. Güvenli Kimlik Doğrulama & Oturum Yönetimi (`apps/api/src/auth/`)
- [x] **Kullanıcı Kaydı (`POST /auth/register`):** 
  - Şifreler düz metin yerine dünyanın en güvenli şifreleme standardı olan **Argon2id** ile hash'lendi.
  - Tek bir **SQL Transaction** içinde atomik olarak kullanıcı profili, 100.000 TL bakiye hesabı ve ilk kayıt dekontu oluşturuldu.
- [x] **Kullanıcı Girişi (`POST /auth/login`):** Argon2 doğrulaması ile kullanıcıya 15 dakikalık **JWT Access Token** ve 30 günlük **Refresh Token** üretildi.
- [x] **Oturum Yenileme (`POST /auth/refresh`):** Güvenli **Refresh Token Rotasyonu** kuruldu (Eski token iptal edilip yerine tek kullanımlık yeni token verilir).
- [x] **Oturum Kapatma (`POST /auth/logout`):** Refresh token veritabanında geçersiz kılındı (`revokedAt`).
- [x] **Profil Alma (`GET /me`):** `requireAccessToken` middleware'i ile korunan profil endpoint'i yazıldı.

---

### 💰 B. Kasa, Dekont & Bonus Modülü (`apps/api/src/bonus/` & `src/db/`)
- [x] **`cash_movements` Tablosu:** Cüzdandaki her para hareketini (kayıt bonusu, günlük bonus, alım, satım, komisyon) banka ekstresi gibi tutan omurga tablo oluşturuldu.
- [x] **Kayıt Bonusu Entegrasyonu:** Kullanıcı kaydolduğunda 100.000 TL (`10000000n` kuruş) bakiye `signup_bonus` olarak ekstreye bağlandı.
- [x] **Günlük Bonus Talebi (`POST /bonus/daily`):** Kullanıcıya her gün 1.000 TL (`100000n` kuruş) bakiye ekleyen servis yazıldı.
- [x] **24 Saat Suistimal Koruması:** Kullanıcı 24 saat dolmadan tekrar basarsa `409 Conflict` hatasıyla engellendi.
- [x] **Hesap Dökümü (`GET /bonus/movements`):** Kullanıcının tüm geçmiş para giriş/çıkışlarını listeleyen endpoint yazıldı.

---

### 🧮 C. TWR (Zaman Ağırlıklı Getiri) Matematik Motoru (`packages/contracts/`)
- [x] **`twr.ts` Saf Fonksiyonu:** Günlük bonusların getiri oranını yapay olarak şişirmesini engelleyen, alt dönemleri bölüp birbirine çarpan $\text{TWR} = \prod (1 + r_i) - 1$ matematik motoru yazıldı.
- [x] **`formatTwrPercent`:** Yüzdeleri ekranda kullanıcı dostu basan (`+39.62%`, `-28.00%`, `%0.00`) yardımcı fonksiyon yazıldı.
- [x] **6 Kritik Birim Testi (`twr.test.ts`):** Tek dönemli, çok dönemli, bonus toplayıp işlem yapmayan (0.00%), zarar senaryoları test edildi ve geçti.

---

### ⚙️ D. Altyapı, Tip Güvenliği & Git Entegrasyonu
- [x] **Drizzle ORM Migration:** `0001_complex_risque.sql` migration'ı üretildi ve Docker'daki PostgreSQL veritabanına uygulandı.
- [x] **Strict TypeScript:** `apps/api/tsconfig.json` ana `tsconfig.base.json`'a bağlandı (`extends`).
- [x] **Git & Merge:** `feature/auth` dalı açıldı, Batuhan'ın `money.ts` commit'leri ile çakışmalar çözülerek birleştirildi ve GitHub'da **Pull Request #1** açıldı.

---

## 💡 2. Alınan Mimari & Mühendislik Kararları (Mülakat Notları)

1. **Neden `bigint` ve Kuruş?**
   - Kayan noktalı sayıların (`0.1 + 0.2 !== 0.3`) IEEE 754 sapmalarından kaçınmak ve finansal verilerde mutlak tam sayı hassasiyeti sağlamak için tüm paralar kuruş cinsinden tutuldu.
2. **Neden SQL Transaction?**
   - Kullanıcı oluşurken elektrik veya internet kesilirse kullanıcının parasız (hayalet hesap) kalmasını engellemek için *"Ya hepsi eksiksiz oluşur ya da hiçbiri oluşmaz"* ilkesi uygulandı.
3. **Neden İki Farklı Token (Access + Refresh)?**
   - Access Token (15 dk) ile hız ve güvenlik sağlanırken, Refresh Token (30 gün) ile kullanıcının her 15 dakikada bir şifre girmek zorunda kalması engellendi.
4. **Neden TWR Formülü?**
   - Ligi sadece bakiye büyüklüğüne göre sıralasaydık 6 ay önce kaydolan hep kazanırdı. TWR ile bonusların etkisi arındırıldı ve sadece saf yatırım başarısı ölçüldü.

---

## 🧪 3. Test ve Doğrulama Sonuçları

```text
✓ packages/contracts/src/twr.test.ts (6 tests)
✓ apps/api/src/lib/money.test.ts     (9 tests)

Test Files:  2 passed (2)
     Tests:  15 passed (15) - 0.43s
 Typecheck:  0 errors across all workspaces (API, Contracts, Mobile)
```

- [x] Thunder Client ile tüm Auth ve Bonus akışları elle test edildi ve doğrulandı.

---

## 🚀 4. Sırada Ne Var? (Yarının Planı)

1. **Arkadaşlık Modülü (`friendships`):** İstek gönderme, kabul etme, arkadaş listeleme.
2. **Haftalık Lig & Liderlik Tablosu (`leagues`):** Haftalık dönem yönetimi, `GET /leagues/current/leaderboard` sıralaması.
