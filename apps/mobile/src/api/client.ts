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
  /**
   * Profil ekranının adresi.
   *
   * ⚠️ `?` İŞARETLİ: kullanıcı adı 0008 migration'ıyla zorunlu oldu
   * ama eski bir token'la gelen yanıtta olmayabilir. Zorunlu yapsaydık
   * tip yalan söylerdi ve `undefined` bir URL'e girerdi.
   */
  username?: string;
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

/**
 * Oturum düştüğünde çağrılacak geri çağrı — App.tsx kaydediyor.
 *
 * ⚠️ NEDEN GEREKLİ: `client.ts` React'i tanımıyor, ekran state'ine
 * erişemiyor. Token ölünce depoyu temizlemek YETMİYOR — uygulama hâlâ
 * "giriş yapılmış" ekranını çiziyor ve her istek patlıyor. Kullanıcı
 * çıkmaz sokakta kalıyor, çıkış tuşu bile yok.
 *
 * Bu geri çağrı köprü: veri katmanı "oturum bitti" diyor, App karar
 * veriyor (giriş ekranına dön).
 */
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

/**
 * Aynı anda birden çok istek 401 alırsa TEK yenileme yapılsın.
 *
 * ⚠️ Bu olmadan: ekran açılışında 4 istek paralel gider, dördü de 401
 * alır, dördü de yenileme ister. İlki refresh token'ı tüketir, kalan üçü
 * ARTIK GEÇERSİZ token'la yenilemeye çalışır ve oturumu düşürür.
 * Kullanıcı sebepsiz yere çıkışa atılır.
 *
 * Devam eden bir yenileme varsa diğerleri onu bekliyor.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight !== null) return refreshInFlight;

  refreshInFlight = (async () => {
    if (currentRefreshToken === null) return false;

    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: currentRefreshToken }),
      });

      if (!response.ok) return false;

      const session = (await response.json()) as {
        accessToken?: string;
        refreshToken?: string;
      };

      if (!session.accessToken || !session.refreshToken) return false;

      await saveSession(session.accessToken, session.refreshToken);
      return true;
    } catch {
      // Ağ hatası yenileme başarısızlığı SAYILMAZ diye düşünülebilir ama
      // burada ayıramıyoruz; false dönüp çağıranın oturumu düşürmesi,
      // kullanıcıyı sonsuza kadar bozuk ekranda tutmaktan iyi.
      return false;
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
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
  /**
   * İç kullanım: bu çağrı zaten bir yenileme sonrası tekrar mı?
   *
   * ⚠️ SONSUZ DÖNGÜ KORUMASI. Yenileme başarılı görünüp yeni token da
   * 401 alırsa, bayrak olmadan sonsuza kadar yenile-tekrarla dönerdik.
   * Bir tekrar hakkı var, o kadar.
   */
  isRetry = false,
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

  /**
   * ⚠️ 401 BURADA KESİLİYOR — eskiden düz bir hata gibi geçiyordu.
   *
   * Erişim token'ı 15 dakikada ölüyor (JWT_ACCESS_TTL_SECONDS=900).
   * `restoreSession` yalnızca AÇILIŞTA yeniliyor; uygulama açıkken token
   * ölünce devreye giren hiçbir şey yoktu. Sonuç: kabuk "giriş yapılmış"
   * sanıyor, her istek "Access token gereklidir" diyor, çıkış tuşu bile
   * olmadığı için kullanıcı kilitleniyordu.
   *
   * Şimdi iki adım:
   *   1. Yenilemeyi dene, isteği bir kez tekrarla — kullanıcı fark etmesin
   *   2. Yenileme de olmuyorsa oturumu KAPAT ve App'e haber ver
   *
   * İkinci adım şart: sessizce başarısız olmak, kullanıcıyı bozuk bir
   * ekranda bırakmak demek.
   */
  if (response.status === 401 && !isRetry && !endpoint.startsWith('/auth/')) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      return apiFetch<T>(endpoint, options, true);
    }

    await clearSession();
    onSessionExpired?.();

    throw new Error('Oturumun sona erdi, lütfen tekrar giriş yap.');
  }

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
