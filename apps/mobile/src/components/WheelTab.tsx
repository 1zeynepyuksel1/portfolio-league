import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View, ScrollView, ActivityIndicator, Alert, Image, Dimensions } from 'react-native';
import Svg, { Path, Text as SvgText, G } from 'react-native-svg';
import { colors, fonts } from '../theme';
import { Share2, Play, Check } from 'lucide-react-native';
import { apiFetch } from '../api/client';

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
};

const createPieSlice = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M', x, y,
    'L', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
    'Z'
  ].join(' ');
};

type Reward = {
  id: string;
  key: string;
  displayName: string;
  description: string;
  rewardType: string;
  rewardValue: any;
  weight: string;
};

// İkonları import et
const iconMoney = require('../../assets/wheel/money.png');
const iconSad = require('../../assets/wheel/sad-face.png');
const iconSurprised = require('../../assets/wheel/surprised.png');
const iconHappy = require('../../assets/wheel/happy-face.png');

// 260px çark, geniş telefonlarda kartın içinde gereğinden küçük kalıyordu.
// Dar ekranlarda taşmaması için kullanılabilir genişliğe göre büyüyor.
const WHEEL_SIZE = Math.min(310, Dimensions.get('window').width - 80);

function formatRemainingTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) return `${hours} saat ${String(minutes).padStart(2, '0')} dk`;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')} dk`;
}

export function WheelTab() {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [canSpin, setCanSpin] = useState(true);
  const [cooldownSeconds, setCooldownSeconds] = useState(24 * 60 * 60);
  const [nextSpinAt, setNextSpinAt] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  
  const [result, setResult] = useState<Reward | null>(null);
  const [isClaimed, setIsClaimed] = useState(false); // Ödülü al butonuna basıldı mı?

  useEffect(() => {
    loadWheelData();
  }, []);

  const loadWheelData = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<{
        rewards: Reward[];
        canSpin: boolean;
        nextSpinAt: string | null;
        cooldownSeconds?: number;
      }>('/bonus/wheel');
      setRewards(data.rewards);
      setCanSpin(data.canSpin);
      setCooldownSeconds(data.cooldownSeconds ?? 24 * 60 * 60);
      const nextAt = data.nextSpinAt === null ? null : Date.parse(data.nextSpinAt);
      setNextSpinAt(Number.isFinite(nextAt) ? nextAt : null);
    } catch (error) {
      console.error('Failed to load wheel data', error);
    } finally {
      setLoading(false);
    }
  };

  /** Ekran açıksa sayaç her saniye güncellenir; süre dolunca çark kendiliğinden açılır. */
  useEffect(() => {
    if (nextSpinAt === null) return;

    const updateCountdown = () => {
      const seconds = Math.max(0, Math.ceil((nextSpinAt - Date.now()) / 1_000));
      setRemainingSeconds(seconds);

      if (seconds === 0) {
        setCanSpin(true);
        setNextSpinAt(null);
        void loadWheelData();
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1_000);
    return () => clearInterval(interval);
  }, [nextSpinAt]);

  const getRarityStyle = (reward: Reward) => {
    const w = parseFloat(reward.weight);
    if (reward.rewardType === 'none' || reward.displayName.toLowerCase().includes('enflasyon')) {
      return { color: '#475569', glow: 'rgba(71,85,105,0.2)', text: colors.inkMuted, title: 'MAALESEF...' };
    }
    if (w < 3) {
      return { color: '#f59e0b', glow: 'rgba(245,158,11,0.5)', text: '#f59e0b', title: 'TEBRİKLER!' };
    }
    return { color: '#3b82f6', glow: 'rgba(59,130,246,0.3)', text: '#3b82f6', title: 'TEBRİKLER!' };
  };

  const getResultIcon = (reward: Reward) => {
    const w = parseFloat(reward.weight);
    if (reward.rewardType === 'none' || reward.displayName.toLowerCase().includes('enflasyon')) {
      return iconSad;
    }
    if (reward.rewardType === 'cash') {
      return iconMoney;
    }
    if (w < 5) {
      return iconSurprised;
    }
    return iconHappy;
  };

  const spinWheel = async () => {
    if (spinning || !canSpin || rewards.length === 0) return;
    setSpinning(true);
    setResult(null);
    setIsClaimed(false); // Yeni çeviri için claim durumunu sıfırla

    try {
      const data = await apiFetch<{ reward: Reward }>('/bonus/wheel/spin', { method: 'POST' });
      const wonReward = data.reward;
      
      const targetIndex = rewards.findIndex(r => r.id === wonReward.id);
      if (targetIndex === -1) throw new Error('Reward not found in local list');

      const anglePerSlice = 360 / rewards.length;
      const targetSliceCenter = (targetIndex * anglePerSlice) + (anglePerSlice / 2);
      const rotationToLand = 360 - targetSliceCenter;

      const randomRotations = 6;
      const totalRotation = (randomRotations * 360) + rotationToLand;

      Animated.timing(spinAnim, {
        toValue: totalRotation,
        duration: 4000,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic)
      }).start(() => {
        setSpinning(false);
        setResult(wonReward);
      });

    } catch (error: any) {
      setSpinning(false);
      Alert.alert('Hata', error.message || 'Çark çevrilirken bir sorun oluştu.');
    }
  };

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 36000],
    outputRange: ['0deg', '36000deg']
  });

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const anglePerSlice = 360 / rewards.length;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      <View style={styles.card}>
        {result ? (
          <View style={styles.resultView}>
            
            <Text style={[styles.resultMainTitle, { color: getRarityStyle(result).text, textShadowColor: getRarityStyle(result).glow }]}>
              {getRarityStyle(result).title}
            </Text>
            
            {!isClaimed && result.rewardType !== 'none' ? (
              <Text style={styles.resultSubtitle}>Günün şans çarkı durdu.</Text>
            ) : null}
            
            {/* 1. Aşama: Ödülü Al (Ödül Varsa) */}
            {!isClaimed && result.rewardType !== 'none' ? (
              <>
                <View style={[styles.resultBox, { borderColor: getRarityStyle(result).glow }]}>
                  <Image 
                    source={getResultIcon(result)} 
                    style={styles.emojiIcon} 
                    resizeMode="contain" 
                  />
                  <Text style={styles.resultBoxText}>{result.displayName}</Text>
                  <Text style={styles.resultBoxSub}>{result.description}</Text>
                </View>

                <View style={{ width: '100%' }}>
                  <TouchableOpacity 
                    style={styles.claimBtn} 
                    onPress={() => setIsClaimed(true)}
                  >
                    <Check size={20} color="#0f172a" strokeWidth={3} />
                    <Text style={styles.claimBtnText}>Ödülü Al</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* 2. Aşama: Alındı Mesajı ve Paylaş/Kapat Butonları (Veya Boş Çıktı) */
              <>
                <View style={[styles.resultBox, { borderColor: getRarityStyle(result).glow }]}>
                  {result.rewardType !== 'none' ? (
                    // Başarılı Alım Ekranı
                    <View style={{ alignItems: 'center' }}>
                      <View style={styles.successIconWrapper}>
                        <Check size={40} color="#10b981" strokeWidth={3} />
                      </View>
                      <Text style={styles.resultBoxText}>Harika!</Text>
                      <Text style={[styles.resultBoxSub, { color: '#10b981', fontFamily: fonts.semibold }]}>
                        {result.rewardType === 'cash' 
                          ? `${result.rewardValue?.amount} TL hesabınıza yattı.`
                          : `"${result.displayName}" başarıyla tanımlandı.`}
                      </Text>
                    </View>
                  ) : (
                    // Boş/Negatif Ekranı
                    <View style={{ alignItems: 'center' }}>
                      <Image 
                        source={getResultIcon(result)} 
                        style={styles.emojiIcon} 
                        resizeMode="contain" 
                      />
                      <Text style={styles.resultBoxText}>{result.displayName}</Text>
                      <Text style={styles.resultBoxSub}>{result.description}</Text>
                    </View>
                  )}
                </View>

                <View style={{ width: '100%' }}>
                  <TouchableOpacity style={styles.shareBtn}>
                    <Share2 size={18} color={colors.inkBright} />
                    <Text style={styles.shareBtnText}>Hemen Paylaş</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.closeBtn} 
                    onPress={() => {
                      // Kullanıcı sonuç ekranını kapattığı anda geri sayım başlar.
                      const nextAt = Date.now() + cooldownSeconds * 1_000;
                      setCanSpin(false);
                      setNextSpinAt(nextAt);
                      setRemainingSeconds(cooldownSeconds);
                      setResult(null);
                      spinAnim.setValue(0);
                    }}
                  >
                    <Text style={styles.closeBtnText}>Kapat</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            
          </View>
        ) : (
          <View style={styles.wheelView}>
            <Text style={styles.title}>Şansını Dene</Text>
            <Text style={styles.subtitle}>
              {cooldownSeconds < 60 * 60
                ? 'Test modu açık: çarkı her dakika bir kez çevirebilirsin.'
                : 'Elit borsa ödülleri ve deneme bakiyesi kazanmak için günde bir kez çevir.'}
            </Text>
            
            <Text style={styles.tapInstruction}>
              {!canSpin
                ? `Sonraki çevirme hakkın ${formatRemainingTime(remainingSeconds)} sonra`
                : 'Çarkı çevirmek için üzerine dokun 👇'}
            </Text>

            <TouchableOpacity 
              style={[styles.svgWrapper, (spinning || !canSpin) && { opacity: 0.8 }]}
              onPress={spinWheel}
              activeOpacity={0.9}
              disabled={spinning || !canSpin}
            >
              <View style={styles.pointerContainer}>
                <View style={styles.pointerCircle}>
                  <View style={styles.pointerInner} />
                </View>
                <View style={styles.pointerTriangle} />
              </View>

              <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
                <Svg width={WHEEL_SIZE} height={WHEEL_SIZE} viewBox="0 0 260 260">
                  <G x={0} y={0}>
                    {rewards.map((sector, i) => {
                      const startAngle = i * anglePerSlice;
                      const endAngle = (i + 1) * anglePerSlice;
                      const pathData = createPieSlice(130, 130, 130, startAngle, endAngle);
                      
                      // Zemin bir koyu bir açık
                      const bgColor = i % 2 === 0 ? '#1e293b' : '#334155';
                      // YAZI RENGİ: BİR GRİ, BİR TURUNCU
                      const textColor = i % 2 === 0 ? '#cbd5e1' : colors.warn; // colors.warn = #f59e0b (turuncu)

                      const midAngle = startAngle + (anglePerSlice / 2);
                      const textPos = polarToCartesian(130, 130, 85, midAngle);
                      const textRotation = midAngle + 90;

                      const shortName = sector.displayName.length > 12 
                        ? sector.displayName.substring(0, 10) + '..' 
                        : sector.displayName;

                      return (
                        <G key={i}>
                          <Path d={pathData} fill={bgColor} />
                          <SvgText
                            x={textPos.x}
                            y={textPos.y}
                            fill={textColor}
                            fontSize="10"
                            fontFamily={fonts.bold}
                            textAnchor="middle"
                            alignmentBaseline="middle"
                            transform={`rotate(${textRotation}, ${textPos.x}, ${textPos.y})`}
                          >
                            {shortName}
                          </SvgText>
                        </G>
                      );
                    })}
                  </G>
                </Svg>
              </Animated.View>

              <View style={styles.centerOverlay}>
                <Play size={20} color={colors.warn} fill={colors.warn} style={{ marginLeft: 3 }} />
              </View>
            </TouchableOpacity>
          </View>
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
    // Çark Keşfet ekranının ana yüzeyinde duruyor. Dışarıdaki büyük kart
    // kaldırıldı; bu sayede ekran bir oyun kutusu gibi değil, daha açık ve
    // profesyonel bir deneyim gibi okunuyor.
    paddingVertical: 8,
  },
  wheelView: {
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.inkBright,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  tapInstruction: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.warn,
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  svgWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    backgroundColor: colors.surface,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    marginBottom: 16,
  },
  centerOverlay: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 4,
    borderColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  pointerContainer: {
    position: 'absolute',
    top: -12,
    left: '50%',
    marginLeft: -12,
    alignItems: 'center',
    zIndex: 10,
  },
  pointerCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.warn,
    borderWidth: 4,
    borderColor: colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointerInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceRaised,
  },
  pointerTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.warn,
    marginTop: -4,
  },
  
  resultView: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  resultMainTitle: {
    fontFamily: fonts.bold,
    fontSize: 28,
    letterSpacing: 1,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  resultSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.inkMuted,
    marginBottom: 24,
    textAlign: 'center',
  },
  resultBox: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    width: '100%',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
  },
  emojiIcon: {
    width: 80,
    height: 80,
    marginBottom: 20,
  },
  successIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  resultBoxText: {
    fontFamily: fonts.bold,
    fontSize: 32,
    color: colors.inkBright,
    marginBottom: 12,
    textAlign: 'center',
  },
  resultBoxSub: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  claimBtn: {
    backgroundColor: colors.warn,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: colors.warn,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  claimBtnText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#0f172a',
    marginLeft: 8,
  },
  shareBtn: {
    backgroundColor: colors.surfacePressed,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  shareBtnText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.inkBright,
    marginLeft: 8,
  },
  closeBtn: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
  },
  closeBtnText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.inkMuted,
  },
});
