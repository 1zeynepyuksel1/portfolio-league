# Kalan İşler ve Şerit Bölüşümü

> 27 Ağustos 2026'da, koda ve veritabanına bakarak çıkarıldı.
> Dokümanlardan değil — `docs/zeynep.md` bayat (18 maddenin hepsi bitmiş
> ama işaretlenmemiş), ona güvenilmedi.
>
> **UX işleri bu planda YOK.** Batuhan tek başına yapıyor.

---

## Nerede duruyoruz

| Faz | Bitiş kriteri | Durum |
|---|---|---|
| 0 · Temel | İskelet, şema, para aritmetiği, veri kaynakları | ✅ |
| 1 · Yürüyen iskelet | Kayıt → 100.000 ₺ → al → portföyde dur · **eşzamanlılık testi** | ✅ 26 Ağu |
| 2 · Ürün | İki hesap arkadaş olur, haftalık ligde yüzde getiriye göre yarışır | ✅ |
| 3 · Derinlik | — | başlanmadı |

**211 test · typecheck üç workspace'te temiz · 50 varlık · 402 bin fiyat satırı**

---

## A · Toplanan ama gösterilmeyen veri

**Bu kategori en yüksek değer/maliyet oranına sahip.** Backend zaten
çalışıyor ve veri birikiyor; eksik olan yalnızca okuma ucu ve ekran.

### A1 · Portföy değer grafiği — **Batuhan**

`portfolio_snapshots` tablosunda **159 satır** birikmiş. Gece cron'u her
gün yazıyor, lig açılışında da yazılıyor. Hiçbir yerde gösterilmiyor.

- `GET /portfolio/history?range=1w|1m|3m|1y` (plan §9'da var, yazılmadı)
- Cüzdan ekranında değer eğrisi

⚠️ **Grafik altyapısı hazır** — `PriceChart.tsx` ve `ranges.ts`'teki kova
mantığı aynen kullanılabilir. Yeni bir çizim kodu yazma.

⚠️ **Tuzak:** snapshot'lar seyrek (günde bir). Fiyat grafiğindeki 5
dakikalık kovalar burada anlamsız; kova boyutu ayrı seçilmeli.

### A2 · Geçmiş ligler — **Zeynep**

Lig her pazar 23:59'da kapanıyor, dereceler `updateEntryRank` ile
mühürleniyor, yeni dönem açılıyor. **Kullanıcı geçmiş bir ligi hiç
göremiyor** — yani haftalık döngünün hafızası yok.

- `GET /leagues/history` (plan §9'da var, yazılmadı)
- Lig ekranında "geçmiş haftalar" görünümü

⚠️ Veri zaten mühürlü duruyor, hesaplanacak bir şey yok. Sorgu + ekran.

---

## B · Teknik borç

| # | İş | Kim | Not |
|---|---|---|---|
| B1 | `retention.ts` | Batuhan | Ertelendi. Tetikleyici: **deploy**. Ölçüm ve tasarım hazır (§13) |
| B2 | `getPortfolio` profilde iki kez çalışıyor | Zeynep | `syncUserLeagueEntry` içinde bir, `Promise.all`'da bir. En pahalı çağrı |
| B3 | `leagues/cron.test.ts` DB koruması yok | Zeynep | Docker kapalıyken tüm takım kırmızı oluyor. `concurrency.test.ts`'teki `dbReady` deseni, 5 satır |
| B4 | `what-if/service.ts` float borcu | Batuhan | 6 yerde `parseFloat`. Gösterim için zararsız, proje kuralına aykırı |
| ~~B5~~ | ~~`granularity` kolonu~~ | — | ⚠️ **ZATEN VAR** (27 Ağu doğrulandı). `open_usd`/`high_usd`/`low_usd` ile eklenmiş, yorum güncellenmemişti. B1'in Zeynep bağımlılığı YOK |
| B6 | 1.213 satır ölü ekran | Batuhan | `AuthScreen` (898) + `OnboardingScreen` (315) hiç import edilmiyor |
| B7 | `docs/zeynep.md` hiç güncellenmemiş | Zeynep | 18/18 madde açık görünüyor, hepsi bitmiş |

⚠️ **B6'da karar gerekli:** `OnboardingScreen` çalışır durumda ve iyi
yazılmış. Silmek yerine BAĞLAMAK daha mantıklı — ama o bir UX kararı,
yani Batuhan'ın. Silinecekse `AuthScreen` kesin gidiyor.

---

## C · Faz 3 özellikleri

Sırası **değer/maliyet** oranına göre, plandaki listeden.

### C1 · Karar notu alanı — **yalnızca Batuhan**

Emir verirken "neden aldım" yazılabilsin, sonra geri okunsun.
Faz 3'ün "karar profili" özelliğinin temeli.

⚠️ **BACKEND'İN TAMAMI ZATEN HAZIR — kontrol edildi.** `docs/batuhan.md`
"şema değişikliği gerektiriyor → Zeynep" diyordu, **yanlış**:

| Parça | Durum |
|---|---|
| `orders.note` kolonu (veritabanında) | ✅ var |
| `db/schema.ts` | ✅ var |
| Zod şeması (`max(500)`) | ✅ var |
| Emir motoru (`ExecuteOrderInput.note`) | ✅ var |
| `POST /orders` notu kabul ediyor | ✅ var |

Yani **migration gerekmiyor, Zeynep'e iş düşmüyor.** Eksik üç parça:

1. `getRecentOrders` sorgusu `note`'u seçmiyor → `GET /orders` dönmüyor *(1 satır)*
2. Al/Sat ekranında not alanı yok
3. Cüzdan'daki "SON İŞLEMLER" notu göstermiyor

Veritabanında **33 emir var, 0'ı notlu** — çünkü not girecek yer yok.

### C2 · Haftalık özet — **Zeynep**

Lig kapandığında kullanıcıya haftanın dökümü: sıra, TWR, en iyi/en kötü
işlem. `closeAndRotateLeague` zaten o anda çalışıyor, oraya takılıyor.

### C3 · Paylaşılabilir kart — **Zeynep**

Lig sonucunun görseli. C2'nin doğal devamı; aynı veriyi kullanıyor.

### C4 · Fiyat alarmı + push — **ikisi birlikte**

| Parça | Kim |
|---|---|
| `GET/POST/DELETE /alerts` + cron kontrolü | Batuhan (piyasa) |
| `POST /devices` + Expo push jetonu | Zeynep (kimlik/cihaz) |

⚠️ En büyük Faz 3 maddesi. Diğerleri bitmeden başlanmamalı.

### C5 · BIST — **Batuhan**

Veri erişimi hâlâ çözülmedi. `asset_kind` enum'unda `bist` değeri
ayrılmış ama hiç varlığı yok. ABD hisseleri için yazılan
`market-hours.ts` deseni burada da kullanılabilir — BIST'in de seansı
var (10:00–18:00 TSİ).

### C6 · Gerçek para — **ertelendi**

Mağaza IAP zorunluluğu + tüzel kişilik + lig adaleti. Takvime alınmadı.

---

## D · Süreç

| İş | Kim |
|---|---|
| Okuma borcu — 21 bölüm, 14 dosya okundu | Batuhan |
| Editör kodlamasını UTF-8'e al | Zeynep |
| **UX iyileştirmeleri** (7 madde) | Batuhan, tek başına |

---

## Önerilen sıra

```
1. B3  cron.test koruması        Zeynep    (5 satır, herkesi engelliyor)
2. B2  getPortfolio çift çağrı   Zeynep    (küçük, ölçülmüş)
3. A1  portföy grafiği           Batuhan   ─┐ paralel,
4. A2  geçmiş ligler             Zeynep    ─┘ çakışmaz
5. C1  karar notu                Batuhan   (backend hazır, 3 küçük parça)
6. B1  retention.ts              Batuhan   (deploy öncesi)
7. C2  haftalık özet             Zeynep
8. C4  alarm + push              ikisi
```

⚠️ **3 ve 4 aynı anda yapılabilir** — farklı dosyalar, farklı tablolar.
Bugün Ya Alsaydın ekranında yaşadığımız çakışmanın tekrarlanmaması için
sıralama böyle kuruldu.

---

## Çakışma kuralları — bugün öğrenilenler

1. **Aynı dosyaya aynı gün iki kişi dokunmasın.** Bugün `WhatIfScreen`,
   `price-cron.ts` ve `price-backfill.ts`'te oldu; üçü de merge ile
   çözüldü ama şansa kalmıştı.

2. **Migration'lar Zeynep'te.** Bir istisna yapıldı (`0009`, enum'a
   `stock`) ve sebebi dosyanın içinde yazılı: `db:generate` kırıktı.

3. **Yorum silinmez.** Kod değişirken gerekçesi de güncellenir, silinmez.
   Bugün iki yerde gerekçe silindi, kod kaldı.

4. **`npm run dev:api` öncesi eski süreç kontrolü.** Bugün 10 hayalet
   sunucu birikmişti, veritabanı yükünü 7 kat şişirmişti.
