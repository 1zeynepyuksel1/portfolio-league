# Görev Paylaşımı

Plan: [01-plan.md](01-plan.md) · Kişisel listeler: [batuhan.md](batuhan.md) · [zeynep.md](zeynep.md)

---

## Temel kural: katmana göre değil, dikey şeride göre

Klasik ikili bölünme "biri backend, biri frontend"tir. Onu yapmıyoruz. İkimiz de SQL yazıyoruz, ikimiz de API route yazıyoruz, ikimiz de React Native yazıyoruz — **farklı alanlarda.**

İki nedeni var:

1. **Öğrenme.** Amaç backend/frontend/API mantığını öğrenmek. Biri sadece ekran yazarsa API'yi hiç öğrenmez.
2. **Bağımlılık.** Katmana bölünürsen frontend'ci sürekli backend'ciyi bekler. Dikey bölünürsen ikiniz de kendi başınıza uçtan uca ilerlersiniz.

---

## Şeritler

| | **Şerit A — Piyasa & Portföy** | **Şerit B — Kimlik & Sosyal** |
|---|---|---|
| **Kim** | Batuhan | Zeynep |
| **Uçtan uca sorumlu** | Dış fiyat verisi → emir → portföy değeri → ekran | Kayıt → kimlik → arkadaş → lig sıralaması → ekran |
| **Sahip olduğu klasörler** | `apps/api/src/market/`<br>`apps/api/src/orders/`<br>`apps/api/src/portfolio/`<br>`apps/mobile/src/screens/market/`<br>`apps/mobile/src/screens/portfolio/` | `apps/api/src/auth/`<br>`apps/api/src/social/`<br>`apps/api/src/league/`<br>`apps/api/db/` (migration'lar)<br>`apps/mobile/src/screens/auth/`<br>`apps/mobile/src/screens/league/`<br>`apps/mobile/src/app/` (navigasyon, tema) |
| **Dokunmadığı** | Şerit B klasörleri, migration'lar | Şerit A klasörleri |

Klasör adları kesin değil — iskeleti kurarken netleşecek. Değişmeyen şey **her klasörün tek sahibi olması.**

---

## Paylaşılan alanlar ve kuralları

### `packages/contracts` — tek paylaşılan paket

API ile mobil arasındaki tipler ve para aritmetiği burada. `money.ts`, `twr.ts` gibi saf fonksiyonlar da burada yaşar.

**Kural: tek başına değiştirilmez.** Bir tip değişecekse ikiniz de onaylar, tek PR'da gider. Sebep: bu paket iki şeridin sözleşmesi. Biri sessizce değiştirirse diğerinin kodu derlenmez ve nedeni belli olmaz.

### `apps/api/db/` — migration'lar

Tek sahibi **Zeynep.** Batuhan'ın tabloya ihtiyacı olursa Zeynep'e söyler, Zeynep yazar, Batuhan review eder.

Sebep: iki kişinin aynı anda migration yazması sıra çakışması ve çözülmesi sinir bozucu conflict'ler üretir.

---

## Faz faz dağılım

### Faz 0 · Temel

| İş | Kim |
|---|---|
| Veri sağlayıcılarını doğrula (kripto ✅ döviz ✅ altın ⏳ TÜFE ⏳) | Batuhan |
| Monorepo iskeleti, TS strict, lint, vitest, git | Zeynep |
| Docker ile local Postgres + Drizzle kurulumu | Zeynep |
| `packages/contracts` — paylaşılan tipler | **İkisi birlikte, aynı oturumda** |
| `money.ts` + testleri | Batuhan |
| Boş API deploy + Expo Go ile boş app açılıyor | Zeynep |

**Bitiş:** İkiniz de local'de çalıştırıyor · API canlıda · şema kurulu · para testleri geçiyor · veri kaynakları doğrulanmış.

### Faz 1 · Yürüyen iskelet

| Batuhan (Şerit A) | Zeynep (Şerit B) |
|---|---|
| `MarketDataProvider` arayüzü + Binance adapter | JWT auth: register / login / refresh |
| TCMB FX adapter + forward-fill kuralı | Kayıtta 100.000 TL bakiye |
| Fiyat çekme cron'u + `price_history` | Günlük 1.000 TL bonus cron'u + `cash_movements` |
| `GET /assets` | Giriş ve Kayıt ekranları |
| **Emir motoru** (transaction, idempotency, komisyon) | Mobil kabuk: navigasyon, tema, API istemcisi, ortak bileşenler |
| `GET /portfolio` + Piyasa ve Portföy ekranları | |

**Bitiş:** Kayıt ol → 100.000 TL gör → BTC al → portföyde görün → uygulamayı kapat aç → duruyor. Eşzamanlı iki emir testi geçiyor.

### Faz 2 · Ürün

| Batuhan | Zeynep |
|---|---|
| Döviz + altın adapterları | Haftalık lig: dönem yönetimi, kapanış cron'u |
| Fiyat grafiği | **TWR hesabı** + sıralama |
| `GET /what-if` + reel getiri + TÜFE verisi | Arkadaşlık akışı (istek, kabul, listeleme) |
| Varlık detay ekranı + karar notu alanı | Lig ve Arkadaşlar ekranları |

**Bitiş:** İki gerçek hesap arkadaş oluyor, haftalık ligde birbirini yüzde getiriye göre görüyor, sıralama sunucuda hesaplanıyor.

### Faz 3 · Derinlik — takvime alınmadı

Faz 2 bitince yeniden planlanacak.

---

## Çalışma kuralları

**Dal ve birleştirme.** Herkes kendi dalında çalışır (`feature/emir-motoru` gibi), `main`'e PR ile girer. Karşı şeridin PR'ını en az bir kez okuyun — kodu anlamasanız bile "burada ne oluyor" sorusunu sorun. Öğrenmenin yarısı orada.

**Tamamlandı sayılma kriteri.** Bir görev şunlar olmadan bitmiş sayılmaz:
- [ ] Çalışıyor ve local'de elle test edildi
- [ ] Tip hatası ve lint hatası yok
- [ ] Hata durumu ve yükleniyor durumu var
- [ ] Telefonda bozuk değil
- [ ] Kritik mantık için test var (para, emir, TWR)
- [ ] Yeni tablo eklendiyse migration yazıldı

**Tıkandığında.** Yarım saatten fazla aynı hatada kalma. Ya karşı tarafa sor, ya buraya yaz. Tıkandığın yeri not al — mülakatta "en zorlandığın şey neydi" sorusunun cevabı orada.

**Sır yönetimi.** API anahtarları (EVDS, JWT secret, DB şifresi) `.env` dosyasında. `.gitignore`'da `.env` olduğundan emin olmadan hiçbir anahtarı dosyaya yazma. `.env.example` dosyasına sadece anahtar **isimlerini** koy, değerlerini değil.
