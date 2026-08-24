# Migration talebi — Zeynep'e

> **Kimden:** Batuhan (Şerit A · Piyasa & Portföy)
> **Tarih:** 23 Ağustos 2026
> **Neden sana geliyor:** `docs/02-gorev-paylasimi.md` — migration'ların tek sahibi sensin.

İki iş için şema değişikliği gerekiyor. Tek turda halledelim diye ikisini
birleştirdim; ayrı ayrı istersem iki kez beklemek gerekecek.

---

## 1 · Hesabın para birimi TL'den dolara geçiyor

### Karar ve gerekçesi

Lig TL bazlı ölçtüğü sürece **kur hareketi yatırım becerisinin önüne geçiyor.**
TL bir hafta içinde %20 değer kaybederse kripto tutan herkesin TL getirisi
şişer — kimse bir şey yapmadan kazanmış görünür. O hafta lig, kimin doğru
varlığı seçtiğini değil, kurun ne yaptığını ölçer.

Hesap dolar olunca bu gürültü kayboluyor.

### Bunun bir yan faydası var

Kripto fiyatları Binance'ten **zaten dolar olarak** geliyor; biz onları TCMB
kuruyla TL'ye çevirip saklıyoruz. Taban dolar olunca bu çevrim kripto için
tamamen gereksizleşiyor — bir yuvarlama katmanı ve hafta sonu forward-fill
bağımlılığı ortadan kalkıyor. Yani değişiklik kodu karmaşıklaştırmıyor,
sadeleştiriyor.

Çevrim yalnızca TCMB'den TL olarak gelen varlıklar için kalıyor (EUR, altın,
gümüş) — ters yönde.

### ⚠️ Bu, `CLAUDE.md`'deki kilitli bir kararı bozuyor

Tabloda "Lig haftalık, sıralama TWR (yüzde getiri) ile" yazıyor ve o TWR TL
bazlıydı. **Bilerek bozuyoruz.** Sen de onaylarsan `CLAUDE.md`'yi
güncelleyeceğim — kararı sessizce değiştirip tabloyu eski hâlinde bırakmak
en kötüsü olur.

### Sıralamaya etkisi: YOK

Bu, kararı verirken hesapladığımız ve şaşırtıcı bulduğumuz şey:

```
TWR_dolar = TWR_TL × (başlangıç kuru ÷ bitiş kuru)
```

Sağdaki çarpan **herkes için aynı** — aynı haftanın aynı kur değişimi.
Herkesin yüzdesi aynı sayıyla çarpılıyor, yani **sıralama bire bir aynı
kalıyor.** Alt dönemlere bölünse bile çarpanlar teleskoplanıp aynı toplam
kur değişimine iniyor.

Örnek — TL bir haftada 40'tan 50'ye gitsin:

| Kullanıcı | Portföy | TL getirisi | Dolar getirisi |
|---|---|---|---|
| A | %100 BTC (dolarda yatay) | +%25 | %0 |
| B | %100 TL nakit | %0 | −%20 |
| C | %100 dolar nakit | +%25 | %0 |

İki sütunda da sıra aynı: **A = C > B.**

Yani bu bir **adalet** değil **anlatım** tercihi: hesap dolarsa getiriyi de
dolarda göstermek tutarlı olur.

### İstenen değişiklikler

**`accounts.cash_cents`** — kolon tipi ve adı **aynı kalıyor** (`bigint`,
"cents" zaten para birimi belirtmiyor). Değişen tek şey **anlamı**: TL kuruşu
yerine dolar senti.

```sql
ALTER TABLE accounts ALTER COLUMN cash_cents SET DEFAULT 500000;  -- 5.000,00 $
```

> ⚠️ `CHECK (cash_cents >= 0)` aynen kalsın. Emir motorunun üç savunma
> katmanından biri o.

**`orders`** — `price_try` kolonu artık dolar fiyatı tutacak, adı yalan
söylemesin:

```sql
ALTER TABLE orders RENAME COLUMN price_try TO price_usd;
```

`gross_cents` · `fee_cents` · `net_cents` adları değişmiyor, anlamları
dolar sentine dönüyor.

### Mevcut veri: sıfırdan başlıyoruz

Bütün hesaplar 5.000 $ ile yeniden başlar, emir geçmişi silinir.

**Neden dönüştürmüyoruz:** her emri kendi tarihindeki kurla çevirmek daha
doğru *görünür* ama sonuç yine yaklaşık olur — ve "o gün gerçekten böyle
miydi" sorusuna dürüst cevap veremeyiz. Geliştirme aşamasındayız, gerçek
kullanıcı yok. Temiz başlangıç, uydurma geçmişten iyidir.

---

## 2 · Mum grafiği için OHLC kolonları

Grafik şu an çizgi. Kullanıcı mum istedi — mum için her kovanın **açılış,
en yüksek, en düşük, kapanış** değerleri gerekiyor. Elimizde sadece kapanış
var.

### İstenen değişiklikler

`price_history` tablosuna:

```sql
ALTER TABLE price_history
  ADD COLUMN price_usd numeric(24,8),
  ADD COLUMN open_usd  numeric(24,8),
  ADD COLUMN high_usd  numeric(24,8),
  ADD COLUMN low_usd   numeric(24,8);
```

**Neden `close_usd` yok:** kapanış zaten `price_usd`. Ayrı bir kolon açsaydık
aynı sayının iki kopyası olurdu ve bir gün ayrışırlardı — ayrıştıklarında da
kimse haber vermezdi. (Aynı gerekçeyle maliyet de `holdings`'te tutulmuyor,
emir defterinden hesaplanıyor.)

**Neden hepsi NULL kabul ediyor:** mevcut ~2,4 milyon satırda bu değerler yok
ve geri doldurmak zaman alacak. `NOT NULL` istersek migration mevcut veriyle
patlar. Geri doldurma bitince ikinci bir migration'la `price_usd`'yi
`NOT NULL` yapabiliriz — o ayrı bir tur.

### ⚠️ `price_try` DURUYOR, silinmiyor

İki kolon birden tutmak "türetilmiş verinin iki kopyası" kuralına aykırı
görünüyor ama burada kaçınılmaz, çünkü **kaynak varlığa göre değişiyor:**

| Varlık türü | Kaynak | Türetilen |
|---|---|---|
| `crypto` | Binance → **USD** | TL |
| `fx` · `metal` | TCMB → **TL** | USD |

Sadece dolar saklasaydık EUR'nun TL fiyatı iki yuvarlamadan geçer ve TCMB'nin
resmî rakamından sapardı — kullanıcı resmî kuru bildiği için bu fark görünür
olurdu. Sadece TL saklasaydık kriptoda aynı sorun ters yönde çıkardı.

Kural: **her varlık kendi kaynağının verdiği rakamı olduğu gibi saklar,
diğeri aynı `ts`'teki USD/TRY kuruyla türetilir.**

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

**Sen:** yukarıdaki üç migration + `schema.ts` güncellemesi.

**Ben:** migration indikten sonra
- geri doldurmayı OHLC yazacak şekilde güncelleme (Binance mumları zaten
  açılış/yüksek/düşük/kapanış döndürüyor, biz sadece kapanışı alıyoruz)
- emir motorunu ve portföy hesabını dolar tabanına geçirme
- `TRY`'yi işlem görebilir varlık olarak ekleme (aşağıya bak)
- mum/çizgi geçişli grafik

## Not: kullanıcı TL'de durmak isterse

Hesabın para birimini seçtirmiyoruz. Bunun yerine **TL'yi işlem görebilir bir
varlık yapıyoruz** — kullanıcı TL'de durmak istiyorsa TL satın alıyor, tıpkı
BTC alır gibi.

Böylece iki tip hesap, aralarında dönüşüm kuralı ve "hangi bakiye doğru"
sorusu hiç doğmuyor. Üstelik daha esnek: kullanıcı %60 dolar %40 TL de
durabiliyor, hesap ayarıyla bunu yapamazdı.

## Açık kalan konu — senin şeridini de ilgilendiriyor

**"Ya alsaydın" ekranı TÜFE kullanıyor, yani Türkiye enflasyonu.** Dolar
bazlı getiriyi TL enflasyonuyla kıyaslamak elmayla armut olur. Üç seçenek
görünüyor:

1. O ekranı TL bazlı bırakmak (tutarsız ama en az iş)
2. ABD TÜFE'sine geçmek (veri kaynağı araştırması gerek)
3. "Dolar bazında şu kadar kazandın, aynı sürede TL şu kadar eridi" diye
   ikisini yan yana göstermek

Bence 3 en dürüstü ama en çok iş. Karar vermeden dolar geçişini bitirmeyelim,
yoksa o ekran sessizce anlamsız bir sayı üretmeye başlar.
