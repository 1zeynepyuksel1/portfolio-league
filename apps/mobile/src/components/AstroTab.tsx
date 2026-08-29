import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Image, Dimensions, ScrollView, Animated, Easing } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { colors, fonts } from '../theme';
import { apiFetch } from '../api/client';

const SCREEN_WIDTH = Dimensions.get('window').width;
const FRAME_WIDTH = Math.min(SCREEN_WIDTH - 60, 380); 
const FRAME_HEIGHT = FRAME_WIDTH * 1.15; 

const img1 = require('../../assets/astro/astro1.png');
const img2 = require('../../assets/astro/astro2.png');
const img3 = require('../../assets/astro/astro3.png');

const THINKING_MESSAGES = [
  'Falcı Abla düşünüyor...',
  'Yıldızlar konuşuyor...',
  'Kahve telvesi şekil alıyor...',
  'Cüzdanının enerjisi okunuyor...',
];

const WAIT_TO_THINK_MS = 520;
const THINK_TO_RESULT_MS = 900;
const THINKING_DURATION_MS = 4_000;
const FORTUNE_COOLDOWN_SECONDS =
  Number(process.env.EXPO_PUBLIC_FORTUNE_COOLDOWN_SECONDS) ||
  (process.env.NODE_ENV === 'production' ? 24 * 60 * 60 : 60);
const FORTUNE_LAST_READ_KEY = 'portfolioyun.fortune-last-read-at';

function formatRemainingTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) return `${hours} saat ${String(minutes).padStart(2, '0')} dk`;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')} dk`;
}

// Arkaplan Yıldız Partikülü Komponenti
const Star = ({ delay, size, left, top }: { delay: number, size: number, left: any, top: any }) => {
  const opacityAnim = useRef(new Animated.Value(0.2)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, { toValue: 1, duration: 1500, delay, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(scaleAnim, { toValue: 1.2, duration: 1500, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0.2, duration: 1500, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 0.8, duration: 1500, useNativeDriver: true })
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.star, { left, top, width: size, height: size, borderRadius: size/2, opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]} />
  );
};

export function AstroTab() {
  const [phase, setPhase] = useState<0 | 1 | 2>(0);
  
  // Animasyon Değerleri
  const charOpacity = useRef(new Animated.Value(0)).current;
  const charEntranceY = useRef(new Animated.Value(24)).current;
  const charScale = useRef(new Animated.Value(1)).current;
  const subtitleOpacity = useRef(new Animated.Value(1)).current;
  const subtitleTranslateY = useRef(new Animated.Value(0)).current;
  
  const bgBlurOpacity = useRef(new Animated.Value(0)).current; // Düşünme modundaki sis
  const resultFlash = useRef(new Animated.Value(0)).current; // Sonuç anındaki parlama
  
  const resultBoxOpacity = useRef(new Animated.Value(0)).current;
  const resultBoxTranslateY = useRef(new Animated.Value(30)).current;

  const [currentImage, setCurrentImage] = useState(img1);
  const [nextImage, setNextImage] = useState<any>(null); // Crossfade için üstteki resim
  const crossfadeOpacity = useRef(new Animated.Value(0)).current;

  // Alt başlık state'i
  const [subtitle, setSubtitle] = useState("Gezegenlerin dizilimi cüzdanını nasıl etkileyecek? Falcı Abla'ya dokun ve öğren.");
  const [fortuneAvailabilityKnown, setFortuneAvailabilityKnown] = useState(false);
  const [canReadFortune, setCanReadFortune] = useState(false);
  const [fortuneNextAvailableAt, setFortuneNextAvailableAt] = useState<number | null>(null);
  const [fortuneRemainingSeconds, setFortuneRemainingSeconds] = useState(0);
  const [fortuneText, setFortuneText] = useState<string | null>(null);

  /** Fal için cihazda kalıcı bir süre sınırı: testte 60 sn, normalde 24 saat. */
  useEffect(() => {
    let mounted = true;

    async function loadFortuneAvailability() {
      try {
        const lastReadRaw = await SecureStore.getItemAsync(FORTUNE_LAST_READ_KEY);
        const lastReadAt = lastReadRaw === null ? 0 : Number(lastReadRaw);
        const available =
          !Number.isFinite(lastReadAt) ||
          Date.now() - lastReadAt >= FORTUNE_COOLDOWN_SECONDS * 1_000;

        if (mounted) {
          setCanReadFortune(available);
          if (!available) {
            const nextAt = lastReadAt + FORTUNE_COOLDOWN_SECONDS * 1_000;
            setFortuneNextAvailableAt(nextAt);
            setFortuneRemainingSeconds(Math.max(0, Math.ceil((nextAt - Date.now()) / 1_000)));
          }
        }
      } catch {
        // Güvenli depoya erişilemeyen web ortamında falı engelleme.
        if (mounted) setCanReadFortune(true);
      } finally {
        if (mounted) setFortuneAvailabilityKnown(true);
      }
    }

    void loadFortuneAvailability();
    return () => {
      mounted = false;
    };
  }, []);

  /** Fal hakkı dolduğunda ekrandaki geri sayım kendiliğinden sıfırlanır. */
  useEffect(() => {
    if (fortuneNextAvailableAt === null) return;

    const updateCountdown = () => {
      const seconds = Math.max(0, Math.ceil((fortuneNextAvailableAt - Date.now()) / 1_000));
      setFortuneRemainingSeconds(seconds);

      if (seconds === 0) {
        setCanReadFortune(true);
        setFortuneNextAvailableAt(null);
        setSubtitle("Gezegenlerin dizilimi cüzdanını nasıl etkileyecek? Falcı Abla'ya dokun ve öğren.");
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1_000);
    return () => clearInterval(interval);
  }, [fortuneNextAvailableAt]);

  /** İlk render'da karakter, sisin içinden beliriyormuş gibi yavaşça girer. */
  useEffect(() => {
    Animated.parallel([
      Animated.timing(charOpacity, {
        toValue: 1,
        duration: 950,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(charEntranceY, {
        toValue: 0,
        duration: 950,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [charEntranceY, charOpacity]);

  /** Düşünme süresini canlı tutmak için mesaj her 1,1 saniyede değişir. */
  useEffect(() => {
    if (phase !== 1) return;

    let messageIndex = 0;
    const interval = setInterval(() => {
      messageIndex = (messageIndex + 1) % THINKING_MESSAGES.length;
      Animated.timing(subtitleOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        setSubtitle(THINKING_MESSAGES[messageIndex]!);
        subtitleTranslateY.setValue(8);
        Animated.parallel([
          Animated.timing(subtitleOpacity, {
            toValue: 1,
            duration: 360,
            useNativeDriver: true,
          }),
          Animated.timing(subtitleTranslateY, {
            toValue: 0,
            duration: 360,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 1_100);

    return () => clearInterval(interval);
  }, [phase, subtitleOpacity, subtitleTranslateY]);

  const transitionToPhase = (newPhase: 1 | 2, onComplete?: () => void) => {
    const isThinking = newPhase === 1;
    const isResult = newPhase === 2;
    
    // 1. Yeni Görseli Crossfade için hazırla
    setNextImage(isThinking ? img2 : img3);
    crossfadeOpacity.setValue(0);
    
    // 2. Karakter Küçülüp Büyüme & Opacity geçişi
    charScale.setValue(0.96);
    
    // 3. Yazı Kaybolsun
    Animated.parallel([
      Animated.timing(subtitleOpacity, { toValue: 0, duration: 320, useNativeDriver: true }),
      Animated.timing(subtitleTranslateY, { toValue: 10, duration: 320, useNativeDriver: true }),
      Animated.timing(crossfadeOpacity, { toValue: 1, duration: isResult ? THINK_TO_RESULT_MS : WAIT_TO_THINK_MS, useNativeDriver: true }),
      Animated.timing(charScale, { toValue: 1, duration: isResult ? THINK_TO_RESULT_MS : WAIT_TO_THINK_MS, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      
      // Arkaplan Sis Efekti
      Animated.timing(bgBlurOpacity, { toValue: isThinking ? 1 : 0, duration: isResult ? 800 : 650, useNativeDriver: true })
    ]).start(() => {
      // Crossfade bittikten sonra state'i eşitle
      setCurrentImage(isThinking ? img2 : img3);
      setNextImage(null);
      crossfadeOpacity.setValue(0);
      setPhase(newPhase);

      // Yazıyı Değiştir ve Geri Getir
      setSubtitle(isThinking ? THINKING_MESSAGES[0]! : "Falcı Abla diyor ki:");
      
      Animated.parallel([
        Animated.timing(subtitleOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(subtitleTranslateY, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
      
      // Sonuç Animasyonları (Glow + Result Box)
      if (isResult) {
        // Flash/Glow efekti (Hızlı yanıp sönme)
        resultFlash.setValue(1);
        Animated.timing(resultFlash, { toValue: 0, duration: 650, useNativeDriver: true }).start();

        // Kutu Gecikmeli Kayarak Girsin
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(resultBoxOpacity, { toValue: 1, duration: 650, useNativeDriver: true }),
            Animated.spring(resultBoxTranslateY, { toValue: 0, friction: 7, tension: 50, useNativeDriver: true })
          ]).start();
        }, 300);
      }

      onComplete?.();
    });
  };

  const handlePress = () => {
    if (phase !== 0 || !fortuneAvailabilityKnown || !canReadFortune) return;

    // Aynı oturumda ikinci kez tetiklenmesin; kalıcı zaman damgası sonuçta yazılır.
    setCanReadFortune(false);
    setFortuneText(null);
    void apiFetch<{ fortune: { content: string } }>('/fortune/today')
      .then(({ fortune }) => setFortuneText(fortune.content))
      .catch(() => {
        setFortuneText('Yıldızlar bugün biraz sessiz evladım; falını sonra tekrar okumayı dene.');
      });
    
    // Önce yavaşça düşünme hâline geçilir; 4 saniyelik ritüel bundan sonra başlar.
    transitionToPhase(1, () => {
      setTimeout(() => transitionToPhase(2), THINKING_DURATION_MS);
    });
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Finans Falın</Text>
        
        <Animated.Text style={[
          styles.subtitle, 
          phase !== 0 && { color: '#a78bfa', fontStyle: 'italic', fontFamily: fonts.medium },
          { opacity: subtitleOpacity, transform: [{ translateY: subtitleTranslateY }] }
        ]}>
          {subtitle}
        </Animated.Text>

        {phase === 0 && fortuneAvailabilityKnown && !canReadFortune && (
          <Text style={styles.cooldownText}>
            Yeni fal hakkın {formatRemainingTime(fortuneRemainingSeconds)} sonra
          </Text>
        )}

        <View style={styles.imageContainer}>
          <TouchableOpacity
            activeOpacity={canReadFortune ? 0.95 : 1}
            onPress={handlePress}
            style={styles.imageWrapper}
            disabled={!fortuneAvailabilityKnown || !canReadFortune}
          >
            {/* Arkaplan Sis Efekti (Düşünme modunda belirir) */}
            <Animated.View style={[styles.blurBackground, { opacity: bgBlurOpacity }]}>
              <View style={[styles.blurCircle, { top: '20%', left: '10%', backgroundColor: '#8b5cf6' }]} />
              <View style={[styles.blurCircle, { bottom: '20%', right: '10%', backgroundColor: '#c084fc' }]} />
              
              {/* Rastgele parlayan yıldızlar */}
              <Star delay={0} size={4} top="15%" left="25%" />
              <Star delay={500} size={6} top="40%" left="80%" />
              <Star delay={1000} size={5} top="70%" left="20%" />
              <Star delay={200} size={3} top="60%" left="85%" />
            </Animated.View>

            {/* Sonuç anındaki ani parlama efekti */}
            <Animated.View style={[styles.flashOverlay, { opacity: resultFlash }]} pointerEvents="none" />

            {/* Karakter Ana Görseli (Eski) */}
            <Animated.Image
              source={currentImage}
              style={[styles.image, { opacity: charOpacity, transform: [{ scale: charScale }, { translateY: Animated.add(charEntranceY, 15) }] }]}
              resizeMode="contain" 
            />
            
            {/* Karakter Crossfade Görseli (Yeni) */}
            {nextImage && (
              <Animated.Image
                source={nextImage}
                style={[styles.image, styles.crossfadeImage, { opacity: crossfadeOpacity, transform: [{ scale: charScale }, { translateY: Animated.add(charEntranceY, 15) }] }]}
                resizeMode="contain" 
              />
            )}
          </TouchableOpacity>
        </View>

        {phase === 2 && (
          <Animated.View style={[styles.resultBox, { opacity: resultBoxOpacity, transform: [{ translateY: resultBoxTranslateY }] }]}>
            <Text style={styles.resultText}>
              {fortuneText ?? 'Falcı Abla kristal küresine bakıyor...'}
            </Text>
            <TouchableOpacity 
              style={styles.btnSecondary} 
              onPress={() => {
                // Fal tamamlandığında, kullanıcı Teşekkürler Abla'ya basınca
                // günlük/deneme süresi başlar; sonuç izlenirken zaman akmaz.
                const readAt = Date.now();
                const nextAvailableAt = readAt + FORTUNE_COOLDOWN_SECONDS * 1_000;
                setFortuneNextAvailableAt(nextAvailableAt);
                setFortuneRemainingSeconds(FORTUNE_COOLDOWN_SECONDS);
                void SecureStore.setItemAsync(FORTUNE_LAST_READ_KEY, String(readAt)).catch(() => {
                  // Depolama hatası, fal sonucunu kullanıcıdan saklamamalı.
                });
                setPhase(0);
                setCurrentImage(img1);
                setSubtitle('Falın tamamlandı. Yeni fal hakkın için geri sayımı takip et.');
                resultBoxOpacity.setValue(0);
                resultBoxTranslateY.setValue(30);
              }}>
              <Text style={styles.btnSecondaryText}>Teşekkürler Abla</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
    alignItems: 'center',
    flexGrow: 1,
  },
  card: {
    width: '100%',
    maxWidth: 600, 
    alignSelf: 'center',
    // Falcı Abla, Keşfet yüzeyinin üzerinde doğrudan yer alır; dış kartın
    // sınırı ve dolgusu karakteri gereksiz bir dikdörtgene hapsediyordu.
    paddingVertical: 8,
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: '#8b5cf6',
    marginBottom: 8, 
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: 'center',
    marginBottom: 0, 
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  cooldownText: {
    fontFamily: fonts.monoMedium,
    fontSize: 13,
    color: '#c4b5fd',
    marginTop: 14,
    textAlign: 'center',
  },
  imageContainer: {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    marginTop: 24, 
    marginBottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  crossfadeImage: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  blurBackground: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  blurCircle: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    opacity: 0.15,
    // Web ve mobilde yumuşak blur efekti için
    shadowColor: '#8b5cf6',
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 0, 
  },
  star: {
    position: 'absolute',
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  flashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 100, // Orta merkezden parlama gibi
    zIndex: 10,
  },
  resultBox: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    width: '100%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    alignItems: 'center',
    marginTop: 16, 
  },
  resultText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.inkBright,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
    fontStyle: 'italic', 
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#8b5cf6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  btnSecondaryText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: '#c4b5fd',
  },
});
