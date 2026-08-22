# Batuhan — Şerit A · Piyasa & Portföy

Plan: [01-plan.md](01-plan.md) · İş bölümü: [02-gorev-paylasimi.md](02-gorev-paylasimi.md)

**Uçtan uca sorumluluğun:** Dış fiyat verisi → emir → portföy değeri → ekran.

Bu şerit projenin "backend gerçekten bir şey hesaplıyor" tarafı. Emir motoru ve para aritmetiği mülakatta anlatacağın şeyler.

---

## 📖 OKUMA BORCU — henüz okumadığın dosyalar

CLAUDE.md'nin en önemli kuralı: *yazılan her satırın **neden** öyle olduğunu anlatabilmelisin.*
Aşağıdakiler yazıldı ve çalışıyor ama sen okumadın. Tasarım işi bitince buraya dön.

### 1. Döviz ve varlık listesi genişlemesi — 21 Ağu 2026
| Dosya | Ne sorulacak |
|---|---|
| `market/tcmb.ts` | `FX_UNITS` neden var? JPY neden 100'e bölünüyor? Önbellek neden kuru değil **belgeyi** tutuyor? `parseRate` neden önce `<Currency>` bloğunu izole ediyor? |
| `market/tcmb.test.ts` | "kur boşsa sonraki para biriminin kuruna sızmaz" testi hangi hatayı kilitliyor? |
| `market/evds.ts` | `fetchFxHistory` neden `Price` döndürüyor, ham metin değil? Seri kalıbı `TP.DK.{KOD}.A`'daki `.A` ne demek? |
| `market/price-cron.ts` | `asset.kind === 'fx'` dallanması neden eklendi? Öncesinde ne oluyordu? |
| `market/price-backfill.ts` | Döviz neden kriptodan **önce** çekiliyor? Döviz neden forward-fill edilmiş hâliyle yazılıyor? |
| `market/repository.ts` | `AssetKind` neden `$inferSelect`'ten türetiliyor, elle yazılmıyor? |
| `market/seed.ts` | Fiyat tohumlaması neden tamamen kaldırıldı? `INACTIVE_SYMBOLS` neden ayrı bir UPDATE gerektiriyor? |
| `market/clean-seed-prices.ts` | Ölçüt neden tarihe değil **saate** göre? |

### 2. Ayar yükleme ve hata görünürlüğü — 21 Ağu 2026
Bu ikisi **gerçek bir hata ayıklama oturumunun bedeliydi**: kayıt ve giriş
500 veriyordu, `/assets` çalışıyordu, sebebi yarım saat görünmedi.

| Dosya | Ne sorulacak |
|---|---|
| `lib/env.ts` | `.env` neden `import.meta.url`'den bulunuyor, `dotenv/config`'ten değil? `npm run dev:api` ile `npx tsx apps/api/src/server.ts` arasındaki fark neydi? `requireEnv` neden yedek değer kabul etmiyor? |
| `auth/router.ts` | `logUnexpected` neden eklendi? İstemciye giden mesaj neden **değişmedi**? |

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

### 4. `apps/api/src/what-if/` — Zeynep yazdı, sen hâlâ okumadın
Reel getiri formülü `(1+nominal)/(1+enflasyon)−1`, TÜFE endeksi kullanımı,
tutar → miktar çevriminde ölçek matematiği (`calcGross`'un tersi).

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
      ⚠️ **Eşzamanlılık testi YOK** — gerçek PostgreSQL gerektiriyor, mock'la yazılamaz
- [x] `GET /portfolio`
      Çekirdeği ortak hesap: `toplam değer = nakit + Σ(miktar × güncel fiyat)`.
      Aynı fonksiyon gece cron'unu da besleyecek (`portfolio_snapshots`, `reason='daily'`).
      Emirde snapshot yazılmıyor — bkz. 01-plan.md 8.1
- [x] Piyasa ve Portföy ekranları
- [ ] **Al/Sat ekranı** ← Faz 1'in kalan TEK maddesi
      Emir motoru yazıldı, 16 testi geçiyor, eşzamanlılık kanıtlandı, `POST /orders`
      ayakta — ama hiçbir ekran onu çağırmıyor. Backend'in en çok emek gören
      parçası şu an görünmez.

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
- [ ] Kıymetli maden (**LBMA**) adapteri
      Altın `gold_pm.json`, gümüş `silver.json` — **tek adapter, metal parametreli**. Tek istekte iner → `price_history`'ye dolum, sonra günlük cron. `gram_TL = ons_USD / 31,1035 × USD_TRY`
      ⚠️ Altında `gold_am.json` ile karıştırma, aralarında ~%1 fark var. Gümüşte tek fixing olduğu için bu risk yok
      ⚠️ `GRAM_ALTIN` şu an **`is_active = false`** — fiyat kaynağı olmadığı için
      listede uydurma bir fiyatla durmasındansa kapatıldı. Adapter gelince aç.
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
      `market/clean-seed-prices.ts` bu satırları arayıp silen betik; şu an
      bulacak bir şey yok, eski bir veritabanına karşı çalıştırılırsa işe yarar.

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
- [ ] `PricePoint.currency` alanı — döviz TL geliyor, ikinci kez kurla çarpılmamalı
- [ ] Fiyat grafiği — `date_trunc` ile kovalama, aralık başına 60-500 nokta (bkz. 01-plan.md §5.2)
- [x] ~~`GET /what-if` + reel getiri~~ — **Zeynep yazdı** (PR #9, 19 Ağu 2026)
      Şerit sınırı aşıldı ama kod çalışıyor ve testli; silmek israf olurdu. Karar: kabul edildi.
      ⚠️ **OKUNACAK — henüz okumadın.** `apps/api/src/what-if/` (service, repository, schema, test).
      Özellikle: reel getiri formülü `(1+nominal)/(1+enflasyon)−1`, TÜFE endeksi kullanımı,
      tutar → miktar çevriminde ölçek matematiği (`calcGross`'un tersi). Kendi şeridinin devamı orası.
      Faz 2'nin kalanı (geri doldurma, grafik, `retention.ts`, varlık detay ekranı) **sende kalıyor**.
- [ ] Varlık detay ekranı + karar notu alanı

---

## Kendine sorman gereken sorular

Bu proje portfolyo için. Her görevden sonra şunu yazabildiğinden emin ol:

- Bu parçada hangi problemi çözdüm ve **neden başka türlü olmazdı?**
- Nerede tıkandım, nasıl çıktım?
- Bu kodu ikiye katlanan kullanıcıyla ne bozar?

Bunları not al. Mülakatta "en zorlandığın şey neydi" sorusunun cevabı bu notlarda.
