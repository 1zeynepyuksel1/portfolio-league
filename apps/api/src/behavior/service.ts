/**
 * service.ts — göstergeleri çalıştırır, sıralar, anlatıya çevirir.
 *
 * ⚠️ İKİ PARÇA VAR VE AYRI DURMALARI BİLİNÇLİ:
 *
 *   buildReport()       saf — veritabanı yok, testi Docker istemiyor
 *   getBehaviorReport() sorguları çeker, buildReport'u çağırır
 *
 * `indicators.ts` ile aynı gerekçe. Önceliklendirme ve metin üretimi
 * karar içeriyor; karar test edilebilir olmalı.
 *
 * ⚠️ METİNLER BURADA ÜRETİLİYOR — YAPAY ZEKÂ OLMADAN DA.
 *
 * Gemini katmanı bunun ÜSTÜNE binecek, yerine değil. Sebebi: model çağrısı
 * ağ üzerinden gidiyor ve başarısız olabilir — kota biter, anahtar süresi
 * dolar, Google kesintiye girer. O anda ekranın boş kalması kabul edilemez.
 * Şablon metin her zaman dolu; model onu güzelleştiriyor.
 */

import {
  detectAveragingDown,
  detectConcentration,
  detectDispositionEffect,
  detectFomoBuying,
  detectOvertrading,
  detectPanicSelling,
  detectWashTrades,
  type BehaviorPosition,
  type BehaviorPricedOrder,
  type Indicator,
} from './indicators.js';
import { getBehaviorOrders } from './repository.js';
import { getRecentOrders } from '../portfolio/repository.js';
import type { BehaviorPortfolio, BehaviorTrade, ChatContext } from './chat.js';
import { divRound, formatTRY, type Penny } from '../lib/money.js';
import { getPortfolio } from '../portfolio/service.js';
import { getDepositedCents } from '../portfolio/repository.js';

/**
 * Analiz için gereken en az emir sayısı.
 *
 * ⚠️ BU EŞİK BİR DÜRÜSTLÜK ÖNLEMİ.
 *
 * Tek emir vermiş bir kullanıcının portföyünün %100'ü tek varlıkta olur —
 * matematiksel olarak doğru ama ALIŞKANLIK değil, tek bir işlemin
 * kaçınılmaz sonucu. "Yumurtaların hepsi tek sepette" demek onu yanıltır.
 *
 * Beş emrin altında hiçbir desen tekrar sayılmaz; o yüzden hiçbir iddia
 * üretmiyoruz. Az veriyle konuşmak, yanlış konuşmanın en kolay yolu.
 */
export const MIN_ORDERS_FOR_ANALYSIS = 5;

/** Kullanıcıya aynı anda en fazla kaç bulgu gösterilir. */
export const MAX_REPORTED_FINDINGS = 3;

/**
 * Önem sırası — küçük sayı önce gelir.
 *
 * ⚠️ SIRALAMA KODDA, MODELDE DEĞİL. Yedi bulgu birden çıkarsa hepsini
 * kullanıcının yüzüne çarpmak işe yaramaz; hangisinin daha önemli olduğuna
 * kesin bir kural karar vermeli. Modele sorsaydık her çağrıda farklı
 * cevap gelirdi ve neden öyle sıralandığını kimse açıklayamazdı.
 *
 * Sıranın mantığı: ÖDENMİŞ PARA > GERÇEKLEŞMİŞ ZARAR > KARAR DESENİ > DURUM.
 *
 *   1-2 Komisyon doğrudan cepten çıktı, tartışmaya kapalı.
 *   3   Panik satışı zararı kesinleştirdi — olmuş bitmiş.
 *   4-6 Karar desenleri: zarar henüz kesin değil, eğilim var.
 *   7   Yoğunlaşma bir DURUM, davranış değil; en zayıf iddia, en sonda.
 */
const PRIORITY: Record<string, number> = {
  overtrading: 1,
  wash_trade: 2,
  panic_selling: 3,
  disposition_effect: 4,
  averaging_down: 5,
  fomo_buying: 6,
  concentration: 7,
};

export interface BehaviorFinding {
  key: string;
  /** Kısa başlık — ekranda kartın üstü. */
  title: string;
  /** Şablon metin. Gemini bunu yeniden yazacak, silmeyecek. */
  message: string;
  facts: Record<string, string | number>;
  orderIds: string[];
}

export interface BehaviorReport {
  orderCount: number;
  /** `false` ise `findings` boş döner — sebebi `MIN_ORDERS_FOR_ANALYSIS`. */
  hasEnoughData: boolean;
  findings: BehaviorFinding[];
}

/**
 * Ham veriden rapor üretir. Saf fonksiyon.
 *
 * `startCapitalCents` kullanıcıya dışarıdan giren toplam para (kayıt
 * bonusu + günlük bonuslar). Sabit 100.000 yazsaydık bonusu çok almış
 * kullanıcı haksız yere "aşırı işlem" damgası yerdi.
 */
export function buildReport(
  orders: BehaviorPricedOrder[],
  positions: BehaviorPosition[],
  cashCents: Penny,
  startCapitalCents: Penny,
): BehaviorReport {
  if (orders.length < MIN_ORDERS_FOR_ANALYSIS) {
    return { orderCount: orders.length, hasEnoughData: false, findings: [] };
  }

  const found = [
    detectOvertrading(orders, startCapitalCents),
    detectWashTrades(orders),
    detectPanicSelling(orders),
    detectDispositionEffect(orders),
    detectAveragingDown(orders),
    detectFomoBuying(orders),
    detectConcentration(positions, cashCents, orders),
  ].filter((i): i is Indicator => i !== null);

  const findings = found
    .sort((a, b) => (PRIORITY[a.key] ?? 99) - (PRIORITY[b.key] ?? 99))
    .slice(0, MAX_REPORTED_FINDINGS)
    .map(toFinding);

  return { orderCount: orders.length, hasEnoughData: true, findings };
}

/** Uç için: sorguları çeker, raporu kurar. */
export async function getBehaviorReport(
  userId: string,
): Promise<BehaviorReport> {
  // Üçü birbirine bağlı değil -> paralel. Sırayla `await` etseydik üç
  // gidiş-dönüş süresi toplanırdı. Aynı desen portfolio/service.ts'te de var.
  const [orders, portfolio, depositedCents] = await Promise.all([
    getBehaviorOrders(userId),
    getPortfolio(userId),
    getDepositedCents(userId),
  ]);

  /*
    ⚠️ POZİSYONLAR PORTFÖY SERVİSİNDEN GELİYOR, YENİ SORGUDAN DEĞİL.

    Yoğunlaşma göstergesi "portföyün %X'i" diyor; o yüzde, kullanıcının
    Cüzdan ekranında gördüğü sayıyla AYNI olmak zorunda. Ayrı bir sorgu
    yazsaydık iki ekran bir gün farklı yüzde gösterirdi ve hangisinin
    doğru olduğunu kimse bilemezdi.
  */
  const positions: BehaviorPosition[] = portfolio.positions.map((p) => ({
    symbol: p.symbol,
    valueCents: p.valueCents,
  }));

  return buildReport(
    orders,
    positions,
    portfolio.cashCents,
    depositedCents as Penny,
  );
}

// ---------------------------------------------------------------------------
// ŞABLON METİNLER
// ---------------------------------------------------------------------------

/**
 * Baz puanı yüzde metnine çevirir: "7000" -> "%70".
 *
 * ⚠️ `Number()` KULLANILIYOR VE BURADA SERBEST — ama sınırı bilmek gerek.
 * Baz puan bir ORAN, para değil; en fazla birkaç bin, güvenli tam sayı
 * aralığının çok altında. Kuruş değerleri asla böyle çevrilmiyor,
 * onlar `formatTRY`'den geçiyor.
 */
function bpsToPercent(bps: string | number): string {
  return `%${Math.round(Number(bps) / 100)}`;
}

/** Kuruş metnini para biçimine sokar: "14677" -> "146,77 ₺" */
function cents(value: string | number): string {
  return formatTRY(BigInt(value) as Penny);
}

/**
 * Bir ölçümü `facts` içinden zorunlu olarak okur.
 *
 * ⚠️ EKSİK ANAHTAR SESSİZCE GEÇMEMELİ — VE TYPESCRIPT BUNU YAKALADI.
 *
 * `facts` tipi `Record<string, string | number>`; indeksle okumak
 * `undefined` de dönebilir. Doğrudan şablona koysaydık ekranda
 * "undefined işlemde 0 komisyon" gibi bir cümle çıkardı ve kimse
 * fark etmezdi — metin dolu görünür, sayı yanlış olur.
 *
 * Bir göstergenin sözünü verdiği ölçümü göndermemesi PROGRAM HATASI.
 * Fırlatmak doğrusu: uç 500 döner, log'a düşer, ertesi gün görülür.
 * Alternatifi (tire basmak) hatayı gizlerdi.
 */
function fact(indicator: Indicator, key: string): string | number {
  const value = indicator.facts[key];

  if (value === undefined) {
    throw new Error(
      `behavior: "${indicator.key}" göstergesi "${key}" ölçümünü döndürmedi`,
    );
  }

  return value;
}

/**
 * Göstergeyi ekrana çıkacak hâline çevirir.
 *
 * ⚠️ METİNLER SUÇLAMIYOR, GÖZLEM BİLDİRİYOR — ve bu bir tasarım kararı.
 *
 * "Panikledin" diyemeyiz çünkü niyeti ölçmedik: disiplinli zarar kesme bu
 * veride panikle tıpatıp aynı görünüyor (bkz. `detectPanicSelling`).
 * Ölçtüğümüz şey ne ise onu söylüyoruz. Aynı kural Gemini'ye giden
 * yönergede de tekrarlanacak.
 */
function toFinding(indicator: Indicator): BehaviorFinding {
  /** Kısa ad — aşağıdaki metinler okunur kalsın diye. */
  const f = (key: string): string | number => fact(indicator, key);

  switch (indicator.key) {
    case 'overtrading':
      return build(
        indicator,
        'Komisyon eriyor',
        `${f('orderCount')} işlemde ${cents(f('feeCents'))} komisyon ödedin — ` +
          `sermayenin ${bpsToPercent(f('feeRatioBps'))}'i. ` +
          `Bu tutar ${f('activeDays')} günde birikti.`,
      );

    case 'wash_trade':
      return build(
        indicator,
        'Sat, hemen geri al',
        `${f('count')} kez bir varlığı sattıktan sonra ${f('windowMinutes')} ` +
          `dakika içinde geri aldın. Bu gidiş-dönüşlerin komisyonu ` +
          `${cents(f('feeCents'))}.`,
      );

    case 'panic_selling':
      return build(
        indicator,
        'Düşüşte satış',
        `Zararına kapattığın ${f('panicCount')} satışın öncesinde fiyat ` +
          `24 saatte ortalama ${bpsToPercent(f('avgDropBps'))} düşmüştü. ` +
          `Ölçülen ${f('measuredSellCount')} satışın ` +
          `${bpsToPercent(f('shareBps'))}'i böyle.`,
      );

    case 'disposition_effect':
      return build(
        indicator,
        'Kazananı çabuk, kaybedeni geç sattın',
        `Kârlı ${f('winnerCount')} pozisyonu ortalama ` +
          `${f('winnerAvgHoldMinutes')} dakika, zararlı ${f('loserCount')} ` +
          `pozisyonu ${f('loserAvgHoldMinutes')} dakika tuttun.`,
      );

    case 'averaging_down':
      return build(
        indicator,
        'Düşerken ekleme',
        `Mevcut pozisyonlarına yaptığın ${f('totalAddCount')} eklemenin ` +
          `${f('downAddCount')} tanesi, o varlık ortalama maliyetinin ` +
          `altındayken oldu (${bpsToPercent(f('shareBps'))}).`,
      );

    case 'fomo_buying':
      return build(
        indicator,
        'Yükselişin ardından alım',
        `Ölçülen ${f('measuredBuyCount')} alımın ${f('chasingCount')} ` +
          `tanesinde fiyat son 24 saatte ortalama ` +
          `${bpsToPercent(f('avgRiseBps'))} yükselmişti.`,
      );

    case 'concentration':
      return build(
        indicator,
        'Tek varlıkta yoğunlaşma',
        `Portföyünün ${bpsToPercent(f('shareBps'))}'i ${f('symbol')} içinde ` +
          `(${cents(f('valueCents'))}). Nakit dahil toplam ` +
          `${cents(f('totalCents'))}.`,
      );

    default:
      /*
        ⚠️ Yeni bir gösterge eklenip metni yazılmazsa BURASI ÇALIŞIR ve
        anahtarı ham hâliyle gösterir. Sessizce düşürmüyoruz: eksik metin
        gözden kaçmalı, bulgu değil.
      */
      return build(indicator, indicator.key, 'Bu bulgu için metin yazılmamış.');
  }
}

function build(
  indicator: Indicator,
  title: string,
  message: string,
): BehaviorFinding {
  return {
    key: indicator.key,
    title,
    message,
    facts: indicator.facts,
    orderIds: indicator.orderIds,
  };
}

// ---------------------------------------------------------------------------
// SOHBET BAĞLAMI
// ---------------------------------------------------------------------------

/**
 * Sohbette modele gösterilecek son işlem sayısı.
 *
 * ⚠️ SINIR HEM MALİYET HEM DOĞRULUK. Geçmiş her mesajda yeniden
 * gönderiliyor; uzadıkça hem token faturası büyüyor hem de modelin uzun
 * bağlamda kuralları kaçırma ihtimali artıyor. Son işlemler zaten en
 * ilgili olanlar — kullanıcı "geçen ay ne yapmıştım" diye sormuyor,
 * "şu an ne yapıyorum" diye soruyor.
 */
const CHAT_TRADE_LIMIT = 20;

/**
 * Sohbetin ihtiyaç duyduğu her şeyi toplar: bulgular + portföy + işlemler.
 *
 * ⚠️ BU FONKSİYON `getBehaviorReport`'TAN AYRI — ve olmalı da.
 *
 * Kart ucu (`GET /me/behavior`) portföyü YALNIZCA yoğunlaşma göstergesi
 * için okuyor ve işlem geçmişine hiç bakmıyor. Sohbet ise ikisini de
 * istiyor. Tek fonksiyonda birleştirseydik kartlar da her açılışta
 * gereksiz sorgu yapardı — oysa oranın en hızlı gelmesi gereken uç o.
 */
export async function getChatContext(userId: string): Promise<ChatContext> {
  const [report, portfolio, orders] = await Promise.all([
    getBehaviorReport(userId),
    getPortfolio(userId),
    getRecentOrders(userId, CHAT_TRADE_LIMIT),
  ]);

  /*
    ⚠️ NAKİT PAYI BURADA HESAPLANIYOR, MODELDE DEĞİL.

    "Portföyünün ne kadarı nakit" bir bölme işlemi ve modele
    yaptırılmaz: yanlış hesaplarsa fark edilmez. Pozisyon payları zaten
    `calculate.ts`'te kesin aritmetikle hesaplanmış halde geliyor;
    nakit payını da aynı yerden türetiyoruz.
  */
  const toplam = portfolio.totalValueCents;
  const nakitPay =
    toplam > 0n
      ? formatHundredths(divRound(portfolio.cashCents * 10_000n, toplam))
      : null;

  const behaviorPortfolio: BehaviorPortfolio = {
    cashSharePercent: nakitPay,
    positions: portfolio.positions.map((p) => ({
      symbol: p.symbol,
      sharePercent: p.sharePercent,
      profitPercent: p.profitPercent,
    })),
  };

  const trades: BehaviorTrade[] = orders
    /*
      ⚠️ ÇARK ÖDÜLLERİ ELENİYOR — çünkü bunlar KARAR DEĞİL.

      `getRecentOrders` günlük bonusları da listeye katıyor (Cüzdan
      ekranında doğru davranış: bakiye değişimi orada görünmeli). Ama
      sohbet bağlamında model onları "kullanıcı çark aldı" diye bir
      tercih sanır ve üzerine yorum yapar.

      ⚠️ Sembol metnine bağlı bir filtre ve bu kırılgan: Zeynep sembolü
      değiştirirse burası sessizce bozulur. Alternatifi `cash_movements`
      için ayrı bir sorgu yazmaktı; bir satırlık filtre için iki sorgu
      döndürmek doğru gelmedi. Bozulursa belirtisi görünür olur —
      sohbette "ÇARK" adında bir varlık belirir.
    */
    .filter((o) => o.symbol !== 'ÇARK')
    .map((o) => ({
    // Saat değil GÜN: modelin işine yarayan şey "hangi gün", ve saat
    // eklemek metni uzatıp bir şey katmıyor.
    date: o.executedAt.toISOString().slice(0, 10),
    symbol: o.symbol,
    side: o.side,
      note: o.note,
    }));

  return { findings: report.findings, portfolio: behaviorPortfolio, trades };
}

/** 1234n -> "12.34" — `cost-basis.ts`'teki `formatHundredths` ile aynı kural. */
function formatHundredths(value: bigint): string {
  const negatif = value < 0n;
  const abs = negatif ? -value : value;
  const tam = abs / 100n;
  const kesir = (abs % 100n).toString().padStart(2, '0');
  return `${negatif ? '-' : ''}${tam}.${kesir}`;
}
