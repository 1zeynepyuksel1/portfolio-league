# Batuhan — Şerit A · Piyasa & Portföy

Plan: [01-plan.md](01-plan.md) · İş bölümü: [02-gorev-paylasimi.md](02-gorev-paylasimi.md)

**Uçtan uca sorumluluğun:** Dış fiyat verisi → emir → portföy değeri → ekran.

Bu şerit projenin "backend gerçekten bir şey hesaplıyor" tarafı. Emir motoru ve para aritmetiği mülakatta anlatacağın şeyler.

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

### `money.ts` — projenin en çok test edilen dosyası
*(Monorepo iskeleti kurulduktan sonra başlanır — Zeynep'i bekle)*

Amaç: hiçbir yerde `number` kullanmadan para hesabı yapmak. `0.1 + 0.2 !== 0.3` olduğu için para asla kayan noktalı sayıyla tutulmaz.

Yazacakların:
- [ ] Üç ölçek: kuruş (`bigint`), fiyat (1e8 ölçekli), miktar (1e10 ölçekli)
- [ ] `ROUND_HALF_UP` yapan bölme fonksiyonu — **tek yerde**
- [ ] Ondalık metni ölçekli `bigint`'e çeviren ayrıştırıcı
- [ ] Brüt tutar ve komisyon hesabı
- [ ] Türkçe para biçimlendirme: `1234567n → "12.345,67 ₺"`
- [ ] Testler

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

- [ ] `MarketDataProvider` arayüzü — `getLatest`, `getHistory`, **USD döner**
- [ ] Binance adapter (`/api/v3/klines`, anahtarsız, 1000 mum limiti, sayfalama)
- [ ] TCMB FX adapter + **hafta sonu forward-fill** kuralı ve testi
- [ ] Fiyat çekme cron'u → `price_history`
- [ ] `GET /assets`
- [ ] **Emir motoru** ← şeridin kalbi
- [ ] `GET /portfolio`
- [ ] Piyasa ve Portföy ekranları

### Emir motoru hakkında şimdiden bilmen gerekenler

Bu, projenin anlatılacak hikâyesi. Cevaplaman gereken soru: *"Kullanıcı aynı anda iki alım emri gönderirse bakiyesi eksiye düşer mi?"*

Üç savunma katmanı olacak:
1. **Veritabanı kısıtı** — `accounts.cash_kurus CHECK >= 0`. Kod hatalı yazılsa bile veri bozulmaz
2. **Satır kilidi** — transaction içinde `SELECT ... FOR UPDATE`
3. **Idempotency** — `UNIQUE(user_id, idempotency_key)`, ağ hatasında tekrarlanan istek ikinci emri yaratmaz

Araştırman gerekenler: transaction izolasyon seviyeleri, `SELECT FOR UPDATE` ne yapıyor, idempotency key deseni neden var.

---

## Faz 2 · sende olanlar

- [ ] Döviz (TCMB kur XML) ve kıymetli maden (**LBMA**) adapterları
      Altın `gold_pm.json`, gümüş `silver.json` — **tek adapter, metal parametreli**. Tek istekte iner → `price_history`'ye dolum, sonra günlük cron. `gram_TL = ons_USD / 31,1035 × USD_TRY`
      ⚠️ Altında `gold_am.json` ile karıştırma, aralarında ~%1 fark var. Gümüşte tek fixing olduğu için bu risk yok
- [ ] Fiyat grafiği
- [ ] `GET /what-if` + reel getiri (TÜFE ile düzeltilmiş)
- [ ] Varlık detay ekranı + karar notu alanı

---

## Kendine sorman gereken sorular

Bu proje portfolyo için. Her görevden sonra şunu yazabildiğinden emin ol:

- Bu parçada hangi problemi çözdüm ve **neden başka türlü olmazdı?**
- Nerede tıkandım, nasıl çıktım?
- Bu kodu ikiye katlanan kullanıcıyla ne bozar?

Bunları not al. Mülakatta "en zorlandığın şey neydi" sorusunun cevabı bu notlarda.
