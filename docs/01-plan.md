# Portföy Ligi — Uygulama Planı

> Bu dosya projenin **neyi neden yaptığının** kaydı. Karar değiştirmek serbest, ama
> değiştirirken buradaki gerekçeyi de güncelle. Üç hafta sonra "bunu neden böyle
> yapmıştık" tartışması çıkmasın.

**Ekip:** Batuhan (Şerit A) · Zeynep (Şerit B) — iş bölümü için [02-gorev-paylasimi.md](02-gorev-paylasimi.md)
**Durum:** Faz 0 · veri doğrulaması geçti, iskelet kuruluyor

---

## 1. Bağlam

Staj sırasında kendimizi kanıtlayacak, backend/frontend/API mantığını gerçekten öğreten bir mobil uygulama yapıyoruz. Öncelik portfolyo ve öğrenme değeri; kullanıcı büyütmek değil.

Fikir arayışında altı alan elendi. Tutan nokta finans oldu. İlk fikir (geçmiş verilerle sabit senaryolar) haklı bir eleştiriyle düzeltildi: sabit senaryolar tükenir, uygulama biter. Çözüm sonlu içerik yerine **hiç bitmeyen canlı bir lig** kurmak oldu; geçmiş veri hesabı ayrı bir özellik olarak kaldı.

**Ne inşa ediyoruz:** Kullanıcı kayıt olunca 100.000 TL sanal bakiye alır. Gerçek piyasa fiyatlarıyla kripto, döviz, altın ve gümüş alıp satar. Haftalık ligde arkadaşlarıyla yüzde getiriye göre yarışır. Geçmiş bir tarih ve tutar seçip "o gün alsaydım bugün ne olurdu" hesabını görebilir.

**Bu proje neden öğretiyor:** Backend sadece satır saklamıyor, karar veriyor ve hesap yapıyor — bakiye yetiyor mu, emir hangi fiyattan geçer, para girişleri varken getiri yüzdesi nasıl hesaplanır. Portfolyoda ve mülakatta anlatılacak şey bunlar.

---

## 2. Kilitlenen kararlar

| # | Karar | Gerekçe |
|---|---|---|
| 1 | Lig **haftalık**, sıralama **yüzde getiriye (TWR)** göre | Mutlak bakiye sıralaması "kim erken geldi"yi ölçer; günlük bonus yüzünden yeni kullanıcı asla kazanamaz |
| 2 | Gerçek parayla sanal bakiye satışı **Faz 3'e** | Şemada yer açılır, MVP'de yapılmaz. Mağaza IAP zorunluluğu, tüzel kişilik gerekliliği ve lig adaletinin bozulması |
| 3 | Varlıklar: **kripto + döviz + altın + gümüş** | Verisi ücretsiz, 7/24 açık — borsa saati, tatil ve takas kuralı karmaşıklığı yok. BIST Faz 3. *Gümüş 17 Ağu 2026'da eklendi: LBMA'da altınla aynı kaynak ve biçim* |
| 4 | **Fiyatı sunucu belirler** | Client'tan gelen fiyata güvenmek ligi ilk gün kırar |
| 5 | İş bölümü **dikey şeride** göre | Kimse "frontend'ci" değil; ikimiz de API ve React Native yazıyoruz, farklı alanlarda |
| 6 | Kripto **USD'de** çekilir, **TCMB kuruyla** TL'ye çevrilir | Doğrulama sonucu — aşağıya bak |

---

## 3. Veri kaynakları (doğrulandı)

Ayrıntılı rapor: [00-veri-saglayici-dogrulama.md](00-veri-saglayici-dogrulama.md)

| Kaynak | Sağlayıcı | Anahtar | Derinlik |
|---|---|---|---|
| Kripto | **Binance public API** | Gerekmiyor | 17 Ağu 2017 |
| Döviz | **TCMB kurlar XML** | Gerekmiyor | En az 2017 |
| Altın | TCMB EVDS | Ücretsiz kayıt | Doğrulanacak |
| TÜFE | TCMB EVDS | Aynı anahtar | Doğrulanacak |

**CoinGecko elendi:** ücretsiz katmanı tarihsel veriyi son 365 günle sınırlıyor. "2020'de alsaydın" özelliğinin tamamını imkânsız kılıyordu.

**Kripto neden USD üzerinden:** Binance'in TRY paritesi ancak Aralık 2019'a gidiyor, USDT paritesi 2017'ye. Ayrıca TL çevrimini borsa paritesinden değil resmî merkez bankası kurundan yapmak daha doğru.

**⚠️ Bilinen tuzak:** TCMB hafta sonu ve tatillerde kur yayımlamıyor (doğrulandı: 14-15 Mart 2020 → HTTP 404). Kripto ise 7/24 işlem görüyor. Hafta sonu fiyatları **son iş gününden ileri doldurulacak (forward-fill)**, kural tek bir dosyada olacak ve testi yazılacak. Yoksa hafta sonu emirleri sessizce yanlış fiyatlanır.

---

## 4. Stack

| Katman | Seçim | Not |
|---|---|---|
| Mobil | React Native + Expo + TypeScript | |
| Backend | Node + TypeScript + Express + Zod | Kendi REST API'mizi yazmak asıl öğrenme hedefi. Framework'ten çok katman disiplini önemli: `route → service → repository` |
| Veritabanı | PostgreSQL (local: Docker · uzak: Neon free) | |
| ORM | Drizzle | SQL'e yakın durur, öğrenme hedefiyle uyumlu |
| Auth | Kendi JWT'miz (access + refresh, argon2) | Hazır auth "API mantığını kavramak" hedefini ıskalar |
| Zamanlanmış işler | `node-cron` (süreç içi) | MVP için yeterli; çok örnekli dağıtımda kırılır |
| Dağıtım | Railway/Render · Neon · Expo EAS | Hepsi ücretsiz katman |

---

## 5. Mimari

```
mobil (Expo)  ──HTTPS──>  API (Express)  ──>  PostgreSQL
                               │
                               ├── price-fetcher  (cron, 60 sn)  ──> Binance + TCMB
                               ├── league-closer  (cron, haftalık)
                               └── alert-checker  (cron, 5 dk)
```

**Kritik karar — fiyatlar kendi veritabanımızda.** Dış sağlayıcı her istekte çağrılmaz. Cron periyodik çeker, `price_history`'ye yazar, API oradan okur. Sonuç: rate limit yemeyiz, sağlayıcı düşse bile uygulama çalışır, tüm kullanıcılar aynı fiyatı görür, geçmiş veri bizde birikir.

Sağlayıcılar `MarketDataProvider` arayüzünün arkasında durur ve **USD** döner. TL çevrimi ayrı bir katmanda (`lib/fx.ts`) yapılır — bu ayrım şart, aksi hâlde iki farklı endişe tek adapter'a karışır.

---

## 6. Sayı hassasiyeti

Projenin en kolay bozulacak yeri burası.

| Tür | Tip | Kural |
|---|---|---|
| Para (bakiye, tutar, komisyon) | `bigint`, **kuruş** | `float` yasak. 100 TL = `10000n` |
| Fiyat | `numeric(24,8)` | Küçük coinler kuruş altı hassasiyet ister |
| Miktar | `numeric(28,10)` | 0,00042 BTC gibi |

Çarpma ve bölme `numeric`/`bigint` ile yapılır, **sonuç tek bir yerde kuruşa yuvarlanır** (`money.ts`). Yuvarlama kuralı `ROUND_HALF_UP`, tek fonksiyonda. Bu dosya en çok test edilen dosya olacak.

---

## 7. Veri modeli

```
users                (id, email, password_hash, display_name, is_public, created_at)
refresh_tokens       (id, user_id, token_hash, expires_at, revoked_at)
devices              (id, user_id, expo_push_token, created_at)

assets               (id, symbol, name, kind[crypto|fx|metal], is_active, sort_order)
price_history        (asset_id, ts, price_try numeric(24,8))     PK(asset_id, ts)
inflation_index      (month, tufe_index)

accounts             (user_id PK, cash_kurus bigint CHECK >= 0)
holdings             (user_id, asset_id, quantity numeric(28,10)) PK(user_id, asset_id)
                                                                  CHECK quantity >= 0
orders               (id, user_id, asset_id, side[buy|sell], quantity,
                      price_try, gross_kurus, fee_kurus, net_kurus,
                      note,                                       -- karar notu
                      idempotency_key, executed_at)
                     UNIQUE(user_id, idempotency_key)

cash_movements       (id, user_id, kind[signup_bonus|daily_bonus|buy|sell|fee],
                      amount_kurus, order_id, created_at)
portfolio_snapshots  (user_id, ts, total_value_kurus, reason[daily|pre_flow|post_flow|league])

league_periods       (id, starts_at, ends_at, status[open|closed])
league_entries       (period_id, user_id, start_value_kurus, end_value_kurus,
                      twr_pct, rank)                              PK(period_id, user_id)

friendships          (requester_id, addressee_id, status[pending|accepted|blocked])
price_alerts         (id, user_id, asset_id, direction[above|below],
                      threshold_try, is_active, last_fired_at)
```

**`cash_movements` bu şemanın omurgası.** Her para girişi ve çıkışı değişmez bir kayıt. TWR hesabı, işlem geçmişi ve ileride her rapor buradan türer. Sonradan eklersek geçmiş veri olmaz.

**`accounts.cash_kurus CHECK >= 0`** — bakiyenin eksiye düşmemesini koda değil veritabanına yaptırıyoruz. Kod hatalı yazılsa bile veri bozulmaz.

Faz 3 için şemada yer açılıyor, kullanılmıyor: `purchases` (gerçek parayla bakiye), `bist` varlık türü.

---

## 8. Üç kritik hesaplama

### 8.1 Emir gerçekleştirme — race condition

`POST /orders` · gövde `{ assetId, side, quantity, note? }` · başlık `Idempotency-Key`

```
BEGIN
  SELECT * FROM accounts WHERE user_id = ? FOR UPDATE     -- satır kilidi
  fiyat = price_history'den en güncel kayıt
  fiyat 120 saniyeden eskiyse -> 503
  gross = quantity × fiyat        -> kuruşa yuvarla
  fee   = gross × 0.001           -> kuruşa yuvarla
  alım:  cash -= gross + fee      (CHECK zaten koruyor)
  satım: holding yeterli mi, cash += gross - fee
  orders + cash_movements + holdings yaz
  portfolio_snapshots'a pre_flow / post_flow yaz
COMMIT
```

`UNIQUE(user_id, idempotency_key)` sayesinde ağ hatasında tekrarlanan istek ikinci emri yaratmaz.

**Bu, projenin anlatılacak hikâyesi.** Testi de bu: iki eşzamanlı alım emrinde bakiye eksiye düşmemeli.

### 8.2 TWR — zaman ağırlıklı getiri

Naif `(şimdiki / başlangıç) - 1` yanlıştır: günlük 1.000 TL bonusu kazanç sanar. Doğrusu dönemi her para girişinde bölmek:

```
Her nakit hareketinde (bonus dahil):
  1. hareketten HEMEN ÖNCE portföy değerini hesapla -> snapshot(pre_flow)
  2. alt dönem getirisi:  r = V_önce / V_altdönem_başı - 1
  3. hareketi uygula -> snapshot(post_flow)

TWR = Π(1 + rᵢ) - 1
```

Saf fonksiyon olarak yazılır, veritabanına dokunmaz, girdi olarak snapshot dizisi alır.

### 8.3 "Ya alsaydın"

`GET /what-if?assetId=…&date=2020-03-12&amountKurus=1000000`

Sunucu: o tarihteki fiyat → miktar → bugünkü fiyat → bugünkü değer → **nominal getiri** ve TÜFE ile düzeltilmiş **reel getiri**. Türkiye'de nominal getiri yanıltıcıdır; reel getiriyi göstermek bu özelliğin asıl değeri.

---

## 9. API sözleşmesi

```
POST   /auth/register       POST /auth/login    POST /auth/refresh   POST /auth/logout
GET    /me                  PATCH /me
GET    /assets              GET  /assets/:symbol
GET    /assets/:symbol/history?range=1d|1w|1m|1y|max
GET    /portfolio           GET  /portfolio/history?range=
POST   /orders  (Idempotency-Key)     GET /orders
GET    /what-if?assetId&date&amountKurus
GET    /leagues/current     GET  /leagues/current/leaderboard    GET /leagues/history
GET    /friends             POST /friends/requests
POST   /friends/requests/:id/accept   DELETE /friends/:id
GET    /friends/:id/portfolio
GET    /alerts              POST /alerts        DELETE /alerts/:id
POST   /devices
```

Tek tip hata formatı: `{ error: { code, message, details? } }`. Doğrulama Zod ile, **her endpoint'te**. Anlamlı durum kodları — bakiye yetmezse `422`, çift emirde `409`, fiyat bayatsa `503`.

**Gizlilik:** `users.is_public` kapalıysa arkadaş sadece yüzde getiriyi görür, varlık dağılımını görmez. Sanal para olduğu için varsayılan açık.

---

## 10. Mobil ekranlar

| Ekran | İçerik |
|---|---|
| Giriş / Kayıt | E-posta + şifre |
| Piyasa | Varlık listesi, fiyat, 24s değişim |
| Varlık detayı | Grafik, al/sat, **ya alsaydın** hesaplayıcı |
| Portföy | Toplam değer, getiri, dağılım, işlem geçmişi + karar notları |
| Lig | Haftalık sıralama, kendi sıran, kalan süre |
| Arkadaşlar | Liste, istek gönder/kabul, arkadaş portföy özeti |
| Profil | Ayarlar, alarmlar, gizlilik |

---

## 11. Fazlar

| Faz | Süre | Bitiş kriteri |
|---|---|---|
| **0 · Temel** | ~1 hafta | İkimiz de local'de çalıştırıyoruz · API canlıda · şema kurulu · para aritmetiği testleri geçiyor · veri kaynakları doğrulanmış |
| **1 · Yürüyen iskelet** | ~2 hafta | Kayıt ol → 100.000 TL gör → BTC al → portföyde görün → uygulamayı kapat aç → duruyor. Eşzamanlı iki emir testi geçiyor |
| **2 · Ürün** | ~3 hafta | İki gerçek hesap arkadaş oluyor, haftalık ligde birbirini yüzde getiriye göre görüyor, sıralama sunucuda hesaplanıyor |
| **3 · Derinlik** | takvime alınmadı | Fiyat alarmı + push · haftalık özet · karar profili · paylaşılabilir kart · BIST · gerçek para |

Görev dağılımı: [02-gorev-paylasimi.md](02-gorev-paylasimi.md)

---

## 12. Kapsam dışı

Mesajlaşma ve forum (moderasyon yükü) · kaldıraç ve vadeli işlem (karmaşıklık + kumar algısı) · WebSocket canlı fiyat akışı (MVP'de periyodik çekim yeterli) · rozet sistemi (lig zaten motivasyon veriyor) · gerçek para (Faz 3).

**Bu listeye bir şey eklemek istediğimizde sorulacak soru:** *"Bu, mevcut fazın bitiş kriterine hizmet ediyor mu, yoksa sonraki faza mı ait?"*

---

## 13. Riskler

| Risk | Etki | Azaltma |
|---|---|---|
| Altın ve TÜFE için EVDS anahtarı alınamazsa | Altın ve reel getiri düşer | TÜFE elle girilebilir (~100 satır). Altın MVP'den çıkar, ürün ayakta kalır |
| Binance rate limit'i | Fiyatlar bayatlar | Kendi cache'imiz + tek merkezi cron; kullanıcı sayısından bağımsız sabit istek |
| TCMB hafta sonu boşluğu | Hafta sonu emirleri yanlış fiyatlanır | Forward-fill kuralı tek dosyada + testi |
| `node-cron` süreç içi | Çok örnekli dağıtımda mükerrer çalışır | MVP'de tek örnek; ölçekte ayrı worker |
| TWR hesabının yanlış olması | Lig anlamsızlaşır, fark edilmesi zor | Saf fonksiyon + elle hesaplanmış vaka testleri |
| Kapsam kayması | Proje bitmez | Faz 3 takvime alınmadı; kapsam dışı listesi yazılı |

---

## 14. Doğrulama

**Birim testleri** (saf fonksiyonlar — projenin en sağlam parçası):
- `money.ts` — kuruş yuvarlama, komisyon, `float` sızmadığının kontrolü
- `twr.ts` — bonussuz dönem, tek bonuslu, çok bonuslu, zarar durumu
- `fx.ts` — hafta sonu forward-fill
- `what-if.ts` — bilinen tarih aralığı için nominal ve reel getiri

**Entegrasyon testleri** (gerçek Postgres):
- Eşzamanlı iki alım emri → bakiye eksiye düşmüyor, biri `422` alıyor
- Aynı `Idempotency-Key` ile iki istek → tek emir
- Bayat fiyatla emir → `503`
- Arkadaş olmayan kullanıcının portföyü → `403`

**Uçtan uca (telefonda, Expo Go):**
1. Kayıt ol → bakiye 100.000 TL
2. BTC al → portföy ve nakit değişti, işlem geçmişinde göründü
3. Uygulamayı kapat aç → veri duruyor
4. İkinci hesapla arkadaş ol → lig sıralamasında ikisi de görünüyor
5. Ligi elle kapat → TWR hesaplanıp sıralama oluştu
6. "Ya alsaydın": 12 Mart 2020, 10.000 TL, BTC → nominal ve reel sonuç geliyor
