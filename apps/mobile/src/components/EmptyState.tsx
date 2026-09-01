import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, fonts, radius, spacing, type } from '../theme';

/**
 * EmptyState — "burada henüz bir şey yok" ekranı.
 *
 * ⚠️ ÖNCEDEN HER YERDE ORTALANMIŞ TEK BİR `<Text>` VARDI:
 *
 *     <Text style={{ color: inkMuted, textAlign: 'center', marginTop: 40 }}>
 *       Henüz hiç paylaşım yok. İlk sen paylaş!
 *     </Text>
 *
 * Çalışıyordu ama "yarım kalmış uygulama" hissinin en büyük kaynağıydı.
 * Boş durum, kullanıcının bir özelliği İLK gördüğü andır; orada bıraktığı
 * izlenim, özellik dolduğunda gördüğünden daha kalıcı olur.
 *
 * ⚠️ BOŞ DURUM BİR HATA DEĞİL. Kırmızı yok, uyarı yok, üzgün yüz yok.
 * "Henüz" kelimesi bilinçli: kapalı bir kapı değil, açılmamış bir kapı.
 *
 * ⚠️ ÜÇ PARÇA VE ÜÇÜ DE AYRI İŞ YAPIYOR:
 *
 *     simge    -> neyin boş olduğunu bir bakışta söylüyor
 *     başlık   -> durumu adlandırıyor ("Henüz paylaşım yok")
 *     açıklama -> NE YAPILACAĞINI söylüyor
 *
 * Açıklama olmadan kullanıcı "peki şimdi ne olacak" diye kalıyor.
 * Eylem düğmesi isteğe bağlı: yalnızca yapılacak şey TEK ve NET ise
 * konuyor. İki farklı yol varsa düğme birini öne çıkarıp diğerini
 * gizlemiş olurdu.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Liste içinde kullanılırken daha az dikey boşluk. */
  compact?: boolean;
}) {
  return (
    <View style={[styles.root, compact && styles.rootCompact]}>
      {/*
        ⚠️ SİMGE YUVASI YÜZEY RENGİNDE, VURGU RENGİNDE DEĞİL.
        Vurgu rengi "buraya bas" demek; burada basılacak bir şey yok.
        Sessiz bir yuva, simgeyi zeminden ayırıyor ama dikkat çekmiyor.
      */}
      <View style={styles.iconWrap}>
        <Icon size={26} color={colors.inkFaint} strokeWidth={1.6} />
      </View>

      <Text style={styles.title}>{title}</Text>

      {description !== undefined && (
        <Text style={styles.description}>{description}</Text>
      )}

      {actionLabel !== undefined && onAction !== undefined && (
        <TouchableOpacity style={styles.action} onPress={onAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: 40,
  },
  rootCompact: { paddingVertical: 24 },

  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  title: {
    fontFamily: fonts.semibold,
    fontSize: type.emphasis,
    color: colors.ink,
    textAlign: 'center',
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: type.body,
    color: colors.inkMuted,
    textAlign: 'center',
    /*
      ⚠️ `lineHeight` AÇIKÇA VERİLİYOR. Varsayılan satır aralığı yazı
      boyutuna çok yakın; iki satırlık bir açıklama sıkışık görünüyor.
      1.5 katı, okunabilirlik kılavuzlarının önerdiği taban.
    */
    lineHeight: Math.round(type.body * 1.5),
    marginTop: 8,
    maxWidth: 280,
  },

  action: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionText: {
    fontFamily: fonts.semibold,
    fontSize: type.body,
    color: colors.ink,
  },
});
