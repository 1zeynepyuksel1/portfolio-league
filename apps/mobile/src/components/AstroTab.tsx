import { SharePostModal, ShareScope } from './SharePostModal';
﻿import React, { useState, useRef, useEffect } from 'react';
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

const THINKING_DURATION_MS = 4000;
const FORTUNE_COOLDOWN_SECONDS = 24 * 60 * 60; // 24 hours
const FORTUNE_LAST_READ_KEY = 'FORTUNE_LAST_READ_KEY';

function formatRemainingTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0s';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}sa ${m}dk`;
  if (m > 0) return `${m}dk ${s}sn`;
  return `${s}sn`;
}

// Sparkle/Star component
const Star = ({ delay, size, top, left }: { delay: number, size: number, top: any, left: any }) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, delay, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true, easing: Easing.inOut(Easing.ease) })
      ])
    ).start();
  }, []);
  return <Animated.View style={[styles.star, { width: size, height: size, borderRadius: size/2, top, left, opacity: anim, transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] }) }] }]} />;
};

export function AstroTab() {
  const [phase, setPhase] = useState<0 | 1 | 2>(0);
  const [currentImage, setCurrentImage] = useState(img1);
  const [nextImage, setNextImage] = useState(null);

  const [subtitle, setSubtitle] = useState("Gezegenlerin dizilimi cüzdanını nasıl etkileyecek? Falcı Abla'ya dokun ve öğren.");
  const [fortuneAvailabilityKnown, setFortuneAvailabilityKnown] = useState(false);
  const [canReadFortune, setCanReadFortune] = useState(false);
  const [fortuneNextAvailableAt, setFortuneNextAvailableAt] = useState<number | null>(null);
  const [fortuneRemainingSeconds, setFortuneRemainingSeconds] = useState(0);
  const [fortuneText, setFortuneText] = useState<string | null>(null);
  const [shareScope, setShareScope] = useState<ShareScope | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadFortuneAvailability() {
      try {
        const lastReadRaw = await SecureStore.getItemAsync(FORTUNE_LAST_READ_KEY);
        if (!lastReadRaw) {
          if (mounted) setCanReadFortune(true);
        } else {
          const lastReadAt = parseInt(lastReadRaw, 10);
          const nextAvailableAt = lastReadAt + FORTUNE_COOLDOWN_SECONDS * 1000;
          if (Date.now() >= nextAvailableAt) {
            if (mounted) setCanReadFortune(true);
          } else {
            if (mounted) {
              setCanReadFortune(false);
              setFortuneNextAvailableAt(nextAvailableAt);
              setFortuneRemainingSeconds(Math.floor((nextAvailableAt - Date.now()) / 1000));
            }
          }
        }
      } catch {
        if (mounted) setCanReadFortune(true);
      } finally {
        if (mounted) setFortuneAvailabilityKnown(true);
      }
    }
    void loadFortuneAvailability();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (fortuneNextAvailableAt === null) return;
    const interval = setInterval(() => {
      const remaining = Math.floor((fortuneNextAvailableAt - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(interval);
        setFortuneRemainingSeconds(0);
        setCanReadFortune(true);
        setFortuneNextAvailableAt(null);
        setSubtitle("Gezegenlerin dizilimi cüzdanını nasıl etkileyecek? Falcı Abla'ya dokun ve öğren.");
      } else {
        setFortuneRemainingSeconds(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [fortuneNextAvailableAt]);

  const charEntranceY = useRef(new Animated.Value(20)).current;
  const charOpacity = useRef(new Animated.Value(0)).current;
  const charScale = useRef(new Animated.Value(1)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleTranslateY = useRef(new Animated.Value(10)).current;
  const bgBlurOpacity = useRef(new Animated.Value(0)).current;
  const crossfadeOpacity = useRef(new Animated.Value(0)).current;
  const resultBoxOpacity = useRef(new Animated.Value(0)).current;
  const resultBoxTranslateY = useRef(new Animated.Value(30)).current;
  const resultFlash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(charEntranceY, { toValue: 0, duration: 800, useNativeDriver: true, easing: Easing.out(Easing.back(1.5)) }),
      Animated.timing(charOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(subtitleOpacity, { toValue: 1, duration: 600, delay: 300, useNativeDriver: true }),
      Animated.timing(subtitleTranslateY, { toValue: 0, duration: 600, delay: 300, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
    ]).start();
  }, []);

  const transitionToPhase = (newPhase: 1 | 2, onComplete?: () => void) => {
    setPhase(newPhase);
    const isThinking = newPhase === 1;
    const isResult = newPhase === 2;

    Animated.parallel([
      Animated.timing(subtitleOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(subtitleTranslateY, { toValue: -5, duration: 300, useNativeDriver: true })
    ]).start(() => {
      setSubtitle(isThinking ? THINKING_MESSAGES[0]! : "Falcı Abla diyor ki:");
      Animated.parallel([
        Animated.timing(subtitleOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(subtitleTranslateY, { toValue: 0, duration: 400, useNativeDriver: true })
      ]).start();
    });

    Animated.timing(bgBlurOpacity, {
      toValue: isThinking || isResult ? 1 : 0,
      duration: 1500,
      useNativeDriver: true,
    }).start();

    if (isThinking) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(charEntranceY, { toValue: -5, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
          Animated.timing(charEntranceY, { toValue: 5, duration: 1500, useNativeDriver: true, easing: Easing.inOut(Easing.sin) })
        ])
      ).start();
    }

    setNextImage(isThinking ? img2 : img3);
    crossfadeOpacity.setValue(0);
    Animated.timing(crossfadeOpacity, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true
    }).start(() => {
      setCurrentImage(isThinking ? img2 : img3);
      setNextImage(null);
      if (isResult) {
        Animated.sequence([
          Animated.timing(resultFlash, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.timing(resultFlash, { toValue: 0, duration: 400, useNativeDriver: true })
        ]).start();

        setTimeout(() => {
          Animated.parallel([
            Animated.timing(resultBoxOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.timing(resultBoxTranslateY, { toValue: 0, duration: 600, useNativeDriver: true, easing: Easing.out(Easing.back(1.2)) })
          ]).start();
        }, 300);
      }
      onComplete?.();
    });
  };

  const handlePress = () => {
    if (phase !== 0 || !fortuneAvailabilityKnown || !canReadFortune) return;

    setCanReadFortune(false);
    setFortuneText(null);
    void apiFetch<{ fortune: { content: string } }>('/fortune/today')
      .then(({ fortune }) => setFortuneText(fortune.content))
      .catch(() => {
        setFortuneText('Yıldızlar bugün biraz sessiz evladım; falını sonra tekrar okumayı dene.');
      });
    
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
            <Animated.View style={[styles.blurBackground, { opacity: bgBlurOpacity }]}>
              <View style={[styles.blurCircle, { top: '20%', left: '10%', backgroundColor: '#8b5cf6' }]} />
              <View style={[styles.blurCircle, { bottom: '20%', right: '10%', backgroundColor: '#c084fc' }]} />
              <Star delay={0} size={4} top="15%" left="25%" />
              <Star delay={500} size={6} top="40%" left="80%" />
              <Star delay={1000} size={5} top="70%" left="20%" />
              <Star delay={200} size={3} top="60%" left="85%" />
            </Animated.View>
            <Animated.View style={[styles.flashOverlay, { opacity: resultFlash }]} pointerEvents="none" />
            <Animated.Image
              source={currentImage}
              style={[styles.image, { opacity: charOpacity, transform: [{ scale: charScale }, { translateY: Animated.add(charEntranceY, 15) }] }]}
              resizeMode="contain" 
            />
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
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                <TouchableOpacity 
                  style={[styles.btnSecondary, { flex: 1, alignItems: 'center' }]} 
                  onPress={() => {
                    const readAt = Date.now();
                    const nextAvailableAt = readAt + FORTUNE_COOLDOWN_SECONDS * 1000;
                    setFortuneNextAvailableAt(nextAvailableAt);
                    setFortuneRemainingSeconds(FORTUNE_COOLDOWN_SECONDS);
                    void SecureStore.setItemAsync(FORTUNE_LAST_READ_KEY, String(readAt));
                    if (fortuneText) SecureStore.setItemAsync('FORTUNE_LAST_TEXT', fortuneText).catch(() => {});
                    setPhase(0);
                    setCurrentImage(img1);
                    setSubtitle('Falın tamamlandı. Yeni fal hakkın için geri sayımı takip et.');
                    resultBoxOpacity.setValue(0);
                    resultBoxTranslateY.setValue(30);
                  }}>
                  <Text style={styles.btnSecondaryText}>Kapat</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.btnSecondary, { flex: 1, alignItems: 'center', backgroundColor: '#8b5cf6' }]} 
                  onPress={() => {
                    if (fortuneText) {
                      setShareScope({ type: 'horoscope', content: fortuneText, assetName: 'Günün Falı' });
                    }
                  }}>
                  <Text style={[styles.btnSecondaryText, { color: '#fff' }]}>Paylaş</Text>
                </TouchableOpacity>
              </View>
          </Animated.View>
        )}
      </View>
        
        <SharePostModal 
          visible={!!shareScope} 
          scope={shareScope} 
          onClose={() => setShareScope(null)} 
          onSuccess={() => setShareScope(null)} 
        />
      </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40, alignItems: 'center', flexGrow: 1 },
  card: { width: '100%', maxWidth: 600, alignSelf: 'center', paddingVertical: 8, alignItems: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 24, color: '#8b5cf6', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkMuted, textAlign: 'center', marginBottom: 0, lineHeight: 20, paddingHorizontal: 8 },
  cooldownText: { fontFamily: fonts.monoMedium, fontSize: 13, color: '#c4b5fd', marginTop: 14, textAlign: 'center' },
  imageContainer: { width: FRAME_WIDTH, height: FRAME_HEIGHT, marginTop: 24, marginBottom: 0, alignItems: 'center', justifyContent: 'center' },
  imageWrapper: { width: '100%', height: '100%' },
  image: { width: '100%', height: '100%' },
  crossfadeImage: { position: 'absolute', top: 0, left: 0 },
  blurBackground: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  blurCircle: { position: 'absolute', width: 150, height: 150, borderRadius: 75, opacity: 0.15, shadowColor: '#8b5cf6', shadowOpacity: 1, shadowRadius: 40, elevation: 0 },
  star: { position: 'absolute', backgroundColor: '#fff', shadowColor: '#fff', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6 },
  flashOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 100, zIndex: 10 },
  resultBox: { backgroundColor: 'rgba(139, 92, 246, 0.1)', width: '100%', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.3)', alignItems: 'center', marginTop: 16 },
  resultText: { fontFamily: fonts.medium, fontSize: 15, color: colors.inkBright, textAlign: 'center', lineHeight: 24, marginBottom: 20, fontStyle: 'italic' },
  btnSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#8b5cf6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
  btnSecondaryText: { fontFamily: fonts.semibold, fontSize: 14, color: '#c4b5fd' }
});

