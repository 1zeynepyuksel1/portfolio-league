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
  bronzeSoft: 'rgba(139, 92, 246, 0.15)',

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

export const rowMetrics = {
  paddingVertical: 13,
  logoSize: 32,
  changeWidth: 62,
  valueWidth: 104,
  sparkWidth: 46,
  sparkHeight: 22,
} as const;
