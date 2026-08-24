import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, fonts } from '../theme';

/**
 * AllocationBar — portföy dağılımı.
 *
 * ⚠️ PASTA GRAFİĞİ DEĞİL — VE BU TASARIMIN KARARI.
 *
 * Batuhan pasta grafiği istemişti; `docs/export/5a` yatay çubuk çiziyor.
 * Çubuk tercih edildi çünkü:
 *
 *   1. Yatay çubuk 6px yükseklik kaplıyor, pasta ~160px. Cüzdan ekranında
 *      asıl bilgi pozisyon listesi; dağılım ikincil ve o kadar yer hak
 *      etmiyor.
 *   2. Küçük dilimler pastada okunmaz olur. Çubukta %2'lik bir dilim ince
 *      ama görünür kalır.
 *   3. Uzunluk karşılaştırmak, açı karşılaştırmaktan kolaydır — insan gözü
 *      açıyı sistematik olarak yanlış tahmin eder.
 *
 * ⚠️ RENK DEĞİL GRİ TONU KULLANILIYOR. Yeşil/kırmızı bu uygulamada YÖN
 * demek. Dağılımı renklendirseydik "yeşil dilim = kazanan varlık" diye
 * okunurdu; oysa dilim sadece büyüklüğü gösteriyor.
 *
 * İstenen bilgi (yüzde · tutar · adet) dokununca açılan satırda.
 */

/** Dilim tonları — açıktan koyuya, en büyük dilim en açık. */
const SHADES = [
  colors.inverse,
  colors.inkMuted,
  colors.inkFaint,
  colors.inkDisabled,
  colors.borderStrong,
] as const;

export type Slice = {
  label: string;
  /** Yüzde, 0-100. */
  percent: number;
  /** Dokununca gösterilecek ayrıntı — biçimlendirilmiş metin. */
  detail: string;
};

export function AllocationBar({ slices }: { slices: Slice[] }) {
  const [active, setActive] = useState<number | null>(null);

  if (slices.length === 0) return null;

  return (
    <View>
      <View style={styles.bar}>
        {slices.map((slice, index) => (
          <TouchableOpacity
            key={slice.label}
            style={[
              styles.slice,
              {
                // ⚠️ Yüzde 0 olan dilim `flex: 0` ile tamamen kaybolur.
                // En az 1 veriyoruz ki çok küçük pozisyonlar da çubukta
                // bir iz bıraksın — yoksa kullanıcı "bu varlık nerede"
                // diye arar.
                flexGrow: Math.max(slice.percent, 1),
                backgroundColor: SHADES[index % SHADES.length],
              },
              index === 0 && styles.first,
              index === slices.length - 1 && styles.last,
              active === index && styles.sliceActive,
            ]}
            onPress={() => setActive(active === index ? null : index)}
            accessibilityRole="button"
            accessibilityLabel={`${slice.label} ${slice.detail}`}
          />
        ))}
      </View>

      {active === null ? (
        // Dokunulmadığında özet: en büyük üç dilim.
        <Text style={styles.summary} numberOfLines={1}>
          {slices
            .slice(0, 3)
            .map((s) => `${s.label} %${s.percent.toFixed(1).replace('.', ',')}`)
            .join(' · ')}
        </Text>
      ) : (
        <View style={styles.detailRow}>
          <View
            style={[
              styles.dot,
              { backgroundColor: SHADES[active % SHADES.length] },
            ]}
          />
          <Text style={styles.detailLabel}>{slices[active]?.label}</Text>
          <Text style={styles.detailValue}>{slices[active]?.detail}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', gap: 2, height: 6 },
  slice: { flexBasis: 0 },
  first: { borderTopLeftRadius: 3, borderBottomLeftRadius: 3 },
  last: { borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  // Seçili dilim büyümüyor, sadece uzuyor — genişlik bilgi taşıdığı için
  // ona dokunmak yalan söylemek olurdu.
  sliceActive: { height: 10, marginTop: -2 },

  summary: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.inkFaint,
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  detailLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.ink },
  detailValue: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkMuted,
    flex: 1,
  },
});
