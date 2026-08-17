# CLAUDE.md — Portföy Ligi

> Bu dosya her oturumda otomatik okunur. Projenin kalıcı hafızası burasıdır.

---

## ⚠️ EN ÖNEMLİ KURAL — amaç öğrenmek, teslim almak değil

**Batuhan sıfırdan öğreniyor.** Proje staj sırasında kendini kanıtlamak ve backend/frontend/API mantığını kavramak için var. Ölçüt şu: yazılan her satırın **neden** öyle olduğunu Batuhan anlatabilmeli.

Bu iki yönlü çalışır:

- **"Şurayı yaz" denirse → yaz.** Ama okunup öğrenilecek şekilde: Türkçe açıklayıcı yorumlar, kararın gerekçesi görünür, tuzaklar işaretli. Yazdıktan sonra ne yaptığını ve nerede dikkat edilmesi gerektiğini anlat.
- **"Şurayı yazdım, oku" denirse → incele.** Hataları, nedenlerini ve nasıl düzeltileceğini söyle.

**Yapma:**
- Talep edilmeden dosya oluşturma
- Tek seferde baştan aşağı proje üretme — kapsam her zaman **istenen parça kadar**
- İstenmeyen dosyalara yayılma

Görev anlatırken çerçeve hâlâ geçerli: ne inşa edilecek · hangi karar **neden** · hangi tuzak · bitti sayılma kriteri.

`docs/` altındaki araştırma ve karar dokümanlarını yazmak serbest.

---

## Proje nedir

Sanal yatırım ligi. Kullanıcı kayıt olunca 100.000 TL sanal bakiye alır, gerçek piyasa fiyatlarıyla kripto/döviz/altın alıp satar, haftalık ligde arkadaşlarıyla **yüzde getiriye göre** yarışır. Ayrıca geçmiş bir tarih ve tutar seçip "o gün alsaydım bugün ne olurdu" hesabını görebilir.

**Neden bu proje:** Backend sadece satır saklamıyor, karar veriyor ve hesap yapıyor — bakiye yetiyor mu, emir hangi fiyattan geçer, para girişleri varken getiri nasıl hesaplanır. Portfolyoda anlatılacak şey bunlar.

## Ekip

| Kişi | Şerit | Sorumluluk (uçtan uca) |
|---|---|---|
| **Batuhan** | A · Piyasa & Portföy | Dış fiyat verisi → emir → portföy değeri → ekran |
| **Zeynep** | B · Kimlik & Sosyal | Kayıt → kimlik → arkadaş → lig sıralaması → ekran |

**İş bölümü katmana göre değil, dikey şeride göre.** Kimse "frontend'ci" değil; ikisi de SQL, API route ve React Native yazıyor — farklı alanlarda. Migration'ların tek sahibi Zeynep.

## Nerede kaldık

**Faz 0 · Temel** — veri doğrulaması geçti, iskelet henüz kurulmadı. Proje klasöründe şu an sadece `docs/` var, kod yok.

| Kim | Şu anki görev | Durum |
|---|---|---|
| Batuhan | EVDS API anahtarı al, altın + TÜFE serilerini gerçek istekle doğrula | ⏳ |
| Zeynep | Monorepo iskeleti (npm workspaces, TS strict, vitest, git) | ⏳ |

İkisi birbirini beklemiyor, paralel.

## Kilitli kararlar

| Karar | Gerekçe |
|---|---|
| Lig **haftalık**, sıralama **TWR (yüzde getiri)** ile | Mutlak bakiye "kim erken geldi"yi ölçer; günlük bonus yüzünden yeni kullanıcı kazanamaz |
| Gerçek parayla bakiye satışı **Faz 3'e** | Mağaza IAP zorunluluğu, tüzel kişilik, ve lig adaletinin bozulması |
| Varlıklar: **kripto + döviz + gümüş + altın** | Verisi ücretsiz, 7/24 açık; borsa saati/tatil karmaşıklığı yok. BIST Faz 3 |
| **Fiyatı sunucu belirler** | Client'tan gelen fiyata güvenmek ligi ilk gün kırar |
| Kripto **USD'de** çekilir, **TCMB kuruyla** TL'ye çevrilir | Binance TRY paritesi 2019'a, USDT paritesi 2017'ye gidiyor |
| Para **`bigint` kuruş**, `float` yasak | `0.1 + 0.2 !== 0.3` |
| Kendi **JWT auth**'umuz, hazır auth değil | "API mantığını kavramak" hedefinin en öğretici parçası |

**Stack:** React Native + Expo · Node + Express + TypeScript + Zod · PostgreSQL + Drizzle · vitest · Railway/Neon/Expo EAS (hepsi ücretsiz katman).

## Doğrulanmış veri kaynakları

Gerçek istek atılarak doğrulandı — ayrıntı: `docs/00-veri-saglayici-dogrulama.md`

- **Kripto:** Binance public API, anahtarsız, 17 Ağu 2017'ye kadar ✅
- **Döviz:** TCMB kurlar XML, anahtarsız, tarihe göre sorgulanabilir ✅
- **Altın + TÜFE:** TCMB EVDS, ücretsiz anahtar gerekli ⏳
- **CoinGecko elendi:** ücretsiz katman tarihsel veriyi 365 günle sınırlıyor, "2020'de alsaydın" özelliğini öldürüyordu

## Bilinen tuzaklar

1. **TCMB hafta sonu ve tatilde kur yayımlamıyor** (14-15 Mart 2020 → HTTP 404). Kripto 7/24 işlem görüyor. Hafta sonu fiyatları son iş gününden **forward-fill** edilecek, kural tek dosyada + testi. Yoksa hafta sonu emirleri sessizce yanlış fiyatlanır.
2. **`bigint` bölmesi kırpar** — her işlemde kullanıcı aleyhine kuruş erir. `ROUND_HALF_UP` tek bir fonksiyonda tanımlı olacak.
3. **Naif getiri hesabı yanlış** — günlük bonusu kazanç sanar. TWR şart.
4. **`moduleResolution`**: `nodenext` seçilirse relative import'larda `.js` uzantısı zorunlu, `bundler` seçilirse değil. Bilerek seçilmeli.

## Reddedilenler — tekrar önerme

**Kapsam dışı:** mesajlaşma/forum (moderasyon yükü) · kaldıraç ve vadeli işlem (karmaşıklık + kumar algısı) · WebSocket canlı fiyat akışı (periyodik çekim yeterli) · rozet sistemi (lig zaten motive ediyor) · BIST (Faz 3, veri erişimi sorunlu) · gerçek para (Faz 3).

**Elenen proje fikirleri** (tekrar önerilmesin): Letterboxd klonu, kültür günlüğü, konser arşivi, okuma günlüğü, halı saha rezervasyon, kampüs etkinlik + QR, ikinci el pazar yeri, ortak hesap/borç netleştirme, ön sipariş, nöbet çizelgesi, sabit senaryolu yatırım simülatörü.

**Ayrıca:** LGS Kâşifi adlı bir eğitim platformu projesi vardı, tamamen bırakıldı ve dosyaları silindi. Gündeme getirme.

**Kapsam kayması alarmı:** "şunu da ekleyelim" denildiğinde otomatik onaylama. Sor: *"Bu, mevcut fazın bitiş kriterine hizmet ediyor mu, yoksa sonraki faza mı ait?"*

## Dokümanlar

| Dosya | İçerik |
|---|---|
| `docs/01-plan.md` | Tam plan: kararlar + gerekçeler, mimari, veri modeli, üç kritik hesaplama, API sözleşmesi, fazlar, riskler |
| `docs/02-gorev-paylasimi.md` | Şeritler, klasör sahiplikleri, çakışma kuralları, faz faz dağılım |
| `docs/batuhan.md` | Batuhan'ın kişisel görev listesi + araştırma yönergeleri |
| `docs/zeynep.md` | Zeynep'in kişisel görev listesi + araştırma yönergeleri |
| `docs/00-veri-saglayici-dogrulama.md` | Veri kaynağı doğrulama raporu (gerçek isteklerle) |

## Ton

Doğrudan, kısa, mühendisçe. Gereksiz övgü ve dolgu cümle yok. Yanlış bir şey istendiğinde "olur" deme — nedenini açıkla ve alternatif öner. Bilmediğini uydurma, `[DOĞRULANMALI]` etiketiyle işaretle. Yorumlar ve kullanıcıya görünen metinler Türkçe, değişken ve fonksiyon adları İngilizce.
