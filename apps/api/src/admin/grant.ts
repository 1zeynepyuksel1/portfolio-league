import { setUserRole } from './service.js';

/**
 * grant.ts — yönetici atama betiği.
 *
 * ⚠️ NEDEN BETİK, NEDEN UÇ DEĞİL:
 *
 * "Yönetici ata" ucu açsaydık, ele geçirilen tek bir yönetici hesabı
 * kendine kalıcı arka kapılar açabilirdi — ve ilk yöneticiyi kim
 * atayacak sorusunun cevabı yine bir betik olurdu (tavuk-yumurta).
 *
 * Yönetici atamak yılda birkaç kez yapılan bir iş; nadir bir işlem için
 * sürekli açık duran bir kapı bırakmak kötü bir takas.
 *
 * ⚠️ BU BETİĞİ ÇALIŞTIRABİLEN KİŞİ SUNUCUYA ZATEN ERİŞEBİLİYOR demektir;
 * yani yeni bir yetki vermiyor, var olanı kullanışlı hâle getiriyor.
 *
 * Kullanım:
 *   npx tsx src/admin/grant.ts <kullaniciAdi> [admin|user]
 */

const [, , username, role = 'admin'] = process.argv;

if (username === undefined) {
  console.error('Kullanım: npx tsx src/admin/grant.ts <kullaniciAdi> [admin|user]');
  process.exit(1);
}

if (role !== 'admin' && role !== 'user') {
  console.error("Rol yalnızca 'admin' ya da 'user' olabilir.");
  process.exit(1);
}

try {
  const updated = await setUserRole(username, role);
  console.log(`@${updated.username} -> ${updated.role}`);
  process.exit(0);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
