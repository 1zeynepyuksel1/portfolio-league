/**
 * prepare-logos.mjs — indirilen para birimi simgelerini arayüze uygun
 * hâle getirir. ELLE ÇALIŞTIRILAN, TEKRAR EDİLEBİLİR BETİK.
 *
 *     node apps/mobile/scripts/prepare-logos.mjs           (sadece raporlar)
 *     node apps/mobile/scripts/prepare-logos.mjs --apply   (yazar)
 *
 * ⚠️ NEDEN GEREKLİ — İNDİRİLEN DOSYALAR OLDUĞU GİBİ KULLANILAMAZ.
 *
 * İnternetten indirilen simgelerin neredeyse hepsi BEYAZ ZEMİNDE SİYAH
 * çizim. Uygulamanın zemini ise #0F0F10. İki sonuç birden çıkıyor:
 *
 *   1. Saydamlık olmadığı için dairenin içi beyaz bir kare oluyor
 *   2. Siyah simge koyu arayüzde zaten okunmuyor
 *
 * Betik ikisini de çözüyor: açık pikselleri saydam yapıyor, koyu
 * pikselleri arayüzün metin rengine boyuyor.
 *
 * ⚠️ NEDEN ELLE DEĞİL BETİKLE: aynı işi Photoshop'ta yapmak da mümkün ama
 * bir daha logo eklendiğinde adımlar hatırlanmaz. Betik hem tekrarlanabilir
 * hem de EŞİKLERİ kodda görünür kılıyor.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';

const here = path.dirname(fileURLToPath(import.meta.url));
const LOGO_DIR = path.join(here, '..', 'assets', 'logos');

/** Arayüzün parlak metin rengi — theme.ts'teki `inkBright`. */
const INK = { r: 0xe9, g: 0xe9, b: 0xea };

/**
 * ⚠️ EŞİKLER — bu iki sayı işin tamamı.
 *
 * `WHITE_CUTOFF`: bundan AÇIK pikseller zemin sayılıp saydam yapılıyor.
 * 230 seçildi çünkü indirilen görsellerin bir kısmında zemin tam beyaz
 * değil, hafif gri bir degrade (istockphoto'nun £ görseli böyle). 250
 * deseydik o degrade kalır ve daire kirli görünürdü.
 *
 * `INK_CUTOFF`: bundan KOYU pikseller çizim sayılıp boyanıyor. Aradaki
 * bant (130-230) kenar yumuşatma pikselleri — onlara koyuluğuna göre
 * kısmi saydamlık veriliyor, yoksa harfin kenarları testere dişi olur.
 */
const WHITE_CUTOFF = 230;
const INK_CUTOFF = 130;

/** Bir dosyayı RGBA piksel dizisine çevirir. */
function decode(file) {
  const buffer = readFileSync(file);

  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) {
    // ⚠️ JPEG'in alfa kanalı YOKTUR — biçim gereği. O yüzden bu dosyalar
    // dönüştürülmeden asla saydam olamaz; betik onları PNG'ye çeviriyor.
    const raw = jpeg.decode(buffer, { useTArray: true });
    return { width: raw.width, height: raw.height, data: raw.data };
  }

  const png = PNG.sync.read(buffer);
  return { width: png.width, height: png.height, data: png.data };
}

/**
 * Zemini saydamlaştırır, çizimi boyar ve içeriğe göre kırpar.
 *
 * ⚠️ ADI `toBadge`, `process` DEĞİL. `function process(...)` yazmıştım ve
 * bu Node'un global `process` nesnesini gölgeliyor — aşağıdaki
 * `process.argv.includes('--apply')` satırı sessizce çöker. Fonksiyon
 * bildirimleri yukarı taşındığı için hata dosyanın başında değil,
 * kullanıldığı yerde patlar.
 *
 * ⚠️ KIRPMA NEDEN VAR: indirilen görsellerin kenar boşlukları çok
 * farklı. Kırpmasak bazı simgeler dairenin ortasında minicik, bazıları
 * kenarlara dayanmış görünürdü. Kırpıp eşit boşlukla kareye oturtmak
 * hepsini aynı görsel ağırlığa getiriyor.
 */
function toBadge({ width, height, data }) {
  const out = Buffer.alloc(width * height * 4);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Kaynak zaten saydamsa olduğu gibi bırakılıyor.
      const luma = (r * 299 + g * 587 + b * 114) / 1000;

      let alpha;

      if (a < 8) {
        alpha = 0;
      } else if (luma >= WHITE_CUTOFF) {
        alpha = 0;
      } else if (luma <= INK_CUTOFF) {
        alpha = 255;
      } else {
        // Ara bant: açıldıkça saydamlaşıyor -> yumuşak kenar.
        alpha = Math.round(
          255 * (1 - (luma - INK_CUTOFF) / (WHITE_CUTOFF - INK_CUTOFF)),
        );
      }

      out[i] = INK.r;
      out[i + 1] = INK.g;
      out[i + 2] = INK.b;
      out[i + 3] = alpha;

      if (alpha > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null; // tamamen boş

  const contentW = maxX - minX + 1;
  const contentH = maxY - minY + 1;

  // Kare tuval + %12 boşluk. Daireye kırpılacağı için köşelere dayanan
  // içerik kesilir; boşluk onu önlüyor.
  const side = Math.round(Math.max(contentW, contentH) * 1.24);
  const canvas = new PNG({ width: side, height: side });

  canvas.data.fill(0);

  const offsetX = Math.round((side - contentW) / 2);
  const offsetY = Math.round((side - contentH) / 2);

  for (let y = 0; y < contentH; y++) {
    for (let x = 0; x < contentW; x++) {
      const src = ((minY + y) * width + (minX + x)) * 4;
      const dst = ((offsetY + y) * side + (offsetX + x)) * 4;

      canvas.data[dst] = out[src];
      canvas.data[dst + 1] = out[src + 1];
      canvas.data[dst + 2] = out[src + 2];
      canvas.data[dst + 3] = out[src + 3];
    }
  }

  return canvas;
}

const apply = process.argv.includes('--apply');

const files = readdirSync(LOGO_DIR).filter(
  (f) => /\.(png|jpe?g)$/i.test(f) && !f.startsWith('.'),
);

for (const file of files) {
  const full = path.join(LOGO_DIR, file);
  const target = path.join(LOGO_DIR, file.replace(/\.(png|jpe?g)$/i, '.png'));

  const decoded = decode(full);
  const result = toBadge(decoded);

  if (result === null) {
    console.log(`${file.padEnd(10)} BOŞ — atlandı`);
    continue;
  }

  console.log(
    `${file.padEnd(10)} ${decoded.width}x${decoded.height} -> ` +
      `${result.width}x${result.height} saydam`,
  );

  if (apply) {
    writeFileSync(target, PNG.sync.write(result));
    // JPEG kaynağı PNG'ye çevrildiyse eskisi artık gereksiz.
    if (target !== full) {
      const { unlinkSync } = await import('node:fs');
      unlinkSync(full);
    }
  }
}

if (!apply) {
  console.log('\nYazmak için: node apps/mobile/scripts/prepare-logos.mjs --apply');
}
