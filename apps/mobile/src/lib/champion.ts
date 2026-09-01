import { apiFetch } from '../api/client';

/**
 * champion.ts — son kapanan ligin şampiyonu, TEK YERDEN.
 *
 * ⚠️ NEDEN MODÜL SEVİYESİNDE ÖNBELLEK, HER EKRANDA `useEffect` DEĞİL:
 *
 * Taç üç yerde çiziliyor (profil, sıralama, gönderi kartı) ve gönderi
 * kartı akışta onlarca kez render ediliyor. Her bileşen kendi isteğini
 * atsaydı tek bir akış açılışı düzinelerce `GET /leagues/champion`
 * üretirdi — hepsi aynı cevabı almak için.
 *
 * ⚠️ SÜREN İSTEK PAYLAŞILIYOR (`bekleyen`). Bunu yapmasaydık aynı anda
 * render olan on kart, önbellek daha dolmadan on ayrı istek başlatırdı;
 * "önbellek var" demek "yarış yok" demek değil.
 *
 * ⚠️ ŞAMPİYON GÜN İÇİNDE DEĞİŞMEZ — lig haftalık. O yüzden süre sınırı
 * yok; uygulama yeniden açılınca zaten sıfırlanıyor. Lig kapanışı tam
 * uygulama açıkken olursa taç bir sonraki açılışta görünür. Kabul
 * edilen bir gecikme, hata değil.
 */

type Champion = { username: string; periodName: string } | null;

let onbellek: Champion | undefined;
let bekleyen: Promise<Champion> | null = null;

export async function getChampion(): Promise<Champion> {
  if (onbellek !== undefined) return onbellek;
  if (bekleyen !== null) return bekleyen;

  bekleyen = apiFetch<{ champion: Champion }>('/leagues/champion')
    .then((res) => {
      onbellek = res.champion ?? null;
      return onbellek;
    })
    .catch(() => {
      /*
        ⚠️ HATA `null` OLUYOR VE ÖNBELLEĞE YAZILMIYOR.

        Yazsaydık, geçici bir ağ hatası "şampiyon yok"u kalıcı hâle
        getirirdi ve taç uygulama kapanana kadar hiç görünmezdi. Taç bir
        süs; başarısızlığı sessiz olmalı ama KALICI olmamalı.
      */
      return null;
    })
    .finally(() => {
      bekleyen = null;
    });

  return bekleyen;
}

/** Bu kullanıcı son ligin şampiyonu mu. */
export function isChampion(champion: Champion, username?: string | null): boolean {
  if (champion === null || !username) return false;
  return champion.username === username;
}
