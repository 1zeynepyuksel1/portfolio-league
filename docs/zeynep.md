# Zeynep — Şerit B · Kimlik & Sosyal

Plan: [01-plan.md](01-plan.md) · İş bölümü: [02-gorev-paylasimi.md](02-gorev-paylasimi.md)

**Uçtan uca sorumluluğun:** Kayıt → kimlik → arkadaş → lig sıralaması → ekran.

Bu şeritte projenin iki değerli parçası var: **kendi yazdığın JWT auth'u** (API mantığının en öğretici kısmı) ve **TWR hesabı** (ligin adaletini sağlayan matematik). İkisi de mülakatta anlatılacak şeyler.

Ayrıca veritabanı migration'larının tek sahibi sensin — Batuhan tabloya ihtiyaç duyarsa sana söyler.

---

## 🔴 Şu anki görev · Monorepo iskeleti

**Hedef:** Kökten `npm install` çalışsın, `npm test` çalışsın, TypeScript strict açık olsun, `packages/contracts` paketi hem API hem mobil tarafından import edilebilsin.

**Neden monorepo:** `contracts` paketi (paylaşılan tipler + para aritmetiği) iki tarafın da kullandığı tek kaynak. Ayrı repo olsaydı her tip değişikliğinde publish ve sürüm derdi çıkardı.

**Kuracağın yapı:**
```
portfoy-ligi/
  package.json          ← workspace kökü
  tsconfig.base.json
  .gitignore
  packages/contracts/
  apps/api/             ← şimdilik boş
  apps/mobile/          ← şimdilik boş
```

**Araştır:**
- **npm workspaces** — kök `package.json`'daki `workspaces` alanı nasıl çalışıyor, kökten `npm install` çalışınca ne oluyor, bir workspace paketini başka paketten nasıl import ediyorsun
- **`"type": "module"`** ne değiştiriyor — ESM ile CommonJS farkı. Node 25 kullanıyoruz, bu kararı bilerek ver
- **tsconfig strict altındaki ek bayraklar** — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`. Her birinin **hangi hatayı yakaladığını** öğrenerek ekle. Kopyalayıp geçme; sonra "bu neden hata veriyor" diye saatler kaybedersin
- **vitest** neden jest yerine

**İki tuzak:**

1. **`moduleResolution` seçimi.** `node` eski ve ESM'de yanlış davranıyor. `bundler` ile `nodenext` arasında seçeceksin. Fark şu: `nodenext` seçersen TypeScript yazmana rağmen relative import'larda `.js` uzantısı yazmak zorundasın (`./money.js`, dosya `money.ts` olsa bile). `bundler` seçersen yazmıyorsun. Hangisini seçtiğini **bilerek** seç.

2. **Workspace paket adı.** `contracts` yerine `@portfoy-ligi/contracts` gibi kapsamlı (scoped) isim kullan — npm'deki gerçek paketlerle çakışma riski kalmaz.

**Bitti sayılır:**
- [ ] `npm install` kökten hatasız
- [ ] `npx tsc --noEmit` geçiyor
- [ ] `npm test` çalışıyor (test yoksa hata vermeden "test yok" demeli)
- [ ] `git init` yapılmış, `.gitignore`'da `node_modules/` ve `.env` var, ilk commit atılmış

---

## Faz 0 · kalan görevlerin

### Docker ile local Postgres + Drizzle
- [ ] `docker-compose.yml` ile local Postgres ayağa kalksın (Docker kurulu, psql client'a gerek yok)
- [ ] Drizzle kurulumu ve ilk migration akışı
- [ ] `.env.example` — anahtar **isimleri** yazılır, değerleri değil

**Araştır:** Drizzle şema tanımı nasıl yazılıyor, migration nasıl üretilip uygulanıyor, `numeric` ve `bigint` sütunları TypeScript tarafında nasıl temsil ediliyor (bu önemli — `number`'a düşerse para bozulur).

### `packages/contracts` tipleri
*(Batuhan ile birlikte, aynı oturumda)*

### Boş API deploy + Expo Go
- [ ] Boş Express API'yi Railway/Render'a deploy et
- [ ] Boş Expo uygulaması telefonda Expo Go ile açılsın

---

## Faz 1 · yol haritan

- [ ] **JWT auth**: register / login / refresh / logout
- [ ] Kayıtta 100.000 TL bakiye
- [ ] Günlük 1.000 TL bonus cron'u + `cash_movements`
- [ ] Giriş ve Kayıt ekranları
- [ ] Mobil kabuk: navigasyon, tema, API istemcisi, ortak bileşenler

### Auth hakkında şimdiden bilmen gerekenler

Hazır auth kullanmıyoruz çünkü "API mantığını kavramak" hedefinin en öğretici parçası bu.

Araştırman gerekenler:
- **Access token ve refresh token neden ikisi birden var?** Access kısa ömürlü, refresh uzun — neden?
- **Şifre hash'leme**: argon2 veya bcrypt. Neden düz saklanmaz, neden md5/sha256 yetmez, "salt" ne işe yarar
- **Refresh token nerede saklanır**, çalınırsa ne olur, iptal (revoke) nasıl yapılır
- Token'ı mobilde nerede tutmalı (`AsyncStorage` mi `SecureStore` mu — ve neden)

**Tuzak:** JWT secret'ı koda gömme. `.env`'de dursun ve `.gitignore`'da `.env` olduğundan emin ol.

---

## Faz 2 · sende olanlar

- [ ] **Haftalık lig**: dönem yönetimi, kapanış cron'u
- [ ] **TWR hesabı** + sıralama
- [ ] Arkadaşlık akışı (istek, kabul, listeleme)
- [ ] Lig ve Arkadaşlar ekranları

### TWR neden önemli

Ligi mutlak bakiyeye göre sıralasaydık, 6 ay önce kaydolup her gün bonus toplayan biri, iyi yatırım yapan yeni kullanıcıyı otomatik yenerdi. Lig "kim erken geldi"yi ölçerdi.

Naif `(şimdiki / başlangıç) - 1` de yanlış: günlük bonusu kazanç sanar. Doğrusu dönemi her para girişinde bölmek — **zaman ağırlıklı getiri (TWR)**. Gerçek fon performansı böyle ölçülür.

Formül ve ayrıntı: [01-plan.md § 8.2](01-plan.md)

Saf fonksiyon olarak yaz — veritabanına dokunmasın, girdi olarak snapshot dizisi alsın. Böylece elle hesapladığın vakalarla test edebilirsin. Bu hesap yanlış olursa lig anlamsızlaşır ve **fark edilmesi çok zordur**, o yüzden testleri ciddiye al.

---

## Kendine sorman gereken sorular

Bu proje portfolyo için. Her görevden sonra şunu yazabildiğinden emin ol:

- Bu parçada hangi problemi çözdüm ve **neden başka türlü olmazdı?**
- Nerede tıkandım, nasıl çıktım?
- Bu kodu ikiye katlanan kullanıcıyla ne bozar?

Bunları not al. Mülakatta "en zorlandığın şey neydi" sorusunun cevabı bu notlarda.
