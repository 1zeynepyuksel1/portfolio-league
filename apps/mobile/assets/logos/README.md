# Varlık logoları

Buraya bırakılan dosyalar `src/components/AssetLogo.tsx` tarafından
kullanılır. Bir dosya yoksa bileşen simgeye/harfe düşer — yani eksik
dosya ekranı bozmaz, sadece o varlık eski görünümde kalır.

## Dosya adları — BİREBİR bunlar olmalı

Ad, veritabanındaki sembolün küçük harflisi:

```
usd.png   eur.png   gbp.png   jpy.png
chf.png   cad.png   aud.png   sek.png
gram_altin.png      gram_gumus.png
```

⚠️ `gram_altin` alt çizgiyle — sembol veritabanında böyle. `gramaltin`
ya da `altin` yazılırsa eşleşmez ve dosya sessizce yok sayılır.

## Biçim

| Ne | Değer | Neden |
|---|---|---|
| Uzantı | **`.png`** | Metro PNG'yi ek ayar olmadan paketliyor. SVG için `react-native-svg-transformer` + metro yapılandırması gerekir — ayrı iş. |
| Boyut | **128×128** | Rozet 32px çiziliyor; 3x yoğunluklu telefonda 96 fiziksel piksel. 128 rahat yetiyor, daha büyüğü paketi şişirir. |
| Şekil | **Kare** | Bileşen daireye kırpıyor. Dikdörtgen verirsen kenarları kesilir. |
| Zemin | **Saydam** | Beyaz zeminli PNG koyu arayüzde beyaz bir kare olarak görünür. |
| Kenar boşluğu | İçerik çerçevenin **~%80**'i | Kenara dayanan görsel daireye kırpılınca uçlarından kesilir. |

## Nereden

Bayrak setleri (dairesel olanlar bu tasarıma daha uygun) ya da para
simgesi ikonları iş görür.

⚠️ **Lisansına bak.** Bayraklar genelde kamu malı ama hazır ikon
setlerinin lisansı değişiyor. Kaynağı ve lisansı bu dosyaya not düş —
altı ay sonra "bunu nereden almıştık" sorusunun cevabı kalsın.

## Sonra

Dosyaları koyduktan sonra haber ver: `AssetLogo.tsx`'teki tabloya on
satır eklenecek. `require` yolu **statik metin olmak zorunda** —
değişkenli yol Metro'da çalışmıyor — o yüzden tablo elle yazılıyor.
