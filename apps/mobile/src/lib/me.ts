import { apiFetch, onLogout } from '../api/client';

/**
 * me.ts — "ben kimim" bilgisi, TEK YERDEN ve önbellekli.
 *
 * ⚠️ NEDEN MODÜL SEVİYESİNDE ÖNBELLEK:
 *
 * Yönetici seçenekleri akıştaki HER gönderi kartında çiziliyor. Her kart
 * kendi `/users/me` isteğini atsaydı tek bir akış açılışı düzinelerce
 * özdeş istek üretirdi.
 *
 * ⚠️ SÜREN İSTEK PAYLAŞILIYOR (`bekleyen`). Yalnızca önbellek olsaydı,
 * aynı anda render olan on kart önbellek dolmadan on ayrı istek
 * başlatırdı. "Önbellek var" demek "yarış yok" demek değil.
 *
 * ⚠️ ÇIKIŞTA TEMİZLENMEK ZORUNDA. Kullanıcı çıkıp başka bir hesapla
 * girerse önbellek eski rolü taşırdı; yönetici çıkıp normal kullanıcı
 * girdiğinde arayüz yönetici seçeneklerini göstermeye devam ederdi.
 * Sunucu yine 403 döndüğü için güvenlik açığı değil, ama kafa karıştıran
 * bir hata. `clearMe()` `clearSession` ile birlikte çağrılıyor.
 */

type Me = { username: string; role: string } | null;

let onbellek: Me | undefined;
let bekleyen: Promise<Me> | null = null;

export async function getMe(): Promise<Me> {
  if (onbellek !== undefined) return onbellek;
  if (bekleyen !== null) return bekleyen;

  bekleyen = apiFetch<{ profile: { username: string; role?: string } }>('/users/me')
    .then((res) => {
      onbellek = {
        username: res.profile.username,
        // ⚠️ Sunucu `role`'ü yalnızca kendi profilinde gönderiyor;
        // eksikse en dar yetkiyi varsay.
        role: res.profile.role ?? 'user',
      };
      return onbellek;
    })
    .catch(() => {
      /*
        ⚠️ HATA ÖNBELLEĞE YAZILMIYOR. Yazsaydık geçici bir ağ hatası
        "yönetici değil"i kalıcı hâle getirir ve uygulama kapanana kadar
        seçenekler görünmezdi.
      */
      return null;
    })
    .finally(() => {
      bekleyen = null;
    });

  return bekleyen;
}

/** Çıkışta çağrılıyor — bir sonraki kullanıcı öncekinin rolünü görmesin. */
export function clearMe(): void {
  onbellek = undefined;
  bekleyen = null;
}

/*
  ⚠️ KAYIT MODÜL YÜKLENİRKEN YAPILIYOR, ÇAĞRI ANINDA DEĞİL.

  `client.ts` bu dosyayı import ETMİYOR — etseydi dairesel bağımlılık
  olurdu. Bunun yerine bu dosya kendini oraya kaydediyor. Bu modül hiç
  yüklenmezse temizlenecek bir önbellek de yok, yani kural kendiliğinden
  doğru.
*/
onLogout(clearMe);
