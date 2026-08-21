import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * storage.ts — token'ları kalıcı saklamak.
 *
 * NEDEN GEREKLİ: token'lar sadece bellekte tutulursa (`let token = ...`)
 * sayfa yenilenince ya da uygulama kapanınca kaybolur ve kullanıcı her
 * seferinde tekrar giriş yapar.
 *
 * Faz 1'in bitiş kriteri bunu doğrudan istiyor:
 *   "...uygulamayı kapat aç -> duruyor" (docs/02-gorev-paylasimi.md)
 *
 * NEDEN İKİ FARKLI DEPO:
 * `expo-secure-store` işletim sisteminin şifreli kasasını kullanıyor —
 * iOS Keychain, Android Keystore. Ama TARAYICIDA çalışmıyor.
 *
 * Tarayıcı için `localStorage` kullanıyoruz. Düz metin, yani daha zayıf —
 * ama tarayıcıda zaten OS kasası yok. Geliştirme ortamı için kabul
 * edilebilir; gerçek dağıtım telefonda olacak.
 *
 * ⚠️ `AsyncStorage` kullanmıyoruz: telefonda da düz metin dosyaya yazıyor.
 * Token bir kimlik bilgisi — telefona erişen biri hesabı ele geçirir.
 */

const ACCESS_KEY = 'pl_access_token';
const REFRESH_KEY = 'pl_refresh_token';

const isWeb = Platform.OS === 'web';

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function removeItem(key: string): Promise<void> {
  if (isWeb) {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function saveTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await setItem(ACCESS_KEY, accessToken);
  await setItem(REFRESH_KEY, refreshToken);
}

export async function loadTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  // Paralel oku — iki ayrı disk erişimi, birbirini beklemesine gerek yok.
  const [accessToken, refreshToken] = await Promise.all([
    getItem(ACCESS_KEY),
    getItem(REFRESH_KEY),
  ]);

  return { accessToken, refreshToken };
}

export async function clearTokens(): Promise<void> {
  await Promise.all([removeItem(ACCESS_KEY), removeItem(REFRESH_KEY)]);
}
