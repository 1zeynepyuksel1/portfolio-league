/**
 * indicators.ts — yatırımcı davranış göstergeleri.
 *
 * ⚠️ BU DOSYA VERİTABANINA DOKUNMAZ. Düz veri alır, düz sonuç döner.
 * Sebebi tek: yedi göstergenin de matematiği Docker kapalıyken
 * test edilebilmeli. Sorgular `repository.ts`'te, karar burada.
 *
 * ⚠️ VE EN ÖNEMLİSİ — BURASI ÖLÇÜYOR, YAPAY ZEKÂ ANLATIYOR.
 *
 * Her sayı burada, kesin aritmetikle hesaplanıyor. Modele "sence bu kötü
 * bir alışkanlık mı" diye sormuyoruz; sorsaydık uydurur ve fark
 * edemezdik. Model yalnızca buradan çıkan ölçümleri okunur bir anlatıya
 * çeviriyor.
 *
 * Bu ayrım olmadan özellik bir kehanet makinesine dönerdi.
 */

import { divRound, subPenny, type Amount, type Penny } from '../lib/money.js';
import {
  applyBuy,
  applySell,
  type CostBasis,
} from '../portfolio/cost-basis.js';

// ---------------------------------------------------------------------------
// ORTAK TİPLER
// ---------------------------------------------------------------------------

/** Bir göstergenin ihtiyaç duyduğu emir bilgisi. */
export interface BehaviorOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  /** Emrin geçtiği an. */
  executedAt: Date;
  /** İşlem fiyatı, PRICE_SCALE ölçekli. */
  priceTry: bigint;
  /** Alışta ödenen / satışta ele geçen, komisyon dahil. */
  netCents: Penny;
  /** Yalnızca komisyon. */
  feeCents: Penny;
  /** Miktar, AMOUNT_SCALE ölçekli. */
  quantity: Amount;
}

/**
 * Bir davranış bulgusu.
 *
 * ⚠️ `orderIds` ZORUNLU — VE BU BİR GÜVENLİK ÖNLEMİ.
 *
 * Her bulgu gerçek emirlere bağlı. Ekranda "hangi işlemler" diye
 * dokunulabiliyor, ve modele giden veride de bu kimlikler var. Bağlanamayan
 * bir iddia varsa o iddia uydurmadır — kimlik zorunluluğu bunu yapısal
 * olarak imkânsız kılıyor.
 */
export interface Indicator {
  /** Makine tarafı anahtar — çeviri ve gruplama için. */
  key: string;
  /** Ölçülen ham sayılar. Model bunları OKUR, üretmez. */
  facts: Record<string, string | number>;
  /** Bulguyu doğuran emirler. */
  orderIds: string[];
}

// ---------------------------------------------------------------------------
// 1. YIKAMA İŞLEMİ — sat, hemen geri al
// ---------------------------------------------------------------------------

/**
 * Fikir değiştirme penceresi: 60 dakika.
 *
 * ⚠️ SAYI KEYFİ DEĞİL, ANLAMA BAĞLI. Yıkama işleminin zararlı olmasının
 * sebebi fiyatın değişmemesi değil, KARARIN değişmemiş olması: aynı saat
 * içinde satıp geri almak "yeni bilgi geldi" değil "tereddüt" demek.
 *
 * Pencereyi bir güne çıkarsaydık, sabah satıp akşam haber üzerine geri
 * alan biri de yıkama sayılırdı — o meşru bir karar. Beş dakikaya
 * indirseydik gerçek tereddütlerin çoğunu kaçırırdık.
 */
export const WASH_WINDOW_MINUTES = 60;

/**
 * Aynı varlığı kısa sürede satıp geri alma.
 *
 * Ölçülen gerçek örnek (27 Ağu 2026): BNB 12:19'da satılmış, 12:21'de
 * geri alınmış. Fiyat farkı %0,04, ödenen komisyon 146,77 ₺. Yani üç
 * dakikalık fikir değişikliğinin bedeli 146 lira.
 *
 * ⚠️ TEK BİR TARAFA BAKMAK YETMEZ. "Çok satış yapıyor" ya da "çok alım
 * yapıyor" ayrı ayrı bir şey söylemiyor; zararlı olan İKİSİNİN ARDIŞIK
 * olması. Bu yüzden eşleştirme yapılıyor.
 */
export function detectWashTrades(orders: BehaviorOrder[]): Indicator | null {
  const sorted = [...orders].sort(
    (a, b) => a.executedAt.getTime() - b.executedAt.getTime(),
  );

  const windowMs = WASH_WINDOW_MINUTES * 60 * 1000;
  const matched: BehaviorOrder[] = [];
  let feeCents = 0n;

  for (let i = 0; i < sorted.length; i++) {
    const sell = sorted[i]!;
    if (sell.side !== 'sell') continue;

    for (let j = i + 1; j < sorted.length; j++) {
      const buy = sorted[j]!;

      // Sıralı liste: pencereyi aştıysak sonrakiler de aşar.
      if (buy.executedAt.getTime() - sell.executedAt.getTime() > windowMs) break;

      if (buy.side !== 'buy' || buy.symbol !== sell.symbol) continue;

      matched.push(sell, buy);
      feeCents += sell.feeCents + buy.feeCents;

      /*
        ⚠️ İLK EŞLEŞMEDEN SONRA DURULUYOR.

        Aynı satışı birden fazla alımla eşleştirseydik tek bir tereddüt
        birden çok bulgu üretirdi ve komisyon toplamı şişerdi. "Kaç kez
        fikir değiştirdi" sorusunun cevabı çift sayısı, üçlü sayısı değil.
      */
      break;
    }
  }

  if (matched.length === 0) return null;

  return {
    key: 'wash_trade',
    facts: {
      // Her bulgu bir sat+al çifti, o yüzden ikiye bölünüyor.
      count: matched.length / 2,
      feeCents: feeCents.toString(),
      windowMinutes: WASH_WINDOW_MINUTES,
    },
    orderIds: matched.map((o) => o.id),
  };
}

// ---------------------------------------------------------------------------
// 2. AŞIRI İŞLEM — komisyon erimesi
// ---------------------------------------------------------------------------

/**
 * Aşırı işlem eşiği: sermayenin binde 5'i.
 *
 * ⚠️ "GÜNDE KAÇ İŞLEM" DEĞİL, "KOMİSYONA NE KADAR GİTTİ" ÖLÇÜLÜYOR —
 * ve fark önemli.
 *
 * Günde 20 işlem yapıp her birinde büyük tutar döndüren biriyle günde 20
 * işlem yapıp bozuk para döndüren biri aynı değil. Kullanıcıya zarar
 * veren şey işlem SAYISI değil, o işlemlerin sermayesinden götürdüğü pay.
 *
 * Binde 5: komisyon oranı işlem başına binde 1 (FEE_BASIS_POINTS = 10).
 * Yani sermayenin binde 5'i, sermayenin tamamını ~5 kez döndürmüş olmak
 * demek. Bir simülasyon ligi için bu çok yüksek bir devir.
 */
export const OVERTRADING_FEE_RATIO_BPS = 50; // binde 5 = 50 baz puan

/**
 * Komisyonun sermayeye oranı.
 *
 * ⚠️ `startCapitalCents` PARAMETRE, SABİT DEĞİL. Şu an herkes 100.000 ₺
 * ile başlıyor ama günlük bonus da sermayeye ekleniyor; sabit yazsaydık
 * bonusu çok almış bir kullanıcı haksız yere "aşırı işlem" damgası
 * yerdi.
 */
export function detectOvertrading(
  orders: BehaviorOrder[],
  startCapitalCents: Penny,
): Indicator | null {
  if (orders.length === 0 || startCapitalCents <= 0n) return null;

  const feeCents = orders.reduce((sum, o) => sum + o.feeCents, 0n);

  /*
    ⚠️ ÖNCE ÇARP, SONRA BÖL — TERSİ SIFIR VERİR.

    `feeCents / startCapitalCents` bigint bölmesinde neredeyse her zaman
    0 çıkar (301 / 10.000.000 = 0). Önce 10.000 ile çarpıp sonra bölmek
    baz puan cinsinden anlamlı bir sayı veriyor.

    `divRound` kullanılıyor çünkü düz bigint bölmesi kırpıyor.
  */
  const feeRatioBps = divRound(feeCents * 10_000n, startCapitalCents);

  if (feeRatioBps < BigInt(OVERTRADING_FEE_RATIO_BPS)) return null;

  // Kaç ayrı günde işlem yapılmış — "yoğunluk" bilgisi anlatıya renk katıyor.
  const days = new Set(
    orders.map((o) => o.executedAt.toISOString().slice(0, 10)),
  ).size;

  return {
    key: 'overtrading',
    facts: {
      orderCount: orders.length,
      activeDays: days,
      feeCents: feeCents.toString(),
      feeRatioBps: feeRatioBps.toString(),
      thresholdBps: OVERTRADING_FEE_RATIO_BPS,
    },
    orderIds: orders.map((o) => o.id),
  };
}

// ---------------------------------------------------------------------------
// 3. YERLEŞİM ETKİSİ — kazananı erken sat, kaybedeni tut
// ---------------------------------------------------------------------------

/**
 * Bir satışın gerçekleşmiş sonucu.
 *
 * ⚠️ "GERÇEKLEŞMİŞ" KELİMESİ ÖNEMLİ. Elde tutulan zarar buraya girmiyor;
 * yalnızca SATILMIŞ pozisyonlar ölçülüyor. Sebebi aşağıda, `MIN_SELLS`
 * notunda.
 */
interface RealizedSell {
  orderId: string;
  symbol: string;
  /** Ele geçen net − satılan kısmın maliyeti. Negatif olabilir. */
  profitCents: Penny;
  /** Alımdan satışa geçen süre, milisaniye. */
  holdMs: bigint;
}

/**
 * Satış başına gerçekleşmiş kâr/zararı ve elde tutma süresini çıkarır.
 *
 * ⚠️ MALİYET KURALI BURADA YENİDEN YAZILMIYOR — `cost-basis.ts`'ten
 * çağrılıyor. Aynı hareketli ortalama, aynı `divRound`. Kopyalasaydık
 * portföy ekranı ile davranış raporu farklı kâr gösterebilirdi ve
 * hangisinin doğru olduğunu kimse bilemezdi.
 *
 * ⚠️ ALIŞ ZAMANI DA AĞIRLIKLI ORTALAMA — ÇÜNKÜ MALİYET ÖYLE.
 *
 * Hareketli ortalamada pozisyonun tek bir "alış tarihi" yok: 10:00'da 1
 * BTC, 14:00'te 3 BTC aldıysan pozisyon ne 10:00'a ne 14:00'e ait. Maliyeti
 * miktara göre harmanladığımız gibi zamanı da harmanlıyoruz:
 *
 *     yeniZaman = (eskiZaman × eskiMiktar + alışZamanı × alınanMiktar) / toplam
 *
 * İlk alışı seçseydik ekleme yapan kullanıcı gerçekte olduğundan çok daha
 * uzun tutuyor görünürdü; son alışı seçseydik tersi olurdu.
 *
 * Satış zamanı DEĞİŞTİRMİYOR: oransal azalma ortalamayı kaydırmaz — tıpkı
 * maliyette olduğu gibi.
 */
function walkRealizedSells(orders: BehaviorOrder[]): RealizedSell[] {
  const sorted = [...orders].sort(
    (a, b) => a.executedAt.getTime() - b.executedAt.getTime(),
  );

  /** Varlık başına: pozisyon + ağırlıklı ortalama alış anı (epoch ms). */
  const positions = new Map<string, { basis: CostBasis; avgBuyMs: bigint }>();
  const results: RealizedSell[] = [];

  for (const order of sorted) {
    const state = positions.get(order.symbol) ?? {
      basis: { quantity: 0n as Amount, costCents: 0n as Penny },
      avgBuyMs: 0n,
    };
    const executedMs = BigInt(order.executedAt.getTime());

    if (order.side === 'buy') {
      const total = state.basis.quantity + order.quantity;

      positions.set(order.symbol, {
        basis: applyBuy(state.basis, order.quantity, order.netCents),
        avgBuyMs:
          total === 0n
            ? executedMs
            : divRound(
                state.avgBuyMs * state.basis.quantity +
                  executedMs * order.quantity,
                total,
              ),
      });
      continue;
    }

    // --- SATIŞ ---

    // Elde hiç yoksa ölçülecek bir şey de yok. Emir motoru buna zaten izin
    // vermiyor; savunma amaçlı.
    if (state.basis.quantity === 0n) continue;

    const { position, costOfSoldCents } = applySell(
      state.basis,
      order.quantity,
    );

    results.push({
      orderId: order.id,
      symbol: order.symbol,
      profitCents: subPenny(order.netCents, costOfSoldCents),
      holdMs: executedMs - state.avgBuyMs,
    });

    /*
      Satıştan sonra ortalama alış anı OLDUĞU GİBİ kalıyor — sıfırlamaya
      gerek yok, ve sebebi ağırlıklı ortalamanın kendisinde:

      Pozisyon tamamen kapandığında `quantity` sıfır oluyor. Varlık sonra
      tekrar alınırsa formüldeki `eskiZaman × eskiMiktar` çarpanı sıfırla
      çarpılıyor, yani eski zaman ağırlığa hiç giremiyor. Ayrıca bir
      sıfırlama satırı yazmak, aslında hiçbir şey yapmayan ama okuyanı
      "demek ki gerekliymiş" diye düşündüren ölü kod olurdu.
    */
    positions.set(order.symbol, { basis: position, avgBuyMs: state.avgBuyMs });
  }

  return results;
}

/**
 * Her iki grupta da en az kaç satış olmalı.
 *
 * ⚠️ TEK BİR KÂRLI SATIŞTAN "ALIŞKANLIK" ÇIKARILMAZ. Bir kişi tek bir
 * kârlı satışı 5 dakikada, tek bir zararlı satışı 3 günde yapmış olabilir;
 * bu bir eğilim değil, iki olay. Eşik düşük tutuluyor (lig genç) ama sıfır
 * değil.
 */
export const DISPOSITION_MIN_SELLS = 2;

/**
 * Kaybedenler kazananlardan kaç kat uzun tutulunca bulgu sayılır.
 *
 * 15.000 baz puan = 1,5 kat. Yani zararlı pozisyonlar kârlılardan %50 daha
 * uzun tutuluyorsa eğilim var demek. Tam eşitlik beklemiyoruz — küçük
 * farklar rastlantı.
 */
export const DISPOSITION_RATIO_BPS = 15_000;

/**
 * Yerleşim etkisi (disposition effect): kazananı erken satıp kaybedeni tutmak.
 *
 * Davranışsal finansın en belgelenmiş yanılgısı. Mantığı şu: kâr etmiş bir
 * pozisyonu satmak "haklı çıktım" duygusu verir, zarardaki bir pozisyonu
 * satmak ise kaybı KESİNLEŞTİRİR. İnsan ikincisini ertelemeyi tercih eder —
 * oysa piyasa kimin neye ne kadar ödediğini bilmiyor.
 *
 * ⚠️ ÖLÇTÜĞÜMÜZ ŞEY KÂR/ZARAR MİKTARI DEĞİL, SÜRE.
 *
 * "Zararda çok para var" demek bir şey söylemez; kötü şans da olabilir.
 * Yanılgının imzası, aynı kişinin kârlı pozisyonu KISA, zararlı pozisyonu
 * UZUN tutması. Kişi kendi kendisiyle karşılaştırılıyor, başkasıyla değil.
 *
 * ⚠️ YALNIZCA GERÇEKLEŞMİŞ (satılmış) POZİSYONLARA BAKIYORUZ — ve bu
 * ölçümü OLDUĞUNDAN ZAYIF gösteriyor. Kullanıcının aylardır tuttuğu
 * zarardaki pozisyon hiç satılmadığı için hesaba girmiyor; yani yanılgı
 * güçlüyse bile bulgu daha ılımlı çıkar. Yanlış tarafa yanılmak: bulgu
 * verdiğimizde gerçekten vardır.
 */
export function detectDispositionEffect(
  orders: BehaviorOrder[],
): Indicator | null {
  const sells = walkRealizedSells(orders);

  const winners = sells.filter((s) => s.profitCents > 0n);
  const losers = sells.filter((s) => s.profitCents < 0n);

  // Tam başa baş satışlar (profit === 0) hiçbir gruba girmiyor: ne
  // "haklı çıkma" ne "kaybı kabullenme" duygusu var.

  if (
    winners.length < DISPOSITION_MIN_SELLS ||
    losers.length < DISPOSITION_MIN_SELLS
  ) {
    return null;
  }

  const winnerAvgMs = averageMs(winners);
  const loserAvgMs = averageMs(losers);

  // Kazananlar anlık satılmışsa (aynı milisaniye) oran tanımsız olurdu.
  if (winnerAvgMs <= 0n) return null;

  // ⚠️ ÖNCE ÇARP, SONRA BÖL — 2. göstergedeki tuzağın aynısı.
  const ratioBps = divRound(loserAvgMs * 10_000n, winnerAvgMs);

  if (ratioBps < BigInt(DISPOSITION_RATIO_BPS)) return null;

  return {
    key: 'disposition_effect',
    facts: {
      winnerCount: winners.length,
      loserCount: losers.length,
      winnerAvgHoldMinutes: divRound(winnerAvgMs, 60_000n).toString(),
      loserAvgHoldMinutes: divRound(loserAvgMs, 60_000n).toString(),
      ratioBps: ratioBps.toString(),
      thresholdBps: DISPOSITION_RATIO_BPS,
    },
    // Kanıt: hangi satışlar. Kazananlar önce — anlatı "bunları çabuk
    // sattın, şunları elde tuttun" sırasıyla kuruluyor.
    orderIds: [...winners, ...losers].map((s) => s.orderId),
  };
}

function averageMs(sells: RealizedSell[]): bigint {
  const total = sells.reduce((sum, s) => sum + s.holdMs, 0n);
  return divRound(total, BigInt(sells.length));
}

// ---------------------------------------------------------------------------
// 4. YOĞUNLAŞMA — yumurtaların tamamı tek sepette
// ---------------------------------------------------------------------------

/** Tek bir pozisyonun güncel değeri. */
export interface BehaviorPosition {
  symbol: string;
  /** Güncel piyasa değeri, kuruş. Fiyat çekilemediyse `null`. */
  valueCents: Penny | null;
}

/**
 * Yoğunlaşma eşiği: portföyün %60'ı.
 *
 * ⚠️ SAYI BİR TERCİH, VE İKİ YÖNE DE HATA YAPILABİLİR. %90 deseydik yalnızca
 * uç durumları görürdük; %30 deseydik üç varlığı olan herkes uyarı alırdı ve
 * uyarı değersizleşirdi. %60, "bu varlık kötü giderse portföyün geri kalanı
 * kurtaramaz" eşiği.
 */
export const CONCENTRATION_SHARE_BPS = 6_000; // %60

/**
 * Portföyün büyük bölümünün tek varlıkta toplanması.
 *
 * ⚠️ PAYDA NAKDİ DE İÇERİYOR — VE BU BİLİNÇLİ BİR KARAR.
 *
 * 90.000 ₺ nakit + 10.000 ₺ BTC tutan biri "yatırımlarının %100'ü BTC'de"
 * sayılabilirdi. Ama o kişi risk almıyor; BTC yarıya inse serveti %5
 * azalır. Ölçmek istediğimiz şey portföyün ne kadarının tek bir varlığın
 * hareketine bağlı olduğu — o yüzden payda toplam varlık: nakit + pozisyonlar.
 *
 * ⚠️ FİYATI ÇEKİLEMEYEN POZİSYON HESABA KATILMIYOR.
 *
 * `valueCents === null` olanı sıfır saymak paydayı küçültür ve kalan
 * varlığın payını OLDUĞUNDAN BÜYÜK gösterir — yani veri eksikliği uydurma
 * bir bulguya dönüşür. Böyle bir durumda hiç bulgu üretmemek doğrusu.
 */
export function detectConcentration(
  positions: BehaviorPosition[],
  cashCents: Penny,
  orders: BehaviorOrder[],
): Indicator | null {
  // Fiyatı bilinmeyen tek bir pozisyon bile varsa toplam güvenilmez.
  if (positions.some((p) => p.valueCents === null)) return null;

  const valued = positions as { symbol: string; valueCents: Penny }[];
  if (valued.length === 0) return null;

  const positionsValue = valued.reduce((sum, p) => sum + p.valueCents, 0n);
  const totalCents = positionsValue + cashCents;

  if (totalCents <= 0n) return null;

  const top = valued.reduce((a, b) => (b.valueCents > a.valueCents ? b : a));

  // ⚠️ Yine önce çarp sonra böl.
  const shareBps = divRound(top.valueCents * 10_000n, totalCents);

  if (shareBps < BigInt(CONCENTRATION_SHARE_BPS)) return null;

  return {
    key: 'concentration',
    facts: {
      symbol: top.symbol,
      shareBps: shareBps.toString(),
      valueCents: top.valueCents.toString(),
      totalCents: totalCents.toString(),
      positionCount: valued.length,
      thresholdBps: CONCENTRATION_SHARE_BPS,
    },
    /*
      Kanıt: o pozisyonu kuran emirler.

      ⚠️ Bu göstergenin dayanağı aslında ANLIK POZİSYON, emirler değil.
      Yine de emirleri bağlıyoruz çünkü `orderIds` sözleşmesi tüm
      göstergeler için geçerli: kullanıcı "neye dayanarak" diye
      sorduğunda dokunabileceği bir şey olmalı.
    */
    orderIds: orders.filter((o) => o.symbol === top.symbol).map((o) => o.id),
  };
}

// ---------------------------------------------------------------------------
// 5. FOMO ALIMI — yükselen trene atlamak
// ---------------------------------------------------------------------------

/**
 * Emrin, kendisinden önceki fiyat hareketiyle birlikte hâli.
 *
 * ⚠️ `priceBeforeTry` BU DOSYADA HESAPLANAMAZ — sorgudan gelmek zorunda.
 * `indicators.ts` veritabanına dokunmuyor; geçmiş fiyatı `repository.ts`
 * getirip buraya veriyor. `null` ise (varlığın o kadar eski verisi yok)
 * o emir ölçüme girmiyor.
 */
export interface BehaviorPricedOrder extends BehaviorOrder {
  priceBeforeTry: bigint | null;
}

/** Geriye bakış penceresi. */
export const PRICE_LOOKBACK_HOURS = 24;

/** "Sert yükseliş" sayılan eşik: %10. */
export const FOMO_RISE_BPS = 1_000;

/**
 * Bu davranışın alışkanlık sayılması için gereken en az alım sayısı.
 *
 * Bir kez yükselişten sonra almak tesadüf; sürekli yapmak yöntem.
 */
export const FOMO_MIN_COUNT = 3;

/** Alımların en az ne kadarı böyleyse eğilim sayılır: %40. */
export const FOMO_SHARE_BPS = 4_000;

/**
 * Sert yükselişin ARDINDAN alım yapma eğilimi.
 *
 * ⚠️ SONUCU DEĞİL KARARI ÖLÇÜYORUZ — VE BU AYRIM GÖSTERGENİN TAMAMI.
 *
 * "Aldıktan sonra düştü mü" diye baksaydık şansı ölçerdik: aynı karar bazen
 * kâr bazen zarar verir, ve sonuca göre yargılamak geri görüş yanılgısının
 * ta kendisi olurdu. Ölçtüğümüz şey kararın kendisi — fiyat çoktan
 * yükselmişken almak, tanımı gereği pahalıya almaktır; sonrasında ne olduğu
 * bunu değiştirmiyor.
 *
 * Aynı ilke 3. göstergede de var: orada da kâr miktarına değil süreye baktık.
 *
 * ⚠️ TEK ÖLÇÜT "KAÇ KEZ" DEĞİL, "ALIMLARIN NE KADARI".
 *
 * Çok işlem yapan birinin böyle üç alımı olması kaçınılmaz. Oran olmadan
 * gösterge aktif kullanıcıyı cezalandırırdı — 2. göstergedeki komisyon
 * oranıyla aynı gerekçe.
 */
export function detectFomoBuying(
  buys: BehaviorPricedOrder[],
): Indicator | null {
  // Geçmiş fiyatı bilinen alımlar — payda bu, tüm emirler değil.
  const measurable = buys.filter(
    (o) => o.side === 'buy' && o.priceBeforeTry !== null && o.priceBeforeTry > 0n,
  );

  if (measurable.length === 0) return null;

  const chasing: { order: BehaviorPricedOrder; riseBps: bigint }[] = [];

  for (const order of measurable) {
    const before = order.priceBeforeTry!;
    const riseBps = divRound((order.priceTry - before) * 10_000n, before);

    if (riseBps >= BigInt(FOMO_RISE_BPS)) chasing.push({ order, riseBps });
  }

  if (chasing.length < FOMO_MIN_COUNT) return null;

  const shareBps = divRound(
    BigInt(chasing.length) * 10_000n,
    BigInt(measurable.length),
  );

  if (shareBps < BigInt(FOMO_SHARE_BPS)) return null;

  const avgRiseBps = divRound(
    chasing.reduce((sum, c) => sum + c.riseBps, 0n),
    BigInt(chasing.length),
  );

  return {
    key: 'fomo_buying',
    facts: {
      chasingCount: chasing.length,
      measuredBuyCount: measurable.length,
      shareBps: shareBps.toString(),
      avgRiseBps: avgRiseBps.toString(),
      lookbackHours: PRICE_LOOKBACK_HOURS,
      riseThresholdBps: FOMO_RISE_BPS,
      shareThresholdBps: FOMO_SHARE_BPS,
    },
    orderIds: chasing.map((c) => c.order.id),
  };
}

// ---------------------------------------------------------------------------
// 6. PANİK SATIŞI — düşüşte kapıya koşmak
// ---------------------------------------------------------------------------

/** "Sert düşüş" sayılan eşik: %10. Pozitif yazılıyor, düşüş miktarı olarak. */
export const PANIC_DROP_BPS = 1_000;

/** Alışkanlık sayılması için gereken en az satış sayısı. */
export const PANIC_MIN_COUNT = 3;

/** Satışların en az ne kadarı böyleyse eğilim sayılır: %40. */
export const PANIC_SHARE_BPS = 4_000;

/**
 * Sert düşüşün ARDINDAN, zararına satış.
 *
 * 5. göstergenin aynadaki hâli: orada yükselişte alıyordu, burada düşüşte
 * satıyor. İkisi birlikte "yüksekten al, düşükten sat" döngüsünü tarif
 * ediyor — kaybettiren en klasik döngü.
 *
 * ⚠️ ZARARINA OLMASI ŞART — VE BU KOŞUL BİR ŞEYİ AYIRT ETMEK İÇİN.
 *
 * Sert düşüşten sonra KÂRLA satmak panik değil, kâr korumak: %40 kazanmış
 * bir pozisyon %10 gerileyince satılırsa bu kazancı masada bırakmama
 * kararıdır. Zararına satış ise farklı: düşüş kaybı kesinleştirecek kadar
 * ilerlemişken, düşüşün kendisi satış sebebi oluyor.
 *
 * ⚠️ DİSİPLİNLİ ZARAR KESME (stop-loss) BU ÖLÇÜMDE PANİKLE AYNI GÖRÜNÜR —
 * VE BU BİLİNEN BİR SINIR.
 *
 * "Zararım %10'u geçerse çıkarım" diye önceden karar vermiş biri de tam
 * olarak bu deseni üretir, ve o iyi bir risk yönetimidir. Elimizdeki
 * veriyle niyeti göremiyoruz — emirde "neden" alanı boş, plan yok.
 *
 * Sonuç kodda değil ANLATIDA: modele giden metin bunu suçlama değil
 * gözlem olarak kurmak zorunda ("düşüşlerde satış yapmışsın" — "panikledin"
 * değil). Ölçemediğin şeyi iddia etmemek bu modülün tamamının kuralı.
 */
export function detectPanicSelling(
  orders: BehaviorPricedOrder[],
): Indicator | null {
  // Hangi satışlar zararla kapandı — 3. göstergenin yürüyüşü yeniden
  // kullanılıyor, maliyet kuralı üçüncü kez yazılmıyor.
  const lossSellIds = new Set(
    walkRealizedSells(orders)
      .filter((s) => s.profitCents < 0n)
      .map((s) => s.orderId),
  );

  const measurable = orders.filter(
    (o) =>
      o.side === 'sell' && o.priceBeforeTry !== null && o.priceBeforeTry > 0n,
  );

  if (measurable.length === 0) return null;

  const panicked: { order: BehaviorPricedOrder; dropBps: bigint }[] = [];

  for (const order of measurable) {
    const before = order.priceBeforeTry!;

    // Düşüş pozitif çıksın diye çıkarma ters yönde.
    const dropBps = divRound((before - order.priceTry) * 10_000n, before);

    if (dropBps >= BigInt(PANIC_DROP_BPS) && lossSellIds.has(order.id)) {
      panicked.push({ order, dropBps });
    }
  }

  if (panicked.length < PANIC_MIN_COUNT) return null;

  const shareBps = divRound(
    BigInt(panicked.length) * 10_000n,
    BigInt(measurable.length),
  );

  if (shareBps < BigInt(PANIC_SHARE_BPS)) return null;

  const avgDropBps = divRound(
    panicked.reduce((sum, p) => sum + p.dropBps, 0n),
    BigInt(panicked.length),
  );

  return {
    key: 'panic_selling',
    facts: {
      panicCount: panicked.length,
      measuredSellCount: measurable.length,
      shareBps: shareBps.toString(),
      avgDropBps: avgDropBps.toString(),
      lookbackHours: PRICE_LOOKBACK_HOURS,
      dropThresholdBps: PANIC_DROP_BPS,
      shareThresholdBps: PANIC_SHARE_BPS,
    },
    orderIds: panicked.map((p) => p.order.id),
  };
}

// ---------------------------------------------------------------------------
// 7. ORTALAMA DÜŞÜRME — zarardaki pozisyona eklemek
// ---------------------------------------------------------------------------

/** Alışkanlık sayılması için gereken en az ekleme sayısı. */
export const AVERAGING_DOWN_MIN_COUNT = 3;

/**
 * Eklemelerin en az ne kadarı zarardayken yapılmışsa eğilim sayılır: %75.
 *
 * ⚠️ EŞİK ÖTEKİLERDEN YÜKSEK (%40 değil %75) — VE SEBEBİ BU GÖSTERGENİN
 * TEMEL SORUNU.
 *
 * Ortalama düşürmek kendi başına yanlış DEĞİL: planlı kademeli alım (maliyet
 * ortalaması / DCA) tam olarak aynı işlemleri üretir ve yaygın kabul gören
 * bir yöntemdir. İkisini ayıran şey niyet, ve niyet veride yok.
 *
 * Ayırt edebildiğimiz tek şey TUTARLILIK: planlı alım yapan kişi fiyat
 * yukarıdayken de ekler — planı takvime bağlıdır, fiyata değil. Yanılgı
 * hâlindeki kişi ise YALNIZCA düşerken ekler, çünkü ekleme sebebi başa baş
 * noktasını aşağı çekmektir.
 *
 * Yüksek eşik bunu yakalıyor: eklemelerinin dörtte üçü zarardayken olan biri
 * artık "bazen düşüşte de alıyorum" değil, "sadece düşüşte alıyorum".
 */
export const AVERAGING_DOWN_SHARE_BPS = 7_500;

/**
 * Zarardaki pozisyona ekleme eğilimi.
 *
 * ⚠️ "ZARARDA" ÖLÇÜSÜ: ALIŞ FİYATI < ORTALAMA MALİYET.
 *
 * Emrin kendi fiyatı zaten o anki piyasa fiyatı — dışarıdan geçmiş veri
 * çekmeye gerek yok (5 ve 6'nın aksine). Ortalama maliyet ise defterden
 * geliyor, yine `cost-basis.ts`'in kuralıyla.
 *
 * ⚠️ İLK ALIM EKLEME DEĞİLDİR. Elde pozisyon yokken alım yapmak sıradan bir
 * giriş; karşılaştırılacak bir maliyet de yok. Yalnızca MEVCUT pozisyona
 * yapılan eklemeler sayılıyor.
 */
export function detectAveragingDown(orders: BehaviorOrder[]): Indicator | null {
  const sorted = [...orders].sort(
    (a, b) => a.executedAt.getTime() - b.executedAt.getTime(),
  );

  const positions = new Map<string, CostBasis>();
  const downAdds: BehaviorOrder[] = [];
  let addCount = 0;
  /** Bir öncekinden BÜYÜK zarar eklemesi — "katlayarak gitme" imzası. */
  let escalatingCount = 0;
  const lastDownAddCents = new Map<string, Penny>();

  for (const order of sorted) {
    const basis = positions.get(order.symbol) ?? {
      quantity: 0n as Amount,
      costCents: 0n as Penny,
    };

    if (order.side === 'sell') {
      positions.set(order.symbol, applySell(basis, order.quantity).position);
      continue;
    }

    // Elde bir şey varsa bu bir EKLEME; yoksa sıradan giriş.
    if (basis.quantity > 0n) {
      addCount++;

      /*
        Ortalama maliyetin birim fiyat karşılığı.

        Ölçek: kuruş (1e2) → fiyat (1e8). `calcGross`'un tersi:
        gross = fiyat × miktar / 1e16  ⟹  fiyat = kuruş × 1e16 / miktar
      */
      const avgCostPrice = divRound(
        basis.costCents * 10n ** 16n,
        basis.quantity,
      );

      if (order.priceTry < avgCostPrice) {
        downAdds.push(order);

        const previous = lastDownAddCents.get(order.symbol);
        if (previous !== undefined && order.netCents > previous) {
          escalatingCount++;
        }
        lastDownAddCents.set(order.symbol, order.netCents);
      }
    }

    positions.set(
      order.symbol,
      applyBuy(basis, order.quantity, order.netCents),
    );
  }

  if (downAdds.length < AVERAGING_DOWN_MIN_COUNT || addCount === 0) return null;

  const shareBps = divRound(
    BigInt(downAdds.length) * 10_000n,
    BigInt(addCount),
  );

  if (shareBps < BigInt(AVERAGING_DOWN_SHARE_BPS)) return null;

  return {
    key: 'averaging_down',
    facts: {
      downAddCount: downAdds.length,
      totalAddCount: addCount,
      shareBps: shareBps.toString(),
      /*
        Eşiğe girmiyor, anlatıya giriyor.

        ⚠️ Eşiğe koysaydık, her seferinde AYNI tutarla zarara ekleyen
        kişiyi kaçırırdık — o da aynı yanılgı, sadece daha sakin hâli.
        Büyüyen tutar yanılgının şiddetini gösterir, varlığını değil.
      */
      escalatingCount,
      thresholdBps: AVERAGING_DOWN_SHARE_BPS,
    },
    orderIds: downAdds.map((o) => o.id),
  };
}
