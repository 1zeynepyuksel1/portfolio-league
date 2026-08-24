import { Image, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { colors, fonts } from '../theme';

/**
 * AssetLogo — varlık simgesi.
 *
 * ÜÇ KAYNAK, TEK GÖRÜNÜM:
 *
 *   kripto  -> `cryptocurrency-icons` paketinin gerçek logosu
 *   döviz   -> para simgesi ($ € £ …)
 *   maden   -> kimyasal simge (Au / Ag)
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
 * Döviz simgeleri.
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
 * Maden simgeleri — kimyasal sembol.
 *
 * Altın için "Au", gümüş için "Ag". Hem doğru hem kısa; "ALT"/"GUM"
 * gibi kısaltmalar hem çirkin hem belirsizdi.
 */
const METAL_SYMBOLS: Record<string, { text: string; color: string }> = {
  GRAM_ALTIN: { text: 'Au', color: '#D4AF37' },
  GRAM_GUMUS: { text: 'Ag', color: '#B8B8BD' },
};

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

  const logo = CRYPTO_LOGOS[symbol];

  if (logo !== undefined) {
    return (
      <View style={[styles.base, frame]}>
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

  const metal = METAL_SYMBOLS[symbol];

  if (metal !== undefined) {
    return (
      <View style={[styles.base, styles.filled, frame]}>
        <Text
          style={[styles.text, { color: metal.color, fontSize: size * 0.38 }]}
        >
          {metal.text}
        </Text>
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
});
