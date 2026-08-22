// Metro (React Native paketleyicisi) — MONOREPO AYARI
//
// NEDEN BU DOSYA GEREKLİ:
// npm workspaces paketleri repo KÖKÜNDEKİ node_modules'e taşıyor ("hoisting").
// Metro varsayılan olarak yalnızca kendi klasörüne bakıyor, kökü görmüyor.
// Sonuç: "Unable to resolve module ..." hataları.
//
// Bu dosya Metro'ya iki şey söylüyor:
//   1. Repo kökünü de izle (kod orada da olabilir — packages/contracts gibi)
//   2. Paketleri ararken hem mobil hem kök node_modules'e bak
//
// ⚠️ `entryPoint` app.json'da açıkça belirtiliyor. Belirtilmezse Expo
// `node_modules/expo/AppEntry.js`'e düşüyor; o dosya `../../App` diye
// göreli bir import yapıyor ve hoist edilmiş konumdan bakınca repo kökünü
// işaret ediyor — App.tsx ise apps/mobile içinde. Bizim yaşadığımız hata buydu.

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Kökü de izle
config.watchFolders = [workspaceRoot];

// 2. İki node_modules klasörünü de tara — önce yerel, sonra kök
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Yukarı doğru otomatik arama kapalı: yalnızca yukarıdaki iki yol
// kullanılsın. Açık kalırsa aynı paketin iki kopyası yüklenebilir ve
// React gibi kütüphanelerde "invalid hook call" tarzı sinsi hatalar çıkar.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
