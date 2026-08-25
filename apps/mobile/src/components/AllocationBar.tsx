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
 * İstenen bilgi (yüzde · tutar · adet) dokununca açılan satırda.
 */

/**
 * Dilim renkleri.
 *
 * ⚠️ ÖNCE GRİ TONLARDI, RENGE GEÇİLDİ — ve gerekçe değişti.
 *
 * Gri seçilmişti çünkü yeşil/kırmızı bu uygulamada YÖN demek ve dağılımı
 * renklendirmek "yeşil dilim = kazanan varlık" gibi okunabilirdi.
 *
 * Ama uygulamada gri tonlar birbirinden ayırt edilemedi: beş dilimin
 * dördü aynı griye çalıyordu ve kullanıcı hangi çubuğun hangi varlık
 * olduğunu göremiyordu. Renk bu sorunu çözüyor.
 *
 * Karışma riski şöyle kapatıldı: paletten YEŞİL VE KIRMIZI ÇIKARILDI.
 * Mor, mavi, turuncu, camgöbeği, sarı — hiçbiri yön rengiyle karışmıyor.
 */
export const SLICE_COLORS = [
  '#7C6BF5', // mor
  '#3E9BF0', // mavi
  '#E8913A', // turuncu
  '#37BFC0', // camgöbeği
  '#D4C24A', // sarı
  '#C56FC9', // eflatun
  '#5F7FE8', // çivit
  colors.inkDisabled, // artanlar
] as const;

export type Slice = {
  label: string;
  /** Yüzde, 0-100. */
  percent: number;
  /** Dokununca gösterilecek ayrıntı — biçimlendirilmiş metin. */
  detail: string;
};

/**
 * Bir dilim etiketinin rengi — satır rozetleri çubukla aynı rengi
 * kullansın diye dışarı açık.
 *
 * ⚠️ İNDİS DEĞİL ETİKET ALIYOR. İndis verseydik liste sıralandığında
 * aynı varlık farklı renk alırdı: kullanıcı "BTC moru neden maviye
 * döndü" diye sorardı. Etiketten türeterek renk varlığa sabitleniyor.
 */
export function colorForLabel(label: string, order: string[]): string {
  const index = order.indexOf(label);
  const safe = index === -1 ? order.length : index;
  return SLICE_COLORS[safe % SLICE_COLORS.length] as string;
}

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
                backgroundColor: SLICE_COLORS[index % SLICE_COLORS.length],
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
              { backgroundColor: SLICE_COLORS[active % SLICE_COLORS.length] },
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
