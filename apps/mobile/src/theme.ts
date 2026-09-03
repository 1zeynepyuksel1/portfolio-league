/**
 * theme.ts — tasarım belirteçleri.
 *
 * ⚠️ ARKA PLAN LACİVERTTEN NÖTR SİYAHA GERİ ALINDI (31 Ağu 2026).
 *
 * Birleştirmeyle gelen sürüm yüzeyleri lacivert yapmıştı (#051424) ve
 * metin gri tonlarını da mavimsi seçmişti (#94a3b8, #475569). İstenen
 * eski görünüm: nötr siyah.
 *
 * ⚠️ YALNIZCA NÖTR AİLE DEĞİŞTİ — anlam renklerine DOKUNULMADI.
 * `gain`, `loss`, `accent`, madalya renkleri ve `error`/`warn` olduğu
 * gibi duruyor: onlar arka plan değil, YÖN ve DURUM taşıyor. Hepsini
 * birden geri almak, arka plan isteğinin ötesine geçip başkasının
 * tasarım kararlarını da silmek olurdu.
 *
 * ⚠️ FONTLARA DA DOKUNULMADI. `App.tsx` üç aileyi birden yüklüyor
 * (Rubik, DM Mono, Space Grotesk), yani geri almak teknik olarak
 * güvenli — ama istenen şey arka plandı. Font değişimi ayrı bir karar
 * ve tek satırlık bir iş.
 *
 * ⚠️ EKSİK OLAN ŞEY: bu dosya 300 satırdan 98'e inerken renk
 * kararlarının GEREKÇELERİ silinmişti. Aşağıdaki değerler geri geldi
 * ama açıklamaları gelmedi; bir sonraki dokunuşta `git show` ile eski
 * sürümden taşınmalı. Değerini bilmek yetmiyor, NEDEN öyle olduğunu da
 * bilmek gerekiyor:
 *
 *   - Yüzeyler gölge kullanmıyor; derinlik yüzey TONUYLA anlatılıyor.
 *   - `inkFaint` tasarımdaki #79797F'den açıldı: 9-11px etiketlerde
 *     kontrast yetmiyordu.
 *   - `inverse`/`onInverse` seçili durumu renkle değil TERS ZEMİNLE
 *     anlatıyor — vurgu renkleri yön için ayrılmış.
 */
export const colors = {
  surface: '#0F0F10',
  surfaceRaised: '#1A1A1C',
  surfacePressed: '#202022',
  surfaceSunken: '#141415',
  border: '#2B2B2E',
  ink: '#FFFFFF',
  inkBright: '#E9E9EA',
  inkMuted: '#A6A6AC',
  inkFaint: '#8E8E96',
  inkDisabled: '#6A6A71',
  gain: '#10b981',
  loss: '#ef4444',
  warn: '#f59e0b',
  /*
    ⚠️ `gold` İLE `warn` AYNI HEX'Tİ (#f59e0b) — İKİ AYRI ANLAM, TEK RENK.

    "Şampiyon oldun" ile "dikkat et" ekranda ayırt edilemiyordu. Renk bir
    anlam taşıyıcısı; iki zıt anlamı aynı renge bağlamak o taşıyıcıyı
    işlevsiz bırakır.

    Altın artık daha sarı ve daha parlak (#f5b53f), uyarı turuncuda
    kalıyor. Yan yana konduklarında ayrılıyorlar.
  */
  gold: '#f5b53f',
  silver: '#cbd5e1',
  /*
    ⚠️ `bronze` MORDU (#8b5cf6). Sıralama ekranında 3. sıra rozeti mor
    çiziliyordu; altın/gümüş/mor bir madalya seti değil. Gerçek bronza
    çevrildi — `PostCard` zaten elle #B45309 yazıyordu, artık ikisi aynı.
  */
  bronze: '#b45309',
  accent: '#3b82f6',
  error: '#ef4444',
  inverse: '#E9E9EA',
  onInverse: '#0F0F10',
  onInverseMuted: '#4E4E53',
  
  gainSoft: 'rgba(16, 185, 129, 0.15)',
  lossSoft: 'rgba(239, 68, 68, 0.15)',
  warnSoft: 'rgba(245, 158, 11, 0.15)',
  goldSoft: 'rgba(245, 181, 63, 0.15)',
  silverSoft: 'rgba(203, 213, 225, 0.15)',
  /*
    ⚠️ `bronze` DÜZELTİLDİ AMA `bronzeSoft` MOR KALMIŞTI.

    Renk ile onun yumuşak eşi AYRI iki satırda yaşıyor; birini
    değiştirip diğerini unutmak sessiz bir tutarsızlık üretiyor —
    simge bronz, arkasındaki zemin mor.

    Bu, "aynı bilgiyi iki yerde tutmanın" bedeli. Şimdilik elle hizalı;
    doğrusu yumuşak tonu ana renkten TÜRETMEK olurdu.
  */
  bronzeSoft: 'rgba(180, 83, 9, 0.15)',
  /*
    ⚠️ MOR ARTIK KENDİ ADIYLA VAR. `ProfileScreen`'de arkadaş sayacı
    #8B5CF6 yazıyordu — bronzun eski mor değeriyle aynı hex. İkisi
    alakasız ama aynı sayı olduğu için birini değiştiren diğerini de
    bozuyordu. Mor bir MADALYA değil, bir kategori rengi.
  */
  violet: '#8b5cf6',
  violetSoft: 'rgba(139, 92, 246, 0.12)',

  axisLine: '#2B2B2E',
  axisText: '#79797F',
  axisGrid: 'rgba(121, 121, 127, 0.14)',
  readoutFill: '#202022',

  inkDim: '#A6A6AC',
  inkGhost: '#5C5C61',
  inkPlaceholder: '#5C5C61',
  fieldFill: '#1A1A1C',
  hairlineSoft: '#2B2B2E',
  hairline: '#2B2B2E',
  hairlineStrong: '#3A3A3E',
  hairlineFocus: '#3b82f6',
  gridLine: 'rgba(121, 121, 127, 0.10)',
  volumeBar: 'rgba(121, 121, 127, 0.14)',
  chartLabel: 'rgba(121, 121, 127, 0.16)',
  accentSoft: 'rgba(59, 130, 246, 0.15)',
  /*
    ⚠️ MODAL PERDESİ — ÜÇ FARKLI KOYULUK VARDI: 0.5, 0.6, 0.7.

    Altı ayrı dosyada elle yazılmıştı. Kullanıcı arka arkaya iki modal
    açtığında arkadaki ekran farklı koyulukta kararıyordu; sebebi
    görünmüyor ama "bir şey tutarsız" hissi bırakıyor.

    ⚠️ 0.6 SEÇİLDİ, ORTALAMA OLDUĞU İÇİN DEĞİL: en çok kullanılan
    değer oydu (beş yerde). Zaten çoğunluğun bulunduğu yere hizalamak,
    en az sayıda ekranı değiştiriyor.
  */
  backdrop: 'rgba(0, 0, 0, 0.6)',
  borderStrong: '#3A3A3E',
} as const;

/**
 * Yazı aileleri.
 *
 * ⚠️ `mono*` GERÇEKTEN MONO DEĞİLDİ — DÖRDÜ DE Space Grotesk'e BAKIYORDU.
 *
 * `App.tsx` DM Mono'yu yüklüyor (400 ve 500) ama tablo onu hiç
 * kullanmıyordu. Yani paket iki fazla font ailesi taşıyor, sayılar da
 * orantılı yazıyla diziliyordu.
 *
 * ⚠️ NEDEN ÖNEMLİ — BU EKRANIN ASIL FİKRİ BU. Orantılı yazıda her
 * rakamın genişliği farklı ('1' dar, '8' geniş). Alt alta gelen tutarlar
 * bu yüzden kayıyor:
 *
 *     orantılı        mono
 *     2.095,91        2.095,91
 *      1.847,03       1.847,03      <- basamaklar hizalı
 *
 * Bir yatırım uygulamasını profesyonel gösteren en ucuz tek değişiklik.
 *
 * ⚠️ `monoSemibold` ve `monoBold` DE 500'E BAKIYOR — çünkü DM Mono'nun
 * yalnızca 400 ve 500 ağırlıkları yükleniyor. Var olmayan bir ağırlığa
 * işaret etseydik React Native sessizce sistem fontuna düşerdi ve
 * hizalama kaybolurdu; en ağır MEVCUT ağırlığa bağlamak dürüst.
 * Daha kalın gerekirse `App.tsx`'e DM Mono 500+ eklenmeli.
 */
export const fonts = {
  regular: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  semibold: 'SpaceGrotesk_600SemiBold',
  bold: 'SpaceGrotesk_700Bold',
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
  monoSemibold: 'DMMono_500Medium',
  monoBold: 'DMMono_500Medium',
} as const;

/**
 * Boşluklar.
 *
 * ⚠️ `group` VE `section` EKLENDİ — ÇÜNKÜ BOŞLUK HİYERARŞİ KURAR.
 *
 * Ekranlarda bölümler arası boşluklar elle yazılıyordu: 14, 18, 18, 20.
 * Hepsi birbirine yakın olunca göz hiçbir gruplama görmüyor — sekiz
 * bölüm de eşit ağırlıkta duruyor ve kullanıcı neye önce bakacağını
 * bilemiyor.
 *
 * Yakınlık ilkesi: birbirine AİT şeyler yakın, AYRI şeyler uzak durur.
 * İki kademe yetiyor:
 *
 *     group   (12)  aynı fikrin parçaları — grafik ile dağılımı
 *     section (30)  ayrı fikirler — bakiye ile geri kalanı
 *
 * ⚠️ ARADAKİ FARK BÜYÜK OLMAK ZORUNDA. 18'e karşı 22 gibi yakın iki
 * değer gruplama üretmez, yalnızca tutarsız görünür. 12'ye karşı 30
 * gözle ayırt edilebiliyor.
 */
/**
 * YAZI ÖLÇEĞİ — ölçüldü: uygulamada 25 FARKLI boyut vardı.
 *
 *     8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 24 26 28 30 32 42 44 46 48 64
 *
 * Bir tasarım sisteminde bu sayı 6-8 olur. Her ekran kendi değerini
 * seçmişti; 13px ile 14px yan yana gelince kimse "iki farklı boyut var"
 * demez ama ÖZENSİZ hisseder. Ritmi olmayan bir arayüz "şablondan
 * çıkmış" görünür — ve bunun tek sebebi budur.
 *
 * ⚠️ GÖVDE METNİ DE KÜÇÜKTÜ. En sık kullanılan boyut 13'tü (80 yerde),
 * 11 ve 12 de çok yaygındı. Erişilebilirlik kılavuzları gövde için
 * 16px taban öneriyor ve 12px altını anti-desen sayıyor. Ölçek bunu
 * bir kademe yukarı çekiyor.
 *
 * ⚠️ ADIMLAR ARASI FARK YUKARI DOĞRU AÇILIYOR (12→14→16→20→26→34→44).
 * Eşit aralıklı bir ölçek (12,14,16,18,20…) hiyerarşi üretmez: başlık
 * ile gövde birbirine yakın kalır. Büyüyen aralık, göze "bu daha
 * önemli" dedirtiyor.
 */
export const type = {
  /** Rozet, birim, ikincil sayaç. */
  micro: 10,
  /** Etiket, sütun başlığı, yardımcı metin. */
  caption: 12,
  /** Gövde — en sık kullanılan. */
  body: 14,
  /** Vurgulu gövde, satır başlığı. */
  emphasis: 16,
  /** Bölüm başlığı. */
  title: 20,
  /** Ekran başlığı. */
  headline: 26,
  /** Büyük sayı. */
  display: 34,
  /** Bakiye gibi tek ve baskın sayı. */
  hero: 44,
} as const;

/**
 * KÖŞE YARIÇAPI — ölçüldü: 18 farklı değer vardı (1'den 20'ye).
 *
 * ⚠️ 12 İLE 14 ARASINDAKİ FARK GÖZLE SEÇİLMEZ ama yan yana duran iki
 * kutuda "bir şey tutmuyor" hissi bırakır. Dört kademe yetiyor.
 */
export const spacing = {
  gutter: 26,
  bottom: 24,
  screen: 22,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  /** Aynı gruba ait bloklar arası. */
  group: 12,
  /** Ayrı bölümler arası. */
  section: 30,
} as const;

export const radius = {
  /** Rozet, küçük etiket. */
  xs: 6,
  /** Düğme, giriş alanı. */
  sm: 10,
  /** Kart, kutu. */
  md: 14,
  /** Modal, büyük yüzey. */
  lg: 20,
  /** Daire — avatar, simge yuvası. */
  full: 999,

  /*
    ⚠️ AŞAĞIDAKİ ÜÇÜ ESKİDEN BERİ VAR VE KORUNDU.

    Kimlik ekranlarının hap biçimli düğmeleri bu değerlere göre
    tasarlandı; ölçeğe zorlamak o ekranların oranını bozardı.
    Yeni kod yukarıdaki kademeleri kullanmalı, bunlar mevcut
    çağıranlar için duruyor.
  */
  field: 12,
  pill: 29,
  pillSmall: 28,
} as const;

export const sizes = {
  control: 58,
  oauth: 56,
} as const;

export const sectionLabel = {
  fontFamily: fonts.bold,
  fontSize: 9,
  letterSpacing: 1.5,
  color: colors.inkFaint,
} as const;

/*
  ⚠️ SÜTUN GENİŞLİKLERİ YAZI ÖLÇEĞİYLE BİRLİKTE BÜYÜDÜ.

  Tablo sütunları SABİT genişlikte ve içlerindeki metin 13px'ten 14px'e,
  11px'ten 12px'e çıktı. Yaklaşık %8 daha geniş yazı, aynı kutuya
  sığmayabilirdi:

      "110.953,35 ₺" · DM Mono 13px -> ~94px   (104'e sığıyordu)
      "110.953,35 ₺" · DM Mono 14px -> ~101px  (kırpılma sınırında)

  ⚠️ BU, YAZI ÖLÇEĞİ DEĞİŞTİRMENİN GÖRÜNMEYEN BEDELİ. Sabit genişlikli
  bir kutuda yazıyı büyütmek, tek başına yapılırsa sayının sonunu
  kırpar — ve kırpılan şey PARA olduğu için kullanıcı yanlış tutar
  okur. Ölçek değiştiren herkes bu kutulara da bakmak zorunda.

  Oranlar korunarak büyütüldü (%9).
*/
/**
 * DEGRADELER — yüzeylere derinlik veren renk geçişleri.
 *
 * ⚠️ YÖN DEĞİŞTİ VE BU BİLİNÇLİ. Önceki tercih "sakin, yalın, araç
 * gibi" idi; ürün sahibi daha ifadeli bir görünüm istedi. Bu bir
 * hata düzeltmesi değil, bir TERCİH değişikliği.
 *
 * ⚠️ AMA KURALSIZ DEĞİL. Üç sınır konuldu:
 *
 *   1. DEGRADE SADECE ZEMİNDE, METİNDE DEĞİL. Renk geçişli yazı
 *      okunurluğu düşürür ve kontrast ölçülemez hâle gelir.
 *   2. GEÇİŞ DAR TUTULDU. İki ucu birbirine yakın renkler; "mor-pembe
 *      degrade" gibi geniş geçişler her yapay zekâ üretimi arayüzde
 *      var ve tam da bu yüzden JENERİK görünüyor.
 *   3. ANLAM RENKLERİ DEGRADE OLMUYOR. Yeşil kâr, kırmızı zarar
 *      demek; geçiş onları birbirine yaklaştırır.
 */
export const gradients = {
  /** Bakiye bloğu — koyudan biraz daha koyuya, üstte hafif aydınlık. */
  hero: ['#1C1C21', '#121215'] as const,
  /** Vurgu düğmesi — mavinin iki tonu. */
  accent: ['#4F8DF7', '#2563EB'] as const,
  /** Kâr rozeti ve alanları. */
  gain: ['#12D18E', '#059669'] as const,
  /** Zarar rozeti. */
  loss: ['#F87171', '#DC2626'] as const,
  /** Şampiyonluk / madalya. */
  gold: ['#FBBF4B', '#D97706'] as const,
  /** Kart üstü ince parlaklık — yüzeyi zeminden ayırıyor. */
  cardSheen: ['rgba(255,255,255,0.045)', 'rgba(255,255,255,0)'] as const,
} as const;

/**
 * GÖLGELER — kartları zeminden ayıran derinlik.
 *
 * ⚠️ KOYU TEMADA GÖLGE ZORDUR. Siyah üstüne siyah gölge görünmez;
 * bu yüzden kartlar bugüne kadar 1 piksellik kenarlıkla ayrılıyordu.
 * Kenarlık işe yarıyor ama düz duruyor — her kutu aynı kağıt
 * kalınlığında.
 *
 * ⚠️ ÇÖZÜM GÖLGEYİ RENKLENDİRMEK. Saf siyah yerine vurgunun koyu
 * tonuyla gölge, koyu zeminde bile algılanıyor ve kartı "yüzüyor"
 * gösteriyor.
 *
 * ⚠️ `elevation` ANDROID İÇİN AYRI VERİLMEK ZORUNDA — `shadow*`
 * özellikleri Android'de hiçbir şey yapmıyor. İkisini birlikte
 * vermeyen kod iOS'ta derinlikli, Android'de düz görünür.
 */
export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  raised: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 8,
  },
  /** Vurgu düğmesi — rengin kendi ışığı. */
  accentGlow: {
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

export const rowMetrics = {
  paddingVertical: 14,
  logoSize: 32,
  changeWidth: 68,
  valueWidth: 114,
  sparkWidth: 46,
  sparkHeight: 22,
} as const;
