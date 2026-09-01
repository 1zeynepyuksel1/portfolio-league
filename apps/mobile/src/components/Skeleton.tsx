import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';

/**
 * Skeleton — yüklenirken gelecek içeriğin gri taslağı.
 *
 * ⚠️ NEDEN DÖNEN ÇEMBER DEĞİL.
 *
 * `ActivityIndicator` "bekle" diyor ama NE beklendiğini söylemiyor.
 * İskelet, içerik gelmeden önce sayfanın ŞEKLİNİ gösteriyor: kullanıcı
 * kaç satır geleceğini, nerede bir başlık nerede bir sayı olacağını
 * daha veri inmeden biliyor.
 *
 * Ölçülebilir faydası da var: yükleme bitince düzen ZIPLAMIYOR. Dönen
 * çember 40 piksel yer kaplarken içerik 300 piksel geliyor ve ekran
 * sıçrıyor; iskelet baştan doğru yüksekliği tutuyor.
 *
 * ⚠️ ANİMASYON YOKSA DA ÇALIŞIR. Nabız yalnızca "bu bir yer tutucu,
 * gerçek içerik değil" demek için var. Kapanırsa iskelet donuk gri
 * kutulara dönüşüyor — hâlâ doğru, sadece daha sessiz.
 */

/**
 * ⚠️ `useNativeDriver` WEB'DE KAPALI.
 *
 * Web'de yerel animasyon modülü yok; açık bırakınca her açılışta
 * konsola uyarı düşüyordu ("RCTAnimation module is missing"). Uyarı
 * zararsız ama gerçek hataları gürültüye boğuyor. Opaklık animasyonu
 * JS ile de yeterince akıcı.
 */
const NATIVE_DRIVER = Platform.OS !== 'web';

function useNabiz(): Animated.Value {
  const deger = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const dongu = Animated.loop(
      Animated.sequence([
        Animated.timing(deger, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(deger, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: NATIVE_DRIVER,
        }),
      ]),
    );
    dongu.start();

    /*
      ⚠️ DÖNGÜ DURDURULMAK ZORUNDA. Bileşen söküldükten sonra animasyon
      çalışmaya devam ederse arka planda boşuna iş yapılır ve React
      "sökülmüş bileşende state güncellendi" uyarısı verir.
    */
    return () => dongu.stop();
  }, [deger]);

  return deger;
}

/**
 * Tek bir gri blok.
 *
 * ⚠️ GENİŞLİK YÜZDE OLARAK VERİLEBİLİYOR ve satırlara FARKLI yüzdeler
 * verilmesi bilinçli: eşit uzunlukta üç çubuk bir tabloya benziyor,
 * farklı uzunluktakiler METNE benziyor. Taslağın geleceği şeye
 * benzemesi, taslak olmasının tek sebebi.
 */
export function SkeletonBlock({
  width = '100%',
  height = 14,
  rounded = radius.xs,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  rounded?: number;
  style?: object;
}) {
  const nabiz = useNabiz();

  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, borderRadius: rounded, opacity: nabiz },
        style,
      ]}
    />
  );
}

/**
 * Metin bloğu taslağı — birkaç satır, sonuncusu kısa.
 *
 * ⚠️ SON SATIR KISA. Gerçek paragraflarda son satır nadiren tam dolar;
 * hepsi eşit uzunlukta olsaydı taslak metne değil bir çubuk grafiğe
 * benzerdi.
 */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <View style={styles.textGroup}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBlock
          key={i}
          height={12}
          width={i === lines - 1 ? '55%' : '100%'}
        />
      ))}
    </View>
  );
}

/** Liste satırı taslağı — solda daire, sağda iki metin çizgisi. */
export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <SkeletonBlock width={36} height={36} rounded={radius.full} />
      <View style={styles.rowText}>
        <SkeletonBlock height={13} width="45%" />
        <SkeletonBlock height={11} width="28%" />
      </View>
      <SkeletonBlock width={64} height={16} />
    </View>
  );
}

/** Kart taslağı — başlık + metin. */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <View style={styles.card}>
      <SkeletonBlock height={16} width="40%" />
      <View style={{ height: 12 }} />
      <SkeletonText lines={lines} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.surfacePressed },
  textGroup: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rowText: { flex: 1, gap: 8 },
  card: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
  },
});
