import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ComponentType, ReactNode } from 'react';
import { colors, fonts, radius, sectionLabel, spacing, type } from '../theme';
import { AssetLogo } from './AssetLogo';

/**
 * Segment simgesi.
 *
 * ⚠️ `lucide-react-native`'in kendi tipini İTHAL ETMİYORUZ. Bileşen
 * kütüphaneye bağlanırsa simge kaynağı değiştiğinde burası da
 * değişmek zorunda kalır. İhtiyacımız olan sözleşme üç prop.
 */
type SegmentIcon = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

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
 * Segmentli denetim: `Piyasa | Ya Alsaydın` · `Portföy | Paylaşımlar`
 *
 * Çiplerden farkı tek bir kabın içinde olması — bunlar birbirini
 * DIŞLAYAN seçenekler, çipler ise bağımsız filtreler.
 *
 * ⚠️ BU BİLEŞEN VARDI VE HİÇBİR YERDEN ÇAĞRILMIYORDU. Aynı denetim
 * üç ekranda ayrı ayrı yazılmıştı (Piyasa, Profil, Arkadaşlar) ve
 * üçünün de ölçüsü farklıydı: yarıçap 999/999/10, yazı 15/14/14,
 * dikey dolgu 8/9/8. Kimse fark etmez ama göz "özensiz" der.
 *
 * ⚠️ SEÇİLİ DURUM VURGU RENGİYLE DEĞİL **TERS ZEMİNLE** ANLATILIYOR.
 * Sebebi zevk değil, ölçüm: beyaz yazı `colors.accent` (#3b82f6)
 * üstünde 3,68:1 kontrast veriyor, WCAG 4,5:1 istiyor. Ters zemin
 * (`inverse`/`onInverse`) 15,79:1. Ayrıca vurgu renkleri bu tasarımda
 * YÖN için ayrılmış — seçili sekmeyi maviye boyamak "bu bir yön
 * bilgisi" gibi okunurdu.
 *
 * ⚠️ JENERİK (`<K extends string>`) — ÇÜNKÜ `onChange` GERİ DÖNEN
 * ANAHTARI TİPLİ VERMELİ. `string` deseydik çağıran taraf
 * `setView(key as 'market' | 'whatif')` diye elle daraltmak zorunda
 * kalırdı; `as` her seferinde derleyiciyi susturmak demek.
 */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
  fill = true,
}: {
  options: readonly {
    key: K;
    label: string;
    /** Etiketin soluna gelen simge. Metin zaten görünür olduğu için dekoratif. */
    icon?: SegmentIcon;
    /** Sağdaki sayaç rozeti — 0 ise hiç çizilmiyor. */
    badge?: number;
  }[];
  value: K;
  onChange: (key: K) => void;
  /**
   * `true`  — bölmeler eşit genişlikte, kap satırı doldurur.
   * `false` — bölmeler içeriğe göre, kap ortalanabilir (Piyasa başlığı).
   */
  fill?: boolean;
}) {
  return (
    /*
      ⚠️ `tablist` / `tab` ROLLERİ — `button` DEĞİL.

      Ekran okuyucu `button` duyduğunda "bir şey olacak" der; `tab`
      duyduğunda "3 sekmeden 2.si, seçili" der. Aynı görsel, tamamen
      farklı bir deneyim.
    */
    <View style={[styles.segmented, !fill && styles.segmentedHug]} accessibilityRole="tablist">
      {options.map((option) => {
        const on = option.key === value;
        const Icon = option.icon;

        return (
          <TouchableOpacity
            key={option.key}
            style={[styles.segment, fill && styles.segmentFill, on && styles.segmentOn]}
            onPress={() => onChange(option.key)}
            activeOpacity={0.75}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={option.label}
          >
            {Icon !== undefined && (
              <Icon
                size={15}
                color={on ? colors.onInverse : colors.inkMuted}
                strokeWidth={2.5}
              />
            )}

            <Text style={[styles.segmentText, on && styles.segmentTextOn]} numberOfLines={1}>
              {option.label}
            </Text>

            {/*
              ⚠️ `> 0` KONTROLÜ ŞART. `{option.badge && ...}` yazsaydık
              badge 0 iken JSX ekrana "0" basardı — React sayıyı
              atlamaz, yalnızca false/null/undefined'ı atlar.
            */}
            {option.badge !== undefined && option.badge > 0 && (
              <View style={styles.segmentBadge}>
                <Text style={styles.segmentBadgeText}>{option.badge}</Text>
              </View>
            )}
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

  /*
    ⚠️ DÜZ METİNDEN DOLGULU ROZETE.

    Önce yalnızca renkli bir yazıydı: yeşil "+1,86%". Doğru ama zayıf —
    yüzde, listedeki en çok bakılan bilgi ve etrafındaki metinlerle aynı
    ağırlıkta duruyordu. Dolgulu bir zemin onu satırdan AYIRIYOR; göz
    listeyi tararken önce rozetlere takılıyor.

    ⚠️ ZEMİN SOLUK, YAZI PARLAK. Tersi olsaydı (dolu yeşil zemin, beyaz
    yazı) her satır bir düğme gibi görünür ve dokunulabilir sanılırdı.
    %15 opaklıkta zemin "vurgu" diyor, "buraya bas" demiyor.

    ⚠️ RENK TEK BAŞINA GÖSTERGE DEĞİL — işaret de var (+ / −). Renk
    körlüğü olan kullanıcı için kâr ile zararı ayıran şey işaret.
  */
  return (
    <View
      style={[
        styles.changePill,
        { backgroundColor: negative ? colors.lossSoft : colors.gainSoft },
      ]}
    >
      <Text
        style={[
          styles.change,
          { fontSize: size, color: negative ? colors.loss : colors.gain },
        ]}
      >
        {negative ? '−' : '+'}%{digits}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ONAY KUTUSU
// ---------------------------------------------------------------------------

/**
 * "Emin misin?" kutusu — geri alınamaz bir işlemden önce duraklatır.
 *
 * ⚠️ AYNI İŞ İÇİN UYGULAMADA İKİ FARKLI TASARIM VARDI (PostCard içinde):
 *
 *   A) 64px simge yuvası, alt alta tam genişlik düğmeler
 *      → "Başa Sabitlendi", "Gönderiyi Sil" (kendi sil)
 *   B) 28px simge, yan yana yarım genişlik düğmeler
 *      → yönetici silme, ban
 *
 * Dördü de aynı soruyu soruyor. Kullanıcı iki farklı kutu görünce her
 * seferinde yeniden okumak zorunda kalıyor — tanıdıklık, hız demektir.
 *
 * ⚠️ (A) SEÇİLDİ, ÇOĞUNLUK OLDUĞU İÇİN DEĞİL. İki gerekçe:
 *
 *   1. Alt alta düğme daha büyük dokunma hedefi verir (tam genişlik).
 *   2. Yıkıcı düğme "Vazgeç"in HEMEN YANINDA durmuyor. Yan yana
 *      dizilimde parmak 4mm kayınca silme oluyor; bu kutunun varlık
 *      sebebi tam olarak o kazayı önlemek.
 *
 * ⚠️ YIKICI DÜĞME ALTTA, ÜSTTE DEĞİL. Baş parmak en kolay alta uzanır;
 * ama okuma sırası yukarıdan aşağıdır. "Vazgeç"i önce okutup yıkıcı
 * olanı sona koymak, kararı bir saniye geciktiriyor — istenen de bu.
 */
export function ConfirmModal({
  visible,
  icon: Icon,
  tone = 'accent',
  title,
  description,
  children,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  busy = false,
}: {
  visible: boolean;
  icon: SegmentIcon;
  /** `accent` bilgi verir, `danger` geri alınamaz bir şey yapar. */
  tone?: 'accent' | 'danger';
  title: string;
  description?: string;
  /** Ek alan — ban sebebi gibi. Açıklamanın altına giriyor. */
  children?: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  const danger = tone === 'danger';

  return (
    /*
      ⚠️ `onRequestClose` ANDROID'İN GERİ TUŞU İÇİN ZORUNLU. Verilmezse
      geri tuşu kutuyu kapatmaz; kullanıcı kilitlenmiş hisseder.
    */
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.confirmBackdrop}>
        <View style={styles.confirmCard}>
          <View style={[styles.confirmIconWell, danger && styles.confirmIconWellDanger]}>
            <Icon size={32} color={danger ? colors.loss : colors.accent} />
          </View>

          <Text style={styles.confirmTitle}>{title}</Text>

          {description !== undefined && (
            <Text style={styles.confirmBody}>{description}</Text>
          )}

          {children}

          <TouchableOpacity
            onPress={onCancel}
            activeOpacity={0.7}
            style={styles.confirmCancel}
            accessibilityRole="button"
          >
            <Text style={styles.confirmCancelText}>{cancelLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onConfirm}
            disabled={busy}
            activeOpacity={0.7}
            style={[styles.confirmAction, danger && styles.confirmActionDanger]}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
          >
            <Text style={styles.confirmActionText}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// VARLIK SİMGESİ
// ---------------------------------------------------------------------------

/**
 * Varlık simgesi.
 *
 * ⚠️ İÇİ BOŞALDI, ADI KALDI. Gerçek çizim artık `AssetLogo`'da; bu
 * fonksiyon yalnızca ona yönlendiriyor.
 *
 * Neden silinmedi: altı ekran `AssetBadge` çağırıyor. Hepsini tek
 * commit'te değiştirmek gereksiz bir yayılma olurdu ve tek bir yerde
 * yapılan hata altı ekranı birden bozardı. Yönlendirme, çağıranlar
 * kendi zamanında geçene kadar duruyor.
 */
export function AssetBadge({
  symbol,
  tint,
}: {
  symbol: string;
  tint?: string | undefined;
}) {
  return <AssetLogo symbol={symbol} tint={tint} />;
}

const styles = StyleSheet.create({
  sectionLabel: { ...sectionLabel },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 6,
    /* ⚠️ 6pt dolgu ~28pt veriyordu, taban 44pt. */
    minHeight: 44,
  },
  chipOn: { backgroundColor: colors.inverse },
  chipOff: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { fontFamily: fonts.semibold, fontSize: type.caption, color: colors.inkMuted },
  chipTextOn: { fontFamily: fonts.bold, color: colors.onInverse },
  chipCount: {
    fontFamily: fonts.monoSemibold,
    fontSize: 10,
    color: colors.inkFaint,
  },
  chipCountOn: { color: colors.onInverseMuted },

  segmented: {
    flexDirection: 'row',
    gap: 4,
    /*
      Ortak kap: seçeneklerin AYNI GRUBA ait olduğunu söylüyor.
      Ayrı duran iki düğme, seçili olmayanı "yok" gibi gösteriyordu.
    */
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    padding: 4,
  },
  /** İçeriğe göre daralan kap — satırın tamamını kaplamıyor. */
  segmentedHug: { alignSelf: 'center' },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    /*
      ⚠️ 44 BİR TERCİH DEĞİL, PLATFORM TABANI. iOS 44pt / Android 48dp
      en küçük dokunma hedefi. Önceki üç kopya 34-36pt idi; parmak
      ucu 8-10mm, o boyutta ıskalama sıradanlaşıyor.

      ⚠️ `minHeight`, `height` DEĞİL — sistem yazı boyutu büyütülünce
      (Dynamic Type) kutu büyüyebilmeli, yazı kırpılmamalı.
    */
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    /*
      ⚠️ SEÇİLİ OLMAYAN DA AYNI DOLGUYU TAŞIYOR (zemini saydam).
      Dolguyu yalnızca seçiliye verseydik seçim değiştiğinde bölmenin
      genişliği değişir ve satır her dokunuşta oynardı.
    */
    backgroundColor: 'transparent',
  },
  /** Eşit genişlik. `minWidth: 0` olmadan uzun etiket kutuyu şişirir. */
  segmentFill: { flex: 1, minWidth: 0 },
  segmentOn: { backgroundColor: colors.inverse },
  segmentText: {
    fontFamily: fonts.medium,
    fontSize: type.body,
    color: colors.inkMuted,
  },
  segmentTextOn: { fontFamily: fonts.bold, color: colors.onInverse },
  segmentBadge: {
    backgroundColor: colors.accentDeep,
    borderRadius: radius.full,
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignItems: 'center',
  },
  /* Beyaz yazı `accentDeep` üstünde 6,70:1 — `accent` olsaydı 3,68. */
  segmentBadgeText: {
    fontFamily: fonts.monoSemibold,
    fontSize: type.micro,
    color: colors.onAccent,
  },

  confirmBackdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  confirmCard: {
    backgroundColor: colors.surface,
    width: '100%',
    /* Tablette kutu ekranı boydan boya kaplamasın — okunur genişlik. */
    maxWidth: 360,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmIconWell: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  confirmIconWellDanger: { backgroundColor: colors.lossSoft },
  confirmTitle: {
    fontFamily: fonts.bold,
    fontSize: type.title,
    color: colors.ink,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  confirmBody: {
    fontFamily: fonts.medium,
    fontSize: type.body,
    color: colors.inkMuted,
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: spacing.sm,
  },
  confirmCancel: {
    width: '100%',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfacePressed,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginBottom: spacing.group,
  },
  confirmCancelText: {
    fontFamily: fonts.bold,
    fontSize: type.body,
    color: colors.inkMuted,
    letterSpacing: 1,
  },
  confirmAction: {
    width: '100%',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentDeep,
    alignItems: 'center',
  },
  /*
    ⚠️ `loss` DEĞİL `lossDeep`. Beyaz yazı `loss` (#ef4444) üstünde
    3,76:1 veriyordu — ve bu, uygulamadaki en tehlikeli düğmeydi.
    En yıkıcı eylemin en kötü okunan düğme olması kabul edilemez.
  */
  confirmActionDanger: { backgroundColor: colors.lossDeep },
  confirmActionText: {
    fontFamily: fonts.bold,
    fontSize: type.body,
    color: colors.onAccent,
    letterSpacing: 1,
  },

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
    /* 21'di. Ölçekteki `title` 20 — fark gözle seçilmiyor, ölçek kazanıyor. */
    fontSize: type.title,
    color: colors.inkFaint,
    letterSpacing: -0.4,
  },

  change: { fontFamily: fonts.monoSemibold },
  /*
    ⚠️ `alignSelf: 'flex-start'` KALDIRILDI — SİMETRİYİ O BOZUYORDU.

    Rozeti kaba sığdırmak için koymuştum. Ama `alignSelf` EBEVEYNİN
    hizalamasını EZİYOR: Piyasa listesinde sütun `alignItems: 'flex-end'`
    ile sağa hizalıyken rozet sola kaçıyordu. Fiyat sağda, rozet solda —
    her satırda farklı genişlikte olduğu için sol kenarları tırtıklı
    görünüyordu.

    Doğrusu: hizalamaya ebeveyn karar verir. `flexDirection: 'row'` ya da
    `alignItems` veren bir kapta bu `View` zaten içeriği kadar yer
    kaplıyor; `alignSelf` gereksizdi ve zararlıydı.
  */
  changePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.xs,
  },

});
