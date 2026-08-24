# Migration talebi — Zeynep'e

> **Kimden:** Batuhan (Şerit A · Piyasa & Portföy)
> **Tarih:** 23 Ağustos 2026 · **güncellendi 24 Ağustos** (1. madde geri çekildi)
> **Neden sana geliyor:** `docs/02-gorev-paylasimi.md` — migration'ların tek sahibi sensin.

Tek turda halledelim diye maddeleri birleştirdim; ayrı ayrı istersem iki kez
beklemek gerekiyor.

**⚠️ Bu belge güncellendi. İlk hâlinde üç madde vardı, biri geri çekildi.
Geçerli olan: 2 ve 3.**

---

## ⚠️ 1 · GERİ ÇEKİLDİ — dolar geçişi yapılmıyor

**Bu talebin ilk hâlinde `accounts` ve `orders` için dolar geçişi vardı.
İptal. Aşağıdaki 2 ve 3 numaralı maddeler geçerli, 1 numaralı madde değil.**

Okumaya başlamadıysan hiç iş çıkmadı; başladıysan özür, sebebi şu:

### Neden istenmişti

TL bazlı ölçümün ligi bozduğunu düşünüyorduk: TL değer kaybedince kripto
tutan herkesin TL getirisi şişer, kimse bir şey yapmadan kazanmış görünür.

### Neden vazgeçildi

Matematiği yapınca gerekçe çürüdü:

```
TWR_dolar = TWR_TL × (başlangıç kuru ÷ bitiş kuru)
```

Sağdaki çarpan **herkes için aynı** — aynı dönemin aynı kur değişimi.
Alt dönemlere bölünse bile çarpanlar teleskoplanıp aynı toplam kur
değişimine iniyor. Yani herkesin yüzdesi aynı sayıyla çarpılıyor ve
**sıralama bire bir aynı kalıyor.**

Somut — TL bir haftada 40'tan 50'ye gitsin:

| Kullanıcı | Portföy | TL getirisi | Dolar getirisi |
|---|---|---|---|
| A | %100 BTC (dolarda yatay) | +%25 | %0 |
| B | %100 TL nakit | %0 | −%20 |
| C | %100 dolar nakit | +%25 | %0 |

İki sütunda da sıra aynı: **A = C > B.** Dolara geçmenin lig adaletine
katkısı **sıfır.**

### Yerine ne var: elimizdeki daha iyi alet

Devalüasyon gürültüsünü **TÜFE** zaten arındırıyor — senin yazdığın
"ya alsaydın" hesabı. Canlı ölçüm:

```
2020-03-12'de 10.000 ₺ ile BTC
  nominal:   +%12.390
  enflasyon:  +%814
  reel:      +%1.266   ← asıl sayı
```

Nominal rakam gerçekten şişmiş. Reel hâli değil.

Ve bu, dolara çevirmekten **daha doğru**: kullanıcı doları değil,
Türkiye'de mal alıyor. Dolar paritesi satın alma gücünün yaklaşımı,
TÜFE ise kendisi.

### Sonuçlar

- `accounts.cash_cents` **TL kuruşu kalıyor**, varsayılan 100.000 ₺
- `orders.price_try` **yeniden adlandırılmıyor**
- `price_history.price_usd` **gerekmiyor**
- **Veri sıfırlanmıyor** — emir geçmişi duruyor
- `CLAUDE.md`'deki "lig TL bazlı TWR" kararı **bozulmuyor**, olduğu gibi kalıyor
- "Ya alsaydın" ekranının TÜFE karşılaştırması **anlamlı kalıyor** —
  aşağıdaki "açık kalan konu" da kapandı

Dolar isteyen kullanıcı için ekranlarda `₺ / $` düğmesi zaten var: muhasebe
TL, gösterim seçilebilir. Sunucu çevirimi yapıyor, saklamıyor.

---

## 2 · Mum grafiği için OHLC kolonları

Grafik şu an çizgi. Kullanıcı mum istedi — mum için her kovanın **açılış,
en yüksek, en düşük, kapanış** değerleri gerekiyor. Elimizde sadece kapanış
var.

### İstenen değişiklikler

`price_history` tablosuna üç kolon:

```sql
ALTER TABLE price_history
  ADD COLUMN open_usd numeric(24,8),
  ADD COLUMN high_usd numeric(24,8),
  ADD COLUMN low_usd  numeric(24,8);
```

**Neden `close` kolonu yok:** kapanış zaten mevcut `price_try`. Ayrı bir
kapanış kolonu açsaydık aynı sayının iki kopyası olurdu ve bir gün
ayrışırlardı — ayrıştıklarında da kimse haber vermezdi. (Aynı gerekçeyle
pozisyon maliyeti de `holdings`'te tutulmuyor, emir defterinden
hesaplanıyor.)

**⚠️ Neden `_usd` eki var ama kapanış TL:** kaynak mumları dolar veriyor.
Binance `open/high/low/close`'u USD olarak döndürüyor, LBMA da öyle.
Kapanışı TCMB kuruyla TL'ye çevirip `price_try`'a yazıyoruz; diğer üçünü
çevirmenin anlamı yok, çünkü grafikte **aynı ölçekte** kullanılacaklar ve
her birini ayrı ayrı çevirmek dört kat yuvarlama demek.

Ekran çizerken üçünü aynı `ts`'in kuruyla çevirecek. Tek kur, tek yuvarlama.

**⚠️ Döviz ve maden için `open/high/low` NULL kalacak** — TCMB ve LBMA
günde tek fiyat yayımlıyor, gün içi aralık diye bir şey yok. Mum grafiği
yalnızca kriptoda anlamlı; ekran bunu bilip diğerlerinde çizgi göstermeli.

**Neden hepsi NULL kabul ediyor:** mevcut 121 bin satırda bu değerler yok
ve geri doldurmak zaman alacak. `NOT NULL` istersek migration mevcut
veriyle patlar.

---

## 3 · Bonus: `granularity` (fırsat varken)

Daha önce konuşulmuştu, hâlâ eksik. Şu an lazım değil ama tur açılmışken:

```sql
ALTER TABLE price_history ADD COLUMN granularity text;  -- '5m' | '1h' | '1d'
```

15 saniyelik cron günde varlık başına 5.760 satır yazıyor. Bir yıl sonra
tablo ~15 milyon satır olur. `retention.ts` eski satırları özetleyip
temizleyecek ve bunu yapabilmek için hangi satırın hangi çözünürlükte
olduğunu bilmesi gerekiyor.

Grafik için gerekmiyor — kova mantığı kaynağa bakmadan çalışıyor.

---

## İş bölümü

**Sen:** aşağıdaki iki migration + `schema.ts` güncellemesi.

```sql
ALTER TABLE price_history
  ADD COLUMN open_usd  numeric(24,8),
  ADD COLUMN high_usd  numeric(24,8),
  ADD COLUMN low_usd   numeric(24,8),
  ADD COLUMN granularity text;
```

⚠️ Kolon adlarındaki `_usd` eki bilerek: LBMA ve Binance mumları **dolar**
veriyor, kapanış ise `price_try` olarak TL saklanıyor. Ad, içindekini
söylesin.

**Ben:** migration indikten sonra
- geri doldurmayı OHLC yazacak şekilde güncelleme (Binance mumları zaten
  açılış/yüksek/düşük/kapanış döndürüyor, biz yalnızca kapanışı alıyoruz)
- mum/çizgi geçişli grafik
- `retention.ts` — eski satırların özetlenip temizlenmesi

**Şu an bekleyemeden yaptığım iş:** altın ve gümüş adaptörü (LBMA).
Migration gerektirmiyor, `price_try`'a yazıyor.

## Sana ayrıca iletilecek bir bulgu

**TWR motoru bağlı değil.** `calculateTwr` yazılmış ve testleri geçiyor
(`packages/contracts/src/twr.ts`), ama:

- API'de hiçbir yerden çağrılmıyor — tek referansı bir yorum satırı
- `portfolio_snapshots` tablosu var, **hiçbir şey yazmıyor**
- `league_entries.twr_pct` okunuyor ama yazan yok — `upsertLeagueEntry`'nin
  çağıranı yok

Yani lig ekranı tabloda ne varsa onu gösteriyor; sıralamayı üreten motor
yok. Parçalar hazır, boru bağlanmamış. **Faz 2'nin bitiş kriteri bu.**
