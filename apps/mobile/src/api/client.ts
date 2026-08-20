/**
 * api/client.ts — Mobil uygulamanın Backend ile konuşma köprüsü
 * 
 * Bu dosya:
 * 1. Backend sunucusunun yerel geliştirme adresini (http://localhost:3000) tutar.
 * 2. Giriş yapınca gelen JWT Access Token'ı hafızada saklar.
 * 3. Sunucuya giden her isteğin başlığına "Authorization: Bearer <token>" ekler.
 */

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

let currentAccessToken: string | null = null;

export function setAccessToken(token: string | null) {
  currentAccessToken = token;
}

export function getAccessToken(): string | null {
  return currentAccessToken;
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
