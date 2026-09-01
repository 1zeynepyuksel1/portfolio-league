import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import { ResponseType } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { apiFetch } from '../api/client';

/**
 * useGoogleSignIn — Google girişinin DAVRANIŞI, görünümü değil.
 *
 * ⚠️ ÖNCE BİR BİLEŞEN OLARAK YAZILDI VE YANLIŞTI.
 *
 * `GoogleSignInButton` diye kendi düğmesini çizen bir bileşen yazmıştım.
 * Oysa `LoginScreen`'de ZATEN "Google ile devam et" düğmesi vardı —
 * üstelik Google'ın resmî dört renkli G harfiyle ve tasarımın kendi
 * `SecondaryButton`'ıyla. Sonuç: yan yana iki Google düğmesi, biri düz
 * "G" metniyle.
 *
 * ⚠️ DERS: bir özelliği eklemeden önce EKRANDA ZATEN VAR MI diye bakmak.
 * Bu projede aynı hata daha önce de çıktı — `AssetLogo` yazılmıştı ve
 * hiçbir ekranda kullanılmıyordu, `FriendsScreen` çiziliyor sanılıyordu
 * ama erişilemezdi. Kod tabanı "yok" görünen şeyleri saklıyor.
 *
 * Bu yüzden burası artık GÖRÜNÜM ÜRETMİYOR. Var olan düğme
 * `signIn`'i çağırıyor; nasıl göründüğü tasarımın işi.
 *
 * ⚠️ `maybeCompleteAuthSession` MODÜL SEVİYESİNDE. Web'de Google geri
 * döndüğünde açılan pencerenin kapanmasını bu sağlıyor; bileşenin içine
 * koyulursa geç kalır ve pencere açık kalır.
 */
/**
 * Açılır pencereden dönüşü tamamlar — GÜVENLİ SARMALAYICI.
 *
 * ⚠️ ÜÇ AYRI TUZAK VAR VE ÜÇÜ DE YAŞANDI.
 *
 * 1) `skipRedirectCheck` OLMADAN PENCERE KAPANMIYOR.
 *    Kütüphane dönüşte kayıtlı yönlendirme adresiyle o anki adresi
 *    karşılaştırıyor (`ExpoWebBrowser.web.js:63-71`); tutmazsa sessizce
 *    vazgeçiyor, pencere kapanmıyor ve uygulama o pencerede açık kalıyor.
 *    Metro `http://localhost:8081` veriyor, dönüş
 *    `http://localhost:8081/#id_token=...` oluyor — tutmuyor.
 *
 * 2) AMA `skipRedirectCheck` TEK BAŞINA UYGULAMAYI ÇÖKERTTİ.
 *    Erken çıkışı kaldırınca kod şu satıra kadar ilerliyor:
 *
 *        const parent = window.opener ?? window.parent;
 *        parent.postMessage({ ... }, parent.location.toString());
 *
 *    Uygulama BAŞKA BİR KÖKENDEN gelen bir iframe'in içinde çalışıyorsa
 *    (sunum/önizleme sayfası `file://` üzerinden gömüyor) `window.parent`
 *    çapraz kökendir ve `parent.location` okumak `SecurityError` fırlatır.
 *    Bu çağrı modül yüklenirken yapıldığı için uygulama HİÇ AÇILMIYORDU.
 *
 * 3) ÇÖZÜM: YALNIZCA AÇILIR PENCEREDEYKEN ÇAĞIR.
 *    Tamamlanacak bir şey ancak biz AÇILIR PENCEREYSEK var; onu da
 *    `window.opener` söylüyor. Ana pencerede çağrı zaten hiçbir işe
 *    yaramıyordu — yalnızca çökme riski getiriyordu.
 *
 * ⚠️ VE HER ŞEY `try` İÇİNDE. Bu bir yardımcı; başarısızlığı uygulamanın
 * açılmasını engelleyemez. `window.opener`'a erişmek bile bazı
 * tarayıcı politikalarında fırlatabiliyor.
 */
function completeAuthSessionSafely(): void {
  if (Platform.OS !== 'web') {
    // Native tarafta iframe/opener kavramı yok; kütüphane kendi işini yapıyor.
    WebBrowser.maybeCompleteAuthSession();
    return;
  }

  try {
    if (typeof window === 'undefined') return;
    // Açılır pencere değilsek tamamlanacak bir oturum yok.
    if (!window.opener) return;

    WebBrowser.maybeCompleteAuthSession({ skipRedirectCheck: true });
  } catch {
    /*
      Sessizce yutuluyor — ve bu bilinçli. Buraya düşmek "dönüş
      tamamlanamadı" demek; kullanıcı pencereyi kapatıp tekrar dener.
      Alternatif, uygulamanın hiç açılmaması.
    */
  }
}

completeAuthSessionSafely();

export type GoogleSession = {
  user: { id: string; email: string; displayName: string; username?: string };
  accessToken: string;
  refreshToken: string;
  isNewUser: boolean;
};

type Options = {
  onSuccess: (session: GoogleSession) => void | Promise<void>;
  onError: (message: string) => void;
};

export function useGoogleSignIn({ onSuccess, onError }: Options) {
  const [busy, setBusy] = useState(false);

  /*
    ⚠️ CALLBACK'LER `ref`'TE TUTULUYOR — VE BU BİR HATAYI ÖNLÜYOR.

    Aşağıdaki efekt `response` değiştiğinde çalışmalı. `onSuccess` /
    `onError`'ı bağımlılık dizisine koysaydık, ekran her render olduğunda
    yeni bir fonksiyon üretileceği için efekt TEKRAR çalışır ve aynı
    jeton sunucuya birden fazla kez gönderilirdi.

    Diziden çıkarıp `ref`'e almak, efekti yalnızca `response`'a bağlı
    tutuyor ama yine de en güncel callback'i çağırıyor.
  */
  const cb = useRef({ onSuccess, onError });
  cb.current = { onSuccess, onError };

  /*
    ⚠️ ÜÇ AYRI İSTEMCİ KİMLİĞİ — GOOGLE'IN KURALI, BİZİM TERCİHİMİZ DEĞİL.
    Google aynı uygulamanın Android / iOS / web sürümlerine ayrı kimlik
    veriyor. Sunucu da bu yüzden `GOOGLE_CLIENT_IDS`'i virgüllü liste
    olarak okuyor: gelen jetonun `aud`'u hangi platformdan geldiyse o olur.

    ⚠️ `EXPO_PUBLIC_` ÖNEKİ BURADA GÜVENLİ — ama yalnızca burada.
    İstemci kimliği zaten gizli değil; Google'ın giriş ekranında herkese
    görünüyor. Gizli olan `client_secret` ve bu akış onu hiç kullanmıyor.
    Aynı öneki bir API anahtarına koymak felaket olurdu: `EXPO_PUBLIC_*`
    pakete gömülüyor ve paketi açan herkes okuyabiliyor.
  */
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,

    /*
      ⚠️ WEB'DE BU SATIR OLMADAN `id_token` HİÇ GELMİYOR — VE HATA
      "Google kimlik bilgisi alınamadı" DİYE GÖRÜNÜYOR.

      `expo-auth-session`'ın Google sağlayıcısı varsayılanı platforma göre
      seçiyor (`providers/Google.js`):

          const isInstalledApp = Platform.OS !== 'web';
          if (config.clientSecret || isInstalledApp) return ResponseType.Code;
          return ResponseType.Token;      // <- web

      Yani web'de Google yalnızca `access_token` döndürüyor. `access_token`
      KİMLİK KANITI DEĞİL — Google API'lerine erişim anahtarı; içinde
      "bu kullanıcı kim" bilgisi yok ve sunucu onu doğrulayamaz.
      Bize gereken `id_token`: Google'ın İMZALADIĞI, `sub`/`email`/`aud`
      taşıyan jeton.

      ⚠️ NATIVE'DE DEĞİŞTİRİLMİYOR. Orada varsayılan `Code` ve paket kodu
      otomatik takas yapıp `authentication.idToken`'ı zaten dolduruyor.
      `IdToken`'ı her platforma zorlasaydık native'de örtük akışa
      düşerdik — Google'ın kurulu uygulamalar için önermediği yol.

      ⚠️ `nonce` ELLE ÜRETİLMİYOR: sağlayıcı `IdToken` seçildiğinde
      kendisi ekliyor (Google.js:66). Kendimiz eklersek onunkiyle çakışır.
    */
    ...(Platform.OS === 'web' ? { responseType: ResponseType.IdToken } : null),
  });

  useEffect(() => {
    if (response === null) return;

    if (response.type === 'error') {
      cb.current.onError('Google girişi tamamlanamadı.');
      setBusy(false);
      return;
    }

    /*
      ⚠️ 'dismiss' ve 'cancel' HATA DEĞİL. Kullanıcı vazgeçmiş olabilir;
      ona hata göstermek "bir şeyler bozuldu" hissi verir.
    */
    if (response.type !== 'success') {
      setBusy(false);
      return;
    }

    const idToken = response.authentication?.idToken ?? response.params?.id_token;

    if (typeof idToken !== 'string' || idToken === '') {
      /*
        ⚠️ Bu dal gerçekten oluyor: ayarlara göre Google bazen `id_token`
        yerine yalnızca `access_token` döndürüyor. `access_token` KİMLİK
        KANITI DEĞİL — Google API'lerine erişim anahtarı. Onu sunucuya
        gönderip "bu kullanıcı" demek, doğrulaması olmayan bir iddia olurdu.
      */
      cb.current.onError('Google kimlik bilgisi alınamadı.');
      setBusy(false);
      return;
    }

    setBusy(true);
    apiFetch<GoogleSession>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    })
      .then((session) => cb.current.onSuccess(session))
      .catch((err: unknown) => {
        cb.current.onError(
          err instanceof Error ? err.message : 'Google girişi başarısız.',
        );
      })
      .finally(() => setBusy(false));
  }, [response]);

  const signIn = useCallback(() => {
    setBusy(true);
    /*
      ⚠️ AÇILIR PENCEREYE AÇIK ÖLÇÜ VERİLİYOR.

      Ölçüsüz bırakılınca tarayıcı `window.open`'ı yeni bir SEKME olarak
      açabiliyor; sekme kullanıcıya "başka bir sayfaya gittim" hissi
      veriyor ve geri dönüşü kaybettiriyor. Ölçülü pencere üstte küçük
      bir kutu olarak açılıyor, iş bitince kapanıp asıl ekrana dönüyor.

      Değerler Google'ın giriş ekranının sığdığı en küçük boyut.
    */
    void promptAsync({
      windowFeatures: { width: 480, height: 640 },
    }).finally(() => {
      /*
        ⚠️ `promptAsync` çözülünce iş BİTMİYOR — sonuç `response` ile
        geliyor ve yukarıdaki efekt onu işliyor. Burada `busy`'yi
        kapatmıyoruz; kapatsaydık düğme bir an aktifleşir, kullanıcı
        ikinci kez basabilirdi.

        Yalnızca `response` hiç gelmezse (pencere kapandı) efekt
        `busy`'yi kapatıyor.
      */
    });
  }, [promptAsync]);

  return {
    /**
     * Google girişi kullanılabilir mi.
     *
     * ⚠️ `request === null` = hiçbir istemci kimliği yapılandırılmamış.
     * Ekran buna bakıp düğmeye ne yaptıracağına karar veriyor.
     */
    available: request !== null,
    busy,
    signIn,
  };
}
