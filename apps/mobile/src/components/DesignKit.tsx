import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ReactNode } from 'react';
import { colors, fonts, rowMetrics, sectionLabel } from '../theme';

/**
 * DesignKit — `docs/export/*.html` tasarımında tekrar eden parçalar.
 *
 * NEDEN AYRI DOSYA: aynı çip, aynı bölüm başlığı, aynı büyük sayı beş
 * ekranda geçiyor. Her ekrana kopyalasaydık tasarımda tek bir ölçü
 * değiştiğinde beş dosyada aramak gerekirdi — ve biri mutlaka atlanırdı.
 */

// ---------------------------------------------------------------------------
// BÖLÜM BAŞLIĞI
// ---------------------------------------------------------------------------

/** `CÜZDAN · TRY` · `ÖZEL GÜNLER` · `NAKİT` — çok küçük, geniş harf aralı. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

// ---------------------------------------------------------------------------
// ÇİP
// ---------------------------------------------------------------------------

/**
 * Filtre çipi: `Tümü 4` · `Kripto 2`
 *
 * ⚠️ SEÇİLİ DURUM RENKLE DEĞİL **TERS ZEMİNLE** ANLATILIYOR.
 *
 * Yaygın çözüm seçiliyi vurgu rengiyle boyamaktır. Bu tasarımda olmaz:
 * vurgu renkleri (yeşil/kırmızı) YÖN için ayrılmış. Seçili çipi kırmızı
 * yapsaydık kullanıcı "düşüş" diye okurdu.
 */
export function Chip({
  label,
  count,
  selected = false,
  onPress,
}: {
  label: string;
  count?: string | number;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}
      onPress={onPress}
      disabled={onPress === undefined}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>
        {label}
      </Text>

      {count !== undefined && (
        <Text style={[styles.chipCount, selected && styles.chipCountOn]}>
          {count}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// SEGMENT ÇUBUĞU
// ---------------------------------------------------------------------------

/**
 * Aralık seçici: `1H | 1A | 3A | 1Y | TÜM`
 *
 * Çiplerden farkı tek bir çerçevenin içinde bölünmüş olması — bunlar
 * birbirini dışlayan seçenekler, çipler ise bağımsız filtreler.
 */
export function Segmented({
  options,
  value,
  onChange,
}: {
  options: readonly { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option, index) => {
        const on = option.key === value;

        return (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.segment,
              // İlk bölmenin sol kenarı çerçevenin kendisi — çizgi
              // eklenirse çift kalın görünür.
              index > 0 && styles.segmentDivider,
              on && styles.segmentOn,
            ]}
            onPress={() => onChange(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.segmentText, on && styles.segmentTextOn]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// BÜYÜK TUTAR
// ---------------------------------------------------------------------------

/**
 * Portföy toplamı: **110.953**,35 ₺
 *
 * ⚠️ TAM KISIM VE KURUŞ FARKLI BOYUTTA — VE BU BİLİNÇLİ.
 *
 * 44px tam kısım + 21px soluk kuruş. Hepsi aynı boyutta olsaydı göz
 * kuruşu da okumaya çalışırdı; oysa "110 bin lira" bilgisi kuruşta
 * değil. Küçültmek gözü doğru yere çekiyor.
 */
export function BigAmount({ value }: { value: string }) {
  // "110.953,35 ₺" -> ["110.953", "35 ₺"]
  const [whole = value, rest] = value.split(',');

  return (
    <View style={styles.bigRow}>
      <Text style={styles.bigWhole}>{whole}</Text>
      {rest !== undefined && <Text style={styles.bigRest}>,{rest}</Text>}
    </View>
  );
}

// ---------------------------------------------------------------------------
// YÖN
// ---------------------------------------------------------------------------

/**
 * Yüzde değişim metni — yeşil/kırmızı ve doğru işaretle.
 *
 * ⚠️ EKSİ İŞARETİ U+2212, KISA ÇİZGİ DEĞİL.
 * Tasarım bunu açıkça belirtiyor. Kısa çizgi rakamlardan dar ve alçak
 * durur; matematik eksisi rakam yüksekliğinde ve aynı genişlikte, yani
 * monospace sütunda hizayı bozmuyor.
 */
export function ChangeText({
  percent,
  size = 13,
}: {
  /** "1.86" / "-0.42" biçiminde metin. `null` ise tire yazar. */
  percent: string | null;
  size?: number;
}) {
  if (percent === null) {
    return (
      <Text style={[styles.change, { fontSize: size, color: colors.inkFaint }]}>
        —
      </Text>
    );
  }

  const negative = percent.trim().startsWith('-');
  const digits = percent.replace('-', '').replace('.', ',');

  return (
    <Text
      style={[
        styles.change,
        { fontSize: size, color: negative ? colors.loss : colors.gain },
      ]}
    >
      {negative ? '−' : '+'}%{digits}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// VARLIK SİMGESİ
// ---------------------------------------------------------------------------

/**
 * Logo yuvası. Tasarımda gerçek logolar var (`<image-slot>`), bizde henüz
 * yok — sembolün ilk üç harfi yuvarlak bir zeminde duruyor.
 *
 * Aynı ölçü ve biçimde olduğu için logolar geldiğinde yalnızca bu
 * bileşenin içi değişecek, çağıran hiçbir ekran değişmeyecek.
 */
export function AssetBadge({ symbol }: { symbol: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{symbol.slice(0, 3)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { ...sectionLabel },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: colors.inverse },
  chipOff: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.inkMuted },
  chipTextOn: { fontFamily: fonts.bold, color: colors.onInverse },
  chipCount: {
    fontFamily: fonts.monoSemibold,
    fontSize: 10,
    color: colors.inkFaint,
  },
  chipCountOn: { color: colors.onInverseMuted },

  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 7 },
  segmentDivider: { borderLeftWidth: 1, borderLeftColor: colors.border },
  segmentOn: { backgroundColor: colors.inverse },
  segmentText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.inkMuted,
  },
  segmentTextOn: { fontFamily: fonts.bold, color: colors.onInverse },

  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  bigWhole: {
    fontFamily: fonts.bold,
    fontSize: 44,
    color: colors.ink,
    letterSpacing: -1.5,
    lineHeight: 48,
  },
  bigRest: {
    fontFamily: fonts.semibold,
    fontSize: 21,
    color: colors.inkFaint,
    letterSpacing: -0.4,
  },

  change: { fontFamily: fonts.monoSemibold },

  badge: {
    width: rowMetrics.logoSize,
    height: rowMetrics.logoSize,
    borderRadius: rowMetrics.logoSize / 2,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, color: colors.inkMuted },
});
