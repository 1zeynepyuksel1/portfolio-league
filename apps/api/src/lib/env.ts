/**
 * env.ts — `.env` dosyasını ÇALIŞMA DİZİNİNDEN BAĞIMSIZ yükler.
 *
 * ⚠️ BU DOSYA BİR HATA AYIKLAMA OTURUMUNUN BEDELİYDİ.
 *
 * Önceden her giriş noktası `import 'dotenv/config'` yazıyordu. O modül
 * `.env`'i **çalışma dizinine göre** arıyor (`process.cwd()`), dosyanın
 * kendi konumuna göre değil. `.env` repo kökünde duruyor, dolayısıyla:
 *
 *     npx tsx apps/api/src/server.ts   (kökten)      -> .env bulunur   ✅
 *     npm run dev:api                  (apps/api'den) -> BULUNMAZ      ❌
 *
 * İkincisi sessizce başarısız oluyordu: sunucu açılıyor, `/assets`
 * çalışıyor (db/client.ts'te bağlantı adresinin yedeği var), ama kayıt ve
 * giriş 500 veriyordu — çünkü `JWT_ACCESS_SECRET` hiç yüklenmemişti.
 *
 * "Bir uç çalışıyor, diğeri çalışmıyor" tablosu bu yüzden çıktı ve
 * gerçek sebebi bulmak uzun sürdü.
 *
 * ÇÖZÜM: yolu `import.meta.url`'den türetiyoruz — yani BU DOSYANIN
 * konumundan. Nereden çalıştırılırsa çalıştırılsın aynı `.env` bulunur.
 *
 * KULLANIM: her giriş noktasının EN ÜST satırı olmalı:
 *
 *     import './lib/env.js';   // (yol dosyaya göre değişir)
 *
 * ⚠️ EN ÜSTTE OLMASI ŞART. ES modüllerinde `import`'lar yukarıdan aşağı
 * çalışır; `process.env`'i okuyan bir modül bundan önce yüklenirse
 * değişkeni boş görür. Sıra burada bir üslup tercihi değil, doğruluk
 * meselesi.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

// import.meta.url -> "file:///C:/.../apps/api/src/lib/env.ts"
// fileURLToPath onu normal bir dosya yoluna çevirir. Doğrudan
// `import.meta.url`'i path'e verirsek Windows'ta "file:///C:" kısmı
// yol sanılır ve bozulur.
const thisDir = path.dirname(fileURLToPath(import.meta.url));

// apps/api/src/lib -> apps/api/src -> apps/api -> apps -> repo kökü
const repoRoot = path.resolve(thisDir, '../../../..');

export const ENV_PATH = path.join(repoRoot, '.env');

config({ path: ENV_PATH });

/**
 * Zorunlu bir değişkeni okur, yoksa AÇIKÇA patlar.
 *
 * NEDEN YEDEK DEĞER YOK: `process.env.X ?? 'varsayilan'` yazmak, ayar
 * eksikken uygulamanın çalışmaya devam etmesi demek. Veritabanı adresinde
 * bu yalnızca can sıkıcı; bir JWT gizli anahtarında güvenlik açığı.
 * Eksik ayar, açılışta yüksek sesle başarısız olmalı.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value === '') {
    throw new Error(
      `${name} tanımlı değil. Beklenen konum: ${ENV_PATH}`,
    );
  }

  return value;
}
