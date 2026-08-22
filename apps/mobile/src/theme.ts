/**
 * theme.ts — Modernist tasarım sistemi belirteçleri
 *
 * Kaynak: design_handoff_portfolioyun_auth/README.md "Design Tokens"
 *
 * NEDEN AYRI DOSYA:
 * Renkleri ekranların içine yazsaydık, "arka plan biraz daha koyu olsun"
 * dendiğinde beş dosyada altı ayrı yerde aramak gerekirdi — ve biri
 * mutlaka atlanırdı. Burada tek satır değişiyor.
 *
 * ⚠️ HEX YERİNE rgba KULLANILAN YERLER BİLİNÇLİ.
 * Tasarım "derinlik gölgeden değil yüzey tonundan gelir" diyor: kutular
 * arka planın üstüne yarı saydam beyaz koyarak ayrışıyor, gölge yok.
 * Opak bir gri yazsaydık arka plandaki grafik dokusu kutunun altında
 * kaybolurdu — dokunun kutuların içinden hafifçe görünmesi tasarımın
 * kendisi.
 */

/** Ana metin ve birincil düğme dolgusu. */
const INK = '#f5f4f3';

/** rgba üretici — INK'in belirli saydamlıktaki hâli. */
function ink(alpha: number): string {
  return `rgba(245, 244, 243, ${alpha})`;
}

export const colors = {
  /** Ekran arka planı. */
  surface: '#111112',

  ink: INK,
  /** Gövde metni. */
  inkMuted: ink(0.55),
  /** İkincil metin. */
  inkDim: ink(0.5),
  /** Üçüncül metin, ikonlar. */
  inkFaint: ink(0.45),
  /** Yasal not gibi en soluk metinler. */
  inkGhost: ink(0.35),
  /** Yer tutucu (placeholder) metni. */
  inkPlaceholder: ink(0.32),

  /** Alan dolgusu ve hayalet düğme hover'ı. */
  fieldFill: ink(0.06),

  /** Kıl çizgiler — sırasıyla alan kenarı, ayraç, düğme kenarı. */
  hairlineSoft: ink(0.09),
  hairline: ink(0.14),
  hairlineStrong: ink(0.18),
  /** Odaklanmış alanın kenarı. */
  hairlineFocus: ink(0.4),

  /** Marka rengi. Aynı zamanda düşüş rengi — tasarımın kararı. */
  accent: '#ec3013',
  /** Hata metni. accent'ten farkı: kırmızı ama okunabilir kalıyor. */
  error: '#ff8a72',
  /** Yükseliş. */
  gain: '#43b56f',

  /** Arka plan dokusundaki ızgara çizgileri. */
  gridLine: ink(0.04),
  /** Hacim çubukları. */
  volumeBar: ink(0.07),
  /** Grafik etiketleri (XU100, BIST...). */
  chartLabel: ink(0.08),
} as const;

/**
 * Yazı tipi aileleri.
 *
 * ⚠️ BU ADLAR `useFonts` İLE YÜKLENEN ANAHTARLARLA BİREBİR AYNI OLMALI.
 * React Native'de olmayan bir fontFamily verirsen hata FIRLAMAZ — sessizce
 * sistem fontuna düşer. Yani yazım hatası "çalışıyor ama tasarıma
 * benzemiyor" olarak görünür, ki bulması en zor hata türü.
 */
export const fonts = {
  regular: 'Archivo_400Regular',
  medium: 'Archivo_500Medium',
  semibold: 'Archivo_600SemiBold',
  bold: 'Archivo_700Bold',
} as const;

/**
 * Ekran boşlukları.
 *
 * Tasarımın kenar boşluğu 26px — 24 ya da 32 gibi "yuvarlak" bir sayı
 * değil. Değiştirme: 46px başlık bu boşlukla birlikte ölçülmüş.
 */
export const spacing = {
  gutter: 26,
  bottom: 24,
} as const;

export const radius = {
  /** Giriş alanları. */
  field: 16,
  /** Hap biçimli düğmeler. Yükseklik 58 -> yarısı 29 = tam yuvarlak uç. */
  pill: 29,
  /** OAuth düğmeleri (yükseklik 56). */
  pillSmall: 28,
} as const;

export const sizes = {
  /** Birincil/ikincil düğmeler ve giriş alanları. */
  control: 58,
  /** OAuth düğmeleri. */
  oauth: 56,
} as const;
