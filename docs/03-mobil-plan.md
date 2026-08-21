# Mobil Plan — Faz 1'in son maddesi

> Backend Faz 1'de bitti. Kalan tek iş ekranlar. Bu dosya onun planı.

---

## 1. Nereden başlıyoruz

`apps/mobile` şu an **Expo şablonu**, 20 satırlık `App.tsx`'ten ibaret.

| | Sürüm |
|---|---|
| Expo | 57 |
| React Native | 0.86 |
| React | 19.2 |
| TypeScript | 6.0 |

Kurulu **olmayan** her şey: navigasyon, API istemcisi, token saklama, tema, ortak bileşenler.

**Hazır olan:** API'nin tamamı. `GET /assets`, `POST /orders`, `GET /portfolio`, `POST /auth/register|login|refresh` — hepsi çalışıyor ve elle doğrulandı.

---

## 2. Şerit sorunu — önce bu çözülmeli

`02-gorev-paylasimi.md` Faz 1 tablosunda **mobil kabuk Zeynep'te**: navigasyon, tema, API istemcisi, ortak bileşenler. Giriş ve Kayıt ekranları da onda.

Ama Zeynep Faz 2'ye geçmiş durumda (lig, arkadaşlık, TWR, what-if). Kabuk gelmezse Batuhan'ın iki ekranı da başlayamaz.

**Karar önerisi: kabuğu Batuhan yazar.**

| + | − |
|---|---|
| Bekleme yok, iş bugün başlar | Zeynep'in görevini almak — daha önce ters yönde olmuştu (what-if) |
| Navigasyon, API istemcisi, token saklama zaten öğrenilmesi gereken şeyler | Sonradan o kendi kabuğunu yazarsa yeniden çalışma riski |
| Giriş ekranı için "geliştirici sürümü" yeterli; gerçeğini o yazar | |

⚠️ **Başlamadan önce Zeynep'e tek cümle:** *"Kabuğu ben kuruyorum, Giriş/Kayıt'ın gerçek tasarımı sende kalsın."* Yazılı onay olmadan başlanmaz — aynı hatayı ters yönde tekrarlamayalım.

---

## 3. Teknik kararlar

### 3.1 Navigasyon → **expo-router**

Dosya tabanlı yönlendirme. `app/` klasöründeki her dosya bir ekran.

| Seçenek | + | − |
|---|---|---|
| **expo-router** | Expo'nun güncel önerisi, az kalıp kod, sekmeli yapı hazır geliyor | Şablonu `App.tsx`'ten `app/` yapısına taşımak gerekiyor |
| react-navigation | Daha açık, daha çok örnek | Her ekran elle kaydediliyor, kalıp kod fazla |

**Seçim: expo-router.** Taşıma maliyeti bir kereliğine ve küçük; karşılığında dört ekranı klasör yapısıyla yönetiyoruz.

### 3.2 Veri çekme → **elle yazılmış hook**

15 saniyede bir fiyat çekmek gerekiyor, ekran kapalıyken durmalı.

| Seçenek | + | − |
|---|---|---|
| **Elle `useApi` hook'u** | Ne olduğunu görürsün — projenin birinci kuralı bu. ~40 satır | Önbellek, yeniden deneme gibi şeyleri kendin yazarsın |
| TanStack Query | Önbellek, polling, odak yönetimi hazır | Kara kutu; bu aşamada öğretmiyor |

**Seçim: elle.** İki ekran için kütüphane fazla. Faz 2'de ekran sayısı artarsa TanStack Query'ye geçilir — o zaman *neden* gerektiğini bilerek geçilir.

### 3.3 Token saklama → **expo-secure-store**

| Seçenek | Nerede tutar |
|---|---|
| `AsyncStorage` | Düz metin dosyası — **kullanma** |
| **`expo-secure-store`** | iOS Keychain / Android Keystore, işletim sistemi şifreliyor |

Token bir kimlik bilgisi. Düz metin saklamak, telefona erişen birinin hesabı ele geçirmesi demek.

### 3.4 Para → **Faz 1'de istemcide aritmetik YOK**

Sunucu her şeyi **string** gönderiyor: `"3085651.86474600"`, `"9691126"`.

İstemcinin Faz 1'de yapması gereken tek şey **biçimlendirme**:

```
"9691126"  ->  "96.911,26 ₺"
```

Bu bir metin işlemi, hesap değil. `number`'a hiç çevrilmiyor.

⚠️ **`Number(priceTry)` yazma.** Ekranda doğru görünür, sonra bir yerde toplama yaparsın ve kuruşlar sessizce kayar. Sunucudan gelen sayı ekrana kadar string kalır.

**Ne zaman aritmetik gerekir:** "0,001 BTC alırsam kaç TL tutar" önizlemesi. Faz 1'de yapmıyoruz — kullanıcı miktarı girer, emri gönderir, sunucu gerçek tutarları döner. Önizleme Faz 2'de gelirse `money.ts`'in `packages/contracts`'a taşınması gerekecek.

### 3.5 Bağlantı → **LAN IP + Expo Go**

Telefon `localhost:3000`'e ulaşamaz — `localhost` telefonun kendisi demektir. Bilgisayarın yerel ağ adresi gerekiyor:

```powershell
ipconfig    # IPv4 Address, örn. 192.168.1.42
```

```
API_BASE_URL = http://192.168.1.42:3000
```

⚠️ **Ofis ağı riski:** kurumsal WiFi'larda *client isolation* açık olabilir — cihazlar birbirini görmez. O durumda kod hatasız olduğu hâlde bağlantı kurulmaz.

Yedek plan: telefonun hotspot'unu aç, bilgisayarı ona bağla. Ağ küçülür, izolasyon olmaz.

---

## 4. Ekranlar

| Ekran | Uç nokta | Sahip |
|---|---|---|
| Giriş (geliştirici sürümü) | `POST /auth/login` | Batuhan — geçici |
| Kayıt | `POST /auth/register` | **Zeynep** |
| **Piyasa** | `GET /assets` | **Batuhan** |
| **Al / Sat** | `POST /orders` | **Batuhan** |
| **Portföy** | `GET /portfolio` | **Batuhan** |

### Piyasa

Varlık listesi: sembol, ad, fiyat, son güncelleme.

- **15 saniyede bir** yenilenir, sadece ekran açıkken
- `asOf` alanı "5 sn önce" olarak gösterilir — veri tazeliği kullanıcıdan gizlenmez
- Aşağı çekince yenileme (pull to refresh)
- Satıra dokununca Al/Sat açılır

### Al / Sat

- Miktar girişi (**metin alanı**, sayı değil — ondalık ayırıcı sorunları ve float için)
- `Idempotency-Key` istemcide üretilir: `crypto.randomUUID()`
- ⚠️ Anahtar **butona basıldığında** üretilir, yeniden denemede **değişmez.** Her denemede yeni anahtar üretilirse idempotency'nin hiçbir anlamı kalmaz
- Sunucudan dönen `422`/`503` kullanıcıya anlamlı mesajla gösterilir
- Buton isteği gönderirken kilitlenir (çift dokunma koruması — ama asıl koruma sunucuda)

### Portföy

- Toplam değer, nakit, kâr/zarar (yüzde ile)
- Pozisyon listesi: miktar, güncel fiyat, değer, portföy payı
- `hasIncompletePrices` doğruysa **uyarı göster** — bazı fiyatlar alınamadı, toplam eksik
- ⚠️ Kâr/zarar **lig sıralaması değil.** Ekranda böyle etiketlenmemeli

---

## 5. Sıra

Her adım bir öncekini gerektiriyor.

### Adım 0 · Zeynep'e mesaj
Kabuk devri onayı. **Onay gelmeden başlanmaz.**

### Adım 1 · İskelet
- `expo-router` kurulumu, `App.tsx` → `app/` yapısına geçiş
- Sekmeler: Piyasa · Portföy
- Telefonda boş ekranlar görünüyor

**Bitti sayılır:** Expo Go'da uygulama açılıyor, sekmeler arasında geçiliyor.

### Adım 2 · API istemcisi + token
- `apiFetch(path, options)` — taban adres, `Authorization` başlığı, hata biçimi
- `expo-secure-store` ile token saklama
- Geliştirici giriş ekranı

**Bitti sayılır:** Telefondan giriş yapılıyor, token saklanıyor, uygulama kapanıp açılınca **giriş korunuyor.**

⚠️ Bu adım **bağlantı meselesini çözen** adım. LAN IP, ofis WiFi, hepsi burada çıkar. En riskli adım bu — erken yapılmasının sebebi o.

### Adım 3 · Piyasa ekranı
- `GET /assets`, 15 saniyelik yenileme, `asOf` göstergesi
- Para biçimlendirme yardımcısı (`formatTRY`)

**Bitti sayılır:** Telefonda gerçek BTC/ETH fiyatları görünüyor ve **kendiliğinden değişiyor.**

### Adım 4 · Al / Sat
- Miktar girişi, `Idempotency-Key`, hata mesajları

**Bitti sayılır:** Telefondan BTC alınıyor, sunucu 201 dönüyor.

### Adım 5 · Portföy ekranı
- `GET /portfolio`, pozisyonlar, kâr/zarar

**Bitti sayılır:** Alınan BTC portföyde görünüyor, değeri doğru.

---

## 6. Bilinen tuzaklar

1. **`Number(priceTry)`** — para string kalmalı. En kolay yapılacak ve en zor fark edilecek hata
2. **`localhost`** — telefondan çalışmaz, LAN IP gerekir
3. **Client isolation** — ofis WiFi'ı engelleyebilir; kodda hata aramadan önce hotspot dene
4. **Idempotency anahtarı** — her denemede yeniden üretilirse koruma çalışmaz
5. **Ekran kapalıyken yenileme** — `AppState` ile durdurulmazsa pil yakar, sunucuya boş yük biner
6. **Access token süresi** — kısa ömürlü. `401` alınca `POST /auth/refresh` ile yenilenmeli, kullanıcı fark etmemeli
7. **`hasIncompletePrices`** — göz ardı edilirse ekran sessizce düşük toplam gösterir

---

## 7. Faz 1 bitiş kriteri

`02-gorev-paylasimi.md`'den:

> Kayıt ol → 100.000 TL gör → BTC al → portföyde görün → uygulamayı kapat aç → duruyor. Eşzamanlı iki emir testi geçiyor.

| Adım | Durum |
|---|---|
| Kayıt ol | ✅ API · ❌ ekran |
| 100.000 TL gör | ✅ API · ❌ ekran |
| BTC al | ✅ API · ❌ ekran |
| Portföyde görün | ✅ API · ❌ ekran |
| Kapat-aç, duruyor | ❌ (Adım 2'de çözülür) |
| Eşzamanlı emir testi | ✅ `concurrency-check.ts` |

**Backend tamam. Kalan her şey bu dosyadaki 5 adım.**

---

## 8. Tasarım — bilerek ertelendi

Renk, tipografi, ekran düzeni henüz konuşulmadı.

Bu plandaki ekranlar **çalışır ama süssüz** olacak. Sebebi: bağlantı, veri akışı ve para biçimlendirme çözülmeden tasarıma girmek, iki işi aynı anda yapmak demek. Biri bozulduğunda hangisinden olduğu anlaşılmaz.

Adım 5 bittiğinde uygulama uçtan uca çalışıyor olacak — tasarım turu ondan sonra, ayrı bir iş olarak.
