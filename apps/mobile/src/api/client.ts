/**
 * api/client.ts — Mobil uygulamanın Backend ile konuşma köprüsü
 * 
 * Bu dosya:
 * 1. Backend sunucusunun adresini (BASE_URL) tutar.
 * 2. Giriş yapınca gelen JWT Access Token'ı hafızada saklar.
 * 3. Sunucuya giden her isteğin başlığına "Authorization: Bearer <token>" ekler.
 * 4. Token'ları kalıcı depoya yazar ve açılışta oturumu geri yükler.
 */

import { clearTokens, loadTokens, saveTokens } from '../lib/storage';

/**
 * Sunucu adresi.
 *
 * ⚠️ TELEFONDA `localhost` ÇALIŞMAZ. `localhost` "bu cihaz" demek —
 * telefon için telefonun kendisi. Tarayıcıda sorun yok (uygulama ve sunucu
 * aynı makinede), ama Expo Go ile telefondan açınca bilgisayarın yerel ağ
 * adresi gerekiyor.
 *
 * Kullanımı: `apps/mobile/.env` dosyası oluştur, içine yaz:
 *
 *     EXPO_PUBLIC_API_URL=http://192.168.1.42:3000
 *
 * IP'yi `ipconfig` (Windows) ile bul — "IPv4 Address" satırı.
 * `EXPO_PUBLIC_` önekli değişkenleri Expo derleme sırasında koda gömüyor.
 *
 * Değişken yoksa `localhost`'a düşüyor, yani tarayıcı akışı bozulmuyor.
 */
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

let currentAccessToken: string | null = null;
let currentRefreshToken: string | null = null;

export type User = {
  id: string;
  email: string;
  displayName: string;
};

export function setAccessToken(token: string | null) {
  currentAccessToken = token;
}

export function getAccessToken(): string | null {
  return currentAccessToken;
}

/**
 * Girişten sonra çağrılır: token'ları hem belleğe hem KALICI depoya yazar.
 *
 * Sadece belleğe yazsaydık sayfa yenilenince kaybolurdu — kullanıcı her
 * seferinde tekrar giriş yapardı.
 */
export async function saveSession(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  currentAccessToken = accessToken;
  currentRefreshToken = refreshToken;
  await saveTokens(accessToken, refreshToken);
}

/** Çıkışta: hem bellekten hem diskten sil. */
export async function clearSession(): Promise<void> {
  currentAccessToken = null;
  currentRefreshToken = null;
  await clearTokens();
}

/**
 * Uygulama açılışında saklanan oturumu geri yükler.
 *
 * ÜÇ ADIMLI, çünkü access token KISA ÖMÜRLÜ (~15 dk):
 *
 *   1. Diskteki access token ile `/me` dene
 *   2. Reddedilirse süresi dolmuştur -> refresh token ile yenile, tekrar dene
 *   3. O da olmazsa oturum gerçekten bitmiştir -> temizle, giriş ekranı
 *
 * İkinci adım olmasaydı kullanıcı 15 dakikada bir giriş yapmak zorunda
 * kalırdı. Refresh token'ın varlık sebebi bu.
 *
 * `null` dönerse giriş ekranı gösterilir.
 */
export async function restoreSession(): Promise<User | null> {
  const { accessToken, refreshToken } = await loadTokens();

  if (!accessToken) return null;

  currentAccessToken = accessToken;
  currentRefreshToken = refreshToken;

  try {
    const me = await apiFetch<{ user: User }>('/me');
    return me.user;
  } catch {
    // Access token süresi dolmuş olabilir. Refresh token yoksa yapacak
    // bir şey yok.
    if (!refreshToken) {
      await clearSession();
      return null;
    }
  }

  try {
    const session = await apiFetch<{
      accessToken: string;
      refreshToken: string;
    }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    await saveSession(session.accessToken, session.refreshToken);

    const me = await apiFetch<{ user: User }>('/me');
    return me.user;
  } catch {
    // Refresh token da geçersiz (süresi dolmuş ya da iptal edilmiş).
    // Oturum gerçekten bitti.
    await clearSession();
    return null;
  }
}

/**
 * Backend'e istek atan merkezi yardımcı fonksiyon
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Eğer giriş yapılmışsa token'ı ekle
  if (currentAccessToken) {
    headers['Authorization'] = `Bearer ${currentAccessToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    let errorMsg = 'Beklenmeyen bir sunucu hatası oluştu.';
    if (typeof data.error === 'string') {
      errorMsg = data.error;
    } else if (data.error && typeof data.error.message === 'string') {
      errorMsg = data.error.message;
    } else if (typeof data.message === 'string') {
      errorMsg = data.message;
    }

    throw new Error(errorMsg);
  }

  return data as T;
}
