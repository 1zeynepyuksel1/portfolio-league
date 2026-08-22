/**
 * AuthControls — kimlik ekranlarının ortak parçaları.
 *
 * Kaynak: design_handoff_portfolioyun_auth/README.md
 *
 * NEDEN AYRI DOSYA: Welcome, Login ve Kayıt ekranlarının üçü de aynı
 * alanı ve aynı düğmeyi kullanıyor. Her ekrana kopyalasaydık "yükseklik
 * 58 olacaktı" düzeltmesi üç yerde yapılmak zorunda kalırdı — ve biri
 * atlanırdı. Tasarım dilinin tek kaynağı burası.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, radius, sizes } from '../theme';

// ---------------------------------------------------------------------------
// İKONLAR
// ---------------------------------------------------------------------------

/**
 * Lucide `arrow-right`.
 *
 * İkon kütüphanesi eklemek yerine tek yol (path) elle yazıldı: üç ikon için
 * bir paket bağımlılığı ve onun ağırlığı gereksiz. Onlarca ikona çıkarsak
 * `lucide-react-native` eklenir.
 */
export function ArrowRight({
  // ⚠️ Tip AÇIKÇA `string`. Yazmasaydık TypeScript varsayılan değerden
  // `'#111112'` literal tipini çıkarır ve başka hiçbir renk kabul etmezdi —
  // basılı hâlde beyaz ok geçirmek derleme hatası verirdi.
  color = colors.surface as string,
  size = 19,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M5 12h14M12 5l7 7-7 7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** Lucide `eye` / `eye-off` — şifre görünürlüğü. */
function EyeIcon({ open, color }: { open: boolean; color: string }) {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24">
      <Path
        d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke={color}
        strokeWidth={1.8}
        fill="none"
      />
      {/* Kapalıyken üzerine çapraz çizgi — açık/kapalı farkı renkten değil
          biçimden anlaşılmalı; renk körü kullanıcı için tek ayırt edici. */}
      {!open && (
        <Path
          d="M3 3l18 18"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      )}
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// GİRİŞ ALANI
// ---------------------------------------------------------------------------

type FieldProps = TextInputProps & {
  /** Şifre alanı: sonunda göz düğmesi çıkar, metin gizlenir. */
  isPassword?: boolean;
};

/**
 * Tasarımdaki alan kabuğu: h58, radius 16, yarı saydam dolgu.
 *
 * ⚠️ ODAK KENARI STATE İLE YÖNETİLİYOR, CSS İLE DEĞİL.
 * Web'de `:focus` sözde sınıfı var; React Native'de yok. `onFocus`/`onBlur`
 * ile kendimiz izliyoruz. Odak göstergesi olmadan klavyeyle gezen kullanıcı
 * nerede olduğunu göremez — erişilebilirlik gereği, süs değil.
 */
export function Field({ isPassword = false, ...props }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  return (
    <View
      style={[
        styles.field,
        focused && { borderColor: colors.hairlineFocus },
      ]}
    >
      <TextInput
        {...props}
        style={styles.fieldInput}
        placeholderTextColor={colors.inkPlaceholder}
        secureTextEntry={isPassword && !revealed}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
      />

      {isPassword && (
        <Pressable
          onPress={() => setRevealed((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={revealed ? 'Şifreyi gizle' : 'Şifreyi göster'}
          // İkon 19px ama dokunma alanı 44px — parmak ucu 19 pikseli
          // ıskalar. hitSlop görünümü değiştirmeden alanı büyütüyor.
          hitSlop={{ top: 13, bottom: 13, left: 13, right: 13 }}
        >
          {({ pressed }) => (
            <EyeIcon
              open={revealed}
              color={pressed ? colors.accent : colors.inkFaint}
            />
          )}
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// DÜĞMELER
// ---------------------------------------------------------------------------

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Sağdaki ok. Welcome'daki "Hesap aç" ve Login'deki CTA'da var. */
  withArrow?: boolean;
};

/**
 * Birincil düğme: açık dolgu, koyu metin. Basılınca marka kırmızısına döner.
 *
 * ⚠️ `loading` sırasında `disabled` da veriliyor. Sadece etiketi
 * değiştirseydik kullanıcı ikinci kez basabilirdi — ve emir/kayıt iki kez
 * gönderilirdi. Görsel geri bildirim yetmez, girdiyi de kapatmak gerekir.
 */
export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  withArrow = true,
}: PrimaryButtonProps) {
  const blocked = loading || disabled;

  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      style={({ pressed }) => [
        styles.primary,
        pressed && !blocked && { backgroundColor: colors.accent },
        blocked && styles.blocked,
      ]}
    >
      {({ pressed }) => {
        const fg = pressed && !blocked ? '#ffffff' : colors.surface;

        return loading ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <>
            <Text style={[styles.primaryLabel, { color: fg }]}>{label}</Text>
            {withArrow && <ArrowRight color={fg} />}
          </>
        );
      }}
    </Pressable>
  );
}

type SecondaryButtonProps = {
  label: string;
  onPress: () => void;
  /** Soldaki marka/ikon parçası — Apple ve Google düğmeleri için. */
  glyph?: React.ReactNode;
  /** OAuth düğmeleri 56px, normal ikincil düğme 58px. */
  compact?: boolean;
};

/** İkincil düğme: saydam, ince kenarlı. */
export function SecondaryButton({
  label,
  onPress,
  glyph,
  compact = false,
}: SecondaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.secondary,
        compact && { height: sizes.oauth, borderRadius: radius.pillSmall },
        pressed && {
          borderColor: colors.hairlineFocus,
          backgroundColor: colors.fieldFill,
        },
      ]}
    >
      {glyph}
      <Text style={[styles.secondaryLabel, compact && { fontSize: 15 }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// HATA SATIRI
// ---------------------------------------------------------------------------

/** Tasarımdaki hata satırı: 5px kırmızı nokta + metin. */
export function ErrorRow({ message }: { message: string }) {
  return (
    <View style={styles.errorRow} accessibilityLiveRegion="polite">
      <View style={styles.errorDot} />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

/** "VEYA" ayracı — iki kıl çizgi arasında ortalanmış etiket. */
export function Divider({ label = 'VEYA' }: { label?: string }) {
  return (
    <View style={styles.divider}>
      <View style={styles.dividerRule} />
      <Text style={styles.dividerLabel}>{label}</Text>
      <View style={styles.dividerRule} />
    </View>
  );
}

/**
 * Ana ekran göstergesi (home indicator) — sahte cihaz süsü.
 *
 * Tasarımda var çünkü prototip telefon çerçevesi çiziyordu. Gerçek
 * uygulamada iOS bunu kendisi çiziyor; burada yalnızca alt boşluğun
 * tasarımdaki gibi görünmesi için duruyor.
 */
export function HomeIndicator() {
  return <View style={styles.homeIndicator} />;
}

const styles = StyleSheet.create({
  field: {
    height: sizes.control,
    paddingHorizontal: 20,
    borderRadius: radius.field,
    backgroundColor: colors.fieldFill,
    borderWidth: 1,
    borderColor: colors.hairlineSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.ink,
    // Android TextInput'un varsayılan iç boşluğu alanı 58px'in dışına
    // taşırıyor; sıfırlanmazsa metin dikeyde ortalanmış görünmüyor.
    paddingVertical: 0,
  },

  primary: {
    height: sizes.control,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryLabel: {
    fontSize: 16,
    fontFamily: fonts.semibold,
  },
  blocked: {
    opacity: 0.6,
  },

  secondary: {
    height: sizes.control,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  secondaryLabel: {
    fontSize: 16,
    fontFamily: fonts.semibold,
    color: colors.ink,
  },

  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  errorDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accent,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.error,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  dividerRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.hairline,
  },
  dividerLabel: {
    fontSize: 11,
    fontFamily: fonts.regular,
    letterSpacing: 0.18 * 11,
    color: colors.inkFaint,
  },

  homeIndicator: {
    width: 134,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(245, 244, 243, 0.28)',
    alignSelf: 'center',
  },
});
