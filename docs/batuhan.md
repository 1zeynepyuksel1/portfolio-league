# Batuhan — Şerit A · Piyasa & Portföy

Plan: [01-plan.md](01-plan.md) · İş bölümü: [02-gorev-paylasimi.md](02-gorev-paylasimi.md)

**Uçtan uca sorumluluğun:** Dış fiyat verisi → emir → portföy değeri → ekran.

Bu şerit projenin "backend gerçekten bir şey hesaplıyor" tarafı. Emir motoru ve para aritmetiği mülakatta anlatacağın şeyler.

---

## 📖 OKUMA BORCU — henüz okumadığın dosyalar

CLAUDE.md'nin en önemli kuralı: *yazılan her satırın **neden** öyle olduğunu anlatabilmelisin.*
Aşağıdakiler yazıldı ve çalışıyor ama sen okumadın. Tasarım işi bitince buraya dön.

### 13. Çıkmaz sokaklar, para birimi merceği ve Zeynep'in yeni cron'ları — 25 Ağu 2026

Bu turun ortak teması: **hata mesajı doğru, çıkış yolu yok.** Üç ayrı yerde
aynı sınıf hata çıktı ve üçü de ancak uygulamayı gerçekten kullanınca görüldü.

#### Oturum ve çıkmaz sokaklar
| Dosya | Ne sorulacak |
|---|---|
| `mobile/src/api/client.ts` (401 işleme) | Erişim token'ı 15 dakikada ölüyordu ve devreye giren hiçbir şey yoktu — uygulama neden KİLİTLENİYORDU? `isRetry` bayrağı hangi sonsuz döngüyü kesiyor? `refreshInFlight` kilidi olmasaydı 4 paralel istek 401 alınca ne olurdu? `/auth/` neden muaf? |
| `mobile/App.tsx` (`setSessionExpiredHandler`) | `client.ts` React'i tanımıyor — depoyu temizlemek neden YETMİYOR? Geri çağrı sökülürken neden `null`'a çekiliyor? |
| `mobile/src/screens/AssetDetailScreen.tsx` (sabit başlık) | "‹ Geri" ScrollView'un içindeyken neden kayboluyordu? Kaçış yolu neden her zaman görünür olmalı? |
| `mobile/src/screens/FriendsScreen.tsx` · `LeaderboardScreen.tsx` · `App.tsx` | Ekran YAZILMIŞ ve import EDİLMİŞ ama hiç çizilmiyordu — sonucu backend'de değil nerede görünüyordu? Rozet neden "bildirim" değil ama yine de gerekli? Sayaç neden AYRI try/catch içinde? |

#### Cüzdan ve para birimi merceği
| Dosya | Ne sorulacak |
|---|---|
| `mobile/src/screens/PortfolioScreen.tsx` (net tutar) | Net tutar neden yüzdenin SOLUNA konamadı? "Sütun eklemek yatay bütçeyi büyütmez" ne demek — 390 pikselde hesabı yap. `profitCents` neden ekranda hesaplanmıyor? |
| `market/repository.ts` (`usdRate` join) | Kur join'i neden seyreltmeden SONRA? Alt sorguya koysaydık kaç satır taranırdı? `usdRate` neden `null` olabiliyor ve çağıran neden `1` varsaymıyor? |
| `market/router.ts` (`?currency=` grafik + 24s) | ⚠️ Bütün eğriyi BUGÜNKÜ kura bölmek neden yanlış — eğrinin şekli ne olurdu? (Ölçüldü: BTC 3 ay, TL +%12,17 · dolar +%6,61.) 24 saat özeti neden güncel kurla çevrilebiliyor ama grafik çevrilemiyor? |
| `mobile/src/components/PriceChart.tsx` (`price` alanı) | Alan adı neden `priceTry` olmaktan çıktı? Birimi sayının ADINA gömmek neden tehlikeli? Çevrim neden ekranda değil sunucuda? |

#### Zeynep'in yeni yazdıkları — hiç okumadın
| Dosya | Ne sorulacak |
|---|---|
| `leagues/twr-engine.ts` | Faz 2'nin bitiş kriteriydi. `packages/contracts/src/twr.ts`'teki `calculateTwr` ile ilişkisi ne? Alt dönemler nasıl bölünüyor? |
| `leagues/cron.ts` | Haftalık lig nasıl kapanıp yenisi açılıyor? Kapanma anında sıralama neye göre donuyor? |
| `portfolio/cron.ts` | `portfolio_snapshots` TWR'nin girdisi — günde bir yazmak neden yeterli? |
| ✅ `market/price-cron.ts` (TWR senkronu) | ⚠️ Bu dosyayı OKUDUN ama sonra DEĞİŞTİ. Her turda `syncAllLeagueEntriesAndRanks` çağrılıyor — 15 saniyelik tur bütçesine etkisi ölçülmedi. |

### 14. Profil, arkadaşlık ve dokuz sessiz hata — 25-26 Ağu 2026

Bu turun tamamı tek bir dersin etrafında: **hiçbiri patlamıyordu.** Dokuz
hata çıktı, hepsi makul görünen yanlış sayı ya da görüntü üretiyordu.
Üçünü test, üçünü TypeScript, üçünü Batuhan ekrana bakarak buldu.

#### Profil — yeni modül
| Dosya | Ne sorulacak |
|---|---|
| `profile/service.ts` | Görünürlük kuralı neden TEK yerde? Arkadaşlık `is_public`'i neden EZİYOR? Kapalı profilde neden 404 değil de boş alanlar dönüyor? Arkadaş sayısı neden yalnızca kendi profilinde HESAPLANIYOR? |
| `profile/repository.ts` | Neden `select *` yok, alanlar tek tek sayılıyor? Neden yalnızca `accepted` arkadaşlık sayılıyor — sadece satırın varlığına baksaydık ne olurdu? `pendingBetween` neden yön döndürüyor, boolean değil? |
| `profile/router.ts` | Gizlilik neden Zod ile doğrulanıyor — `Boolean("false")` ne döner? Herkese açık profil neden yine de giriş istiyor? |
| `mobile/src/screens/ProfileScreen.tsx` | Kendi profilin ve başkasınınki neden TEK ekran? Gizlilik anahtarı neden ayrı state? Neden mutlak tutar hiçbir yerde yok? |
| `mobile/src/components/TabBar.tsx` | Beşinci sekme eklenince "Ya alsaydın" neden "Alsaydın" oldu? |
| `apps/api/src/app.ts` | ⚠️ İKİ router aynı adrese bağlıydı. Express bunu nasıl çözüyor ve neden tehlikeli? |

#### Lig kâr hesabı — iki hata
| Dosya | Ne sorulacak |
|---|---|
| `leagues/twr-engine.ts` | ⚠️ `buy`/`fee` neden DIŞ AKIŞ DEĞİL? Akış sayılınca TWR neden %99.900 çıkıyordu ve bu neden INSERT'i patlatıyordu? `signup_bonus` neden dış akış AMA alt dönem bölmüyor? Beyaz liste neden kara listeden güvenli? |
| `leagues/repository.ts` (sıralama) | ⚠️ `ORDER BY rank, twr` neden DAİRESEL? Sync bu listeyi alıp yeniden rank yazınca ne oluyordu? |
| `leagues/service.ts` | `username` repository'de seçiliyordu ama yanıta çıkmıyordu — alanları tek tek sayan eşlemelerin bedeli ne? |

#### Arkadaşlık
| Dosya | Ne sorulacak |
|---|---|
| `friends/friends.schema.ts` | ⚠️ Neden `toLocaleLowerCase('tr')` KALDIRILDI — "GMAIL.COM" ne oluyordu? Küçültme hangi katmana taşındı ve neden? ⚠️ `.min(1)` neden transform'dan SONRA olmalı — sadece "@" yazılınca ne oluyordu? |
| `friends/repository.ts` | Kullanıcı adı araması neden `lower() = lower()`? Bunun indeks maliyeti ne? |
| `friends/service.ts` | Tek alan iki anlam: ayrım nasıl yapılıyor? E-posta neden serviste küçültülüyor? |

#### Cüzdan ve dağılım çubuğu
| Dosya | Ne sorulacak |
|---|---|
| `mobile/src/screens/PortfolioScreen.tsx` (çubuk) | ⚠️ Dilimler neden `sorted` değil `barPositions`'tan kuruluyor? Kesilmiş listeden kurulunca NAKİT yüzdesine ne oluyordu? Çubuk ile satır rozetleri neden farklı renk gösteriyordu? |
| `mobile/src/components/AllocationBar.tsx` | ⚠️ Palet üç kez değişti. Kırmızı/yeşil neden önce çıkarıldı, sonra geri kondu? Kabul edilen risk ne? |
| `mobile/src/screens/AssetDetailScreen.tsx` (sabit çubuk) | Al/Sat neden `ScrollView` dışına alındı? "Ekranın iki ucu sabit" deseni başka nerede var? |

#### Ya alsaydın
| Dosya | Ne sorulacak |
|---|---|
| `what-if/repository.ts` | ⚠️ Aynı dosyada İKİ `endOfDay` var, biri `Date` biri metin — hangisi neden? Ham `sql` şablonuna `Date` bağlanınca ne oluyor? `::timestamptz` neden değil? |

#### Oturum ve para birimi (25 Ağu)
| Dosya | Ne sorulacak |
|---|---|
| `mobile/src/api/client.ts` | 401 işleme: `isRetry` hangi döngüyü kesiyor? `refreshInFlight` olmasaydı 4 paralel istek ne yapardı? |
| `market/router.ts` (`?currency=`) | Bütün eğriyi bugünkü kura bölmek neden yanlış — eğrinin ŞEKLİ ne olurdu? |

### 1. Döviz ve varlık listesi genişlemesi — 21 Ağu 2026
| Dosya | Ne sorulacak |
|---|---|
| ✅ `market/binance.ts` | `PAIRS` neden kural (`symbol + "USDT"`) değil elle tablo? Coin'lerin başlangıç tarihleri neden koda YAZILMADI? |
| ✅ `market/tcmb.ts` | `FX_UNITS` neden var? JPY neden 100'e bölünüyor? Önbellek neden kuru değil **belgeyi** tutuyor? `parseRate` neden önce `<Currency>` bloğunu izole ediyor? |
| ✅ `market/tcmb.test.ts` | "kur boşsa sonraki para biriminin kuruna sızmaz" testi hangi hatayı kilitliyor? |
| ✅ `market/evds.ts` | `fetchFxHistory` neden `Price` döndürüyor, ham metin değil? Seri kalıbı `TP.DK.{KOD}.A`'daki `.A` ne demek? |
| ✅ `market/price-cron.ts` | `asset.kind === 'fx'` dallanması neden eklendi? Öncesinde ne oluyordu? |
| ✅ `market/price-backfill.ts` | Döviz neden kriptodan **önce** çekiliyor? Döviz neden forward-fill edilmiş hâliyle yazılıyor? |
| ✅ `market/repository.ts` | `AssetKind` neden `$inferSelect`'ten türetiliyor, elle yazılmıyor? |
| ✅ `market/seed.ts` | Fiyat tohumlaması neden tamamen kaldırıldı? `INACTIVE_SYMBOLS` neden ayrı bir UPDATE gerektiriyor? |

### 2. Ayar yükleme ve hata görünürlüğü — 21 Ağu 2026
Bu ikisi **gerçek bir hata ayıklama oturumunun bedeliydi**: kayıt ve giriş
500 veriyordu, `/assets` çalışıyordu, sebebi yarım saat görünmedi.

| Dosya | Ne sorulacak |
|---|---|
| `lib/env.ts` | `.env` neden `import.meta.url`'den bulunuyor, `dotenv/config`'ten değil? `npm run dev:api` ile `npx tsx apps/api/src/server.ts` arasındaki fark neydi? `requireEnv` neden yedek değer kabul etmiyor? |
| `auth/router.ts` | `logUnexpected` neden eklendi? İstemciye giden mesaj neden **değişmedi**? |
| `server.ts` · `market/tufe-backfill.ts` | Tek satır: `dotenv/config` → `lib/env.js`. Neden hepsinin değişmesi gerekti? |

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

### 4. Al/Sat ekranı — 21 Ağu 2026 (Faz 1'i kapatan iş)
| Dosya | Ne sorulacak |
|---|---|
| `mobile/src/lib/order-math.ts` | Sunucunun ölçek matematiği neden **tekrarlandı**? `16` nereden geliyor? `divRound` neden düz bölme değil? `maxBuyableQuantity` neden komisyonu hesaba katıyor ve neden **aşağı** yuvarlıyor? |
| `mobile/src/screens/TradeScreen.tsx` | Idempotency anahtarı neden `useState` değil **`useRef`**? Hangi durumda sıfırlanıyor, hangisinde korunuyor — ve korunmasaydı ne olurdu? Ekrandaki tutar neden "tahmini" diye işaretli? |
| `mobile/src/screens/MarketScreen.tsx` | `onSelectAsset` neden **isteğe bağlı** bir prop? |
| `market/price-cron.test.ts` | "döviz varlığını Binance'e değil TCMB'ye sorar" testi hangi hatayı kilitliyor? |

**Ölçülen sonuç:** istemci tahmini ile sunucu sonucu birebir aynı çıktı —
`gross 369393 · fee 369 · net 369762`. İkisi ayrışsaydı kullanıcı ekranda
bir tutar görüp başka bir tutar öderdi.

### 5. Fiyat grafiği — 22 Ağu 2026
| Dosya | Ne sorulacak |
|---|---|
| `market/ranges.ts` | Kova boyutları neden bu sayılar? Hedef nokta aralığı neden 90-500? `max` için `lookbackSeconds` neden `null`, 0 değil? `startOf` neden `now`'u parametre alıyor? |
| `market/ranges.test.ts` | Test "kod çalışıyor mu"yu değil neyi sınıyor? |
| ✅ `market/repository.ts` (`getPriceSeries`) | `DISTINCT ON (bucket)` + `ORDER BY bucket, ts DESC` birlikte ne yapıyor? Neden `date_trunc` kullanılmadı? Neden ortalama değil **son** fiyat alınıyor? Tarih neden `Date` değil ISO metin + `::timestamp`? Neden `::timestamptz` değil? |
| `market/router.ts` | Seyreltme neden sunucuda, istemcide değil? `range` neden kapalı liste, serbest tarih aralığı değil? |
| `mobile/src/components/PriceChart.tsx` | `Number()` burada neden serbest, `format.ts`'te neden yasak? `y` neden ters çevriliyor? `max === min` olduğunda ne oluyor ve neden **sessiz** bir hata? |
| `mobile/src/screens/AssetDetailScreen.tsx` | Yüzde değişimde float neden kabul edilebilir? Seyrek veri uyarısı neden var? |
| `mobile/src/screens/WhatIfScreen.tsx` | `yearsFor` hangi hata mesajını ortadan kaldırıyor? Varlık değişince seçili yıl neden sınıra çekiliyor? `tooEarly` neden `dateString`'den SONRA tanımlanmak zorunda? |

**Yol boyunca çıkan hata:** iç içe `sql` parçasında JS `Date` bağlamak
`ERR_INVALID_ARG_TYPE` veriyor — düz sorguda çalışıyor, iç içe kullanımda
patlıyor. Beş aralık 0 nokta döndürüyordu ve **benim test betiğim bunu
gizledi** (`d.get('points', [])` yazdığım için 500 yanıtı "0 nokta" gibi
göründü). Ders: testin hatayı yutmadığından emin ol.

**Ölçülen sonuç:** `1y` 365 nokta · `max` 471 nokta (BTC) · SOL `max`
316 nokta, 2020-08-12'den başlıyor — varlık başına gerçek başlangıç.

### 6. `apps/api/src/what-if/` — sen hâlâ okumadın
`service.ts` · `repository.ts` · `what-if.test.ts`

**Zeynep'in yazdığı kısım:** reel getiri formülü `(1+nominal)/(1+enflasyon)−1`,
TÜFE endeksi kullanımı, tutar → miktar çevriminde ölçek matematiği
(`calcGross`'un tersi).

**Sonradan eklenen kısım:** `findTufeIndexOnOrBefore`.
**Ne sorulacak:** enflasyon verisi neden HER ZAMAN gecikmeli? Tam eşleşme
arasaydık ne olurdu? Yanıt neden istenen ayı değil **kullanılan** ayı
bildiriyor?

⚠️ Bu dosyalarda hesabın tamamı `parseFloat` ile yapılıyor — projenin
"para `bigint`, `float` yasak" kuralına aykırı. Gösterim için zararsız
olduğu için şimdilik bırakıldı ama **bilinçli bir borç**, kaza değil.

### 7. Grafiğe detay, yakınlaştırma ve pozisyon kârı — 23 Ağu 2026
| Dosya | Ne sorulacak |
|---|---|
| `market/hourly-backfill.ts` | Neden ayrı bir geri doldurma betiği? `PricePoint`'e `openTime` neden eklendi — `date` yetmiyor muydu? Yetmeseydi 24 saatlik mum ne olurdu? |
| `market/provider.ts` (`Candle`) | Binance'in `1m`'i ile `ranges.ts`'in `1m`'i neden **aynı şey değil**? Bu karışıklık nasıl işaretlendi? |
| `market/binance.ts` (`CANDLE_MS`) | Sayfalama neden sabit bir gün değil kova boyutu kadar ilerliyor? Sabit kalsaydı 5 dakikalık mumlarda ne olurdu? |
| `market/ranges.ts` (`BUCKET_LADDER`, `bucketFor`, `parseWindow`) | Merdivenin en küçüğü neden **5 dakika**? Daha küçük olsaydı kullanıcı ne yaşardı? `range`'in kapalı liste olma kararı neden geri alındı, karşılığında hangi iki koruma kondu? |
| ✅ `market/repository.ts` (`until` parametresi) | Üst sınır neden `null` varsayılanlı? Zorunlu olsaydı mevcut çağıranlar ne olurdu? |
| `portfolio/cost-basis.ts` | Maliyet neden **saklanmıyor**, emir defterinden türetiliyor? `grossCents` değil neden `netCents`? Satışta maliyet neden oranla azaltılıyor? `profitPercent` hangi iki durumda `null` dönüyor ve neden 0 dönmüyor? |
| `mobile/src/components/PriceChart.tsx` (eksen + yakınlaştırma) | Etiket biçimi neden kova boyutuna göre değişiyor? `scrubRef`/`zoomRef` neden var — `PanResponder` içinde doğrudan state okusaydık ne olurdu? İstek neden parmak kalkınca gidiyor, her karede değil? %15 eşiği ne işe yarıyor? |

**Ölçülen sonuç — yakınlaştırma gerçekten çözünürlük artırıyor:**
3 yıl → haftalık/157 · 1 yıl → günlük/365 · 1 ay → 6 saat/121 ·
1 hafta → saatlik/168 · 2 gün → **15 dakika**/193 · 6 saat → **5 dakika**/72.
1 aydan 6 saate inince kova 72 kat inceliyor.

**Ölçülen sonuç — komisyon maliyete gerçekten dahil:** fiyat hiç değişmemiş
bir pozisyon **−%0,10** gösterdi. Bu tam olarak komisyon oranı; `grossCents`
kullansaydık kâr **%0,00** çıkar ve kullanıcı ödediği komisyonu hiç görmezdi.

### 12. Denetim — listede olmayan üç test dosyası (25 Ağu 2026)

Bu üçü `market/` içinde duruyor ama okuma borcuna hiç girmemiş.
Aynı hata sınıfı: kod eklendi, listeye eklenmedi.

| Dosya | Ne sorulacak |
|---|---|
| `market/binance.test.ts` | Sayfalama testi hangi senaryoyu kuruyor? Sahte `fetch` nasıl veriliyor? |
| `market/lbma.test.ts` | Ons→gram beklenen değerleri nereden geldi? Mutfak onsu testi neyi kanıtlıyor? |
| `market/repository.test.ts` | Veritabanı olmadan repository nasıl test ediliyor? |

### 8. Denetim — listeye hiç girmemiş 13 dosya (23 Ağu 2026)

Bu bölüm bir **hatanın telafisi.** Yukarıdaki bölümler yazılırken "asıl iş"
sayılan dosyalar listelendi, yanlarında değişen dosyalar atlandı. Denetimde
13 tanesi çıktı — hepsi benim yazdığım ya da değiştirdiğim kod.

**Neden önemli:** okuma borcu eksikse borç yokmuş gibi görünür. Listeye
girmeyen dosya sorulmayan dosyadır.

#### Emir ve portföy tarafı
| Dosya | Ne sorulacak |
|---|---|
| `orders/orders.schema.ts` | `quantity` neden `number` değil **`string`**? Number olsaydı zincir tam olarak nerede kırılırdı — doğrulamadan önce mi sonra mı? Ondalık sınırı neden şemada, `toAmount` içinde değil? Düzenli ifade negatifi nasıl eliyor? |
| `orders/calculate.test.ts` | Hangi testler yuvarlamayı, hangileri ölçek matematiğini kilitliyor? |
| `portfolio/repository.ts` (`getOrderLedger`) | Emir defteri neden **tarih sırasına göre** okunuyor — sıra bozulsa maliyet ne olurdu? |
| `portfolio/service.ts` | Maliyet hesabı neden servis katmanında birleştiriliyor, repository'de değil? |
| `portfolio/router.ts` | `profitCents` ve `profitPercent` JSON'a nasıl yazılıyor — biri string biri sayı, neden? |
| `portfolio/calculate.test.ts` · `portfolio/cost-basis.test.ts` | Yarım satış testi hangi sayıyı kilitliyor? (735.510 → 367.755) |
| `mobile/src/screens/PortfolioScreen.tsx` | Yeşil/kırmızı kararı neye bakıyor — `profitCents` mi `profitPercent` mi? `profitPercent` `null` gelince ekran ne gösteriyor ve neden **%0 değil**? |

#### Altyapı
| Dosya | Ne sorulacak |
|---|---|
| `app.ts` | Router'lar neden bu sırayla monte ediliyor? `/assets` yolu neden `marketRouter`'a bağlı — dosya adıyla yol adı neden aynı değil? |
| `market/scheduler.ts` | ⚠️ Cron ifadesi neden **altı alan**, standart cron beş değil mi? Kopyalanıp başka sisteme taşınırsa ne olur? `running` bayrağı olmasaydı iki tur çakışınca ne olurdu — veritabanı korur mu, korursa bayrak neden var? |
| `market/evds.test.ts` | 1000 gözlem sınırı testte nasıl temsil ediliyor? |
| `mobile/src/lib/storage.ts` | ⚠️ Neden **iki farklı depo** — telefonda `SecureStore`, tarayıcıda `localStorage`? `AsyncStorage` neden bilerek reddedildi? Tarayıcıdaki düz metin saklama hangi gerekçeyle kabul edildi ve bu gerekçe **dağıtımda hâlâ geçerli mi**? |
| `mobile/src/api/client.ts` | Token yenileme (`refresh`) hangi anda tetikleniyor? Aynı anda iki istek 401 alırsa ne oluyor — iki kez mi yenileniyor? |
| `mobile/src/lib/format.ts` | ⚠️ Hiçbir fonksiyon neden `Number()` kullanmıyor? `decimalToCents` metni nasıl `bigint`e çeviriyor — ve neden `parseFloat` ile değil? |
| `mobile/src/screens/AuthScreen.tsx` | ⚠️ Bu dosya artık **hiçbir yerden çağrılmıyor** — Login/Register ekranları yerine geçti. Silinmeli mi, yoksa Zeynep hâlâ kullanıyor mu? Zeynep'e sorulacak. |

#### Benim borcum değil ama okunmamış (Zeynep'in yazdığı)
`db/schema.ts` · `market/tufe-cron.ts` · `what-if/schema.ts` ·
`screens/FriendsScreen.tsx` · `screens/LeaderboardScreen.tsx`

Bunları ben değiştirmedim, o yüzden yukarıdaki tablolarda yok. Ama
`db/schema.ts` bütün projenin veri modeli — okumadan portföy hesabının
neden öyle olduğu tam anlaşılmaz.

### 9. TL / USD gösterim düğmesi — 23 Ağu 2026
| Dosya | Ne sorulacak |
|---|---|
| `lib/fx.ts` (`tryToUsd`, `centsTryToUsd`, `parseCurrency`) | `usdToTry`'ın "simetriği" değil "tersi" demek ne fark yaratıyor? Ölçekten bağımsız `divideByRate` neden tek fonksiyon, iki sarmalayıcı? Geçersiz `?currency=eur` neden sessizce TL'ye düşmüyor? |
| `lib/fx.test.ts` | Gidiş-dönüş çevrim neden **kayıpsız değil** ve bu test neyi kilitliyor? Negatif tutar testi hangi ekran hatasını engelliyor? |
| ✅ `market/repository.ts` (`latestUsdTryRate`) | Kur neden ayrı tabloda değil, **normal bir varlık** olarak tutuluyor? `price_usd` kolonu eklenseydi ne olurdu? `null` dönünce çağıran neden `1` varsaymıyor? |
| `market/router.ts` · `portfolio/router.ts` | Kur neden yalnızca dolar istendiğinde okunuyor? `priceTry` alanının üzerine dolar yazsaydık hata **neden fark edilmezdi**? Kur yoksa neden 503 — sessizce TL döndürmek neden daha kötü? |
| `mobile/src/lib/currency.tsx` | ⚠️ Sağlayıcı neden **en dışta**, sadece iki sekmeyi sarmıyor? `App` kendi sağladığı context'i neden okuyamıyor? Depoda saçma değer varsa ne oluyor? ⚠️ `./storage` importunda uzantı neden **yok** — API tarafında neden zorunlu? |
| `mobile/src/lib/storage.ts` (`setPreference`) | Tercih neden token'larla aynı dosyada ama ayrı başlıkta? `clearTokens` tercihe neden dokunmuyor? |
| `mobile/src/lib/format.ts` (`symbolOf`) | Dolar biçiminde neden **Türkçe sayı yazımı** korundu (`1.234,56 $`)? |
| `mobile/src/components/CurrencyToggle.tsx` | Neden tek düğme değil, iki seçenek yan yana? |
| `mobile/src/screens/MarketScreen.tsx` · `PortfolioScreen.tsx` | ⚠️ `queryRef` neden var — zamanlayıcının içindeki `load` doğrudan `query` okusaydı hangi hata çıkardı ve **neden yalnızca otomatik yenilemede** görünürdü? `money()` yardımcısı hangi hatayı önlüyor? Yeşil/kırmızı kararı neden hep **TL** değerine bakıyor? |
| `mobile/src/screens/TradeScreen.tsx` · `WhatIfScreen.tsx` | `apiFetch<Asset[]>` tip iddiası neden **çalışma anında** korumuyor — `GET /assets` dizi olmaktan çıkınca tip kontrolü niye hata vermedi? |

**Ölçülen sonuç — çevrim doğrulandı:**
- USD varlığının kendi dolar fiyatı **tam 1,00000000** çıktı. Kur formülü
  yanlış olsaydı ilk bozulacak sayı buydu.
- BTC: `3.697.539,16 ₺ ÷ 47,8799 = 77.225,29 $` — elle hesapla birebir aynı.
- Nakit: `100.000,00 ₺ → 2.088,56 $` (`2088,5591` → ROUND_HALF_UP).
- Zarar `−18,50 ₺ → −0,39 $` — **işaret korundu**, yüzde iki görünümde de
  `−%0,10`, yani tam komisyon oranı.

**Yol boyunca çıkan hata:** `currency.tsx` içinde `./storage.js` yazdım —
API'nin `nodenext` alışkanlığı. `npm run typecheck` **temiz geçti**, hata
ancak `expo export` sırasında Metro'da çıktı. Tip kontrolü ile paketleme
iki farklı şeyi ölçüyor.

⚠️ **Doğrulama sırasında veritabanına iki tek kullanımlık kullanıcı eklendi**
(`fx-test-…@example.com`, `fx-pos-…@example.com`) ve biri 0,005 BTC aldı.
Lig sıralamasında görünürler; temizlenmeleri gerekiyor.

### 10. Tasarım dili birliği — 23 Ağu 2026
| Dosya | Ne sorulacak |
|---|---|
| `mobile/src/theme.ts` (yeni belirteçler) | Yeni renkler neden **mevcut üçünden türetildi**, palete dördüncü bir ton eklenmedi? `warn` neden `accent` (kırmızı) olamazdı? `readoutFill` neden yarı saydam değil **opak**? |
| `mobile/src/components/PriceChart.tsx` | `fontWeight: 'bold'` neden `fontFamily: fonts.semibold` ile değiştirildi — ikisi aynı şeyi yapmıyor mu? |
| `mobile/src/screens/*.tsx` (5 ekran) | Ham hex yerine anlamsal belirteç kullanmanın kazancı ne? `colors.gain` yerine `#10B981` kalsaydı "yükseliş rengini değiştir" isteği kaç dosyaya dokunurdu? |

**⚠️ Yol boyunca yapılan iki hata — ikisi de otomatik değiştirmeden:**

1. **JSX özniteliğinde süslü parantez unutuldu.** `tintColor="#10B981"` düz
   metin değişimiyle `tintColor=colors.gain` oldu — JSX'te sözdizimi hatası.
   Doğrusu `tintColor={colors.gain}`. Değer bağlamı (`'#fff'`) ile öznitelik
   bağlamı (`="#fff"`) farklı kurallara tabi.
2. **Import çok satırlı bir import'un ortasına girdi.** "`import ` ile
   başlayan son satır" ölçütü, `import {` ile başlayıp üç satır sonra
   `} from '...'` ile biten blokta yanlış yeri buluyor. Ölçüt **noktalı
   virgülle biten satır** olmalıydı.

İkisi de `npx tsc` ile anında yakalandı ve dosyalar `git checkout` ile geri
alınıp yeniden yapıldı. **Ders:** toplu değiştirme yaparken bağlamı olmayan
metin değişimi kırılgan — ve tip kontrolü bu kırılganlığın ağıdır.

**Kapsam kararı:** `FriendsScreen` ve `LeaderboardScreen` **değiştirilmedi**.
İkisi de Zeynep'in şeridi (`docs/02-gorev-paylasimi.md`). Uygulama şu an
karışık görünüyor — kendi ekranlarım kömür grisi, onunkiler lacivert. Bu
bilinçli: başkasının şeridine izinsiz girmek, karışık görünmekten kötü.

### 11. Tasarım entegrasyonu ve ürün eksikleri — 24 Ağu 2026

Bu tur `docs/export/`'taki dört ekranı uygulamaya taşıdı ve senin
bildirdiğin eksikleri kapattı. En büyük dosya yığını burada.

#### Tasarım sistemi
| Dosya | Ne sorulacak |
|---|---|
| `mobile/src/theme.ts` | Renkler neden **anlamsal** (`gain`) değil birebir (`#10B981`) adlandırıldı? "Yükseliş yeşilini değiştir" isteği eskiden kaç dosyaya dokunurdu? Yeni renkler neden mevcut üçünden **türetildi**, palete dördüncü ton eklenmedi? `inkFaint` ve `inkDisabled` tasarımdakinden neden **açıldı** — hangi kontrast oranları? |
| `mobile/src/components/DesignKit.tsx` | Seçili çip neden vurgu rengiyle değil **ters zeminle** anlatılıyor? Kırmızı yapsaydık kullanıcı ne okurdu? `BigAmount` tam kısmı ve kuruşu neden farklı puntoda? |
| `mobile/src/components/TabBar.tsx` | Sekme neden üstten **alta** taşındı? Beşten dörde inişin gerekçesi ne? İkonlar neden **emoji değil SVG** — emoji hangi üç platformda nasıl bozuluyor? |
| `mobile/src/components/AllocationBar.tsx` | Pasta değil **çubuk**: üç gerekçe neydi? Renkler önce **gri**ydi, neden değişti — ve karışma riski nasıl kapatıldı? `colorForLabel` neden indis değil **etiket** alıyor? |
| `mobile/src/components/AssetLogo.tsx` | ⚠️ `require` neden **dinamik olamaz**? Metro hangi anda karar veriyor? Elle eklenen logo hazır seti neden **eziyor**? Madeni paranın degrade `id`'si neden benzersiz olmak zorunda — aynı olsaydı ne görünürdü? |
| `mobile/scripts/prepare-logos.mjs` | İndirilen dosyalar neden **olduğu gibi kullanılamadı** — iki ayrı sebep? `WHITE_CUTOFF` neden 250 değil **230**? İki eşik arasındaki bant ne işe yarıyor? ⚠️ Fonksiyon adı neden `process` **olamaz**? |

#### Ekranlar
| Dosya | Ne sorulacak |
|---|---|
| `mobile/src/components/Calendar.tsx` | Verisi olmayan gün neden **silinmiyor da soluklaşıyor**? Dokunulunca neden sessiz kalmıyor? Ayın gün sayısı neden elle 28/30/31 tablosuyla değil `Date` ile bulunuyor? Çift ok neden var? |
| `mobile/src/screens/WhatIfScreen.tsx` | ⚠️ **Enflasyon eşiği** ne anlatıyor — 2020 için hangi varlıklar altında kaldı ve bu ne demek? Çizgi neden sabit konumda değil **hesaplanıyor**? Kat listesi neden tarihe bağlı ama **tutara bağlı değil**? Buton neden sabit? |
| `mobile/src/screens/WhatIfResultScreen.tsx` | Sonuç neden **ayrı ekran**? `104× ÷ 12,8× = 8,1×` üçlüsü neyi anlatıyor? Grafikte iki çizgi neden **aynı ölçekte** olmak zorunda? Enflasyon çizgisi neden **yaklaşım** olarak işaretli? Okuma satırı neden grafiğin **üstünde**? `pointsRef` olmasaydı hangi hata çıkardı? |
| `mobile/src/screens/PortfolioScreen.tsx` (sıralama) | Sıralama neden **üç durumlu**? `null` yüzdeler neden hep sona düşüyor — sıfır saysaydık hangi iki şey karışırdı? Sıralama neden `[...]` kopyası üzerinde? Değer neden `Number` değil `BigInt` ile karşılaştırılıyor? |
| `mobile/src/screens/LeaderboardScreen.tsx` | Başlık neden lig adı değil **tarih aralığı** gösteriyor? ⚠️ Bu dosya kimin şeridinde — hangi kısmına dokunuldu, hangisine dokunulmadı? |
| `mobile/src/components/AddFriend.tsx` | Davet düğmesi neden **boş durumda da** var? Kullanıcı adı değil **e-posta** ile olmasının sebebi ne? |

#### Sunucu
| Dosya | Ne sorulacak |
|---|---|
| ✅ `market/repository.ts` (`getDailyStats`) | 24 saat özeti neden **migration gerektirmiyor** ama mum grafiği gerektiriyor — aradaki ölçek farkı ne? Açılış/kapanış neden `MIN`/`MAX` ile alınamıyor? |
| ✅ `market/repository.ts` (24s değişim) | Neden **tam eşleşme** aranmıyor? Alt sınır neden 48 saat? ⚠️ SQL yorumunda **ters tırnak** neden kullanılamıyor? |
| `what-if/repository.ts` (`findMultiplesForDate`) | Tek sorgu neden şart — N+1 burada kaç sorgu ederdi? |
| `what-if/service.ts` (`calculateMultiples`) | Enflasyon katı nasıl hesaplanıyor? Liste neden **büyükten küçüğe** sıralı dönüyor? |
| `what-if/service.ts` (iki kur) | ⚠️ Başlangıç ve bugün kuru neden **ayrı** okunuyor? Tek kur kullansaydık 12 Mart 2020 bitcoin'i kaç dolar çıkardı? |
| `orders/router.ts` (`GET /orders`) | `limit` neden üst sınırlı? Bu sorgu maliyet defterinden neden **ayrı** — birleştirseydik hangi hesap bozulurdu? |
| `portfolio/repository.ts` (`getRecentOrders`) | İkincil sıralama ölçütü `id` neden var? |

**Ölçülen sonuçlar:**
- Enflasyon eşiği 2020-03-12 için **9,1×**. Üstünde 10 kripto/maden, altında
  **sekiz dövizin hepsi** — dolar tutmak o dönem alım gücü kaybettirmiş.
- BTC: lirada **128×**, dolarda **16×**. İkisini yan yana göstermenin sebebi.
- 12 Mart 2020 BTC = **4.800,00 $** (kur 6,15 ₺). Bugünkü kurla çevirseydik
  620 $ çıkardı.
- Altın 2017 Ocak **133,77 ₺/gram**, gerçeği ~137 ₺.

**Yol boyunca çıkan üç hata:**
1. SQL yorumundaki **ters tırnak** JS şablon dizesini erken kapattı; hata
   mesajı SQL'i değil TypeScript'i işaret ettiği için kaynağı bulmak sürdü.
2. Betikte `function process(...)` Node'un global `process` nesnesini
   gölgeledi — `process.argv` sessizce çökerdi.
3. Sunum penceresindeki bulanıklık **uygulamada değildi**: `demo.html`
   `transform: scale()` kullanıyordu, yazıyı çizip sonra küçültüyordu.

⚠️ **Bilerek yapılmayanlar** (hepsi migration bekliyor): satır içi mini
grafik (20 varlık × 7 gün ≈ 800.000 satır/5 sn), mum grafiği, `retention.ts`.
Ve CHF logosu — dosyada Shutterstock filigranı var.

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
- [x] **Al/Sat ekranı** — 21 Ağu 2026, Faz 1 kapandı
      `TradeScreen.tsx`. Canlı doğrulandı: emir 201, aynı `Idempotency-Key` ile
      tekrar → aynı `orderId` ve bakiye değişmedi, bakiyeyi aşan emir → 422.
      İstemci tahmini sunucu sonucuyla birebir tuttu (`369393 / 369 / 369762`).

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
- [x] **Kıymetli maden (LBMA) adapteri** — 24 Ağu 2026
      `market/lbma.ts`. Altın `gold_pm.json`, gümüş `silver.json`, tek adapter.
      2.417 gün altın + 2.435 gün gümüş geri dolduruldu, ikisi de `is_active = true`.
      **Çapraz kontrol:** 2017 Ocak gram altın 133,77 ₺ çıktı, gerçeği ~137 ₺.
      ⚠️ Ons/gram çevrimi tek sabitte ve testli. Buradaki tehlikeli hata
      bariz olan değil: onsu hiç çevirmemek 31 kat sapar ve saniyede fark
      edilir, **mutfak onsunu** (28,349523125) kullanmak yalnızca %10 sapar
      ve asla yakalanmaz. Test iki sonucun ayrıştığını ölçüyor.
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
      `market/clean-seed-prices.ts` bu satırları arayıp silen betikti.
      **25 Ağu 2026'da SİLİNDİ** — görevini bitirmişti (ölçüldü: temizlenecek
      0 satır) ve durduğu yerde tehlikeliydi.

      ⚠️ **NEDEN TEHLİKELİYDİ — ders bu.** İkinci aşaması şu varsayıma
      dayanıyordu: *"GRAM_ALTIN'a cron hiç yazmıyor, o yüzden oradaki gece
      yarısı olmayan HER satır tohumdandır."* Yazıldığında doğruydu.
      24 Ağu'da LBMA adapteri eklenince `GRAM_ALTIN` aktif bir maden oldu ve
      cron 15 saniyede bir yazmaya başladı. Ölçüldü: `--apply` ile
      çalıştırılsa **1.844 geçerli fiyat kaydı** silinecekti, hata vermeden.

      Kod bozulmadı — **dünyası değişti.** Aynı tuzak `binance.ts`'te de
      uyarılıyor: koda gömülen bir gerçek, dünya değişince sessizce yalan
      söyler. Tek seferlik betikler işi bitince silinmeli.

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
- [x] ~~`PricePoint.currency` alanı~~ — **BAŞKA YOLLA ÇÖZÜLDÜ**
      Çift çevrim riski alana değil, cron'daki tür yönlendirmesine bağlandı:
      `asset.kind === 'fx'` ise kur doğrudan yazılıyor, `usdToTry`'a hiç
      girmiyor. Alan eklemek aynı bilgiyi ikinci bir yerde tutmak olurdu.
- [x] **Fiyat grafiği** — 22 Ağu 2026
      ⚠️ `date_trunc` KULLANILMADI: yalnızca sabit birimlerle (hour/day/week)
      çalışıyor, bize 5 dakikalık ve 6 saatlik kova da lazımdı. Epoch'a
      çevirip kova boyutuna bölerek tabana yuvarlamak her ölçüde çalışıyor.
      Üstüne yakınlaştırma da eklendi (`ranges.ts`, `bucketFor`).
- [x] ~~`GET /what-if` + reel getiri~~ — **Zeynep yazdı** (PR #9, 19 Ağu 2026)
      Şerit sınırı aşıldı ama kod çalışıyor ve testli; silmek israf olurdu. Karar: kabul edildi.
      ⚠️ **OKUNACAK — henüz okumadın.** `apps/api/src/what-if/` (service, repository, schema, test).
      Özellikle: reel getiri formülü `(1+nominal)/(1+enflasyon)−1`, TÜFE endeksi kullanımı,
      tutar → miktar çevriminde ölçek matematiği (`calcGross`'un tersi). Kendi şeridinin devamı orası.
      Faz 2'nin kalanı (geri doldurma, grafik, `retention.ts`, varlık detay ekranı) **sende kalıyor**.
- [x] **Varlık detay ekranı** — 22-24 Ağu 2026
      Grafik, aralık düğmeleri, dokunmalı fiyat okuma, iki parmakla
      yakınlaştırma, 24 saat özeti (yüksek/düşük/açılış/kapanış), canlı fiyat.
      ⚠️ **Karar notu alanı hâlâ YOK** — "bunu neden aldım" notu. Ayrı madde
      olarak aşağıda duruyor.
- [ ] Karar notu alanı — emir verirken "neden" yazılabilsin, sonra geri okunsun
      Faz 3'ün "karar profili" özelliğinin temeli (01-plan.md). Şema değişikliği
      gerektiriyor → Zeynep.

---

## Kendine sorman gereken sorular

Bu proje portfolyo için. Her görevden sonra şunu yazabildiğinden emin ol:

- Bu parçada hangi problemi çözdüm ve **neden başka türlü olmazdı?**
- Nerede tıkandım, nasıl çıktım?
- Bu kodu ikiye katlanan kullanıcıyla ne bozar?

Bunları not al. Mülakatta "en zorlandığın şey neydi" sorusunun cevabı bu notlarda.
