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
  // ---------------------------------------------------------------------
  // YÜZEYLER — beş kademe, hepsi ölçülü
  // ---------------------------------------------------------------------
  //
  // ⚠️ TASARIM GÖLGE KULLANMIYOR. Derinlik yüzey TONUYLA anlatılıyor:
  // her kademe bir öncekinden hafifçe açık. Gölge eklemek tasarımı
  // "bozmaz" ama ona ait olmayan bir dil katar — kartlar yüzmeye başlar.

  /** Ekran arka planı. */
  surface: '#0F0F10',
  /** Kart, satır dolgusu, ikon düğmesi. */
  surfaceRaised: '#1A1A1C',
  /** Ekrandan DAHA KOYU — girintili alanlar (arama kutusu, boş durum). */
  surfaceSunken: '#141415',
  /** Basılı/seçili hâldeki yüzey. */
  surfacePressed: '#202022',

  /** Ayraç ve kart kenarı. */
  border: '#2B2B2E',
  /** Vurgulu kenar — seçili kart, odaklı alan. */
  borderStrong: '#3A3A3E',

  // ---------------------------------------------------------------------
  // METİN — dört kademe
  // ---------------------------------------------------------------------

  /** Başlık ve rakam. */
  ink: '#FFFFFF',
  /** Ters zeminde metin, ve ikincil başlık. */
  inkBright: '#E9E9EA',
  /** Gövde metni. */
  inkMuted: '#A6A6AC',
  /**
   * Etiket, birim, bölüm başlığı.
   *
   * ⚠️ TASARIMDAKİ #79797F'DEN AÇILDI — okunabilirlik için.
   *
   * Tasarımın rengi koyu zeminde ~4,4:1 kontrast veriyor. Bu, normal
   * boyutta yeterli ama bu renk 9-11px etiketlerde kullanılıyor ve
   * o boyutta harfler inceldiği için gözle görülür şekilde soluyor.
   * #8E8E96 kontrastı ~5,6:1'e çıkarıyor; ton aynı kalıyor, sadece
   * bir kademe açık.
   */
  inkFaint: '#8E8E96',
  /**
   * Devre dışı / üçüncül.
   *
   * ⚠️ #4E4E53 kontrastı ~2,2:1 idi — okunabilir değil, "var ama
   * okunmasın" demek. Takvimdeki kapalı günler için doğruydu ama
   * zaman damgası gibi GERÇEK bilgi de bu renkteydi. Açıldı.
   */
  inkDisabled: '#6A6A71',

  // ---------------------------------------------------------------------
  // YÖN
  // ---------------------------------------------------------------------

  /** Yükseliş. */
  gain: '#34C28A',
  /** Düşüş. */
  loss: '#E5484D',

  /**
   * Marka rengi — giriş ekranlarından geliyor (design_handoff §Brand row).
   *
   * ⚠️ DÜŞÜŞ RENGİ DEĞİL. Uygulama tasarımı düşüş için #E5484D kullanıyor;
   * ikisi farklı kırmızı ve karıştırılmamalı. Marka kırmızısı yalnızca
   * logo noktası ve birincil düğme hover'ında.
   */
  accent: '#ec3013',
  /** Hata metni — kırmızı ama okunabilir kalıyor. */
  error: '#ff8a72',

  /** Uyarı. Ne yükseliş ne düşüş — "dikkat et". */
  warn: '#d9a441',

  /**
   * MADALYA RENKLERİ — podyum için.
   *
   * ⚠️ ÜÇÜ AYRI TOKEN OLMAK ZORUNDA. Önceden bronz da `warn` (altın
   * sarısı) kullanıyordu; birinci ile üçüncü AYNI renkteydi ve podyum
   * "kim kaçıncı" bilgisini renkle taşıyamıyordu.
   *
   * Gümüş bilerek soğuk gri, bronz bilerek kırmızıya çalan kahve:
   * altın sarısından hem ton hem parlaklık olarak ayrışıyorlar, yani
   * renk körlüğünde de sıra okunabiliyor.
   */
  /**
   * ⚠️ `warn` İLE AYNI DEĞİL — VE OLMAMALI.
   *
   * İkisi de sarı ama işleri farklı: `warn` (#d9a441) bir UYARI rengi,
   * dikkat çekmeli ama tedirgin etmemeli — bilerek soluk. Madalya ise
   * bir ÖDÜL: parlak olması gerekiyor, birinciliğin ekranda ışıldaması
   * lazım.
   *
   * Ayrı token olmasalardı birini parlatmak diğerini de değiştirirdi:
   * uyarı mesajları gereksiz yere bağırmaya başlardı.
   */
  gold: '#ffc93c',
  silver: '#b9bec8',
  bronze: '#b0703a',

  // ---------------------------------------------------------------------
  // TERS ZEMİN — seçili çip ve birincil düğme
  // ---------------------------------------------------------------------
  //
  // Tasarımda seçili durum renkle değil TERS ZEMİNLE anlatılıyor:
  // açık dolgu + koyu metin. Seçiliyi vurgu rengiyle boyamak yaygın çözüm
  // ama bu tasarımda vurgu rengi yön için ayrılmış — seçili çipi kırmızı
  // yapsaydık "düşüş" gibi okunurdu.

  /** Seçili çipin / birincil düğmenin dolgusu. */
  inverse: '#E9E9EA',
  /** Ters zemin üzerindeki metin. */
  onInverse: '#0F0F10',
  /** Ters zemin üzerindeki ikincil metin. */
  onInverseMuted: '#4E4E53',

  // ---------------------------------------------------------------------
  // ROZET DOLGULARI
  // ---------------------------------------------------------------------

  gainSoft: 'rgba(52, 194, 138, 0.15)',
  lossSoft: 'rgba(229, 72, 77, 0.15)',
  warnSoft: 'rgba(217, 164, 65, 0.15)',
  goldSoft: 'rgba(255, 201, 60, 0.18)',
  silverSoft: 'rgba(185, 190, 200, 0.14)',
  bronzeSoft: 'rgba(176, 112, 58, 0.16)',

  // ---------------------------------------------------------------------
  // GRAFİK
  // ---------------------------------------------------------------------

  axisLine: '#2B2B2E',
  axisText: '#79797F',
  axisGrid: 'rgba(121, 121, 127, 0.14)',
  /** Dokunma imlecinin fiyat balonu — opak, altındaki çizgi görünmesin. */
  readoutFill: '#202022',

  // ---------------------------------------------------------------------
  // ESKİ ADLAR — giriş ekranları hâlâ bunları kullanıyor
  // ---------------------------------------------------------------------
  //
  // Tek seferde hepsini değiştirmek yerine köprü bırakıldı: giriş
  // ekranları çalışmaya devam ediyor, yeni ekranlar yukarıdaki adları
  // kullanıyor. Giriş ekranları da geçince bu blok silinecek.

  inkDim: '#A6A6AC',
  inkGhost: '#5C5C61',
  inkPlaceholder: '#5C5C61',
  fieldFill: '#1A1A1C',
  hairlineSoft: '#2B2B2E',
  hairline: '#2B2B2E',
  hairlineStrong: '#3A3A3E',
  hairlineFocus: '#4E4E53',
  gridLine: 'rgba(121, 121, 127, 0.10)',
  volumeBar: 'rgba(121, 121, 127, 0.14)',
  chartLabel: 'rgba(121, 121, 127, 0.16)',
  accentSoft: 'rgba(229, 72, 77, 0.15)',
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
  /**
   * ⚠️ ARCHIVO'DAN RUBIK'E GEÇİLDİ.
   *
   * Archivo dar bir grotesk: harfleri sıkışık ve köşeli, küçük
   * boyutlarda okumak yoruyor. Rubik'in harf uçları yuvarlatılmış ve
   * gövdeler daha geniş — aynı punto daha rahat okunuyor.
   *
   * Rubik seçildi, Nunito değil: Nunito daha da yuvarlak ama bir finans
   * uygulaması için fazla yumuşak, oyun arayüzü gibi duruyor. Rubik
   * yuvarlak ama ciddi kalıyor ve rakamları net.
   */
  regular: 'Rubik_400Regular',
  medium: 'Rubik_500Medium',
  semibold: 'Rubik_600SemiBold',
  bold: 'Rubik_700Bold',

  /**
   * ⚠️ RAKAMLAR MONOSPACE — VE BU TASARIMIN EN ÖNEMLİ KARARI.
   *
   * Fiyat, miktar, yüzde: hepsi tek genişlikte. Sebebi estetik değil
   * OKUNABİLİRLİK: orantılı bir fontta "1" ile "8" farklı genişlikte
   * olduğu için alt alta duran fiyatların ondalık noktaları kayar.
   * Ayrıca canlı fiyat değişince sayının GENİŞLİĞİ de değişir ve satır
   * oynar — liste titrer. Monospace ikisini de bitiriyor.
   *
   * ⚠️ IBM PLEX MONO'DAN DM MONO'YA GEÇİLDİ. Plex Mono köşeli ve
   * teknik; Rubik'in yanında yabancı duruyordu. DM Mono geometrik ve
   * yuvarlak, aynı aileden gelmiş gibi oturuyor.
   *
   * KURAL: değişen sayı -> mono. Sabit metin -> Rubik.
   */
  mono: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
  // ⚠️ DM Mono'nun 600/700 kesimi YOK — en kalını 500.
  // Aynı adları koruyup 500'e yönlendiriyoruz ki çağıran ekranların
  // hiçbiri değişmesin; ileride başka bir mono seçilirse tek yer burası.
  monoSemibold: 'DMMono_500Medium',
  monoBold: 'DMMono_500Medium',
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
  /**
   * Uygulama ekranlarının kenar boşluğu — giriş ekranlarından FARKLI.
   *
   * Giriş 26px kullanıyor (nefes alan, tek sütun). Uygulama 22px:
   * liste satırları ve veri tablosu daha dar boşlukla daha çok bilgi
   * taşıyor. `docs/export/5a` bu değerle ölçülmüş.
   */
  screen: 22,
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


/**
 * Bölüm başlığı stili — tasarımda ONLARCA yerde tekrarlanıyor.
 *
 *     CÜZDAN · TRY     ÖZEL GÜNLER     NAKİT     VARLIK
 *
 * Ortak özellik: çok küçük, çok kalın, harf arası GENİŞ, soluk renk.
 * Harf arası olmadan 9px metin okunmaz bir leke olur; asıl işi o yapıyor.
 */
export const sectionLabel = {
  fontFamily: fonts.bold,
  fontSize: 9,
  letterSpacing: 1.5,
  color: colors.inkFaint,
} as const;

/** Liste ve tablo satırlarının ortak ölçüleri. */
export const rowMetrics = {
  paddingVertical: 13,
  logoSize: 32,
  /** Değişim sütunu — sabit genişlik, sayılar hizalansın diye. */
  changeWidth: 62,
  /** Değer sütunu. */
  valueWidth: 104,
  /** Satır içi mini grafik. */
  sparkWidth: 46,
  sparkHeight: 22,
} as const;
