import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { createAvatar } from '@dicebear/core';
import { shapes } from '@dicebear/collection';
import { colors, fonts, radius } from '../theme';

/**
 * Hazır avatar görselleri.
 *
 * ⚠️ AYNI LİSTE `ProfileScreen`'de DE VAR — bilerek bırakıldı, ama
 * borç olarak. Profil ekranına bir daha dokunulduğunda oradaki kopya
 * silinip buradan `import` edilmeli. İki `require` haritası tutmak,
 * yeni bir avatar eklendiğinde birinde görünüp öbüründe görünmemesi
 * demek — ve bu, hiçbir yerde hata vermeden olur.
 */
export const localAvatars: Record<string, any> = {
  meerkat: require('../../assets/avatars/meerkat.png'),
  chicken: require('../../assets/avatars/chicken.png'),
  bear: require('../../assets/avatars/bear.png'),
  rabbit: require('../../assets/avatars/rabbit.png'),
  cat: require('../../assets/avatars/cat.png'),
  panda: require('../../assets/avatars/panda.png'),
};

type Props = {
  /** Avatarın tohumu. `null`/`undefined` ise baş harfe düşülür. */
  seed?: string | null;
  /** 'local' ise hazır görsel, değilse dicebear ile üretilen SVG. */
  avatarStyle?: string | null;
  /** Tohum yokken gösterilecek metin — kullanıcı adı yeterli. */
  fallback?: string | undefined;
  size?: number;
};

/**
 * Kullanıcı avatarı — üç kademeli.
 *
 *   1. Hazır görsel  (avatarStyle === 'local')
 *   2. Üretilen SVG  (dicebear "shapes")
 *   3. Baş harf      (tohum yoksa)
 *
 * ⚠️ ÜÇÜNCÜ KADEME ŞART. Avatar seçmemiş kullanıcı — ki yeni kayıt
 * olan herkes öyle — aksi hâlde boş bir daire görürdü. Boş daire
 * "yükleniyor" gibi durur ve kullanıcı beklemeye başlar; baş harf
 * ise tamamlanmış bir durumdur.
 */
export function UserAvatar({ seed, avatarStyle, fallback, size = 32 }: Props) {
  /*
    ⚠️ `#` KIRPILIYOR — dicebear renkleri diyez OLMADAN bekliyor.
    `'#22c55e'` geçilirse renk sessizce yok sayılır ve avatar
    varsayılan paletle çizilir; hata da vermez.
  */
  const bgColors = [
    colors.surfaceRaised.replace('#', ''),
    colors.surfacePressed.replace('#', ''),
  ];
  const shapeColors = [colors.gain, colors.loss, colors.warn, colors.gold, colors.accent]
    .map((c) => c.replace('#', ''));

  const kutu = {
    width: size,
    height: size,
    borderRadius: radius.full,
  };

  if (avatarStyle === 'local' && seed && localAvatars[seed]) {
    return (
      <View style={[styles.wrap, kutu]}>
        <Image
          source={localAvatars[seed]}
          style={styles.fill}
          resizeMode="contain"
        />
      </View>
    );
  }

  if (seed) {
    const svg = createAvatar(shapes, {
      seed,
      backgroundColor: bgColors,
      shape1Color: shapeColors,
      shape2Color: shapeColors,
      shape3Color: shapeColors,
    }).toString();

    return (
      <View style={[styles.wrap, kutu]}>
        <SvgXml xml={svg} width="100%" height="100%" />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, styles.initialWrap, kutu]}>
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>
        {(fallback ?? '?').charAt(0).toLocaleUpperCase('tr')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    backgroundColor: colors.surfacePressed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialWrap: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  fill: { width: '100%', height: '100%' },
  initial: {
    fontFamily: fonts.bold,
    color: colors.inkMuted,
  },
});
