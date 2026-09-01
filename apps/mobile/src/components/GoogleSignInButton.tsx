import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { apiFetch } from '../api/client';
import { colors, fonts } from '../theme';

/**
 * GoogleSignInButton — "Google ile devam et".
 *
 * ⚠️ BU DÜĞME KİMLİK DOĞRULAMIYOR, SADECE JETON TOPLUYOR.
 *
 * Akış:
 *
 *   1. Kullanıcı Google ekranında oturum açar          (burada)
 *   2. Google bize imzalı bir `id_token` verir          (burada)
 *   3. Jeton SUNUCUYA gönderilir                        (burada)
 *   4. Sunucu jetonu Google'a DOĞRULATIR                (auth/google.ts)
 *   5. Sunucu BİZİM access/refresh token'ımızı üretir   (auth/service.ts)
 *
 * Uygulamanın geri kalanı Google'ı hiç bilmiyor; her yerde yine kendi
 * JWT'imiz dolaşıyor. Kilitli karar ("kendi auth'umuz") böyle korunuyor:
 * Google bir GİRİŞ YOLU, kimlik sisteminin kendisi değil.
 *
 * ⚠️ E-POSTA/AD BURADAN GÖNDERİLMİYOR. Yalnızca `idToken` gidiyor.
 * Profil bilgisini istemciden gönderseydik, sunucu onu doğrulayamaz ve
 * herhangi biri istediği e-postayı iddia edebilirdi.
 *
 * ⚠️ `maybeCompleteAuthSession` MODÜL SEVİYESİNDE ÇAĞRILMAK ZORUNDA.
 * Web'de Google geri döndüğünde açılan pencerenin kapanmasını bu sağlıyor;
 * bileşenin içine koyarsak geç kalır ve pencere açık kalır.
 */
WebBrowser.maybeCompleteAuthSession();

type Props = {
  onSuccess: (data: {
    user: { id: string; email: string; displayName: string; username?: string };
    accessToken: string;
    refreshToken: string;
    isNewUser: boolean;
  }) => void;
  onError: (message: string) => void;
  disabled?: boolean;
};

export function GoogleSignInButton({ onSuccess, onError, disabled }: Props) {
  const [gonderiliyor, setGonderiliyor] = useState(false);

  /*
    ⚠️ ÜÇ AYRI İSTEMCİ KİMLİĞİ — VE BU GOOGLE'IN KURALI, BİZİM TERCİHİMİZ
    DEĞİL. Google aynı uygulamanın Android / iOS / web sürümlerine ayrı
    kimlik veriyor. Sunucu tarafı da bu yüzden `GOOGLE_CLIENT_IDS` ile
    virgüllü liste kabul ediyor: gelen jetonun `aud`'u hangi platformdan
    geldiyse o olur.

    ⚠️ `EXPO_PUBLIC_` ÖNEKİ BURADA GÜVENLİ — ama yalnızca burada.
    İstemci kimliği zaten GİZLİ DEĞİL; Google'ın giriş ekranında herkese
    görünüyor. Gizli olan `client_secret` ve o SUNUCUDA bile yok (bu akış
    onu kullanmıyor). Aynı öneki bir API anahtarına koymak felaket olurdu:
    `EXPO_PUBLIC_*` pakete gömülüyor ve paketi açan herkes okuyabiliyor.
  */
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (response === null) return;

    if (response.type === 'error') {
      onError('Google girişi tamamlanamadı.');
      return;
    }

    /*
      ⚠️ 'dismiss' ve 'cancel' HATA DEĞİL. Kullanıcı vazgeçmiş olabilir;
      ona hata göstermek "bir şeyler bozuldu" hissi verir. Sessizce
      hiçbir şey yapmak doğru.
    */
    if (response.type !== 'success') return;

    const idToken = response.authentication?.idToken ?? response.params?.id_token;

    if (typeof idToken !== 'string' || idToken === '') {
      /*
        ⚠️ Bu dal gerçekten oluyor: `responseType` ayarına göre Google
        bazen `id_token` yerine yalnızca `access_token` döndürüyor.
        `access_token` KİMLİK KANITI DEĞİL — Google API'lerine erişim
        anahtarı. Onu sunucuya gönderip "bu kullanıcı" demek, doğrulaması
        olmayan bir iddia olurdu.
      */
      onError('Google kimlik bilgisi alınamadı.');
      return;
    }

    setGonderiliyor(true);
    apiFetch<{
      user: { id: string; email: string; displayName: string; username?: string };
      accessToken: string;
      refreshToken: string;
      isNewUser: boolean;
    }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    })
      .then(onSuccess)
      .catch((err: unknown) => {
        onError(err instanceof Error ? err.message : 'Google girişi başarısız.');
      })
      .finally(() => setGonderiliyor(false));
  }, [response, onSuccess, onError]);

  /*
    ⚠️ Yapılandırma yoksa düğme HİÇ ÇİZİLMİYOR. Çizip "çalışmıyor"
    dedirtmek, kullanıcıya var olmayan bir yol göstermek olurdu.
    `request` yalnızca en az bir istemci kimliği verilmişse kuruluyor.
  */
  if (request === null) return null;

  const mesgul = gonderiliyor || disabled === true;

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && styles.pressed, mesgul && styles.disabled]}
      onPress={() => void promptAsync()}
      disabled={mesgul}
      accessibilityRole="button"
      accessibilityLabel="Google ile devam et"
    >
      {gonderiliyor ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <View style={styles.icerik}>
          {/*
            ⚠️ Google'ın renkli "G" logosu KULLANILMIYOR. Marka
            kullanımının kendi kuralları var (boyut, boşluk, renk) ve
            indirilen bir görselle onlara uymak kolay değil. Sade metin
            hem güvenli hem de tasarımın paletiyle uyumlu.
          */}
          <Text style={styles.harf}>G</Text>
          <Text style={styles.label}>Google ile devam et</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfacePressed,
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
  icerik: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  harf: { fontFamily: fonts.bold, fontSize: 17, color: colors.accent },
  label: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
});
