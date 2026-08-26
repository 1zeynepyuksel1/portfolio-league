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
 * Dilim renkleri — TEMEL RENKLER, kırmızı ve yeşil dahil.
 *
 * ⚠️ ÜÇÜNCÜ PALET. Yol şöyle oldu:
 *
 *   1. Gri tonlar -> beş dilimin dördü birbirine benziyordu, hangi çubuğun
 *      hangi varlık olduğu görünmüyordu.
 *   2. Renkli ama kırmızı/yeşil YOK -> ayırt edilebilirlik arttı ama
 *      kalan tonlar (mor/çivit/eflatun, sarı/turuncu) hâlâ birbirine
 *      yakındı; küçük dilimlerde fark seçilmiyordu.
 *   3. Bu palet: temel renk çemberinden altı ayrı ton.
 *
 * ⚠️ KIRMIZI VE YEŞİLİN BİLİNEN RİSKİ VAR — kayıt için burada duruyor.
 *
 * Bu uygulamada yeşil KAZANÇ, kırmızı KAYIP demek. Dağılım çubuğunda
 * kırmızı bir dilim "bu varlık zararda" gibi okunabilir. Palet bunu
 * KABUL EDİYOR, çünkü:
 *
 *   - Çubuk bir BÜYÜKLÜK gösteriyor, yön değil. Yanındaki her sayı
 *     ayrıca kendi yön rengiyle yazılıyor.
 *   - Tonlar yön renklerinden BİLEREK farklı seçildi: gain #34C28A
 *     (nane), buradaki yeşil #37C978 (çimen); loss #E5484D (mercan),
 *     buradaki kırmızı #F0483E (turuncuya çalan). Yan yana konduğunda
 *     aynı renk olmadıkları görülüyor.
 *   - Ayırt edilememek daha büyük bir zarar: kullanıcı hangi dilimin
 *     hangi varlık olduğunu göremiyorsa çubuk hiçbir işe yaramıyor.
 */
export const SLICE_COLORS = [
  '#F0483E', // kırmızı
  '#3E9BF0', // mavi
  '#F5A524', // turuncu
  '#37C978', // yeşil
  '#A855F7', // mor
  '#22D3EE', // camgöbeği
  '#EAB308', // sarı
  '#EC4899', // pembe
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
