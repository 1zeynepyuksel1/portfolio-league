import { Image, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, fonts } from '../theme';

/**
 * AssetLogo — varlık simgesi.
 *
 * DÖRT KAYNAK, TEK GÖRÜNÜM:
 *
 *   kripto  -> `cryptocurrency-icons` paketinin gerçek logosu
 *   hisse   -> indirilen şirket logosu (`assets/logos/stocks/`)
 *   döviz   -> elle eklenen logo, yoksa para simgesi ($ € £ …)
 *   maden   -> SVG ile çizilen madeni para
 *
 * ⚠️ VE HER ZAMAN BİR YEDEK VAR. Tanımadığımız bir sembol gelirse ilk üç
 * harfi gösteriliyor. Yedeksiz bıraksaydık yeni eklenen her varlık
 * listede boş bir daire olurdu ve sebebi hiçbir yerde yazmazdı.
 */

/**
 * Kripto logoları.
 *
 * ⚠️ `require` DİNAMİK OLAMAZ — `require(\`.../${symbol}.png\`)` yazmak
 * Metro'da çalışmaz. Paketleyici hangi dosyaların pakete gireceğini
 * DERLEME ANINDA, statik metinlere bakarak buluyor; değişken içeren bir
 * yol çözümlenemez ve çalışma anında "unknown module" hatası verir.
 *
 * Bu yüzden tablo elle yazılmış. Yan faydası: pakete yalnızca bu on
 * dosya giriyor, paketin 7.732 dosyasının tamamı değil.
 *
 * Lisans: paket CC0-1.0 (kamu malı). Logolar marka işareti; varlığı
 * TANIMLAMAK için kullanmak olağan kullanım.
 */
const CRYPTO_LOGOS: Record<string, ImageSourcePropType> = {
  BTC: require('cryptocurrency-icons/128/color/btc.png'),
  ETH: require('cryptocurrency-icons/128/color/eth.png'),
  BNB: require('cryptocurrency-icons/128/color/bnb.png'),
  SOL: require('cryptocurrency-icons/128/color/sol.png'),
  XRP: require('cryptocurrency-icons/128/color/xrp.png'),
  ADA: require('cryptocurrency-icons/128/color/ada.png'),
  DOGE: require('cryptocurrency-icons/128/color/doge.png'),
  AVAX: require('cryptocurrency-icons/128/color/avax.png'),
  LINK: require('cryptocurrency-icons/128/color/link.png'),
  LTC: require('cryptocurrency-icons/128/color/ltc.png'),
};

/**
 * Elle eklenen logolar — `assets/logos/`.
 *
 * ⚠️ DOSYALAR HAM HÂLLERİYLE DEĞİL, İŞLENEREK EKLENDİ: indirilen simgeler
 * beyaz zeminde siyahtı; koyu arayüzde hem beyaz kare olarak görünür hem
 * de simge okunmazdı. Zemin saydamlaştırılıp çizim açık renge boyandı.
 *
 * ⚠️ BU İŞİ YAPAN BETİK ARTIK REPODA YOK. Yorum uzun süre
 * `scripts/prepare-logos.mjs`'e atıf yapıyordu ama o dosya hiç
 * commit'lenmemiş — yani "nasıl hazırlandı" sorusunun cevabı var olmayan
 * bir dosyaya işaret ediyordu. Bu satırlar o boşluğu kapatıyor: yeni bir
 * döviz logosu eklenecekse aynı işlem elle yapılmalı.
 *
 * ⚠️ `require` yolu STATİK METİN OLMAK ZORUNDA: Metro paketlenecek dosyaları
 * DERLEME ANINDA, statik metinlere bakarak buluyor. `require(yol)` gibi
 * değişkenli bir çağrı çözümlenemez ve çalışma anında "unknown module"
 * hatası verir. O yüzden tablo elle büyüyor.
 *
 * Tablo boşken aşağıdaki simge/harf yolu devreye giriyor — yani eksik
 * dosya ekranı bozmuyor, sadece o varlık eski görünümde kalıyor.
 */
const CUSTOM_LOGOS: Record<string, ImageSourcePropType> = {
  USD: require('../../assets/logos/usd.png'),
  EUR: require('../../assets/logos/eur.png'),
  GBP: require('../../assets/logos/gbp.png'),
  JPY: require('../../assets/logos/jpy.png'),
  CAD: require('../../assets/logos/cad.png'),
  AUD: require('../../assets/logos/aud.png'),
  SEK: require('../../assets/logos/sek.png'),

  // ⚠️ CHF BİLEREK YOK. Elimizdeki dosyada Shutterstock filigranı var —
  // hem lisans sorunu hem görsel kirlilik. Tablodan çıkarılınca aşağıdaki
  // `₣` simgesi devreye giriyor, yani liste eksiksiz görünmeye devam
  // ediyor. Filigransız bir dosya gelince buraya bir satır eklenecek.
};

/**
 * ABD hisse logoları — `assets/logos/stocks/`.
 *
 * KAYNAK: financialmodelingprep.com/image-stock/{SEMBOL}.png
 * 100×100 PNG, RGBA (saydam zemin), toplam 408 KB.
 *
 * ⚠️ DÖRT KAYNAK DENENDİ, ÜÇÜ ELENDİ:
 *   Clearbit                 -> ölü (bağlantı kurulmuyor)
 *   companiesmarketcap       -> gri tonlamalı, renk yok
 *   tradingview / parqet     -> SVG; Metro'da PNG kadar sorunsuz değil
 *
 * ⚠️ YER TUTUCU KONTROLÜ YAPILDI. Bazı servis bulamadığı sembol için
 * herkese aynı boş görseli döndürür ve bu FARK EDİLMEZ — otuz varlık da
 * aynı gri daireyle görünür, kimse "logo gelmiyor" demez, "logolar böyle"
 * sanılır. Otuz dosyanın MD5'i alındı: otuzu da benzersiz.
 *
 * ⚠️ LİSANS: logolar marka işareti. Bir varlığı TANIMLAMAK için kullanmak
 * olağan kullanım — `CRYPTO_LOGOS` için verilen gerekçenin aynısı.
 * Dosyalar DEĞİŞTİRİLMEDİ; yeniden renklendirmek marka açısından daha
 * sorunlu olurdu.
 *
 * ⚠️ `require` YOLU STATİK METİN OLMAK ZORUNDA — döngüyle üretilemez.
 * Metro paketlenecek dosyaları DERLEME ANINDA statik metinlere bakarak
 * buluyor. Otuz satır elle duruyor, sebebi bu.
 */
const STOCK_LOGOS: Record<string, ImageSourcePropType> = {
  AAPL: require('../../assets/logos/stocks/aapl.png'),
  MSFT: require('../../assets/logos/stocks/msft.png'),
  NVDA: require('../../assets/logos/stocks/nvda.png'),
  GOOGL: require('../../assets/logos/stocks/googl.png'),
  AMZN: require('../../assets/logos/stocks/amzn.png'),
  META: require('../../assets/logos/stocks/meta.png'),
  TSLA: require('../../assets/logos/stocks/tsla.png'),
  NFLX: require('../../assets/logos/stocks/nflx.png'),
  AMD: require('../../assets/logos/stocks/amd.png'),
  INTC: require('../../assets/logos/stocks/intc.png'),
  JPM: require('../../assets/logos/stocks/jpm.png'),
  V: require('../../assets/logos/stocks/v.png'),
  MA: require('../../assets/logos/stocks/ma.png'),
  BAC: require('../../assets/logos/stocks/bac.png'),
  WMT: require('../../assets/logos/stocks/wmt.png'),
  KO: require('../../assets/logos/stocks/ko.png'),
  PEP: require('../../assets/logos/stocks/pep.png'),
  MCD: require('../../assets/logos/stocks/mcd.png'),
  NKE: require('../../assets/logos/stocks/nke.png'),
  DIS: require('../../assets/logos/stocks/dis.png'),
  BA: require('../../assets/logos/stocks/ba.png'),
  CAT: require('../../assets/logos/stocks/cat.png'),
  XOM: require('../../assets/logos/stocks/xom.png'),
  CVX: require('../../assets/logos/stocks/cvx.png'),
  PFE: require('../../assets/logos/stocks/pfe.png'),
  JNJ: require('../../assets/logos/stocks/jnj.png'),
  UNH: require('../../assets/logos/stocks/unh.png'),
  ORCL: require('../../assets/logos/stocks/orcl.png'),
  CSCO: require('../../assets/logos/stocks/csco.png'),
  ADBE: require('../../assets/logos/stocks/adbe.png'),
};

/**
 * Koyu arayüzde kaybolan logolar — arkalarına açık daire konuyor.
 *
 * ⚠️ ÖLÇÜLEREK BULUNDU, TAHMİNLE DEĞİL. Önce otuz logonun saydam olmayan
 * piksellerinin ortalama parlaklığı hesaplandı; 14'ü "sorunlu" çıktı.
 * Sonra hepsi gerçek arayüz rengine (#0B132B) basılıp GÖZLE bakıldı:
 * sorunlu görünen 14'ün 13'ü aslında gayet okunur.
 *
 * Ortalama yanıltıcıydı çünkü çok renkli bir logoda koyu ve açık pikseller
 * birbirini götürüyor — Coca-Cola'nın kırmızısı ortalamada 65 çıkıyor ama
 * lacivert zeminde net görünüyor.
 *
 * Gerçekten kaybolan tek logo INTEL: neredeyse siyah bir yazı, ortalama
 * parlaklık 3.
 *
 * Ders: "ölçtüm" demek yetmiyor, DOĞRU ŞEYİ ölçmek gerekiyor.
 */
const NEEDS_LIGHT_BACKDROP = new Set(['INTC']);

/**
 * Döviz simgeleri — elle logo YOKKEN kullanılan yedek.
 *
 * ⚠️ BAYRAK DEĞİL, PARA SİMGESİ — ve bu bilinçli.
 *
 * Bayraklar renkli ve gürültülü; tasarımın sakin paletini bozarlar.
 * Daha önemlisi 32 pikselde CHF ile SEK bayrağı birbirinden ayırt
 * edilemez. Simge tek karakter ve her boyutta okunur.
 */
const FX_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CHF: '₣',
  CAD: 'C$',
  AUD: 'A$',
  SEK: 'kr',
};

/**
 * Madenler — İNDİRİLMEDİ, ÇİZİLDİ.
 *
 * ⚠️ ÜZERİNDE YAZI YOK. Önce "Au"/"Ag" vardı; kaldırıldı. Diğer varlıkların
 * logolarında da yazı yok — yazılı iki daire aralarında yabancı duruyordu.
 * Altın sarısı ile gümüş grisi zaten karıştırılamaz; adı da hemen yanında
 * yazıyor.
 *
 * Altın ve gümüş için hazır dosya gelmedi. İnternetten indirmek yerine
 * SVG ile çiziliyor; üç sebeple:
 *
 *   1. Lisans sorunu yok — kendi çizimimiz.
 *   2. Filigran riski yok (CHF dosyasında yaşandı).
 *   3. Vektör: 32px'te de 128px'te de aynı keskinlikte.
 *
 * ⚠️ MADENİ PARA GİBİ ÇİZİLİYOR, düz harf olarak değil. Önceki hâli
 * dairenin içinde soluk "Au" yazısıydı ve diğer varlıkların gerçek
 * logolarının yanında yarım kalmış duruyordu. Degrade dolgu ona madeni
 * bir yüzey hissi veriyor ve listedeki ağırlığı eşitliyor.
 *
 * Kimyasal simge korundu: "ALT"/"GUM" gibi kısaltmalar hem çirkin hem
 * belirsizdi; Au ve Ag doğru ve evrensel.
 */
const METALS: Record<
  string,
  { key: string; from: string; to: string; ink: string }
> = {
  // Sıcak sarıdan koyu altına — tek renk düz bir daire verirdi.
  GRAM_ALTIN: { key: 'altin', from: '#F7D774', to: '#B8860B', ink: '#4A3608' },
  // Gümüşte kontrast daha düşük; metal zaten soğuk ve soluk bir yüzey.
  GRAM_GUMUS: { key: 'gumus', from: '#F2F2F7', to: '#9096A0', ink: '#33353B' },
};

/** Degrade dolgulu madeni para. */
function MetalCoin({
  metal,
  size,
}: {
  metal: { key: string; from: string; to: string; ink: string };
  size: number;
}) {
  /**
   * ⚠️ DEGRADE KİMLİĞİ BENZERSİZ OLMALI.
   *
   * SVG'de `id` belge genelinde geçerli. İki madeni para aynı ekranda
   * çizilirken ikisi de "coin" kimliğini kullansaydı, ikincisi
   * birincinin degradesini alırdı — gümüş altın rengi çıkardı.
   * Anahtarı kimliğe katmak bunu kapatıyor.
   */
  const id = `coin-${metal.key}`;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0.7" y2="1">
            <Stop offset="0" stopColor={metal.from} />
            <Stop offset="1" stopColor={metal.to} />
          </LinearGradient>
        </Defs>

        <Circle cx={50} cy={50} r={49} fill={`url(#${id})`} />

        {/*
          İnce iç halka: madeni paraların kenar pahını taklit ediyor.
          Olmadan daire düz bir renk lekesi gibi duruyor.
        */}
        <Circle
          cx={50}
          cy={50}
          r={41}
          fill="none"
          stroke={metal.ink}
          strokeWidth={2}
          strokeOpacity={0.28}
        />
      </Svg>

    </View>
  );
}

export function AssetLogo({
  symbol,
  size = 32,
  /** Kenar rengi — dağılım çubuğundaki dilimle eşleşsin diye. */
  tint,
}: {
  symbol: string;
  size?: number;
  tint?: string | undefined;
}) {
  const frame = {
    width: size,
    height: size,
    borderRadius: size / 2,
    ...(tint !== undefined ? { borderColor: tint, borderWidth: 2 } : null),
  };

  // ⚠️ SIRA ÖNEMLİ: elle eklenen logo, hazır kripto setini EZER.
  // Bir varlığın logosunu beğenmezsek klasöre kendi dosyamızı koyup
  // koddan hiçbir şey silmeden değiştirebiliyoruz.
  const logo =
    CUSTOM_LOGOS[symbol] ?? CRYPTO_LOGOS[symbol] ?? STOCK_LOGOS[symbol];

  if (logo !== undefined) {
    return (
      <View
        style={[
          styles.base,
          // Koyu logolara açık daire; diğerleri zeminsiz (kripto gibi).
          NEEDS_LIGHT_BACKDROP.has(symbol) && styles.lightBackdrop,
          frame,
        ]}
      >
        <Image
          source={logo}
          style={{ width: size, height: size }}
          // ⚠️ `contain`: logolar kare ama içlerinde farklı oranda boşluk
          // var. `cover` olsaydı bazılarının kenarı kırpılırdı.
          resizeMode="contain"
          accessibilityLabel={symbol}
        />
      </View>
    );
  }

  const metal = METALS[symbol];

  if (metal !== undefined) {
    return (
      <View style={[styles.base, frame]}>
        <MetalCoin metal={metal} size={size} />
      </View>
    );
  }

  const fx = FX_SYMBOLS[symbol];

  if (fx !== undefined) {
    return (
      <View style={[styles.base, styles.filled, frame]}>
        <Text
          style={[
            styles.text,
            {
              color: colors.inkBright,
              // Çok karakterli simgeler ("C$", "kr") daha küçük punto
              // ister, yoksa daireden taşarlar.
              fontSize: fx.length > 1 ? size * 0.32 : size * 0.44,
            },
          ]}
        >
          {fx}
        </Text>
      </View>
    );
  }

  // Yedek: bilinmeyen sembolün ilk üç harfi.
  return (
    <View style={[styles.base, styles.filled, frame]}>
      <Text
        style={[
          styles.text,
          { color: colors.inkMuted, fontSize: size * 0.31 },
        ]}
      >
        {symbol.slice(0, 3)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Gerçek logolarda zemin YOK — logonun kendi rengi görünsün.
  // Harf/simge gösterirken zemin var, yoksa yazı boşlukta durur.
  filled: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { fontFamily: fonts.bold, textAlign: 'center' },
  /**
   * Koyu logolar için açık daire.
   *
   * ⚠️ SAF BEYAZ DEĞİL (#ECEEF3). Beyaz daire lacivert listede fazla
   * parlak bir leke oluyor ve göz doğrudan oraya kayıyor — logo öne
   * çıkmalı, ZEMİNİ değil. Hafif kırık beyaz aynı okunurluğu veriyor.
   */
  lightBackdrop: { backgroundColor: '#ECEEF3' },
});
