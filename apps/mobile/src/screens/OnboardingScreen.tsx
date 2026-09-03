import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles, Gift, EyeOff } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, fonts, radius, spacing, type } from '../theme';

/**
 * OnboardingScreen — kayıt sonrası üç adım.
 *
 * ⚠️ DÖRT ANLATAN KARTTAN ÜÇ ADIMA — VE İKİSİ SORU SORUYOR.
 *
 * Eski hâli dört karttı ve dördü de ürünü ANLATIYORDU: başlangıç
 * bakiyesi, canlı veri, TWR ligi, gizlilik. Yalnızca sonuncusu bir
 * soru içeriyordu.
 *
 * İki kart silindi:
 *
 *   "Gerçek Zamanlı Borsa Verileri" -> Bir özellik duyurusu. İlk
 *      kullanımda zaten görülüyor; anlatmaya gerek yok.
 *
 *   "Haftalık Performans Ligi (TWR)" -> Metni şuydu: "Uluslararası
 *      Zaman Ağırlıklı Getiri (TWR) standartlarına göre hesaplanan..."
 *      Yatırımdan korkan bir kullanıcıya uygulamanın ilk 30 saniyesinde
 *      söylenecek cümle bu değil. TWR açıklaması Lig ekranına ait —
 *      oraya ULAŞAN kullanıcı için anlamlı.
 *
 * ⚠️ ADIM 1 PERSONA KARARININ TEK UYGULAMA YOLU.
 *
 * Ürün iki kullanıcıya birden hizmet edecek: yatırımdan korkan
 * (varsayılan) ve prova yapmak isteyen. İkisi giriş kapısında
 * BİRBİRİNİN ZITTINI ister — biri güvence, öteki hız. Tahmin etmek
 * yerine kullanıcıya SORUYORUZ.
 *
 * ⚠️ 100.000 ₺ ARTIK BURADA, KARŞILAMA EKRANINDA DEĞİL.
 * Karşılamada rakam çerçevesizdi ve "sorumluluk" diye okunabiliyordu.
 * Burada bir ÖDÜL ANI: "sıfır risk" cümlesiyle birlikte geliyor.
 */

type Level = 'new' | 'some' | 'experienced';
type AllocationVisibility = 'public' | 'friends' | 'private';
type PostVisibility = 'public' | 'friends_only';

export type OnboardingResult = {
  isPublic: boolean;
  allocationVisibility: AllocationVisibility;
  postVisibility: PostVisibility;
  level: Level;
};

type Props = {
  userName: string;
  onFinishOnboarding: (result: OnboardingResult) => void;
};

const LEVELS: { value: Level; title: string; hint: string }[] = [
  { value: 'new',         title: 'İlk kez deniyorum', hint: 'Hiç yatırım yapmadım' },
  { value: 'some',        title: 'Biraz biliyorum',   hint: 'Denedim ama uzman değilim' },
  { value: 'experienced', title: 'Deneyimliyim',      hint: 'Yarışmak için buradayım' },
];

const VISIBILITIES: { value: AllocationVisibility; label: string }[] = [
  { value: 'public',  label: 'Herkes' },
  { value: 'friends', label: 'Arkadaşlarım' },
  { value: 'private', label: 'Hiç kimse' },
];

/**
 * Paylaşımların varsayılan görünürlüğü.
 *
 * ⚠️ İKİ SEÇENEK, ÜÇ DEĞİL — VE FARK ÖNEMLİ.
 *
 * Portföy üç seçenekli çünkü "hiç kimse" anlamlı: portföyünü kimseye
 * göstermeyebilirsin. Paylaşım öyle değil — kimsenin görmeyeceği bir
 * paylaşım zaten paylaşım değildir. Sunucudaki alan da bu yüzden iki
 * değerli (`posts.visibility`: 'public' | 'friends_only').
 *
 * ⚠️ BU BİR VARSAYILAN, KİLİT DEĞİL. Paylaşım kutusunda her gönderi
 * için ayrı seçim zaten var; buradaki cevap yalnızca o kutunun
 * başlangıç değerini belirliyor.
 */
const POST_VISIBILITIES: { value: PostVisibility; label: string }[] = [
  { value: 'public',       label: 'Herkes' },
  { value: 'friends_only', label: 'Arkadaşlarım' },
];

const TOPLAM_ADIM = 3;

export function OnboardingScreen({ userName, onFinishOnboarding }: Props) {
  const [step, setStep] = useState(0);

  const [level, setLevel] = useState<Level | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [visibility, setVisibility] = useState<AllocationVisibility>('friends');
  const [postVisibility, setPostVisibility] = useState<PostVisibility>('public');

  /*
    ⚠️ 1. ADIMDA CEVAP ZORUNLU, 3. ADIMDA DEĞİL.

    Seviye sorusunun varsayılanı YOK — çünkü "hangisi olduğunu
    bilmiyoruz" ile "kullanıcı şunu seçti" farklı şeyler. Varsayılan
    verseydik seçmeyen herkes o kutuya düşer ve veri yalan söylerdi.

    Gizlilik ayarlarının varsayılanı VAR çünkü orada bir cevap
    ZORUNLU: hesap bir ayarla açılmak zorunda, boş kalamaz.
  */
  const ileriKapali = step === 0 && level === null;

  function ileri() {
    if (step < TOPLAM_ADIM - 1) {
      setStep((s) => s + 1);
      return;
    }

    onFinishOnboarding({
      isPublic,
      allocationVisibility: visibility,
      postVisibility,
      // `level` bu noktada asla null olamaz — 1. adım geçilmedi demektir.
      level: level ?? 'some',
    });
  }

  const ADIMLAR: { Icon: LucideIcon; baslik: string; altBaslik?: string }[] = [
    { Icon: Sparkles, baslik: `Hoş geldin, ${userName}`, altBaslik: 'Yatırımda kendini nerede görüyorsun?' },
    { Icon: Gift,     baslik: 'Hesabın hazır' },
    { Icon: EyeOff,   baslik: 'Gizlilik ayarların' },
  ];

  const adim = ADIMLAR[step]!;
  const AdimIcon = adim.Icon;
  const sonAdim = step === TOPLAM_ADIM - 1;

  return (
    <View style={styles.container}>
      {/* --- ilerleme --- */}
      <View style={styles.topHeader}>
        <Text style={styles.stepIndicator}>
          ADIM {step + 1} / {TOPLAM_ADIM}
        </Text>
        <View style={styles.progressBarBackground}>
          <View
            style={[styles.progressBarFill, { width: `${((step + 1) / TOPLAM_ADIM) * 100}%` }]}
          />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <AdimIcon size={30} color={colors.accent} strokeWidth={1.8} />
        </View>

        <Text style={styles.title}>{adim.baslik}</Text>
        {adim.altBaslik !== undefined && (
          <Text style={styles.subtitle}>{adim.altBaslik}</Text>
        )}

        {/* ---------------- ADIM 1 · SEVİYE ---------------- */}
        {step === 0 && (
          <View style={styles.optionList}>
            {LEVELS.map((s) => {
              const secili = level === s.value;
              return (
                <TouchableOpacity
                  key={s.value}
                  style={[styles.option, secili && styles.optionOn]}
                  onPress={() => setLevel(s.value)}
                  activeOpacity={0.85}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: secili }}
                >
                  <Text style={[styles.optionTitle, secili && styles.optionTitleOn]}>
                    {s.title}
                  </Text>
                  <Text style={styles.optionHint}>{s.hint}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ---------------- ADIM 2 · ÖDÜL ---------------- */}
        {step === 1 && (
          <View style={styles.rewardBlock}>
            {/*
              ⚠️ RAKAM BÜYÜK AMA YALNIZ DEĞİL. Altındaki "sıfır risk"
              satırı olmadan 100.000 ₺ yine çerçevesiz kalırdı —
              karşılama ekranından çıkarma sebebimiz tam olarak buydu.
            */}
            <LinearGradient
              colors={['rgba(18,209,142,0.18)', 'rgba(18,209,142,0.04)']}
              style={styles.rewardCard}
            >
              <Text style={styles.rewardAmount}>100.000 ₺</Text>
              <Text style={styles.rewardLabel}>sanal bakiye</Text>
            </LinearGradient>

            <Text style={styles.rewardNote}>
              Gerçek fiyatlarla işlem yap, sıfır risk al. Her gün
              1.000 ₺ ek bakiye kazanabilirsin.
            </Text>
          </View>
        )}

        {/* ---------------- ADIM 3 · GİZLİLİK ---------------- */}
        {step === 2 && (
          <View style={styles.privacyBlock}>
            {/*
              ⚠️ İKİ SORU AYNI ADIMDA — VE BU BİLİNÇLİ.

              Miller yasası "her adımda az öğe" der, ama parçalamanın
              ölçüsü öğe sayısı değil KONU sayısıdır. İkisi de
              gizlilik; ayrı adımlara bölmek kullanıcıya iki farklı
              konu olduğunu düşündürürdü.
            */}
            {/*
              ⚠️ BU SORUNUN ETİKETİ YANLIŞTI — VE HATA BENDEYDİ.

              "Adımla / Takma adla" yazmıştım, ama `isPublic` adın
              nasıl görüneceğini BELİRLEMİYOR. Sunucuda tek işi var
              (`profile/service.ts` → `canSee`): profilini
              arkadaşın olmayan biri görebilsin mi?

              Yanlış etiket, yanlış zihinsel model üretir: kullanıcı
              "takma adla" seçer, adının gizlendiğini sanır, oysa
              profilini kapatmış olur. İkisi tamamen farklı sonuçlar.

              ⚠️ AD ZATEN HİÇ GÖSTERİLMİYOR. Lig tablosu ve arkadaş
              listesi artık kullanıcı adını gösteriyor; gerçek ad
              yabancılara hiç gitmiyor. Yani o seçim ortadan kalktı,
              geriye gerçek soru kaldı.
            */}
            <Text style={styles.groupLabel}>Profilini kimler görebilsin?</Text>
            <View style={styles.segRow} accessibilityRole="radiogroup">
              {[
                { v: true,  l: 'Herkes' },
                { v: false, l: 'Arkadaşlarım' },
              ].map((o) => (
                <TouchableOpacity
                  key={o.l}
                  style={[styles.seg, isPublic === o.v && styles.segOn]}
                  onPress={() => setIsPublic(o.v)}
                  activeOpacity={0.85}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isPublic === o.v }}
                >
                  <Text style={[styles.segText, isPublic === o.v && styles.segTextOn]}>
                    {o.l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.groupLabel, styles.groupLabelSpaced]}>
              Portföyünü kimler görebilir?
            </Text>
            <View style={styles.segRow} accessibilityRole="radiogroup">
              {VISIBILITIES.map((o) => (
                <TouchableOpacity
                  key={o.value}
                  style={[styles.seg, visibility === o.value && styles.segOn]}
                  onPress={() => setVisibility(o.value)}
                  activeOpacity={0.85}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: visibility === o.value }}
                >
                  <Text
                    style={[styles.segText, visibility === o.value && styles.segTextOn]}
                    numberOfLines={1}
                  >
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.groupLabel, styles.groupLabelSpaced]}>
              Paylaşımlarını kimler görsün?
            </Text>
            <View style={styles.segRow} accessibilityRole="radiogroup">
              {POST_VISIBILITIES.map((o) => (
                <TouchableOpacity
                  key={o.value}
                  style={[styles.seg, postVisibility === o.value && styles.segOn]}
                  onPress={() => setPostVisibility(o.value)}
                  activeOpacity={0.85}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: postVisibility === o.value }}
                >
                  <Text
                    style={[styles.segText, postVisibility === o.value && styles.segTextOn]}
                    numberOfLines={1}
                  >
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/*
              ⚠️ "SONRA DEĞİŞTİREBİLİRSİN" CÜMLESİ SÜS DEĞİL.
              Gizlilik sorusu kullanıcıyı durdurur çünkü geri
              alınamaz sanılır. Değiştirilebilir olduğunu söylemek,
              kararı ucuzlatıp akışı sürdürüyor.
            */}
            <Text style={styles.privacyNote}>
              Üçünü de sonra değiştirebilirsin.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.cta, ileriKapali && styles.ctaOff]}
          onPress={ileri}
          disabled={ileriKapali}
          activeOpacity={0.85}
        >
          <Text style={[styles.ctaText, ileriKapali && styles.ctaTextOff]}>
            {sonAdim ? 'Başla' : 'Devam'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.screen,
    justifyContent: 'center',
  },

  topHeader: { marginBottom: 24 },
  stepIndicator: {
    fontFamily: fonts.semibold,
    fontSize: type.micro,
    letterSpacing: 1.2,
    color: colors.inkFaint,
    marginBottom: 8,
  },
  progressBarBackground: {
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.surfacePressed,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },

  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: type.title,
    color: colors.ink,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: type.body,
    color: colors.inkMuted,
    marginTop: 6,
  },

  /* --- adım 1 --- */
  optionList: { marginTop: 20, gap: 10 },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionOn: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(37,99,235,0.12)',
  },
  optionTitle: {
    fontFamily: fonts.semibold,
    fontSize: type.body,
    color: colors.ink,
  },
  optionTitleOn: { color: colors.accent },
  optionHint: {
    fontFamily: fonts.regular,
    fontSize: type.caption,
    color: colors.inkMuted,
    marginTop: 2,
  },

  /* --- adım 2 --- */
  rewardBlock: { marginTop: 20 },
  rewardCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(18,209,142,0.35)',
    paddingVertical: 22,
    alignItems: 'center',
  },
  rewardAmount: {
    fontFamily: fonts.bold,
    fontSize: 38,
    color: colors.gain,
    letterSpacing: -1,
  },
  rewardLabel: {
    fontFamily: fonts.medium,
    fontSize: type.caption,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.inkMuted,
    marginTop: 2,
  },
  rewardNote: {
    fontFamily: fonts.regular,
    fontSize: type.body,
    lineHeight: type.body * 1.45,
    color: colors.inkMuted,
    marginTop: 16,
  },

  /* --- adım 3 --- */
  privacyBlock: { marginTop: 20 },
  groupLabel: {
    fontFamily: fonts.semibold,
    fontSize: type.caption,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.inkFaint,
    marginBottom: 8,
  },
  groupLabelSpaced: { marginTop: 20 },
  segRow: { flexDirection: 'row', gap: 8 },
  seg: {
    /*
      ⚠️ `flex: 1` + `minWidth: 0`: üç seçenek eşit genişlikte.
      İçeriğe göre büyüselerdi "Arkadaşlarım" en geniş kutu olur ve
      görsel olarak "önerilen seçenek" gibi okunurdu.
    */
    flex: 1,
    minWidth: 0,
    /*
      ⚠️ 12pt DOLGU + 12px YAZI = ~40pt YÜKSEKLİK. Platform tabanı
      44pt. Dolguyu artırmak yerine `minHeight` verildi: sistem yazı
      boyutu büyüdüğünde kutu da büyüyebilsin, yazı kırpılmasın.
    */
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  /* ⚠️ Ham `rgba(37,99,235,0.12)` yazılıydı — `accent`'in yakın ama
     AYRI bir kopyası. `accentSoft` tema değişince otomatik takip eder. */
  segOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  segText: {
    fontFamily: fonts.medium,
    /*
      ⚠️ `caption` (12) İDİ. Bu bir yardımcı etiket değil, kullanıcının
      DOKUNACAĞI birincil denetimin yazısı. Erişilebilirlik kılavuzları
      gövde için 16px taban öneriyor, 12px altını anti-desen sayıyor;
      ölçekteki `body` bu rolün doğru kademesi.
    */
    fontSize: type.body,
    color: colors.inkMuted,
  },
  segTextOn: { fontFamily: fonts.bold, color: colors.accent },
  privacyNote: {
    fontFamily: fonts.regular,
    fontSize: type.caption,
    color: colors.inkFaint,
    marginTop: 14,
  },

  cta: {
    marginTop: 24,
    height: 52,
    borderRadius: radius.full,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /*
    ⚠️ KAPALI DÜĞME GİZLENMİYOR, SÖNÜKLEŞİYOR. Gizleseydik kullanıcı
    "devam edemiyorum" değil "devam yok" sanardı; sönük bir düğme
    "bir şey eksik" der ve gözü yukarı, seçeneklere geri gönderir.
  */
  ctaOff: { backgroundColor: colors.surfacePressed },
  ctaText: {
    fontFamily: fonts.bold,
    fontSize: type.body,
    color: colors.surface,
  },
  ctaTextOff: { color: colors.inkFaint },
});
