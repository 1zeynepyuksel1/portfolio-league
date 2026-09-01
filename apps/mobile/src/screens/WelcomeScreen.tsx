/**
 * WelcomeScreen — uygulamanın ilk açılış ekranı.
 *
 * Kaynak: design_handoff_portfolioyun_auth/README.md §1
 *
 * ⚠️ METİNLER ÜRÜNE UYARLANDI — ve nedeni ciddi.
 *
 * Tasarımda üç iddia vardı, üçü de ürün için doğru değil:
 *
 *   "SPK lisanslı"            -> Portfolioyun sanal bakiyeli bir simülasyon.
 *                                SPK lisansı iddiası gerçek dışı bir
 *                                DÜZENLEYİCİ BEYAN olur. Yazılmadı.
 *   "Komisyonsuz ilk 30 gün"  -> İlk emirden itibaren %0,1 komisyon var
 *                                (orders/calculate.ts FEE_BASIS_POINTS = 10).
 *   "Hisse, fon ve kripto"    -> Fon hiç yok.
 *
 * Yerlerine doğru olan ve aynı ritmi tutan metinler kondu. Düzen, punto,
 * renk, boşluk tasarımdaki gibi bırakıldı — değişen yalnızca kelimeler.
 *
 * Bir pazarlama metni ürünün yapabildiğinden fazlasını söylüyorsa, o metni
 * düzeltmek tasarımı bozmak değil; tasarımı doğru kılmaktır.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';
import { ChartBackground } from '../components/ChartBackground';
import {
  HomeIndicator,
  PrimaryButton,
  SecondaryButton,
} from '../components/AuthControls';
import { colors, fonts, spacing } from '../theme';

type Props = {
  onGoToRegister: () => void;
  onGoToLogin: () => void;
};

/** Lucide `shield` — güven satırının sol işareti. */
function ShieldIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Path
        d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"
        stroke={colors.gain}
        strokeWidth={2}
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Lucide `clock`. */
function ClockIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9} stroke={colors.gain} strokeWidth={2} fill="none" />
      <Polyline
        points="12,7 12,12 16,14"
        stroke={colors.gain}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * Güven satırı.
 *
 * "7/24 emir" tasarımdan aynen korundu çünkü DOĞRU — ve tesadüf değil:
 * varlıkların kripto, döviz ve maden seçilmesinin gerekçelerinden biri
 * borsa saati/tatil karmaşıklığının olmamasıydı (bkz. CLAUDE.md).
 */
const TRUST_ITEMS = [
  { icon: <ShieldIcon />, label: 'Sanal bakiye' },
  { icon: <ClockIcon />, label: '7/24 emir' },
];

export function WelcomeScreen({ onGoToRegister, onGoToLogin }: Props) {
  return (
    <View style={styles.root}>
      <ChartBackground />

      <View style={styles.content}>
        {/* Kahraman blok — dikeyde ortalanmış, sola yaslı */}
        <View style={styles.hero}>
          <Text style={styles.title}>Portfolioyun</Text>

          <Text style={styles.tagline}>
            ABD hissesi, kripto ve döviz tek portföyde. 100.000 TL sanal
            bakiyeyle başla.
          </Text>

          <View style={styles.trustRow}>
            {TRUST_ITEMS.map((item) => (
              <View key={item.label} style={styles.trustItem}>
                {item.icon}
                <Text style={styles.trustLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Eylem bloğu — dibe yaslı */}
        <View style={styles.actions}>
          <PrimaryButton label="Hesap aç" onPress={onGoToRegister} />
          <SecondaryButton label="Giriş yap" onPress={onGoToLogin} />

          <Text style={styles.legal}>
            Devam ederek Kullanım Koşulları ve Gizlilik Politikası'nı kabul
            edersiniz.
          </Text>

          <View style={styles.indicatorWrap}>
            <HomeIndicator />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.gutter,
  },

  hero: {
    // flex:1 + justifyContent:center -> başlık ekranın dikey ortasında,
    // eylem bloğu ne kadar büyürse büyüsün kendini ona göre ayarlar.
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 44,
    // lineHeight punto'dan KÜÇÜK (46 × .98). Tasarımın istediği bu:
    // tek satırlık büyük başlıkta harfler biraz sıkışınca daha oturaklı
    // duruyor. Çok satırlı gövde metninde aynısını yapmak okunmaz kılardı.
    lineHeight: 46 * 0.98,
    fontFamily: fonts.bold,
    letterSpacing: -0.04 * 46,
    color: colors.ink,
  },
  tagline: {
    fontSize: 16,
    lineHeight: 16 * 1.45,
    fontFamily: fonts.regular,
    color: colors.inkMuted,
    maxWidth: 290,
    marginTop: 16,
  },
  trustRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 28,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trustLabel: {
    fontSize: 12,
    fontFamily: fonts.medium,
    letterSpacing: 0.04 * 12,
    color: colors.inkFaint,
  },

  actions: {
    paddingBottom: spacing.bottom,
    gap: 10,
  },
  legal: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: fonts.regular,
    color: colors.inkGhost,
    textAlign: 'center',
    marginTop: 12,
  },
  indicatorWrap: {
    marginTop: 16,
  },
});
