import type { ReactElement } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Path, Polyline, Rect } from 'react-native-svg';
import { colors, fonts } from '../theme';

/**
 * TabBar — `docs/export/8a` ve `9a`'nın alt çubuğu.
 *
 * ⚠️ SEKME SAYISI BEŞTEN DÖRDE İNDİ ve bu tasarımın kararı.
 *
 * Eskiden Arkadaşlar ayrı bir sekmeydi. Tasarım onu Lig'in içine bir
 * alt sekme olarak koyuyor (`Genel Lig` / `Arkadaşlarım`), çünkü ikisi
 * de aynı soruyu soruyor: "başkalarına göre neredeyim". Ayrı sekme
 * olduğunda kullanıcı ikisi arasında gidip gelerek karşılaştırmak
 * zorundaydı; artık yan yanalar.
 *
 * ⚠️ İKONLAR EMOJİ DEĞİL, SVG. Emoji her platformda farklı çiziliyor
 * (iOS'ta renkli Apple seti, Android'de Noto, web'de sistem fontu) ve
 * boyutları tutmuyor. Tasarımın ince çizgili ikonlarına benzemeleri
 * imkânsız. SVG her yerde birebir aynı.
 */

export type TabKey = 'wallet' | 'market' | 'league' | 'whatif';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'wallet', label: 'Cüzdan' },
  { key: 'market', label: 'Piyasa' },
  { key: 'league', label: 'Lig' },
  { key: 'whatif', label: 'Ya alsaydın' },
];

/** Cüzdan — kart yuvası. */
function WalletIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={6} width={18} height={13} rx={2.5} />
      <Path d="M3 10h18" />
      <Path d="M17 14.5h.01" />
    </Svg>
  );
}

/** Piyasa — sütun grafiği. */
function MarketIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={1.7} strokeLinecap="round">
      <Path d="M5 15v4" />
      <Path d="M10 9v10" />
      <Path d="M15 12v7" />
      <Path d="M20 5v14" />
    </Svg>
  );
}

/** Lig — kupa. */
function LeagueIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <Path d="M7 6H4.5a2.5 2.5 0 0 0 2.5 4" />
      <Path d="M17 6h2.5a2.5 2.5 0 0 1-2.5 4" />
      <Path d="M12 14v3" />
      <Path d="M8.5 20h7" />
    </Svg>
  );
}

/** Ya alsaydın — geriye saat. */
function HistoryIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 12a9 9 0 1 0 3-6.7" />
      <Polyline points="3,4 3,9 8,9" />
      <Path d="M12 8v4.5l3 1.8" />
    </Svg>
  );
}

// ⚠️ `JSX.Element` DEĞİL, `ReactElement`. Yeni JSX dönüşümünde global
// `JSX` ad alanı yok; React'ten içe aktarılan tip kullanılıyor.
const ICONS: Record<TabKey, (props: { color: string }) => ReactElement> = {
  wallet: WalletIcon,
  market: MarketIcon,
  league: LeagueIcon,
  whatif: HistoryIcon,
};

export function TabBar({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (key: TabKey) => void;
}) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const on = tab.key === active;
        const Icon = ICONS[tab.key];
        // Aktif sekme BEYAZ, pasif soluk. Renk kullanmıyoruz: yeşil/kırmızı
        // bu uygulamada yön demek, aktif sekmeyi yeşil yapsaydık "yükseliş"
        // gibi okunurdu.
        const color = on ? colors.ink : colors.inkFaint;

        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={tab.label}
          >
            <Icon color={color} />
            <Text style={[styles.label, { color }, on && styles.labelOn]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: 10,
    // Alt boşluk: telefonun ana ekran çizgisi çubuğun üstüne binmesin.
    paddingBottom: 18,
  },
  tab: { flex: 1, alignItems: 'center', gap: 5 },
  label: { fontFamily: fonts.medium, fontSize: 10, letterSpacing: 0.1 },
  labelOn: { fontFamily: fonts.semibold },
});
