# Portföy Ligi

**Gerçek piyasa verisiyle çalışan sanal yatırım ligi — ve kullanıcının yatırım davranışını ölçüp yorumlayan bir AI koçu.**

Kullanıcı 100.000 ₺ sanal bakiyeyle başlar, gerçek fiyatlardan kripto/döviz/altın/hisse alıp satar, arkadaşlarıyla haftalık ligde **yüzde getiriye göre** yarışır. Uygulama bununla kalmaz: her işlemi ve kullanıcının işlem sırasında yazdığı notu saklar, bunlardan davranış göstergeleri hesaplar ve kişiselleştirilmiş geri bildirim üretir.

> **Risk sanal, piyasa gerçek.** Hiçbir fiyat elle yazılmadı; hepsi canlı API'lerden çekilip saklanıyor.

![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)
![Node](https://img.shields.io/badge/Node-Express-339933)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1)
![Expo](https://img.shields.io/badge/React%20Native-Expo-000020)
![Tests](https://img.shields.io/badge/tests-331%20passing-10b981)

---

## İçindekiler

- [Ne yapıyor](#ne-yapıyor)
- [Teknoloji yığını](#teknoloji-yığını)
- [Mimari](#mimari)
- [Veri kaynakları](#veri-kaynakları)
- [Kurulum](#kurulum)
- [Komutlar](#komutlar)
- [Proje yapısı](#proje-yapısı)
- [Mühendislik kararları](#mühendislik-kararları)
- [Test](#test)
- [Bilinen sınırlar](#bilinen-sınırlar)
- [Ekip](#ekip)

---

## Ne yapıyor

| Alan | Özellik |
|---|---|
| **Piyasa** | 50 varlık (10 kripto · 8 döviz · 2 maden · 30 ABD hissesi), 15 saniyede bir güncellenen fiyat, ₺/$ gösterim anahtarı |
| **Grafik** | Sıfırdan yazılmış SVG fiyat grafiği — iki parmakla yakınlaştırma, parmakla sürükleyip anlık fiyat okuma, 6 zaman aralığı (2017'ye kadar) |
| **Emir** | Sunucu fiyatlı al/sat, komisyon, idempotency anahtarı, bayat fiyat reddi |
| **Cüzdan** | Portföy değeri, kâr/zarar, varlık dağılımı, işlem geçmişi + karar notları |
| **Lig** | Haftalık dönem, **TWR** (zaman ağırlıklı getiri) ile sıralama, pazar gecesi otomatik kapanış |
| **Ya Alsaydın** | Geçmiş tarih + tutar seç, bugünkü değeri gör — nominal **ve** TÜFE ile düzeltilmiş reel getiri ayrı ayrı |
| **KocAI** | Emir geçmişinden ölçülen 7 davranış göstergesi + bunları yorumlayan sohbet katmanı |
| **Sosyal** | Paylaşılabilir kartlar, arkadaşlık, profil gizlilik ayarları, admin moderasyon paneli |

### Ekran görüntüleri

<!--
  TODO: Buraya ekran görüntüleri ekle.
  Önerilen: docs/screenshots/ klasörü açıp Piyasa, Varlık Detayı,
  Cüzdan, Lig ve KocAI ekranlarının görüntülerini koy.

  | Piyasa | Cüzdan | KocAI |
  |---|---|---|
  | ![](docs/screenshots/piyasa.png) | ![](docs/screenshots/cuzdan.png) | ![](docs/screenshots/kocai.png) |
-->

---

## Teknoloji yığını

| Katman | Teknoloji |
|---|---|
| Mobil | React Native · Expo · TypeScript |
| API | Node · Express · TypeScript (strict) · Zod |
| Veritabanı | PostgreSQL 16 · Drizzle ORM |
| Zamanlanmış işler | node-cron |
| Test | Vitest |
| AI | Google Gemini (`gemini-2.5-flash`) |

Monorepo, npm workspaces ile yönetiliyor. Tamamı ücretsiz katmanda çalışır.

---

## Mimari

```
┌──────────────────────────────────────────────┐
│  React Native (Expo)                         │
│  17 ekran · 5 sekme                          │
└───────────────────┬──────────────────────────┘
                    │  REST + JWT
┌───────────────────▼──────────────────────────┐
│  Express API  ·  Zod ile istek doğrulama     │
│                                              │
│  market · orders · portfolio · leagues       │
│  what-if · behavior · auth · friends · …     │
└──────┬──────────────────────┬────────────────┘
       │                      │
┌──────▼──────────┐   ┌───────▼─────────────────┐
│  PostgreSQL     │   │  Piyasa katmanı         │
│                 │   │                         │
│  portföy        │   │  Binance · TCMB · LBMA  │
│  emirler        │   │  Yahoo  · EVDS          │
│  notlar         │   │                         │
│  fiyat geçmişi  │   │  cron: 15 saniye        │
└─────────────────┘   └─────────────────────────┘
       │
┌──────▼──────────────────────────────────────┐
│  Davranış katmanı                           │
│  emir geçmişinden 7 gösterge ÖLÇER          │
│                     │                       │
│                     ▼                       │
│  Gemini — yalnızca YORUMLAR, ölçmez         │
└─────────────────────────────────────────────┘
```

**Tasarımın özü:** AI mimarinin merkezi değil, en son katmanı. Hesabı sunucu yapar, model yalnızca anlatır.

### Zamanlanmış işler

| İş | Aralık |
|---|---|
| Fiyat çekme | `*/15 * * * * *` (15 saniye) |
| Günlük portföy özeti | 23:55 |
| Lig kapanışı ve rotasyon | Pazar 23:59 |
| TÜFE (EVDS) | Ayın 3'ü, 10:05 |

---

## Veri kaynakları

Altısı da gerçek isteklerle doğrulandı — ayrıntılı rapor: [`docs/00-veri-saglayici-dogrulama.md`](docs/00-veri-saglayici-dogrulama.md)

| Kaynak | Kapsam | Tarihsel derinlik | Anahtar |
|---|---|---|---|
| **Binance** | 10 kripto (USDT paritesi) | BTC/ETH 17 Ağu 2017'den | gerekmiyor |
| **TCMB** | 8 döviz, resmî satış kuru | 2017 öncesine gidiyor | gerekmiyor |
| **LBMA** | Gram altın + gram gümüş (PM fixing) | Altın 1968, gümüş 1968 | gerekmiyor |
| **TCMB EVDS** | TÜFE — reel getiri hesabı için | 2003'ten, aylık | **gerekli** |
| **Yahoo Finance** | 30 ABD hissesi | 3 Oca 2017'den | gerekmiyor |
| **Google Gemini** | Fiyat değil — davranış yorumu ve sohbet | — | **gerekli** |

Kripto, maden ve hisse **USD** bazında gelir; TL'ye **TCMB'nin resmî kuruyla** çevrilir. Borsanın kendi kuru kullanılmaz — lig sıralamasının herkes için aynı, oynamayan bir kura dayanması gerekiyor.

---

## Kurulum

### Gereksinimler

- Node.js 20+
- Docker (PostgreSQL için) — ya da yerel bir PostgreSQL 16
- [Expo Go](https://expo.dev/go) (telefonda denemek için, isteğe bağlı)

### Adımlar

**1. Depoyu klonla ve bağımlılıkları kur**

```bash
git clone <repo-url>
cd portfoy-ligi
npm install
```

**2. Veritabanını başlat**

```bash
docker compose up -d
```

PostgreSQL 16, `localhost:5433` üzerinde ayağa kalkar.

**3. Ortam değişkenlerini ayarla**

```bash
cp .env.example .env
```

`.env` dosyasını doldur:

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `DATABASE_URL` | ✅ | Docker kullanıyorsan `.env.example`'daki değer hazır |
| `JWT_ACCESS_SECRET` | ✅ | En az 32 karakter, rastgele |
| `JWT_ACCESS_TTL_SECONDS` | ✅ | Örn. `900` |
| `JWT_REFRESH_TTL_DAYS` | ✅ | Örn. `30` |
| `PORT` | — | Varsayılan `3000` |
| `EVDS_API_KEY` | — | [TCMB EVDS](https://evds2.tcmb.gov.tr/)'den ücretsiz. Yoksa TÜFE/reel getiri devre dışı kalır |
| `GEMINI_API_KEY` | — | [Google AI Studio](https://aistudio.google.com/apikey)'dan ücretsiz. Yoksa KocAI yorumu sessizce kapanır, uygulama çalışmaya devam eder |
| `GOOGLE_CLIENT_IDS` | — | Google ile giriş için. Boşsa düğme hiç çizilmez |

> ⚠️ `GEMINI_API_KEY` **yalnızca sunucuda** tutulur. `EXPO_PUBLIC_*` önekiyle mobil tarafa konursa paketten çıkarılıp başkası tarafından harcanır.

**4. Şemayı kur**

```bash
npm run db:migrate -w apps/api
```

**5. Varlıkları ve içerikleri ekle**

```bash
npx tsx apps/api/src/market/seed.ts     # 50 varlık
npx tsx apps/api/seed-achievements.ts   # rozetler
npx tsx apps/api/seed-fortune.ts        # günlük içerik
npx tsx apps/api/seed-wheel.ts          # çark ödülleri
```

**6. Fiyat geçmişini doldur** *(isteğe bağlı ama önerilir)*

Cron yalnızca çalıştığı andan itibaren yazar. Grafiklerin ve "Ya Alsaydın"ın anlamlı olması için geçmişi bir kez doldur:

```bash
npx tsx apps/api/src/market/price-backfill.ts
```

Tek bir varlık sınıfı için: `--kind=fx` · `--kind=crypto` · `--kind=metal` · `--kind=stock`

**7. Çalıştır**

```bash
npm run dev          # API  → http://localhost:3000
npm run dev:mobile   # Expo → http://localhost:8081
```

> Mobil uygulama API adresini Metro'nun adresinden **otomatik** çıkarır. Telefonda Expo Go ile açtığında bilgisayarının yerel IP'sini kendisi bulur — elle adres yazman gerekmez.

---

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | API'yi geliştirme modunda başlatır (tsx watch) |
| `npm run dev:mobile` | Expo'yu web modunda başlatır |
| `npm test` | Tüm testleri çalıştırır |
| `npm run typecheck` | Tüm workspace'lerde tip kontrolü |
| `npm run build` | Tüm workspace'leri derler |
| `npm run db:generate -w apps/api` | Şema değişikliğinden migration üretir |
| `npm run db:migrate -w apps/api` | Bekleyen migration'ları uygular |

---

## Proje yapısı

```
portfoy-ligi/
├── apps/
│   ├── api/                      # Express API
│   │   ├── drizzle/              # 19 migration
│   │   └── src/
│   │       ├── market/           # fiyat sağlayıcıları, cron, geri doldurma
│   │       ├── orders/           # emir motoru
│   │       ├── portfolio/        # portföy değerleme
│   │       ├── leagues/          # haftalık lig, TWR motoru
│   │       ├── what-if/          # "ya alsaydın" hesabı
│   │       ├── behavior/         # davranış göstergeleri + Gemini
│   │       ├── auth/             # JWT, kayıt, giriş
│   │       ├── friends/ posts/ profile/ admin/ …
│   │       └── lib/              # para aritmetiği, kur çevrimi
│   └── mobile/                   # React Native (Expo)
│       └── src/
│           ├── screens/          # 17 ekran
│           ├── components/       # PriceChart, PostCard, DesignKit…
│           └── theme.ts          # tasarım belirteçleri
├── packages/contracts/           # iki taraf arasındaki paylaşılan tipler
└── docs/                         # plan, kararlar, veri doğrulama raporu
```

---

## Mühendislik kararları

Bu projenin asıl değeri burada. Her karar bir soruna karşılık geliyor ve gerekçesi kodun içinde yazılı.

### Para asla `float` değil

`0.1 + 0.2 !== 0.3`. Bakiye, fiyat ve miktar üç ayrı ölçekli `bigint` olarak tutulur (kuruş, 1e8, 1e10). Bölme **her yerde** tek bir `divRound` fonksiyonundan geçer — düz `bigint` bölmesi kırpar ve her kırpma kullanıcı aleyhine kuruş eritir. Bu, fark edilmesi en zor hata sınıfıdır.

### Fiyatı sunucu belirler

İstemciden gelen fiyata güvenilmez. Ekrandaki tutar bir **önizlemedir**; sonuç sunucunun döndürdüğü değerdir. Aksi hâlde lig ilk gün kırılırdı.

### Emir motoru eşzamanlılığı

Üç katmanlı koruma:

1. `SELECT … FOR UPDATE` — satır kilidi, bakiye **okunmadan önce** alınır
2. Veritabanı seviyesinde `CHECK (cash_cents >= 0)`
3. `UNIQUE (user_id, idempotency_key)` — çift tıklama çift emre dönüşmez

Eşzamanlılık testi bunu kanıtlıyor: 10 emir aynı anda gönderildiğinde yalnızca bakiyenin yettiği kadarı geçiyor.

### Sıralama TWR ile, mutlak bakiyeyle değil

Mutlak bakiyeye göre sıralasaydık günlük bonus alan yeni kullanıcı "kazanmış" görünürdü — bakiyesi arttı ama bunu yatırım kararıyla kazanmadı. **Zaman ağırlıklı getiri (TWR)** para giriş/çıkışlarını getiriden ayırır; ölçülen tek şey yatırım kararının kendisi olur.

### Forward-fill — hafta sonu tuzağı

TCMB ve LBMA hafta sonu/tatilde veri yayımlamaz (14-15 Mart 2020 → HTTP 404), ama kripto 7/24 işlem görür. Kur ve maden fiyatı en yakın önceki iş gününden taşınır. Olmasaydı hafta sonu emirleri **sessizce** yanlış fiyatlanırdı.

### İki ayrı "tazelik" kavramı

| Kontrol | Sorduğu soru | Sınır |
|---|---|---|
| `MAX_PRICE_AGE_MS` | Bu kaydı ne zaman **yazdık**? | 120 sn (hisse: 300 sn) |
| `MAX_SOURCE_AGE_DAYS` | Kaynak bu fiyatı ne zaman **yayımladı**? | 10 gün |

Cron 15 saniyede bir taze damgayla yazdığı için birincisi her zaman geçer — değer cumadan kalma olsa bile. İkincisi olmadan LBMA'nın susması fark edilmezdi.

### AI'a ne verilmediği, ne verildiği kadar tasarlandı

Modele giden bağlam üç katmandır: ölçülmüş bulgular, portföy **oranları**, son 20 işlem ve kullanıcının kendi notları.

Modele **gitmeyen**ler:

- **TL tutarları** — ekran kesin rakamı gösteriyor; model "yaklaşık 150 lira" derse kullanıcı hangisine güveneceğini bilemez
- **Kullanıcı kimliği** — ad, e-posta, emir kimliği yok. Model kullanıcıyı tanımaz, yalnızca davranışını görür
- **Ham ölçümler** — yalnızca bulgunun kendisi gider

Sistem yönergesi fiyat tahminini ve belirli varlık tavsiyesini açıkça yasaklar; bir **yöntemin** mantıklı olup olmadığını tartışmak serbesttir.

### Niyet ölçülemez — o yüzden kullanıcıya sorulur

Bir göstergeyle kullanıcının **ne yaptığını** ölçebilirsin, **neden yaptığını** ölçemezsin. Bu yüzden her işlemde isteğe bağlı bir not alanı var. Model böylece söylenenle yapılanı karşılaştırabiliyor: *"uzun vadeli tutacağım yazmışsın, ertesi gün satmışsın."* Hiçbir istatistik bunu tek başına yakalayamaz.

---

## Test

```bash
npm test
```

**331 test**, 32 dosya. Yoğunlaştığı yerler: para aritmetiği, emir motoru eşzamanlılığı, TWR hesabı, veri sağlayıcı ayrıştırıcıları (TCMB `<Unit>` tuzağı, LBMA ons→gram çevrimi) ve davranış göstergeleri.

---

## Bilinen sınırlar

Dürüst olmak gerekirse:

- **Kripto TL fiyatı, borsaların kendi TL paritesinden ~%0,4 farklı.** Bilinçli: TCMB'nin resmî kuru kullanılıyor. Borsanın kendi USDT/TRY'si kullanılsaydı 2019 öncesi geçmiş kaybolur ve lig sıralamasına piyasa oynaklığı sızardı.
- **`what-if` servisinde `parseFloat` kullanımı** — gösterim amaçlı, işaretli, henüz `bigint`'e taşınmadı.
- **Boşluk doldurma yalnızca kripto için çalışıyor.** Sunucu kapalıyken oluşan boşluk döviz/maden/hisse için elle `price-backfill` ile kapatılmalı.
- **Yahoo Finance resmî bir API değil.** Yayımlanmış bir kotası yok; yarın kapatılabilir.
- **Gerçek para, BIST, kaldıraç/vadeli işlem kapsam dışı** — mağaza IAP zorunluluğu, tüzel kişilik ve kumar algısı riskleri nedeniyle bilinçli olarak ertelendi.

---

## Ekip

İş bölümü katmana göre değil, **dikey şeride** göre yapıldı. Kimse "sadece frontend'ci" değil; ikisi de SQL, API ve React Native yazdı — farklı alanlarda.

| Kişi | Şerit | Uçtan uca sorumluluk |
|---|---|---|
| **Batuhan** | Piyasa & Portföy | Dış fiyat verisi → emir → portföy değeri → ekran |
| **Zeynep** | Kimlik & Sosyal | Kayıt → kimlik → arkadaş → lig sıralaması → ekran |

Ayrıntılı plan ve kararlar: [`docs/01-plan.md`](docs/01-plan.md) · [`docs/02-gorev-paylasimi.md`](docs/02-gorev-paylasimi.md)
