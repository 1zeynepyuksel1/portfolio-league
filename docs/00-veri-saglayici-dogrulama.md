# Faz 0 Çıkış Kapısı — Veri Sağlayıcı Doğrulama Raporu

**Tarih:** 14 Ağustos 2026 · **Güncelleme:** 17 Ağustos 2026 (EVDS erişimi) · **Yapan:** Şerit A · **Durum:** ✅ Geçti, bir plan değişikliğiyle

Planın kuralı: bu rapor yazılmadan Faz 1'e geçilmez. Aşağıdaki her bulgu **gerçek istek atılarak** doğrulandı, dokümantasyon okunarak değil.

---

## Özet

| Kaynak | Durum | Anahtar | Tarihsel derinlik |
|---|---|---|---|
| **Kripto** — Binance public API | ✅ | Gerekmiyor | 17 Ağu 2017 (BTC, ETH) |
| **Döviz** — TCMB kurlar XML | ✅ | Gerekmiyor | En az 2017 |
| **Altın** — LBMA PM fixing | ✅ | **Gerekmiyor** | 1 Nisan 1968 |
| **Gümüş** — LBMA | ✅ | **Gerekmiyor** | 2 Ocak 1968 |
| **TÜFE** — TCMB EVDS | ✅ | Ücretsiz kayıt | `TP.GENENDEKS.T1` · aylık · Ocak 2003 → Tem 2026 |

Altın **EVDS'den çıktı, LBMA'ya geçti** (§3). EVDS artık yalnızca TÜFE için kullanılıyor; erişim biçimi §5'te.

---

## 1. Kripto — planı değiştiren bulgu

**CoinGecko ücretsiz katmanı kullanılamaz.** Demo planı tarihsel veriyi **son 365 günle** sınırlıyor. Bu, "12 Mart 2020'de alsaydın" özelliğinin tamamını imkânsız kılar — yani ürünün ayırt edici özelliklerinden birini.

**Çözüm: Binance public API.** Anahtar gerektirmiyor, ücretsiz, istek başına 1000 mum, `startTime`/`endTime` ile sayfalama.

Doğrulama — 17 Ağustos 2017 (Binance'in ilk günü):

```
GET api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&startTime=1502928000000
→ [1502928000000, "4261.48", "4485.39", "4200.74", "4285.08", ...]
```

Pandemi çöküşü günü, tam olarak beklendiği gibi:

```
GET .../klines?symbol=BTCUSDT&interval=1d&startTime=1583971200000   (12 Mart 2020)
→ açılış 7934.58 · en düşük 4410.00 · kapanış 4800.00     // tek günde -%39
```

ETH de aynı tarihe kadar mevcut (17 Ağu 2017: açılış 301.13).

### Kripto neden TRY değil USD üzerinden alınacak

Binance'in TRY paritesi de var ama **20 Aralık 2019'da başlıyor**:

```
GET .../klines?symbol=BTCTRY&interval=1d&startTime=1502928000000
→ ilk kayıt 1576800000000 = 20 Aralık 2019, fiyat 42.330 TL
```

USDT paritesi 2017'ye giderken TRY paritesi 2019'da başlıyor. Bu yüzden:

> **Karar:** Kripto fiyatı Binance'ten **USD** cinsinden alınır, TRY'ye **TCMB kuruyla** çevrilir.

İki kazanç: tarihsel derinlik 2017'ye çıkıyor **ve** TRY çevrimi resmî merkez bankası kurundan yapılıyor — borsa paritesinden değil. `price_history` tablosuna yazılan değer yine TL.

---

## 2. Döviz — anahtar bile gerekmiyor

TCMB günlük kur XML'i herkese açık ve **tarihe göre sorgulanabiliyor**. EVDS API anahtarı döviz için gereksiz.

```
GET tcmb.gov.tr/kurlar/today.xml                      → bugünün kurları
GET tcmb.gov.tr/kurlar/202003/12032020.xml            → 12 Mart 2020
    USD ForexBuying = 6.2264
    EUR ForexBuying = 7.0139
GET tcmb.gov.tr/kurlar/201701/02012017.xml            → HTTP 200
```

### ⚠️ Uygulama tuzağı: hafta sonu ve tatillerde dosya yok

Doğrulandı:

| Tarih | Gün | Sonuç |
|---|---|---|
| 13.03.2020 | Cuma | HTTP 200 |
| 14.03.2020 | Cumartesi | **HTTP 404** |
| 15.03.2020 | Pazar | **HTTP 404** |
| 16.03.2020 | Pazartesi | HTTP 200 |

Kripto 7/24 işlem görüyor ama TCMB kuru sadece iş günlerinde yayımlanıyor. Yani **hafta sonu bir kripto fiyatını TL'ye çevirmek için Cuma kurunu taşımak gerekiyor.**

> **Karar:** FX adapter'ı **son iş gününden ileri doldurma (forward-fill)** yapar. `price_history`'ye hafta sonu kayıtları Cuma kuruyla yazılır. Bu kural tek bir yerde (`lib/fx.ts`) uygulanır ve testi yazılır — aksi hâlde hafta sonu emirleri sessizce yanlış fiyatlanır.

---

## 3. Altın — çözüldü, kaynak LBMA · 17 Ağustos 2026

Dört aday gerçek istekle denendi. Üçü elendi.

| Aday | Sonuç |
|---|---|
| **PAXG** (Binance) | ⚠️ Yalnızca 28 Ağu 2020'ye gidiyor + sistematik sapma (aşağıda) |
| **TCMB EVDS** | ❌ Günlük altın **fiyatı yok** — dokuz gruptan sekizi aylık, tek işgünü serisi 2018'de arşivlenmiş |
| **GoldAPI.io** | ❌ Ücretsiz kota **100 istek/ay**, backfill 32 ay sürer |
| **LBMA** | ✅ **Seçildi** |

### Elenen adayların ayrıntısı

**PAXG** — `klines?symbol=PAXGUSDT` ilk kaydı `1598572800000` = 28 Ağustos 2020. 2017-2020 senaryolarını kapsamıyor.

**EVDS** — altın grupları tarandı, hepsi fiyat verisi bile değil (para basımı, ithalat/ihracat, cevher üretimi). Fiyat serisi olan `bie_mkaltytl` **aylık** ve kendi `NOTE` alanında "gösterge" diyor, borsa fiyatı değil. Aylık veri haftalık ligde kullanılamaz. Tek işgünü serisi `bie_mkbral` 29-06-2018'de arşivlenmiş.

**GoldAPI.io** — `403 {"error":"No API Key provided"}`. Tarihsel uç noktası tek gün döndürüyor (`/XAU/USD/YYYYMMDD`), aralık değil. 2017'den bugüne ~3.200 gün ÷ 100 istek/ay = **32 ay**. CoinGecko'yu eleyen desenin aynısı: ücretsiz katman tarihsel veriyi kullanılamaz kılıyor.

### Seçilen: LBMA

```
GET prices.lbma.org.uk/json/gold_am.json     → 200, anahtarsız, 923 KB
ilk kayıt : 1968-01-02  v=[35.18, 14.64, null]
son kayıt : 2026-08-14  v=[4349.9, 3216.75, 3764.84]
```

`v` dizisi `[USD, GBP, EUR]`. İç tutarlılık kanıtı: 1968'de 35,18 USD/ons — Bretton Woods altın paritesi; EUR `null`, çünkü o tarihte euro yok.

**Tek istekte tüm seri geliyor.** Sayfalama yok, kota yok, anahtar yok. LBMA zaten altının dünya referans fiyatı — GoldAPI gibi aracıların sattığı veri de buradan geliyor.

> **Karar:** Altın fiyatı **LBMA PM fixing**'den alınır (`gold_pm.json`), tek kaynak.

### Güncel veri nasıl gelecek

Dosya arşiv değil, **canlı**: `last-modified: Mon, 17 Aug 2026 07:50:04 GMT`. Her iş günü sonuna yeni satır ekleniyor. Aynı kaynak iki şekilde kullanılır:

1. **İlk dolum (bir kez):** tüm dosya indirilir, 2017'den itibaren `price_history`'ye yazılır
2. **Günlük cron:** aynı dosya indirilir, son kaydın tarihi DB'dekiyle karşılaştırılır, yeni tarih varsa eklenir

Koşullu istek denendi, **desteklenmiyor**: `If-None-Match` ile `ETag` gönderildiğinde sunucu 304 değil `200` + tam 923 KB döndürüyor (`Cache-Control: no-cache, no-store, must-revalidate`). Yani her çekimde dosyanın tamamı iniyor — günde bir kez için önemsiz (~28 MB/ay), ama gün içi sık çekim yapılmamalı.

### ⚠️ AM/PM karıştırılmamalı

LBMA günde iki fixing yayımlıyor ve ikisi farklı:

```
14 Ağustos 2026 →  AM: 4349,90 USD/ons
                   PM: 4390,70 USD/ons      // %0,94 fark
```

Karıştırılırsa portföyde %1'lik hayalet hareket üretir. **PM seçildi**, tek dosya kullanılacak: `gold_pm.json`. Cron, Londra 15:00 (TSİ ~17:00) fixing'inden sonra çalışır.

İki dosyanın başlangıç tarihi de farklı: `gold_am` 2 Ocak 1968, `gold_pm` **1 Nisan 1968**. PM tercihi üç aylık derinlik kaybettiriyor — MVP için önemsiz (ihtiyaç 2017'den itibaren).

## 3b. Gümüş — varlık listesine eklendi · 17 Ağustos 2026

> **Karar (Batuhan, 17 Ağustos 2026):** Gümüş varlık listesine eklenir. Kaynak aynı: **LBMA**.

Kilitli karardaki varlık listesi bu kararla genişledi: **kripto + döviz + altın + gümüş**.

```
GET prices.lbma.org.uk/json/silver.json    → 200, anahtarsız, 897 KB
ilk kayıt : 1968-01-02  v=[2.173, 0.904, null]
```

Altınla aynı JSON biçimi, aynı `[USD, GBP, EUR]` dizisi, aynı işgünü frekansı, aynı forward-fill ihtiyacı.

**Altına göre bir avantajı var:** LBMA gümüşte günde **tek fixing** yapıyor — `silver.json` tek dosya. Altındaki AM/PM karıştırma tuzağı gümüşte yok.

> **Karar:** Varlık **gram gümüş**, altınla aynı dönüşüm: `gram_gümüş_TL = ons_USD / 31,1035 × USD_TRY`

### Aynı kaynakta kalan madenler *(kapsam dışı)*

| Dosya | İlk kayıt |
|---|---|
| `platinum_pm.json` | 2 Nis 1990 |
| `palladium_pm.json` | 2 Nis 1990 |

Doğrulandı ve çalışıyor, ama varlık listesine **alınmadı**. Eklenirlerse bu bir ürün kararı olur — "verisi hazır" gerekçesi tek başına yeterli değil.

> **Tasarım notu:** LBMA adapter'ı `gold` sabitine göre değil, **metal parametresine** göre yazılacak (dosya adı + varlık kodu parametre). Altın ve gümüş aynı adapter'ın iki örneği olur; ileride bir maden eklemek tek satıra iner.

### Neden hibrit (LBMA geçmiş + PAXG canlı) reddedildi

"Geçmiş LBMA'dan, güncel fiyat PAXG'den" önerisi ölçüldü:

| Tarih | LBMA fixing | PAXG kapanış | Fark |
|---|---|---|---|
| 2026-08-14 | 4349,90 | 4380,40 | +0,70% |
| 2025-06-16 | 3417,30 | 3432,41 | +0,44% |
| 2023-03-15 | 1906,00 | 1924,00 | +0,94% |
| 2021-02-15 | 1817,45 | 1833,22 | +0,87% |

Sapma **sistematik** — dördünde de PAXG yukarıda. Sebebi: LBMA fixing'i 10:30 Londra'da belirleniyor, PAXG kapanışı UTC gece yarısı; üstüne PAXG'nin token primi biniyor.

Sonucu: kullanıcı 2019'da alıp bugün satarsa alış LBMA'dan (düşük), satış PAXG'den (yüksek) → **%0,7 sahte kazanç.** Lig yüzde getiriye göre ve haftalık sıralanıyor; bir haftalık gerçek performans farkları da bu mertebede. Yani kimin kazandığını veri kaynağı seçimi belirlerdi. Sabit çarpanla düzeltmek de yetmiyor — sapma %0,44 ile %0,94 arasında geziyor.

> **Karar:** Hibrit reddedildi. Gün içi hareket kazancı, ligi bozan sistematik sapmaya değmez. Ayrıca TL fiyatı zaten günde bir değişiyor: kur TCMB'den geliyor, o da günlük yayımlanıyor.

### Altının birimi

LBMA ve PAXG **troy ons** (31,1035 gram), 24 ayar saf altın fiyatı verir.

> **Karar:** Tek varlık: **gram altın (24 ayar)**. `gram_altın_TL = ons_USD / 31,1035 × USD_TRY`

Yarım/çeyrek/tam/cumhuriyet altını **kapsam dışı**: bunlar piyasa fiyatı değil ürün fiyatı — işçilik payı ve kuyumcu marjı içeriyorlar, 22 ayar basılıyorlar, kuyumcudan kuyumcuya değişiyorlar. "Fiyatı sunucu belirler" kuralı için hesaplanabilir bir formül gerekiyor; işçilik payının ücretsiz veri kaynağı yok.

### ⚠️ Forward-fill kuralı buraya da uygulanır

LBMA **işgünü** verisi — son kayıt 14 Ağustos Cuma. TCMB kur XML'iyle birebir aynı desen. Kural üçüncü kez doğrulandı: TCMB kaynaklı olsun olmasın, **işgünü yayımlanan her seri** hafta sonu forward-fill ister.

---

## 4. TÜFE — çözüldü · 17 Ağustos 2026

**Seri kodu: `TP.GENENDEKS.T1`** — Genel Endeks (2003=100) · AYLIK · 01-01-2003 → 01-07-2026 · kaynak TÜİK · veri grubu `bie_tukfiy2003`.

### Aday seri kodu yanlış çıktı

Raporun ilk sürümündeki aday `TP.FG.J0` **arşiv serisiymiş**: adı `GENEL (Tüketici) (Arşiv) (Arşiv)`, `END_DATE` Ocak 2026'da donmuş. Kullanılsaydı reel getiri hesabı son yedi ayı kapsamazdı — ve bu, sessizce yanlış sonuç veren türden bir hata olurdu.

EVDS serileri yeni veri gruplarına taşımış, eskileri "(Arşiv)" etiketiyle bırakmış. **İnternetteki seri kodu örnekleri bu yüzden güvenilmez.** Kod her zaman canlı `datagroups`/`serieList` metaverisinden doğrulanmalı.

Değerlendirilen alternatifler: `bie_tukfiy2025` (2025=100, 2005'ten) ve `bie_tukfiy2003` (2003=100). **İkisi de canlı ve ikisi de Temmuz 2026'ya kadar güncel** — bu yüzden farklı bazlı serileri birleştirme (chain-linking) ihtiyacı doğmadı. Reel getiri endeksin *oranını* kullandığı için (`endeks_bugün / endeks_alım_günü`) baz yılı sonucu değiştirmiyor.

### Doğrulama — gerçek istek

```
GET .../series=TP.GENENDEKS.T1&startDate=01-01-2020&endDate=01-06-2020&type=json
```

```json
{"totalCount":6,"items":[
  {"Tarih":"2020-1","TP_GENENDEKS_T1":"446.45000000","UNIXTIME":{"$numberLong":"1577833200"}},
  {"Tarih":"2020-2","TP_GENENDEKS_T1":"448.02000000","UNIXTIME":{"$numberLong":"1580511600"}},
  ...
  {"Tarih":"2020-6","TP_GENENDEKS_T1":"465.84000000","UNIXTIME":{"$numberLong":"1590962400"}}]}
```

### 🔴 Yanıt yapısı — EVDS adapter'ının dört tuzağı

1. **Alan adında noktalar alt çizgiye dönüşüyor.** İstek `TP.GENENDEKS.T1`, yanıt `TP_GENENDEKS_T1`. Adapter seri kodunu dönüştürerek aramalı, yoksa `undefined` okur
2. **Sarmalayıcı var:** `{totalCount, items[]}` — düz dizi değil. (`serieList` ucu düz dizi döndürüyor; iki uç farklı davranıyor)
3. **Değerler string, sayı değil:** `"446.45000000"`. Bu aslında **iyi** — `float`'a dönüştürülmemiş, ondalık metin olarak geliyor. `money.ts`'in ayrıştırıcısına doğrudan verilebilir. Sakın `Number()`'dan geçirme, `bigint` kuralını orada kaybedersin
4. **Tarih formatı `"2020-1"`** — ISO değil, sıfır dolgusu **yok**. `2020-01` bekleyen bir ayrıştırıcı Ekim'den itibaren sessizce bozulur

Ayrıca `UNIXTIME` alanı `{"$numberLong":"1577833200"}` biçiminde — MongoDB extended JSON. İç içe obje, değer yine string. `1577833200` = 1 Ocak 2020 00:00 **TSİ**, yani UTC değil yerel saat. Tercihen `Tarih` alanı kullanılmalı, `UNIXTIME` kullanılacaksa saat dilimi bilinerek kullanılmalı.

Kılavuzdan okunan `decimalSeperator` varsayılanının **nokta** olduğu da bu yanıtla doğrulandı.

### Yedek plan (artık gereksiz ama duruyor)

TÜFE aylık ve az satırlı bir veri. EVDS erişimi bir gün kesilirse `inflation_index` tablosuna elle girilebilir — 2017'den bugüne ~100 satır. Reel getiri özelliği bu yüzden tek bir sağlayıcıya bağımlı değil.

---

## 5. EVDS web servis erişimi — 17 Ağustos 2026

Anahtar alındı. İlk istek JSON yerine **portalın HTML sayfasını** döndürdü. Sebep: EVDS'nin erişim biçimi değişmiş, ve internetteki hemen bütün örnekler — blog yazıları, Python kütüphaneleri, mevcut kılavuz kopyaları — hâlâ eski biçimi gösteriyor.

### Doğrulandı — gerçek istek

| İstek | Sonuç |
|---|---|
| `evds2.tcmb.gov.tr/service/evds/series=…` | `302` → `evds3.tcmb.gov.tr/` **ana sayfasına** yönlendiriyor |
| `evds3.tcmb.gov.tr/service/evds/series=…` | `200` ama `text/html` — SPA'nın catch-all sayfası, veri yok |
| `evds3.tcmb.gov.tr/igmevdsms-dis/series=…` (anahtarsız) | `403` `application/json` |

Anahtarsız isteğin gövdesi:

```json
{"status":"403","message":"Required request header 'key' is not present"}
```

Bu 403, doğru uç noktanın bulunduğunun kanıtı: yanlış path sessizce HTML dönerken doğru path anlamlı bir hata veriyor.

> **Karar:** Base URL `https://evds3.tcmb.gov.tr/igmevdsms-dis/`. Anahtar **HTTP header'ında** `key: <anahtar>` olarak gönderilir, query parametresi olarak **değil**.

`evds2` ve `/service/evds/` kombinasyonunu gösteren her kaynak eskimiştir — adapter yazılırken Stack Overflow yerine resmî kılavuza bakılacak.

### Kılavuzdan okundu — gerçek istekle test edilmedi

Kaynak: EVDS Web Servis ve API Kullanımı (portal → Kullanıcı Dokümanları). Bunlar `[DOĞRULANMALI]`, adapter yazılırken teyit edilecek.

- **1000 gözlem sınırı.** Aralık daha genişse **bitiş tarihinden geriye doğru** 1000 gözlem döner
- Tarih formatı `gg-aa-yyyy`
- `decimalSeperator` varsayılanı **nokta**
- `frequency`: günlük `1`, işgünü `2`, aylık `5`
- Yanlış anahtar da `403` döndürür
- Metaveri uçları: `serieList/`, `datagroups/`, `categories/`

### ⚠️ Derinlik ölçümünde tuzak

Binance'te kullanılan *"başlangıcı çok geriye at, dönen ilk kayda bak"* yöntemi **EVDS'de yanlış sonuç verir.** 1000 gözlem sınırı bitiş tarihinden geriye işlediği için geniş aralık en eski değil **en yeni** 1000 gözlemi döndürür — 1990'a giden bir seri "2023'te başlıyor" gibi görünür.

> **Karar:** EVDS serilerinin tarihsel derinliği veri çağrısıyla değil, `serieList` metaveri ucunun `Start_Date` / `End_Date` / `Frequency_Str` alanlarından okunur.

### Adapter'a yansıyanlar

- **Sayfalama gerekiyor.** 1000 gözlem, günlük seride ~2.7 yıl. 2017'den bugüne ~4 çağrı. Binance'in 1000 mum sınırıyla aynı desen — sayfalama mantığı iki adapter arasında paylaşılabilir
- **Sunucu tarafı dönüşüm kullanılmayacak.** `aggregationTypes`, `formulas`, `frequency` parametreleri TCMB'ye hesap yaptırır. Ham günlük veri çekilip hesap kendi kodumuzda yapılacak — aksi hâlde TCMB'nin ortalama alma kuralı TWR hesabına sessizce karışır
- **Forward-fill kuralının kapsamı genişliyor.** EVDS serileri de işgünü frekansında yayımlanıyorsa hafta sonu boşlukları TCMB kur XML'iyle aynı problemi doğurur. Kural `lib/fx.ts` içinde FX'e özel değil, **TCMB kaynaklı her seri için** geçerli olacak biçimde yazılmalı `[DOĞRULANMALI — altın serisinin frekansı görülünce netleşir]`

---

## Plana yansıyan değişiklikler

1. **Kripto sağlayıcısı Binance.** CoinGecko ücretsiz katmanı elendi (365 gün sınırı).
2. **Kripto USD'de çekilir, TCMB kuruyla TL'ye çevrilir.** `MarketDataProvider` arayüzü buna göre: `getLatest(symbol)` ve `getHistory(symbol, from, to)` **USD** döner; TL çevrimi ayrı bir katmanda (`lib/fx.ts`) yapılır. Bu ayrım şart — aksi hâlde iki farklı endişe tek adapter'a karışır.
3. **FX forward-fill kuralı** ve testi Faz 1 kapsamına eklendi.
4. **EVDS anahtarı alma** görevi Faz 0'a eklendi (Şerit A, ~10 dk).
5. Risk tablosundaki *"altın ve TÜFE için ücretsiz veri bulunamaması"* satırı kapandı: ikisi de EVDS'de var, ücretsiz, anahtar karşılığı.
6. **EVDS base URL'i ve anahtar gönderim biçimi** kayda geçti (§5). EVDS adapter'ı sayfalama yapacak ve sunucu tarafı dönüşüm kullanmayacak.
7. **Altın sağlayıcısı LBMA** (§3). EVDS'nin altın verisi aylık çıktığı için elendi; GoldAPI kota nedeniyle, PAXG hem derinlik hem sistematik sapma nedeniyle elendi. Altın **anahtarsız** bir kaynağa bağlandı.
8. **Altın tek varlık olarak modellenecek: gram altın (24 ayar).** Ziynet ürünleri kapsam dışı.
9. **Forward-fill kuralı genelleşti.** Artık yalnızca FX'in değil, işgünü yayımlanan **her** serinin (TCMB kuru, LBMA altın) kuralı. `lib/fx.ts` adı bu yüzden dar kalıyor olabilir.

## ✅ Faz 0 veri kapısı kapandı — 17 Ağustos 2026

**Kripto ✅ · Döviz ✅ · Altın ✅ · TÜFE ✅**

Dört veri kaynağının tamamı gerçek istekle doğrulandı. Hepsi ücretsiz; yalnızca TÜFE anahtar gerektiriyor.

| Varlık | Kaynak | Uç nokta | Frekans | Derinlik |
|---|---|---|---|---|
| Kripto | Binance | `/api/v3/klines` | 7/24 | 17 Ağu 2017 |
| Döviz | TCMB | `/kurlar/<tarih>.xml` | İş günü | ≥ 2017 |
| Altın | LBMA | `/json/gold_pm.json` | İş günü | 1 Nis 1968 |
| Gümüş | LBMA | `/json/silver.json` | İş günü | 2 Oca 1968 |
| TÜFE | TCMB EVDS | `series=TP.GENENDEKS.T1` | Aylık | Oca 2003 |

Faz 1'e geçilebilir.

### Faz 1'e taşınan kurallar

- **Forward-fill**, işgünü yayımlanan her seri için (TCMB kuru + LBMA altın). Tek yerde, testli
- **Sayfalama**, Binance 1000 mum ve EVDS 1000 gözlem sınırları için — aynı desen
- **USD → TL çevrimi ayrı katmanda**, adapter'ların içinde değil
- **Sunucu tarafı dönüşüm kullanılmaz** — ham veri çekilir, hesap kendi kodumuzda yapılır

---

**Kaynaklar:**
[CoinGecko API fiyatlandırma](https://www.coingecko.com/en/api/pricing) · [CoinGecko tarihsel veri sınırı](https://docs.coingecko.com/demo/reference/coins-id-market-chart-range) · [Binance klines dokümantasyonu](https://developers.binance.com/docs/alpha/market-data/rest-api/klines) · [TCMB EVDS portalı](https://evds3.tcmb.gov.tr) · [EVDS SSS](https://evds3.tcmb.gov.tr/sorular) · EVDS Web Servis ve API Kullanımı (portal → Kullanıcı Dokümanları, PDF) · [TCMB tüketici fiyatları](https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Istatistikler/Enflasyon+Verileri/Tuketici+Fiyatlari) · [LBMA fiyat verisi](https://prices.lbma.org.uk/json/gold_pm.json) · [GoldAPI.io](https://www.goldapi.io/)

⚠️ `evds2.tcmb.gov.tr` ve `/service/evds/` gösteren kaynaklar eskimiştir (§5). [fatihmete/evds](https://github.com/fatihmete/evds) dâhil mevcut kütüphaneler eski biçimi kullanıyor — seri kodu örneği olarak hâlâ değerli, istek biçimi örneği olarak değil.
