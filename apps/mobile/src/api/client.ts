import Constants from 'expo-constants';
import { clearTokens, loadTokens, saveTokens } from '../lib/storage';

/**
 * api/client.ts — Mobil uygulamanın Backend ile konuşma köprüsü
 * 
 * Bu dosya:
 * 1. Hem Bilgisayar Web Tarayıcısında (localhost) hem de Gerçek Telefonda (Expo Go / IP) sorunsuz çalışır.
 * 2. Giriş yapınca gelen JWT Access Token'ı hafızada saklar.
 * 3. Sunucuya giden her isteğin başlığına "Authorization: Bearer <token>" ekler.
 * 4. Token'ları kalıcı depoya yazar ve açılışta oturumu geri yükler.
 */

// Expo Go telefonda çalışırken bilgisayarınızın yerel IP'sini (192.168.x.x) otomatik algılar
const debuggerHost = Constants.expoConfig?.hostUri;
const hostIp = debuggerHost ? debuggerHost.split(':')[0] : 'localhost';

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? `http://${hostIp}:3000`;

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
