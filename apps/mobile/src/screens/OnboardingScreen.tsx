import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
/*
  ⚠️ BU EKRAN TEMAYI HİÇ KULLANMIYORDU — 22 RENK ELLE YAZILIYDI.

  Ve renkler uygulamanın palettiyle TUTMUYORDU: vurgu #38BDF8 (gök
  mavisi) iken uygulamanın vurgusu #3b82f6; yüzeyler beyazın yüzdesiydi
  (%8, %10, %12, %22) oysa temada dört kademeli yüzey merdiveni var.

  ⚠️ EN ÇOK BURADA ÖNEMLİ: kullanıcının GÖRDÜĞÜ İLK ekran burası. İlk
  izlenim başka bir uygulamadan alınmış gibi duruyordu.
*/
import { colors } from '../theme';
/*
  ⚠️ EMOJİLER SİMGE OLARAK KULLANILIYORDU — HEM ROZETTE HEM KARTTA.

  Kartlar `badge: '🏆 UYUMLU GETİRİ HESABI'` ve `icon: '⚖️'` taşıyordu.
  Emoji platformdan platforma farklı çiziliyor, temaya bağlanamıyor ve
  yazı satırında hizalanmıyor. Uygulamanın İLK gördüğü ekran burası;
  profesyonel görünmesi gereken ilk yer de burası.

  `lucide-react-native` zaten projede ve diğer ekranlar onu kullanıyor.
*/
import { Wallet, LineChart, Trophy, ShieldCheck } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

type Props = {
  userName: string;
  onFinishOnboarding: (isPublic: boolean) => void;
};

const CARDS = [
  {
    badge: 'SANAL SERMAYE: 100.000 ₺',
    Icon: Wallet,
    title: '100.000 ₺ Başlangıç Portföyü',
    description:
      'Hesabınıza aktarılan sanal bakiyenizle hiçbir finansal risk almadan yatırım stratejilerinizi test edin. Ayrıca her 24 saatte bir 1.000 ₺ ek kaynak kazanabilirsiniz.',
  },
  {
    badge: 'CANLI PİYASA ENTEGRASYONU',
    Icon: LineChart,
    title: 'Gerçek Zamanlı Borsa Verileri',
    description:
      'Bitcoin, Ethereum, Gram Altın ve Döviz kurlarının canlı borsa fiyatlarını anlık takip edin, derinlikli analizlerle alım-satım emirlerinizi yönetin.',
  },
  {
    badge: 'UYUMLU GETİRİ HESABI (TWR)',
    Icon: Trophy,
    title: 'Haftalık Performans Ligi',
    description:
      'Uluslararası Zaman Ağırlıklı Getiri (TWR) standartlarına göre hesaplanan yatırım başarınızla haftalık ligde yarışın, liderlik podyumunda yerinizi alın.',
  },
  {
    badge: 'GİZLİLİK VE ANONİMLİK',
    Icon: ShieldCheck,
    title: 'Profil Görünürlük Yapılandırması',
    description:
      'Haftalık lig sıralama tablosunda adınızın nasıl görüneceğini belirleyin. Bu ayarı dilediğiniz zaman profil ayarlarınızdan değiştirebilirsiniz.',
  },
];

export function OnboardingScreen({ userName, onFinishOnboarding }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPublic, setIsPublic] = useState(true);

  const card = CARDS[currentStep]!;
  /*
    ⚠️ BÜYÜK HARFLE BAŞLAYAN DEĞİŞKEN ŞART. JSX'te `<card.Icon />`
    yazmak da çalışırdı ama `<cardIcon />` gibi küçük harfli bir ad
    React tarafından HTML etiketi sanılır ve sessizce hiçbir şey
    çizilmez. Ayrı bir değişkene almak niyeti görünür kılıyor.
  */
  const CardIcon: LucideIcon = card.Icon;
  const isLastStep = currentStep === CARDS.length - 1;

  function handleNext() {
    if (isLastStep) {
      onFinishOnboarding(isPublic);
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  }

  return (
    <View style={styles.container}>
      {/* İlerleme Çubuğu */}
      <View style={styles.topHeader}>
        <Text style={styles.stepIndicator}>
          ADIM {currentStep + 1} / {CARDS.length}
        </Text>
        <View style={styles.progressBarBackground}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${((currentStep + 1) / CARDS.length) * 100}%` },
            ]}
          />
        </View>
      </View>

      {/* BUZLU CAM KARŞILAMA KARTI */}
      <View style={styles.glassCard}>
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{card.badge}</Text>
        </View>

        {/*
          ⚠️ SİMGE BİR BİLEŞEN, METİN DEĞİL. Emoji `<Text>` içindeyken
          boyutu font boyutuna, rengi de hiçbir şeye bağlıydı. Bileşen
          olarak `size` ve `color` temadan geliyor.
        */}
        <View style={styles.iconWrap}>
          <CardIcon size={34} color={colors.accent} strokeWidth={1.8} />
        </View>

        <Text style={styles.cardTitle}>
          {currentStep === 0 ? `Hoş Geldiniz, ${userName}` : card.title}
        </Text>

        <Text style={styles.cardDescription}>{card.description}</Text>

        {/* 4. KARTTA GİZLİLİK ŞALTERİ */}
        {isLastStep && (
          <View style={styles.privacyOptionContainer}>
            <Text style={styles.privacyLabel}>
              Liderlik Tablosunda Profil Görünümü:
            </Text>

            <View style={styles.privacyToggleRow}>
              <TouchableOpacity
                style={[
                  styles.privacyButton,
                  isPublic && styles.privacyButtonActive,
                ]}
                onPress={() => setIsPublic(true)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.privacyButtonText,
                    isPublic && styles.privacyButtonTextActive,
                  ]}
                >
                  🌐 Tam İsimle Görün
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.privacyButton,
                  !isPublic && styles.privacyButtonActive,
                ]}
                onPress={() => setIsPublic(false)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.privacyButtonText,
                    !isPublic && styles.privacyButtonTextActive,
                  ]}
                >
                  🔒 Anonim / Gizli Kal
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Alt Navigasyon Butonları */}
      <View style={styles.footer}>
        {currentStep > 0 ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setCurrentStep((prev) => prev - 1)}
          >
            <Text style={styles.backButtonText}>← Önceki Adım</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 100 }} />
        )}

        <TouchableOpacity
          style={styles.glowingPillButton}
          onPress={handleNext}
          activeOpacity={0.85}
        >
          <Text style={styles.glowingPillButtonText}>
            {isLastStep ? '🚀 Portföye Giriş Yap' : 'Devam Et →'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#081226',
    paddingHorizontal: 20,
    paddingVertical: 36,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topHeader: {
    width: '100%',
    maxWidth: 380,
    gap: 8,
    marginTop: 12,
  },
  stepIndicator: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: colors.surfacePressed,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.gain,
    borderRadius: 6,
  },
  glassCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
    borderWidth: 1.5,
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
    marginVertical: 16,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
  },
  badgeContainer: {
    alignSelf: 'center',
    backgroundColor: colors.gainSoft,
    borderColor: colors.gainSoft,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  badgeText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  iconWrap: { alignItems: 'center', marginBottom: 16 },
  cardTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  cardDescription: {
    fontSize: 14,
    color: colors.inkBright,
    textAlign: 'center',
    lineHeight: 22,
  },
  privacyOptionContainer: {
    width: '100%',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  privacyLabel: {
    color: colors.inkBright,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
  },
  privacyToggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSunken,
    borderRadius: 14,
    padding: 4,
    width: '100%',
  },
  privacyButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  privacyButtonActive: {
    backgroundColor: colors.accent,
  },
  privacyButtonText: {
    color: colors.inkDisabled,
    fontSize: 12,
    fontWeight: '600',
  },
  privacyButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  footer: {
    width: '100%',
    maxWidth: 380,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backButtonText: {
    color: colors.inkDisabled,
    fontSize: 14,
    fontWeight: '600',
  },
  glowingPillButton: {
    backgroundColor: colors.gain,
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 28,
    shadowColor: colors.gain,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  glowingPillButtonText: {
    color: '#022C22',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
