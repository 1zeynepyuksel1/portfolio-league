import { divRound, PRICE_SCALE } from "./money.js";
import type { Price } from "./money.js";

/** 1e8 — fiyat ölçeğindeki "bir" değeri. */
const PRICE_ONE = 10n ** BigInt(PRICE_SCALE);

/**
 * USD cinsinden bir fiyatı TL'ye çevirir.
 *
 * ÖLÇEK MATEMATİĞİ — buradaki hatanın tehlikesi sonucun makul görünmesidir:
 *
 *   usd  (1e8 ölçekli)  ×  rate (1e8 ölçekli)  =  ara sonuç (1e16 ölçekli)
 *
 * Sonuç yine bir fiyat, yani 1e8 ölçekli olmalı. Fazla gelen 1e8'i bölerek
 * atıyoruz — ve bu bölme mutlaka divRound'dan geçiyor, çünkü bigint bölmesi
 * kırpar ve her kırpma kullanıcı aleyhine kuruş eritir.
 *
 * Örnek: 100 USD, kur 40 -> 4000 TL
 *   10000000000n × 4000000000n = 40000000000000000000n   (1e16 ölçekli)
 *   ÷ 100000000n              = 400000000000n            (1e8 ölçekli = 4000)
 *
 * NOT: Kur her zaman TCMB'den gelir, borsadan değil. Binance'in TRY paritesi
 * yalnızca 20 Aralık 2019'a kadar gidiyor; USDT paritesi 2017'ye. Bu yüzden
 * fiyat USD çekilip burada TL'ye çevriliyor.
 * (bkz. docs/00-veri-saglayici-dogrulama.md §1)
 */
export function usdToTry(usd: Price, usdTryRate: Price): Price {
  return divRound(usd * usdTryRate, PRICE_ONE) as Price;
}
